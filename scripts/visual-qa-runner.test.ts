// @vitest-environment node
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertPortAvailable,
  buildQaChildEnv,
  buildSafeNextDevEnv,
  canonicalizeWindowsPath,
  isMainModule,
  killProcessTree,
  parseCliArgs,
  restoreFileIfChanged,
  runVisualQa,
  snapshotFile,
  validateScriptPath,
  waitForServerReady,
} from "./visual-qa-runner.mjs";

const RUNNER_ABS = path.resolve(process.cwd(), "scripts", "visual-qa-runner.mjs");

async function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close(() => reject(new Error("Failed to resolve ephemeral port.")));
        return;
      }
      const { port } = addr;
      srv.close(() => resolve(port));
    });
  });
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidDead(pid: number, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !isPidAlive(pid);
}

function tryCreateDirLink(targetDir: string, linkPath: string): boolean {
  try {
    fs.symlinkSync(targetDir, linkPath, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    // Windows AppContainer sandboxes may block FSCTL_SET_REPARSE_POINT with EPERM;
    // POSIX/Linux CI (ubuntu-latest) must never hit EPERM and rethrows any error.
    if (process.platform === "win32" && code === "EPERM") return false;
    throw err;
  }
}

function createFakeChild(
  pid: number
): ChildProcess & { unrefMock: ReturnType<typeof vi.fn>; killMock: ReturnType<typeof vi.fn> } {
  const ee = new EventEmitter();
  const unrefMock = vi.fn();
  const killMock = vi.fn(() => true);
  return Object.assign(ee, {
    pid,
    unref: unrefMock,
    kill: killMock,
    unrefMock,
    killMock,
  }) as unknown as ChildProcess & {
    unrefMock: ReturnType<typeof vi.fn>;
    killMock: ReturnType<typeof vi.fn>;
  };
}

describe("scripts/visual-qa-runner.mjs (VQ-01..VQ-15)", () => {
  let tmpBase = "";
  let tmpRepo = "";
  let tmpArtifact = "";
  let tmpOutside = "";

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "visual-qa-runner-"));
    tmpRepo = path.join(tmpBase, "repo");
    tmpArtifact = path.join(tmpBase, "brain");
    tmpOutside = path.join(tmpBase, "outside");

    fs.mkdirSync(path.join(tmpRepo, "tests", "e2e"), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, "scripts-evil"), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, "src"), { recursive: true });
    fs.mkdirSync(path.join(tmpArtifact, "conv-1", "scratch"), { recursive: true });
    fs.mkdirSync(tmpOutside, { recursive: true });

    fs.writeFileSync(path.join(tmpRepo, "tests", "e2e", "smoke.js"), "console.error('ok');\n");
    fs.writeFileSync(path.join(tmpRepo, "scripts", "check.mjs"), "console.error('ok');\n");
    fs.writeFileSync(
      path.join(tmpArtifact, "conv-1", "scratch", "qa.cjs"),
      "console.error('ok');\n"
    );
    fs.writeFileSync(path.join(tmpArtifact, "conv-1", "no-scratch.js"), "console.error('no');\n");
    fs.writeFileSync(path.join(tmpRepo, "scripts-evil", "a.js"), "console.error('no');\n");
    fs.writeFileSync(path.join(tmpRepo, "src", "a.js"), "console.error('no');\n");
    fs.writeFileSync(path.join(tmpRepo, "tests", "bad.ps1"), "Write-Host 1\n");
    fs.writeFileSync(path.join(tmpRepo, "tests", "bad.bat"), "echo 1\n");
    fs.writeFileSync(path.join(tmpRepo, "tests", "bad.json"), "{}\n");
    fs.writeFileSync(path.join(tmpRepo, "tests", ".env.js"), "secret\n");
    fs.writeFileSync(path.join(tmpRepo, ".env.local"), "SECRET=1\n");
    fs.writeFileSync(path.join(tmpOutside, "escape.js"), "console.error('escaped');\n");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (tmpBase && fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("VQ-01: canonicalizeWindowsPath uppercases Windows drive letters and preserves POSIX paths", () => {
    expect(canonicalizeWindowsPath("c:\\Users\\wyemh\\vikini")).toBe("C:\\Users\\wyemh\\vikini");
    expect(canonicalizeWindowsPath("d:/projects/app")).toBe("D:/projects/app");
    expect(canonicalizeWindowsPath("C:\\Users\\wyemh\\vikini")).toBe("C:\\Users\\wyemh\\vikini");
    expect(canonicalizeWindowsPath("/home/runner/vikini")).toBe("/home/runner/vikini");
    expect(canonicalizeWindowsPath("relative/path.js")).toBe("relative/path.js");
  });

  it("VQ-02: parseCliArgs parses defaults, explicit flags, --flag=value syntax, and --help", () => {
    const def = parseCliArgs(["--script", "tests/e2e/smoke.js"]);
    expect(def).toEqual({
      ok: true,
      options: {
        scriptPath: "tests/e2e/smoke.js",
        host: "127.0.0.1",
        port: 3100,
        timeoutMs: 120_000,
        readyTimeoutMs: 60_000,
        readyPath: "/",
        help: false,
      },
    });

    const custom = parseCliArgs([
      "--script=scripts/check.mjs",
      "--host",
      "localhost",
      "--port=3105",
      "--timeout-ms",
      "150000",
      "--ready-timeout-ms=45000",
      "--ready-path",
      "/chat",
    ]);
    expect(custom).toEqual({
      ok: true,
      options: {
        scriptPath: "scripts/check.mjs",
        host: "localhost",
        port: 3105,
        timeoutMs: 150_000,
        readyTimeoutMs: 45_000,
        readyPath: "/chat",
        help: false,
      },
    });

    const helpRes = parseCliArgs(["--help"]);
    expect(helpRes.ok).toBe(true);
    if (helpRes.ok) expect(helpRes.options.help).toBe(true);
  });

  it("VQ-03: parseCliArgs rejects missing --script, unknown flags, non-loopback hosts, and out-of-range values", () => {
    const cases: string[][] = [
      [],
      ["--script", "tests/a.js", "--evil", "1"],
      ["--script", "tests/a.js", "--host", "0.0.0.0"],
      ["--script", "tests/a.js", "--port", "80"],
      ["--script", "tests/a.js", "--port", "70000"],
      ["--script", "tests/a.js", "--port", "abc"],
      ["--script", "tests/a.js", "--timeout-ms", "500"],
      ["--script", "tests/a.js", "--timeout-ms", "700000"],
      ["--script", "tests/a.js", "--ready-timeout-ms", "200000", "--timeout-ms", "60000"],
      ["--script", "tests/a.js", "--ready-path", "http://evil"],
      ["--script", "tests/a.js", "--ready-path", "//evil"],
      ["positional.js"],
    ];
    for (const argv of cases) {
      const res = parseCliArgs(argv);
      expect(res.ok, JSON.stringify(argv)).toBe(false);
      if (!res.ok) expect(res.reason.length, JSON.stringify(argv)).toBeGreaterThan(0);
    }
  });

  it("VQ-04: validateScriptPath allows real .js/.mjs/.cjs scripts inside tests/, scripts/, and artifact scratch/", () => {
    const posixSmoke = validateScriptPath("tests/e2e/smoke.js", {
      repoRoot: tmpRepo,
      artifactRoot: tmpArtifact,
    });
    expect(posixSmoke).toEqual({
      ok: true,
      resolvedPath: canonicalizeWindowsPath(
        fs.realpathSync(path.join(tmpRepo, "tests", "e2e", "smoke.js"))
      ),
    });

    const winSepScript = validateScriptPath(["scripts", "check.mjs"].join("\\"), {
      repoRoot: tmpRepo,
      artifactRoot: tmpArtifact,
    });
    expect(winSepScript).toEqual({
      ok: true,
      resolvedPath: canonicalizeWindowsPath(
        fs.realpathSync(path.join(tmpRepo, "scripts", "check.mjs"))
      ),
    });

    const scratchScript = validateScriptPath(
      path.join(tmpArtifact, "conv-1", "scratch", "qa.cjs"),
      { repoRoot: tmpRepo, artifactRoot: tmpArtifact }
    );
    expect(scratchScript).toEqual({
      ok: true,
      resolvedPath: canonicalizeWindowsPath(
        fs.realpathSync(path.join(tmpArtifact, "conv-1", "scratch", "qa.cjs"))
      ),
    });

    // Clean CI environment where artifactRoot does not exist must still allow repo scripts.
    const missingArtifactRoot = validateScriptPath("tests/e2e/smoke.js", {
      repoRoot: tmpRepo,
      artifactRoot: path.join(tmpBase, "nonexistent-brain"),
    });
    expect(missingArtifactRoot.ok).toBe(true);
  });

  it("VQ-05 (NP-3): validateScriptPath rejects .env*, traversal, disallowed roots/extensions, directory junction escape, and post-realpath symlink targets", () => {
    const opts = { repoRoot: tmpRepo, artifactRoot: tmpArtifact };

    const invalidTargets: Array<{ input: string; match: RegExp }> = [
      { input: ".env", match: /\.env/i },
      { input: ".env.local", match: /\.env/i },
      { input: "tests/.env.js", match: /\.env/i },
      { input: "../outside.js", match: /traversal/i },
      { input: "tests/../../outside.js", match: /traversal/i },
      { input: path.join(tmpRepo, "scripts-evil", "a.js"), match: /allowed roots/i },
      { input: path.join(tmpRepo, "src", "a.js"), match: /allowed roots/i },
      { input: path.join(tmpArtifact, "conv-1", "no-scratch.js"), match: /allowed roots/i },
      { input: "tests/bad.bat", match: /extension/i },
      { input: "tests/bad.ps1", match: /extension/i },
      { input: "tests/bad.json", match: /extension/i },
      { input: "tests/missing.js", match: /does not exist/i },
      { input: "tests/e2e", match: /extension|regular file/i },
      { input: "tests/e2e/smoke.js\u0000", match: /control/i },
    ];

    for (const { input, match } of invalidTargets) {
      const res = validateScriptPath(input, opts);
      expect(res.ok, input).toBe(false);
      if (!res.ok) expect(res.reason, input).toMatch(match);
    }

    // Real directory junction (win32) / dir symlink (POSIX) escaping outside repoRoot.
    const junctionDir = path.join(tmpRepo, "tests", "linked-outside");
    if (tryCreateDirLink(tmpOutside, junctionDir)) {
      const junctionRes = validateScriptPath("tests/linked-outside/escape.js", opts);
      expect(junctionRes.ok).toBe(false);
      if (!junctionRes.ok) expect(junctionRes.reason).toMatch(/allowed roots|symlink/i);
    }

    // Unconditional DI realpathSync probes for directory/file symlinks resolving outside repoRoot, to .env.local, or .txt.
    const smokeFile = path.join(tmpRepo, "tests", "e2e", "smoke.js");
    const outsideEscape = validateScriptPath(smokeFile, {
      ...opts,
      realpathSync: (p) =>
        p === path.resolve(smokeFile) ? path.join(tmpOutside, "escape.js") : fs.realpathSync(p),
    });
    expect(outsideEscape.ok).toBe(false);
    if (!outsideEscape.ok) expect(outsideEscape.reason).toMatch(/allowed roots|symlink/i);

    const envSymlink = validateScriptPath(smokeFile, {
      ...opts,
      realpathSync: (p) =>
        p === path.resolve(smokeFile) ? path.join(tmpRepo, ".env.local") : fs.realpathSync(p),
    });
    expect(envSymlink.ok).toBe(false);
    if (!envSymlink.ok) expect(envSymlink.reason).toMatch(/\.env/i);

    const txtSymlink = validateScriptPath(smokeFile, {
      ...opts,
      realpathSync: (p) =>
        p === path.resolve(smokeFile)
          ? path.join(tmpRepo, "tests", "real.txt")
          : fs.realpathSync(p),
    });
    expect(txtSymlink.ok).toBe(false);
    if (!txtSymlink.ok) expect(txtSymlink.reason).toMatch(/extension/i);
  });

  it("VQ-06: buildSafeNextDevEnv isolates all 20 E2E vars + telemetry and buildQaChildEnv injects CJS/ESM Playwright helpers", () => {
    const prodEnv: Record<string, string | undefined> = {
      SUPABASE_SERVICE_ROLE_KEY: "real-prod-key",
      GEMINI_API_KEY: "real-gemini-key",
      ANTHROPIC_API_KEY: "real-anthropic-key",
      NODE_PATH: "/existing/modules",
    };

    const devEnv = buildSafeNextDevEnv(prodEnv, "127.0.0.1", 3105);
    expect(devEnv).toMatchObject({
      PORT: "3105",
      NEXTAUTH_URL: "http://127.0.0.1:3105",
      AUTH_URL: "http://127.0.0.1:3105",
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
    });

    const qaEnv = buildQaChildEnv(prodEnv, { repoRoot: tmpRepo, host: "localhost", port: 3105 });
    const canonicalRepo = canonicalizeWindowsPath(path.resolve(tmpRepo));
    const expectedModules = path.join(canonicalRepo, "node_modules");
    expect(qaEnv.BASE_URL).toBe("http://localhost:3105");
    expect(qaEnv.VISUAL_QA_BASE_URL).toBe("http://localhost:3105");
    expect(qaEnv.VISUAL_QA_PORT).toBe("3105");
    expect(qaEnv.VISUAL_QA_REPO_ROOT).toBe(canonicalRepo);
    expect(qaEnv.NODE_PATH).toBe(`${expectedModules}${path.delimiter}/existing/modules`);
    expect(qaEnv.VISUAL_QA_WORKSPACE_PKG).toBe(path.join(canonicalRepo, "package.json"));
    expect(qaEnv.VISUAL_QA_PLAYWRIGHT_ENTRY).toBe(
      pathToFileURL(path.join(expectedModules, "@playwright", "test", "index.mjs")).href
    );
  });

  it("VQ-07: snapshotFile & restoreFileIfChanged handle unchanged, modified, deleted, and newly created files without git", () => {
    const trackedPath = path.join(tmpRepo, "next-env.d.ts");
    const originalBytes = Buffer.from('/// <reference types="next" />\r\n', "utf8");
    fs.writeFileSync(trackedPath, originalBytes);
    const snap = snapshotFile(trackedPath);
    const mtimeBefore = fs.statSync(trackedPath).mtimeMs;

    // (a) Unchanged -> no write, mtime preserved
    expect(restoreFileIfChanged(snap)).toBe(false);
    expect(fs.statSync(trackedPath).mtimeMs).toBe(mtimeBefore);

    // (b) Modified -> byte-exact restore
    fs.writeFileSync(trackedPath, "mutated content\n");
    expect(restoreFileIfChanged(snap)).toBe(true);
    expect(fs.readFileSync(trackedPath).equals(originalBytes)).toBe(true);

    // (c) Deleted -> byte-exact recreate
    fs.unlinkSync(trackedPath);
    expect(restoreFileIfChanged(snap)).toBe(true);
    expect(fs.readFileSync(trackedPath).equals(originalBytes)).toBe(true);

    // (d) Absent initially, then created -> deleted on restore
    const absentPath = path.join(tmpRepo, "new-next-env.d.ts");
    const absentSnap = snapshotFile(absentPath);
    expect(absentSnap.existed).toBe(false);
    expect(restoreFileIfChanged(absentSnap)).toBe(false);
    fs.writeFileSync(absentPath, "created by dev");
    expect(restoreFileIfChanged(absentSnap)).toBe(true);
    expect(fs.existsSync(absentPath)).toBe(false);
  });

  it("VQ-08 (NP-4): assertPortAvailable rejects an occupied loopback port and resolves once free", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) =>
      server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => resolve())
    );
    const addr = server.address();
    expect(addr && typeof addr !== "string").toBe(true);
    const port = (addr as net.AddressInfo).port;

    try {
      await expect(assertPortAvailable("127.0.0.1", port)).rejects.toThrow(/already in use/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    await expect(assertPortAvailable("127.0.0.1", port)).resolves.toBeUndefined();
  });

  it("VQ-09: killProcessTree uses System32\\taskkill.exe on win32, negative PGID on linux, and never throws", () => {
    const winChild = createFakeChild(4242);
    const mockSpawnSync = vi.fn(() => ({ status: 0 }));
    killProcessTree(winChild, {
      platform: "win32",
      systemRoot: "C:\\Windows",
      spawnSync: mockSpawnSync as unknown as typeof spawnSync,
    });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      path.join("C:\\Windows", "System32", "taskkill.exe"),
      ["/F", "/T", "/PID", "4242"],
      { stdio: "ignore", windowsHide: true, shell: false, timeout: 10_000 }
    );
    expect(winChild.killMock).toHaveBeenCalledWith("SIGKILL");

    const linuxChild = createFakeChild(5151);
    const mockProcessKill = vi.fn(() => true);
    killProcessTree(linuxChild, {
      platform: "linux",
      processKill: mockProcessKill as unknown as typeof process.kill,
    });
    expect(mockProcessKill).toHaveBeenCalledWith(-5151, "SIGKILL");
    expect(linuxChild.killMock).toHaveBeenCalledWith("SIGKILL");

    // Idempotent when ESRCH / child already gone
    const throwingKill = vi.fn(() => {
      throw new Error("ESRCH");
    });
    expect(() =>
      killProcessTree(linuxChild, {
        platform: "linux",
        processKill: throwingKill as unknown as typeof process.kill,
      })
    ).not.toThrow();
    expect(() => killProcessTree(null)).not.toThrow();
    expect(() => killProcessTree({ pid: -1 })).not.toThrow();
  });

  it("VQ-10: waitForServerReady retries ECONNREFUSED, passes redirect: manual, fails early on server exit, times out, and honors AbortSignal", async () => {
    // (a) 2 failures then HTTP 307
    let attempts = 0;
    const fakeFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      attempts++;
      expect(init?.redirect).toBe("manual");
      if (attempts < 3) throw new Error("ECONNREFUSED");
      return { status: 307, body: { cancel: vi.fn(async () => undefined) } } as unknown as Response;
    });
    await expect(
      waitForServerReady({
        url: "http://127.0.0.1:3100/",
        readyTimeoutMs: 2000,
        pollIntervalMs: 10,
        fetchFn: fakeFetch as unknown as typeof fetch,
      })
    ).resolves.toBeUndefined();
    expect(attempts).toBe(3);

    // (b) Early exit
    const startEarly = Date.now();
    await expect(
      waitForServerReady({
        url: "http://127.0.0.1:3100/",
        readyTimeoutMs: 5000,
        pollIntervalMs: 10,
        serverState: { exited: true, exitCode: 1, signal: null },
        fetchFn: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/exited early/i);
    expect(Date.now() - startEarly).toBeLessThan(500);

    // (c) Timeout
    await expect(
      waitForServerReady({
        url: "http://127.0.0.1:3100/",
        readyTimeoutMs: 80,
        pollIntervalMs: 15,
        fetchFn: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/SERVER_READY_TIMEOUT/);

    // (d) Watchdog AbortSignal cancels mid-sleep
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 30);
    await expect(
      waitForServerReady({
        url: "http://127.0.0.1:3100/",
        readyTimeoutMs: 5000,
        pollIntervalMs: 2000,
        signal: ac.signal,
        fetchFn: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }) as unknown as typeof fetch,
      })
    ).rejects.toThrow(/WAIT_ABORTED/);
  });

  it("VQ-11: runVisualQa enforces anti-hang spawn options (win32 & linux) and cleans timers, signal listeners, child trees, and next-env.d.ts", async () => {
    for (const platform of ["win32", "linux"] as const) {
      const nextEnvPath = path.join(tmpRepo, `next-env-${platform}.d.ts`);
      fs.writeFileSync(nextEnvPath, "ORIGINAL_NEXT_ENV\n", "utf8");

      const fakeServer = createFakeChild(1001);
      const fakeQa = createFakeChild(2002);
      const spawnCalls: Array<{ cmd: string; args: string[]; opts: SpawnOptions }> = [];
      const mockSpawn = vi.fn((cmd: string, args: string[], opts: SpawnOptions) => {
        spawnCalls.push({ cmd, args, opts });
        if (spawnCalls.length === 1) return fakeServer;
        fs.writeFileSync(nextEnvPath, "MUTATED_BY_DEV\n", "utf8");
        setTimeout(() => fakeQa.emit("exit", 0), 10);
        return fakeQa;
      });
      const fakeProc = new EventEmitter();
      const onSpy = vi.spyOn(fakeProc, "on");
      const offSpy = vi.spyOn(fakeProc, "off");
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const killTreeSpy = vi.fn();

      const exitCode = await runVisualQa(
        {
          scriptPath: "tests/e2e/smoke.js",
          host: "127.0.0.1",
          port: 3100,
          timeoutMs: 10_000,
          readyTimeoutMs: 5_000,
          readyPath: "/",
          help: false,
        },
        {
          repoRoot: tmpRepo,
          artifactRoot: tmpArtifact,
          nextEnvPath,
          platform,
          spawn: mockSpawn,
          proc: fakeProc,
          assertPortAvailable: vi.fn(async () => undefined),
          waitForServerReady: vi.fn(async () => undefined),
          killProcessTree: killTreeSpy,
          stderr: { write: vi.fn() },
        }
      );

      expect(exitCode).toBe(0);
      expect(spawnCalls).toHaveLength(2);
      expect(spawnCalls[0].opts).toMatchObject({
        stdio: "ignore",
        windowsHide: true,
        shell: false,
        detached: platform !== "win32",
      });
      expect(fakeServer.unrefMock).toHaveBeenCalledTimes(1);
      expect(spawnCalls[1].opts).toMatchObject({
        stdio: ["ignore", "inherit", "inherit"],
        windowsHide: true,
        shell: false,
        detached: platform !== "win32",
      });
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(onSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(offSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
      expect(killTreeSpy).toHaveBeenNthCalledWith(1, fakeQa);
      expect(killTreeSpy).toHaveBeenNthCalledWith(2, fakeServer);
      expect(fs.readFileSync(nextEnvPath, "utf8")).toBe("ORIGINAL_NEXT_ENV\n");
    }
  });

  it("VQ-12: real-process integration (happy path + grandchild anti-hang + byte-exact next-env.d.ts restore)", async () => {
    const port = await allocateFreePort();
    const nextEnvPath = path.join(tmpRepo, "next-env.d.ts");
    const originalNextEnv = "// original next-env\n";
    fs.writeFileSync(nextEnvPath, originalNextEnv, "utf8");

    const grandchildPidFile = path.join(tmpBase, "grandchild.pid");
    const stubServerPath = path.join(tmpRepo, "scripts", "stub-server.mjs");
    fs.writeFileSync(
      stubServerPath,
      [
        'import fs from "node:fs";',
        'import http from "node:http";',
        'import { spawn } from "node:child_process";',
        `const gc = spawn(process.execPath, ["-e", "setInterval(() => {}, 10000)"], { stdio: "inherit" });`,
        `fs.writeFileSync(${JSON.stringify(grandchildPidFile)}, String(gc.pid));`,
        'const srv = http.createServer((_req, res) => { res.statusCode = 200; res.end("ok"); });',
        'srv.listen(Number(process.env.PORT), "127.0.0.1");',
      ].join("\n"),
      "utf8"
    );

    const qaScriptPath = path.join(tmpRepo, "tests", "e2e", "real-ok.mjs");
    fs.writeFileSync(
      qaScriptPath,
      [
        'import fs from "node:fs";',
        "const res = await fetch(process.env.VISUAL_QA_BASE_URL);",
        "if (res.status !== 200) process.exit(9);",
        `fs.writeFileSync(${JSON.stringify(nextEnvPath)}, "// mutated by dev\\n");`,
      ].join("\n"),
      "utf8"
    );

    const start = Date.now();
    const code = await runVisualQa(
      {
        scriptPath: "tests/e2e/real-ok.mjs",
        host: "127.0.0.1",
        port,
        timeoutMs: 15_000,
        readyTimeoutMs: 10_000,
        readyPath: "/",
        help: false,
      },
      {
        repoRoot: tmpRepo,
        artifactRoot: tmpArtifact,
        nextEnvPath,
        nextBin: stubServerPath,
        pollIntervalMs: 30,
        qaStdio: "ignore",
      }
    );

    expect(code).toBe(0);
    expect(Date.now() - start).toBeLessThan(5000);
    expect(fs.readFileSync(nextEnvPath, "utf8")).toBe(originalNextEnv);
    const grandchildPid = Number(fs.readFileSync(grandchildPidFile, "utf8").trim());
    expect(grandchildPid).toBeGreaterThan(0);
    expect(await waitForPidDead(grandchildPid)).toBe(true);
  });

  it("VQ-13: real-process integration propagates non-zero QA exit code (3) and restores next-env.d.ts", async () => {
    const port = await allocateFreePort();
    const nextEnvPath = path.join(tmpRepo, "next-env.d.ts");
    fs.writeFileSync(nextEnvPath, "// original-vq13\n", "utf8");

    const stubServerPath = path.join(tmpRepo, "scripts", "stub-server-13.mjs");
    fs.writeFileSync(
      stubServerPath,
      [
        'import http from "node:http";',
        'http.createServer((_req, res) => { res.statusCode = 200; res.end("ok"); }).listen(Number(process.env.PORT), "127.0.0.1");',
      ].join("\n"),
      "utf8"
    );

    const failScriptPath = path.join(tmpRepo, "tests", "e2e", "real-fail.mjs");
    fs.writeFileSync(
      failScriptPath,
      [
        'import fs from "node:fs";',
        `fs.writeFileSync(${JSON.stringify(nextEnvPath)}, "// dirty-vq13\\n");`,
        "process.exit(3);",
      ].join("\n"),
      "utf8"
    );

    const code = await runVisualQa(
      {
        scriptPath: "tests/e2e/real-fail.mjs",
        host: "127.0.0.1",
        port,
        timeoutMs: 15_000,
        readyTimeoutMs: 10_000,
        readyPath: "/",
        help: false,
      },
      {
        repoRoot: tmpRepo,
        artifactRoot: tmpArtifact,
        nextEnvPath,
        nextBin: stubServerPath,
        pollIntervalMs: 30,
        qaStdio: "ignore",
      }
    );

    expect(code).toBe(3);
    expect(fs.readFileSync(nextEnvPath, "utf8")).toBe("// original-vq13\n");
  });

  it("VQ-14 (NP-4): real-process integration triggers hard watchdog exit 124 without killing Vitest worker", async () => {
    const port = await allocateFreePort();
    const nextEnvPath = path.join(tmpRepo, "next-env.d.ts");
    fs.writeFileSync(nextEnvPath, "// original-vq14\n", "utf8");

    const qaPidFile = path.join(tmpBase, "hang-qa.pid");
    const stubServerPath = path.join(tmpRepo, "scripts", "stub-server-14.mjs");
    fs.writeFileSync(
      stubServerPath,
      [
        'import http from "node:http";',
        'http.createServer((_req, res) => { res.statusCode = 200; res.end("ok"); }).listen(Number(process.env.PORT), "127.0.0.1");',
      ].join("\n"),
      "utf8"
    );

    const hangScriptPath = path.join(tmpRepo, "tests", "e2e", "real-hang.mjs");
    fs.writeFileSync(
      hangScriptPath,
      [
        'import fs from "node:fs";',
        `fs.writeFileSync(${JSON.stringify(qaPidFile)}, String(process.pid));`,
        `fs.writeFileSync(${JSON.stringify(nextEnvPath)}, "// dirty-vq14\\n");`,
        "setTimeout(() => {}, 60_000);",
      ].join("\n"),
      "utf8"
    );

    const stderrChunks: string[] = [];
    const start = Date.now();
    const code = await runVisualQa(
      {
        scriptPath: "tests/e2e/real-hang.mjs",
        host: "127.0.0.1",
        port,
        timeoutMs: 1500,
        readyTimeoutMs: 1500,
        readyPath: "/",
        help: false,
      },
      {
        repoRoot: tmpRepo,
        artifactRoot: tmpArtifact,
        nextEnvPath,
        nextBin: stubServerPath,
        pollIntervalMs: 30,
        qaStdio: "ignore",
        stderr: { write: (s: string) => stderrChunks.push(s) },
      }
    );

    expect(code).toBe(124);
    expect(Date.now() - start).toBeLessThan(4500);
    expect(stderrChunks.join("")).toMatch(/timeout/i);
    expect(fs.readFileSync(nextEnvPath, "utf8")).toBe("// original-vq14\n");
    if (fs.existsSync(qaPidFile)) {
      const qaPid = Number(fs.readFileSync(qaPidFile, "utf8").trim());
      expect(await waitForPidDead(qaPid)).toBe(true);
    }
  });

  it("VQ-15: pure module import has zero side-effects, CLI missing --script exits 2 with Usage, and isMainModule normalizes Windows drive case", () => {
    const importProbe = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", "await import('./scripts/visual-qa-runner.mjs')"],
      { cwd: process.cwd(), encoding: "utf8" }
    );
    expect(importProbe.status).toBe(0);
    expect(importProbe.stdout).toBe("");

    const cliMissing = spawnSync(process.execPath, [RUNNER_ABS], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(cliMissing.status).toBe(2);
    expect(cliMissing.stderr).toContain("Usage:");

    expect(
      isMainModule(
        "file:///C:/Users/wyemh/vikini/scripts/visual-qa-runner.mjs",
        "c:\\Users\\wyemh\\vikini\\scripts\\visual-qa-runner.mjs",
        "win32"
      )
    ).toBe(true);
  });
});
