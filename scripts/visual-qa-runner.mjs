// @ts-check
/* global process, setTimeout, clearTimeout, fetch, AbortController */
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  isEnvSecretPath,
  normalizeForCompare,
  REPO_ROOT,
  toPosix,
} from "../.agents/scripts/guard-paths.js";

/**
 * @typedef {{ scriptPath: string, host: "127.0.0.1" | "localhost", port: number, timeoutMs: number, readyTimeoutMs: number, readyPath: string, help: boolean }} RunnerCliOptions
 * @typedef {{ path: string, existed: boolean, bytes: Buffer | null }} FileSnapshot
 * @typedef {(cmd: string, args: string[], opts: import("node:child_process").SpawnOptions) => import("node:child_process").ChildProcess} SpawnFn
 * @typedef {{ on: (ev: string, fn: () => void) => unknown, off: (ev: string, fn: () => void) => unknown }} SignalProc
 * @typedef {{ repoRoot?: string, artifactRoot?: string, nextEnvPath?: string, nextBin?: string, nodeBin?: string, serverArgs?: string[], baseEnv?: Record<string, string | undefined>, platform?: NodeJS.Platform, qaStdio?: import("node:child_process").StdioOptions, pollIntervalMs?: number, spawn?: SpawnFn, proc?: SignalProc, stderr?: { write: (s: string) => unknown }, assertPortAvailable?: typeof assertPortAvailable, waitForServerReady?: typeof waitForServerReady, killProcessTree?: (c: unknown) => void, fetchFn?: typeof fetch, realpathSync?: (p: string) => string, statSync?: typeof fs.statSync }} RunnerDeps
 */

const ARTIFACT_ROOT = path.join(os.homedir(), ".gemini", "antigravity", "brain");
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_EXTS = new Set([".js", ".mjs", ".cjs"]);
const USAGE =
  "Usage: node scripts/visual-qa-runner.mjs --script <path> [--host 127.0.0.1|localhost] [--port 3100] [--timeout-ms 120000] [--ready-timeout-ms 60000] [--ready-path /]";
const STATIC_E2E_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-e2e-service-key",
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079",
  UPSTASH_REDIS_REST_TOKEN: "dummy-redis-token",
  AUTH_SECRET: "dummy-auth-secret-for-e2e-testing-32-chars-minimum",
  NEXTAUTH_SECRET: "dummy-auth-secret-for-e2e-testing-32-chars-minimum",
  AUTH_TRUST_HOST: "true",
  GOOGLE_CLIENT_ID: "dummy-google-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "dummy-google-client-secret",
  GEMINI_API_KEY: "dummy-gemini-key-for-e2e",
  DATA_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  OPENROUTER_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  DEEPSEEK_API_KEY: "",
  WHITELIST_EMAILS: "",
  ATTACHMENTS_CRON_SECRET: "dummy-cron-secret",
  NEXT_TELEMETRY_DISABLED: "1",
};
/** @type {Record<string, [number, number, "port" | "timeoutMs" | "readyTimeoutMs"]>} */
const INT_FLAGS = {
  "--port": [1024, 65535, "port"],
  "--timeout-ms": [1000, 600_000, "timeoutMs"],
  "--ready-timeout-ms": [500, 600_000, "readyTimeoutMs"],
};

/** @param {() => unknown} fn */
const safeRun = (fn) => {
  try {
    fn();
  } catch {
    /* best-effort cleanup */
  }
};
/** @param {string} s */
const hasCtrl = (s) => [...s].some((ch) => ch.charCodeAt(0) < 32);

/** @param {string} rawPath */
export function canonicalizeWindowsPath(rawPath) {
  if (typeof rawPath !== "string") return "";
  return rawPath.replace(/^([a-z]):([\\/]|$)/, (_, d, tail) => `${d.toUpperCase()}:${tail}`);
}

/** @param {RunnerCliOptions} opts @param {string} flag @param {string} val */
function applyCliFlag(opts, flag, val) {
  if (flag === "--script") {
    if (!val.trim()) return "Missing value for --script.";
    opts.scriptPath = val;
    return null;
  }
  if (flag === "--host") {
    if (!ALLOWED_HOSTS.has(val)) return `Host must be loopback (127.0.0.1 or localhost): ${val}`;
    opts.host = /** @type {"127.0.0.1" | "localhost"} */ (val);
    return null;
  }
  if (flag === "--ready-path") {
    if (!val.startsWith("/") || val.startsWith("//") || /\s/.test(val) || hasCtrl(val)) {
      return `Invalid --ready-path: ${val}`;
    }
    opts.readyPath = val;
    return null;
  }
  const spec = INT_FLAGS[flag];
  if (!spec) return `Unknown argument: ${flag}`;
  const n = /^\d+$/.test(val) ? Number(val) : NaN;
  if (!Number.isSafeInteger(n) || n < spec[0] || n > spec[1]) {
    return `${flag} must be between ${spec[0]} and ${spec[1]}.`;
  }
  opts[spec[2]] = n;
  return null;
}

/** @param {string[]} argv @returns {{ ok: true, options: RunnerCliOptions } | { ok: false, reason: string }} */
export function parseCliArgs(argv) {
  /** @type {RunnerCliOptions} */
  const opts = {
    scriptPath: "",
    host: "127.0.0.1",
    port: 3100,
    timeoutMs: 120_000,
    readyTimeoutMs: 60_000,
    readyPath: "/",
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "--help" || tok === "-h") return { ok: true, options: { ...opts, help: true } };
    if (!tok.startsWith("--")) return { ok: false, reason: `Unexpected argument: ${tok}` };
    const eq = tok.indexOf("=");
    const flag = eq === -1 ? tok : tok.slice(0, eq);
    const val = eq === -1 ? argv[++i] : tok.slice(eq + 1);
    if (typeof val !== "string") return { ok: false, reason: `Missing value for ${flag}.` };
    const err = applyCliFlag(opts, flag, val);
    if (err) return { ok: false, reason: err };
  }
  if (!opts.scriptPath) return { ok: false, reason: "Missing required --script <path> argument." };
  if (opts.readyTimeoutMs > opts.timeoutMs) {
    return { ok: false, reason: "--ready-timeout-ms must not exceed --timeout-ms." };
  }
  return { ok: true, options: opts };
}

/** @param {string} p @param {(v: string) => string} rp */
const safeRealpath = (p, rp) => {
  try {
    return canonicalizeWindowsPath(rp(p));
  } catch {
    return null;
  }
};

/** @param {string} p @param {string} label */
function checkSecretAndExt(p, label) {
  if (isEnvSecretPath(p)) return `${label} cannot target .env* secret files.`;
  if (!ALLOWED_EXTS.has(path.posix.extname(toPosix(p)).toLowerCase())) {
    return `${label} extension must be .js, .mjs, or .cjs.`;
  }
  return null;
}

/** @param {string} realPath @param {string} repoRoot @param {string | null} artRoot @param {NodeJS.Platform} platform */
function isInsideAllowedRoots(realPath, repoRoot, artRoot, platform) {
  const cmp = (/** @type {string} */ v) =>
    (platform === "win32" ? normalizeForCompare(v) : toPosix(v).trim()).replace(/\/+$/, "");
  const target = cmp(realPath);
  const repo = cmp(repoRoot);
  if (target.startsWith(`${repo}/tests/`) || target.startsWith(`${repo}/scripts/`)) return true;
  if (!artRoot) return false;
  const art = `${cmp(artRoot)}/`;
  return target.startsWith(art) && /^[^/]+\/scratch\/.+/.test(target.slice(art.length));
}

/** @param {string} rawScriptPath @param {{ repoRoot?: string, artifactRoot?: string, realpathSync?: (p: string) => string, statSync?: typeof fs.statSync, platform?: NodeJS.Platform }} [opts] @returns {{ ok: true, resolvedPath: string } | { ok: false, reason: string }} */
export function validateScriptPath(rawScriptPath, opts = {}) {
  const s = typeof rawScriptPath === "string" ? rawScriptPath.trim() : "";
  if (!s || hasCtrl(s)) return { ok: false, reason: "Empty path or control chars." };
  const norm = toPosix(s);
  if (norm.split("/").includes("..")) return { ok: false, reason: "Traversal forbidden." };
  const pre = checkSecretAndExt(norm, "Script path");
  if (pre) return { ok: false, reason: pre };
  const repoRoot = canonicalizeWindowsPath(path.resolve(opts.repoRoot ?? REPO_ROOT));
  const rp = opts.realpathSync ?? fs.realpathSync;
  const cand = path.isAbsolute(norm) ? path.resolve(norm) : path.resolve(repoRoot, norm);
  let stat;
  try {
    stat = (opts.statSync ?? fs.statSync)(cand);
  } catch {
    return { ok: false, reason: `Script file does not exist: ${s}` };
  }
  if (!stat.isFile()) return { ok: false, reason: `Not a regular file: ${s}` };
  const real = safeRealpath(cand, rp);
  if (!real) return { ok: false, reason: `Unable to resolve realpath: ${s}` };
  const post = checkSecretAndExt(real, "Resolved script path");
  if (post) return { ok: false, reason: post };
  const realRepo = safeRealpath(repoRoot, rp) ?? repoRoot;
  const realArt = safeRealpath(opts.artifactRoot ?? ARTIFACT_ROOT, rp);
  if (!isInsideAllowedRoots(real, realRepo, realArt, opts.platform ?? process.platform)) {
    return { ok: false, reason: "Outside allowed roots (tests/, scripts/, scratch/) or symlink." };
  }
  return { ok: true, resolvedPath: real };
}

/** @param {Record<string, string | undefined>} baseEnv @param {string} [host] @param {number} [port] @returns {NodeJS.ProcessEnv} */
export const buildSafeNextDevEnv = (baseEnv, host = "127.0.0.1", port = 3100) => {
  const url = `http://${host}:${port}`;
  return /** @type {NodeJS.ProcessEnv} */ (
    /** @type {unknown} */ ({
      ...baseEnv,
      ...STATIC_E2E_ENV,
      PORT: String(port),
      NEXTAUTH_URL: url,
      AUTH_URL: url,
    })
  );
};

/** @param {Record<string, string | undefined>} baseEnv @param {{ repoRoot?: string, host?: string, port?: number }} [cfg] @returns {NodeJS.ProcessEnv} */
export function buildQaChildEnv(baseEnv, cfg = {}) {
  const repoRoot = canonicalizeWindowsPath(path.resolve(cfg.repoRoot ?? REPO_ROOT));
  const url = `http://${cfg.host ?? "127.0.0.1"}:${cfg.port ?? 3100}`;
  const mods = path.join(repoRoot, "node_modules");
  const prev = typeof baseEnv?.NODE_PATH === "string" && baseEnv.NODE_PATH ? baseEnv.NODE_PATH : "";
  return /** @type {NodeJS.ProcessEnv} */ (
    /** @type {unknown} */ ({
      ...baseEnv,
      BASE_URL: url,
      VISUAL_QA_BASE_URL: url,
      VISUAL_QA_PORT: String(cfg.port ?? 3100),
      VISUAL_QA_REPO_ROOT: repoRoot,
      NODE_PATH: prev ? `${mods}${path.delimiter}${prev}` : mods,
      VISUAL_QA_WORKSPACE_PKG: path.join(repoRoot, "package.json"),
      VISUAL_QA_PLAYWRIGHT_ENTRY: pathToFileURL(path.join(mods, "@playwright", "test", "index.mjs"))
        .href,
    })
  );
}

/** @param {string} filePath @returns {FileSnapshot} */
export const snapshotFile = (filePath) =>
  fs.existsSync(filePath)
    ? { path: filePath, existed: true, bytes: fs.readFileSync(filePath) }
    : { path: filePath, existed: false, bytes: null };

/** @param {FileSnapshot} snap @returns {boolean} */
export function restoreFileIfChanged(snap) {
  if (!snap.existed) {
    if (!fs.existsSync(snap.path)) return false;
    fs.unlinkSync(snap.path);
    return true;
  }
  if (!snap.bytes) return false;
  if (fs.existsSync(snap.path) && fs.readFileSync(snap.path).equals(snap.bytes)) return false;
  fs.writeFileSync(snap.path, snap.bytes);
  return true;
}

/** @param {string} host @param {number} port */
export const assertPortAvailable = (host, port) =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", (/** @type {NodeJS.ErrnoException} */ err) =>
      reject(new Error(`Port ${host}:${port} is already in use (${err.code ?? err.message}).`))
    );
    probe.listen({ host, port, exclusive: true }, () => probe.close(() => resolve(undefined)));
  });

/** @param {{ pid?: number, kill?: (sig?: NodeJS.Signals | number) => boolean } | null | undefined} child @param {{ platform?: NodeJS.Platform, spawnSync?: typeof spawnSync, processKill?: typeof process.kill, systemRoot?: string }} [deps] */
export function killProcessTree(child, deps = {}) {
  const pid = child?.pid;
  if (!pid || !Number.isInteger(pid) || pid <= 0) return;
  if ((deps.platform ?? process.platform) === "win32") {
    const exe = path.win32.join(
      deps.systemRoot ?? process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "taskkill.exe"
    );
    safeRun(() =>
      (deps.spawnSync ?? spawnSync)(exe, ["/F", "/T", "/PID", String(pid)], {
        stdio: "ignore",
        windowsHide: true,
        shell: false,
        timeout: 10_000,
      })
    );
  } else {
    safeRun(() => (deps.processKill ?? process.kill)(-pid, "SIGKILL"));
  }
  safeRun(() => child?.kill?.("SIGKILL"));
}

/** @param {number} ms @param {AbortSignal | undefined} signal */
const sleepWithAbort = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("WAIT_ABORTED"));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("WAIT_ABORTED"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(undefined);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/** @param {{ url: string, readyTimeoutMs?: number, pollIntervalMs?: number, serverState?: { exited: boolean, exitCode: number | null, signal?: string | null }, signal?: AbortSignal, fetchFn?: typeof fetch }} params */
export async function waitForServerReady(params) {
  const readyTimeoutMs = params.readyTimeoutMs ?? 60_000;
  const pollMs = params.pollIntervalMs ?? 250;
  const fetchFn = params.fetchFn ?? fetch;
  const deadline = Date.now() + readyTimeoutMs;
  const checkAlive = () => {
    if (params.signal?.aborted) throw new Error("WAIT_ABORTED");
    if (params.serverState?.exited) {
      throw new Error(
        `Dev server exited early (code: ${params.serverState.exitCode ?? "unknown"}).`
      );
    }
  };
  while (Date.now() < deadline) {
    checkAlive();
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    params.signal?.addEventListener("abort", onAbort, { once: true });
    const t = setTimeout(() => ctrl.abort(), Math.min(2000, Math.max(50, deadline - Date.now())));
    try {
      const res = await fetchFn(params.url, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
      });
      res.body?.cancel?.().catch(() => undefined);
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      if (params.signal?.aborted) throw new Error("WAIT_ABORTED");
    } finally {
      clearTimeout(t);
      params.signal?.removeEventListener("abort", onAbort);
    }
    checkAlive();
    const rem = deadline - Date.now();
    if (rem > 0) await sleepWithAbort(Math.min(pollMs, rem), params.signal);
  }
  throw new Error(`SERVER_READY_TIMEOUT: ${params.url} did not respond in ${readyTimeoutMs}ms.`);
}

/** @param {import("node:child_process").ChildProcess} child @param {AbortSignal} signal */
const waitForChildExit = (child, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return resolve(124);
    const done = () => {
      signal.removeEventListener("abort", onAbort);
      child.off("exit", onExit);
      child.off("error", onErr);
    };
    const onAbort = () => {
      done();
      resolve(124);
    };
    /** @param {number | null} code */
    const onExit = (code) => {
      done();
      resolve(typeof code === "number" ? code : 1);
    };
    /** @param {Error} err */
    const onErr = (err) => {
      done();
      reject(err);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    child.once("exit", onExit);
    child.once("error", onErr);
  });

/** @param {{ timeoutMs: number, proc: SignalProc, stderr: { write: (s: string) => unknown }, getChildren: () => { qa: unknown, server: unknown }, nextEnvSnapshot: FileSnapshot, killTree: (c: unknown) => void }} cfg */
function createLifecycleGuard(cfg) {
  const runAbort = new AbortController();
  /** @type {number | null} */
  let forcedCode = null;
  let cleaned = false;
  const onSigint = () => trigger(130, "Visual QA aborted by SIGINT.\n");
  const onSigterm = () => trigger(143, "Visual QA aborted by SIGTERM.\n");
  const timer = setTimeout(
    () => trigger(124, `Visual QA hard watchdog timeout (${cfg.timeoutMs}ms).\n`),
    cfg.timeoutMs
  );
  const cleanupOnce = () => {
    if (cleaned) return;
    cleaned = true;
    safeRun(() => clearTimeout(timer));
    safeRun(() => cfg.proc.off("SIGINT", onSigint));
    safeRun(() => cfg.proc.off("SIGTERM", onSigterm));
    const { qa, server } = cfg.getChildren();
    safeRun(() => cfg.killTree(qa));
    safeRun(() => cfg.killTree(server));
    safeRun(() => restoreFileIfChanged(cfg.nextEnvSnapshot));
  };
  /** @param {number} code @param {string} msg */
  function trigger(code, msg) {
    if (forcedCode === null) forcedCode = code;
    safeRun(() => cfg.stderr.write(msg));
    runAbort.abort();
    cleanupOnce();
  }
  cfg.proc.on("SIGINT", onSigint);
  cfg.proc.on("SIGTERM", onSigterm);
  return { signal: runAbort.signal, getForcedCode: () => forcedCode, cleanupOnce };
}

/** @param {RunnerDeps} deps @param {string} cwd @param {NodeJS.Platform} platform @param {string[]} args @param {NodeJS.ProcessEnv} env @param {import("node:child_process").StdioOptions} stdio */
const spawnManaged = (deps, cwd, platform, args, env, stdio) =>
  (deps.spawn ?? /** @type {SpawnFn} */ (spawn))(deps.nodeBin ?? process.execPath, args, {
    cwd,
    env,
    stdio,
    windowsHide: true,
    shell: false,
    detached: platform !== "win32",
  });

/** @param {RunnerCliOptions} options @param {RunnerDeps} deps @param {string} repoRoot @param {NodeJS.Platform} platform */
function startDevServer(options, deps, repoRoot, platform) {
  const nextBin = canonicalizeWindowsPath(
    deps.nextBin ?? path.join(repoRoot, "node_modules", "next", "dist", "bin", "next")
  );
  const args = deps.serverArgs ?? [nextBin, "dev", "-H", options.host, "-p", String(options.port)];
  const env = buildSafeNextDevEnv(deps.baseEnv ?? process.env, options.host, options.port);
  const child = spawnManaged(deps, repoRoot, platform, args, env, "ignore");
  child.unref?.();
  const state = { exited: false, exitCode: /** @type {number | null} */ (null) };
  child.once("exit", (c) => {
    state.exited = true;
    state.exitCode = c;
  });
  child.once("error", () => {
    state.exited = true;
  });
  return { child, state };
}

/** @param {RunnerCliOptions} options @param {string} resolvedScript @param {RunnerDeps} deps @param {string} repoRoot @param {NodeJS.Platform} platform @param {FileSnapshot} nextEnvSnapshot @param {{ write: (s: string) => unknown }} stderr */
async function executeQaLifecycle(
  options,
  resolvedScript,
  deps,
  repoRoot,
  platform,
  nextEnvSnapshot,
  stderr
) {
  /** @type {import("node:child_process").ChildProcess | null} */
  let serverChild = null;
  /** @type {import("node:child_process").ChildProcess | null} */
  let qaChild = null;
  const killTree =
    deps.killProcessTree ??
    ((c) =>
      killProcessTree(/** @type {import("node:child_process").ChildProcess} */ (c), { platform }));
  const guard = createLifecycleGuard({
    timeoutMs: options.timeoutMs,
    proc: deps.proc ?? process,
    stderr,
    getChildren: () => ({ qa: qaChild, server: serverChild }),
    nextEnvSnapshot,
    killTree,
  });
  try {
    const srv = startDevServer(options, deps, repoRoot, platform);
    serverChild = srv.child;
    await (deps.waitForServerReady ?? waitForServerReady)({
      url: `http://${options.host}:${options.port}${options.readyPath}`,
      readyTimeoutMs: options.readyTimeoutMs,
      pollIntervalMs: deps.pollIntervalMs,
      serverState: srv.state,
      signal: guard.signal,
      fetchFn: deps.fetchFn,
    });
    if (guard.getForcedCode() !== null) return /** @type {number} */ (guard.getForcedCode());
    const qaEnv = buildQaChildEnv(deps.baseEnv ?? process.env, {
      repoRoot,
      host: options.host,
      port: options.port,
    });
    const qa = spawnManaged(
      deps,
      repoRoot,
      platform,
      [resolvedScript],
      qaEnv,
      deps.qaStdio ?? ["ignore", "inherit", "inherit"]
    );
    qaChild = qa;
    return guard.getForcedCode() ?? (await waitForChildExit(qa, guard.signal));
  } catch (err) {
    if (guard.getForcedCode() !== null) return /** @type {number} */ (guard.getForcedCode());
    stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  } finally {
    guard.cleanupOnce();
  }
}

/** @param {RunnerCliOptions} options @param {RunnerDeps} [deps] @returns {Promise<number>} */
export async function runVisualQa(options, deps = {}) {
  const stderr = deps.stderr ?? process.stderr;
  const repoRoot = canonicalizeWindowsPath(path.resolve(deps.repoRoot ?? REPO_ROOT));
  const platform = deps.platform ?? process.platform;
  const check = validateScriptPath(options.scriptPath, {
    repoRoot,
    artifactRoot: deps.artifactRoot,
    realpathSync: deps.realpathSync,
    statSync: deps.statSync,
    platform,
  });
  if (!check.ok) {
    stderr.write(`${check.reason}\n`);
    return 2;
  }
  const nextEnvSnapshot = snapshotFile(deps.nextEnvPath ?? path.join(repoRoot, "next-env.d.ts"));
  try {
    await (deps.assertPortAvailable ?? assertPortAvailable)(options.host, options.port);
  } catch (err) {
    stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
  return executeQaLifecycle(
    options,
    check.resolvedPath,
    deps,
    repoRoot,
    platform,
    nextEnvSnapshot,
    stderr
  );
}

/** @param {string | undefined} metaUrl @param {string | undefined} argv1 @param {NodeJS.Platform} [platform] */
export function isMainModule(metaUrl, argv1, platform = process.platform) {
  if (typeof metaUrl !== "string" || !metaUrl || typeof argv1 !== "string" || !argv1) {
    return false;
  }
  const isWin = platform === "win32";
  if (!isWin && /^[A-Za-z]:[\\/]/.test(argv1)) return false;
  const resolved = (isWin ? path.win32 : path.posix).resolve(argv1);
  if (isWin) {
    if (!/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(resolved)) return false;
  } else if (!resolved.startsWith("/")) {
    return false;
  }
  const normalized = isWin ? canonicalizeWindowsPath(resolved) : resolved;
  try {
    const expected = pathToFileURL(normalized, { windows: isWin }).href;
    return isWin ? metaUrl.toLowerCase() === expected.toLowerCase() : metaUrl === expected;
  } catch {
    return false;
  }
}

/** @param {string[]} [argv] */
export async function runCli(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.reason}\n${USAGE}\n`);
    process.exit(2);
  }
  if (parsed.options.help) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(0);
  }
  process.exit(await runVisualQa(parsed.options));
}

if (isMainModule(import.meta.url, process.argv[1])) {
  runCli().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
