// @ts-check
/* global process, console, Buffer */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verification script for documentation links, governance standards, and archive integrity.
 * Run via: node scripts/verify-docs.mjs
 */

export const RULE_MAX_CHARS = 16000;
export const RULE_MAX_BYTES = 24000;
export const ALWAYS_ON_MAX_CHARS = 28000;
export const AGENT_MAX_CHARS = 10000;

const REPO_ROOT = process.cwd();
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * @typedef {{ errors: string[], ruleCount: number, alwaysOnChars: number, agentCount: number }} GovernanceLimitReport
 * @typedef {{ file: string, text: string, target: string, resolved: string }} BrokenLinkEntry
 * @typedef {{ file: string, pattern: string }} LegacyMatchEntry
 * @typedef {{ file: string, line: number, content: string }} ShorthandMatchEntry
 */

/**
 * Extracts the leading YAML frontmatter block, or `""` when absent.
 *
 * @param {string} content
 * @returns {string}
 */
function extractYamlFrontmatter(content) {
  const match = FRONTMATTER_REGEX.exec(content);
  return match ? match[1] : "";
}

/**
 * Checks whether a rule file declares `trigger: always_on` strictly inside
 * its leading YAML frontmatter block (ignoring code examples in the body).
 *
 * @param {string} content
 * @returns {boolean}
 */
export function isAlwaysOnRule(content) {
  return /^trigger:\s*always_on\s*$/m.test(extractYamlFrontmatter(content));
}

/**
 * Checks `.agents/rules/*.md` (sorted; chars <= 16,000, UTF-8 bytes <= 24,000,
 * always_on total <= 28,000 via `isAlwaysOnRule`) and `.agents/agents/<name>/agent.md`
 * (sorted; <= 10,000 chars).
 *
 * @param {string} [repoRoot]
 * @returns {GovernanceLimitReport}
 */
export function checkGovernanceLimits(repoRoot = REPO_ROOT) {
  /** @type {string[]} */
  const errors = [];
  let ruleCount = 0;
  let alwaysOnChars = 0;
  let agentCount = 0;

  const rulesDir = path.join(repoRoot, ".agents", "rules");
  if (fs.existsSync(rulesDir)) {
    for (const f of fs.readdirSync(rulesDir).sort()) {
      if (!f.endsWith(".md")) {
        continue;
      }
      ruleCount += 1;
      const content = fs.readFileSync(path.join(rulesDir, f), "utf8");
      const len = content.length;
      const bytes = Buffer.byteLength(content, "utf8");
      if (len > RULE_MAX_CHARS) {
        errors.push(`.agents/rules/${f} has ${len} chars (limit 16,000)`);
      }
      if (bytes > RULE_MAX_BYTES) {
        errors.push(`.agents/rules/${f} has ${bytes} UTF-8 bytes (limit 24,000)`);
      }
      if (isAlwaysOnRule(content)) {
        alwaysOnChars += len;
      }
    }
    if (alwaysOnChars > ALWAYS_ON_MAX_CHARS) {
      errors.push(`always_on rules total ${alwaysOnChars} chars (limit 28,000)`);
    }
  }

  const agentsDir = path.join(repoRoot, ".agents", "agents");
  if (fs.existsSync(agentsDir)) {
    for (const a of fs.readdirSync(agentsDir).sort()) {
      const agentMd = path.join(agentsDir, a, "agent.md");
      if (!fs.existsSync(agentMd)) {
        continue;
      }
      agentCount += 1;
      const len = fs.readFileSync(agentMd, "utf8").length;
      if (len > AGENT_MAX_CHARS) {
        errors.push(`.agents/agents/${a}/agent.md has ${len} chars (limit 10,000)`);
      }
    }
  }

  return { errors, ruleCount, alwaysOnChars, agentCount };
}

/**
 * Recursively collects Markdown files under `dir`, excluding build artifacts and `.claude/worktrees`.
 *
 * @param {string} dir
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
function walk(dir, repoRoot = REPO_ROOT) {
  /** @type {string[]} */
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }
    if (
      entry.isDirectory() &&
      path.relative(repoRoot, fullPath).replace(/\\/g, "/") === ".claude/worktrees"
    ) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, repoRoot));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Returns true only when this script is executed directly as the Node entrypoint.
 *
 * @returns {boolean}
 */
function isMainModule() {
  if (typeof process.argv[1] !== "string" || !process.argv[1]) {
    return false;
  }
  const entry = path.resolve(process.argv[1]);
  const self = fileURLToPath(import.meta.url);
  return process.platform === "win32" ? entry.toLowerCase() === self.toLowerCase() : entry === self;
}

/**
 * Runs the 5-step documentation and governance verification CLI.
 *
 * @param {string} [repoRoot]
 * @param {string[]} [argv]
 * @returns {void}
 */
function runCli(repoRoot = REPO_ROOT, argv = process.argv) {
  let hasError = false;

  console.log("==================================================");
  console.log(" Vikini Documentation & Governance Verification   ");
  console.log("==================================================");

  // 1. Link Checker (strips code spans and fenced blocks, resolves relative to file)
  console.log("\n[1/5] Checking Markdown Link Integrity...");
  const allMdFiles = walk(repoRoot, repoRoot);
  // Exclude archive and specific plan files from active link checking (keep docs/plans/README.md)
  const activeFiles = allMdFiles.filter((f) => {
    const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
    if (rel.startsWith("docs/archive/")) {
      return false;
    }
    if (rel.startsWith("docs/plans/") && rel !== "docs/plans/README.md") {
      return false;
    }
    return true;
  });

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  /** @type {BrokenLinkEntry[]} */
  const brokenLinks = [];

  for (const file of activeFiles) {
    const raw = fs.readFileSync(file, "utf8");
    // Strip fenced code blocks
    const noCodeBlocks = raw.replace(/```[\s\S]*?```/g, "");
    // Strip inline code spans
    const stripped = noCodeBlocks.replace(/`[^`]*`/g, "");

    /** @type {RegExpExecArray | null} */
    let match;
    while ((match = linkRegex.exec(stripped)) !== null) {
      const href = match[2].trim();
      if (
        !href ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("#")
      ) {
        continue;
      }
      const cleanHref = href.split("#")[0];
      if (!cleanHref) {
        continue;
      }

      let targetPath = cleanHref;
      if (targetPath.startsWith("file:///")) {
        targetPath = targetPath.replace("file:///", "").replace(/^\/([a-zA-Z]:)/, "$1");
      }

      /** @type {string} */
      let resolved;
      if (targetPath.startsWith("/")) {
        resolved = path.join(repoRoot, targetPath.slice(1));
      } else if (path.isAbsolute(targetPath)) {
        resolved = targetPath;
      } else {
        // CommonMark / GitHub Markdown relative resolution: relative to file's directory
        resolved = path.resolve(path.dirname(file), targetPath);
      }

      if (!fs.existsSync(resolved)) {
        brokenLinks.push({
          file: path.relative(repoRoot, file).replace(/\\/g, "/"),
          text: match[1],
          target: href,
          resolved: path.relative(repoRoot, resolved).replace(/\\/g, "/"),
        });
      }
    }
  }

  if (brokenLinks.length > 0) {
    console.error("FAIL: Found broken links:");
    for (const b of brokenLinks) {
      console.error(`  - In ${b.file}: [${b.text}](${b.target}) -> resolved: ${b.resolved}`);
    }
    hasError = true;
  } else {
    console.log(`PASS: Scanned ${activeFiles.length} files. Zero broken links found.`);
  }

  // 2. Negative Grep for Deleted/Moved Legacy Paths
  console.log("\n[2/5] Checking Negative Grep (Legacy paths)...");
  const legacyPatterns = [
    { name: "docs/context.md", regex: /docs\/context\.md/ },
    { name: "docs/model-routing.md", regex: /docs\/model-routing\.md/ },
    { name: "docs/superpowers/", regex: /docs\/superpowers\// },
    { name: ".agent/rules/ (typo)", regex: /\.agent\/rules\// },
    { name: ".agents/workflows/ (deprecated)", regex: /\.agents\/workflows\// },
  ];

  /** @type {LegacyMatchEntry[]} */
  const legacyMatches = [];
  for (const file of allMdFiles) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    // Exclude archive, changelog, and historical plan files from legacy negative grep
    if (
      rel.startsWith("docs/archive/") ||
      rel === "docs/CHANGELOG.md" ||
      (rel.startsWith("docs/plans/") && rel !== "docs/plans/README.md")
    ) {
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    for (const pat of legacyPatterns) {
      if (pat.regex.test(content)) {
        legacyMatches.push({ file: rel, pattern: pat.name });
      }
    }
  }

  if (legacyMatches.length > 0) {
    console.error("FAIL: Found legacy references in active files:");
    for (const m of legacyMatches) {
      console.error(`  - In ${m.file}: matches ${m.pattern}`);
    }
    hasError = true;
  } else {
    console.log("PASS: Zero legacy references found in active files.");
  }

  // 3. Negative Grep for Shorthand Prefixes in Active Governance Files
  console.log(
    "\n[3/5] Checking Negative Shorthand Prefixes (rules/ skills/ workflows/ without .agents/)..."
  );
  const shorthandRegex = /(?:^|[^\w./-])(rules|skills|workflows)\/([\w.-]+\.md)/;

  // Scope: active rules, agents, skills (root *.md), workflows, architecture, lessons-learned, and new hubs
  const shorthandScope = allMdFiles.filter((f) => {
    const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
    return (
      rel.startsWith(".agents/rules/") ||
      rel.startsWith(".agents/agents/") ||
      (rel.startsWith(".agents/skills/") && !rel.includes("ux-ui-agent-skills")) ||
      rel === "docs/architecture.md" ||
      rel === "docs/lessons-learned.md" ||
      rel === "docs/README.md" ||
      rel === ".agents/README.md" ||
      rel === ".agents/skills/README.md"
    );
  });

  /** @type {ShorthandMatchEntry[]} */
  const shorthandMatches = [];
  for (const file of shorthandScope) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Exclude markdown code blocks or explanatory comments
      if (line.includes("```")) {
        continue;
      }
      if (shorthandRegex.test(line)) {
        shorthandMatches.push({ file: rel, line: i + 1, content: line.trim() });
      }
    }
  }

  // During post-implementation verification, shorthandMatches MUST be 0
  const isPostImplementation = argv.includes("--strict-shorthand");
  if (shorthandMatches.length > 0) {
    if (isPostImplementation) {
      console.error(`FAIL: Found ${shorthandMatches.length} unmigrated shorthand references:`);
      for (const s of shorthandMatches.slice(0, 10)) {
        console.error(`  - ${s.file}:${s.line} ${s.content}`);
      }
      hasError = true;
    } else {
      console.log(
        `NOTE: Pre-implementation state: found ${shorthandMatches.length} shorthand occurrences to be migrated.`
      );
    }
  } else {
    console.log("PASS: All active governance files use full .agents/ prefixes.");
  }

  // 4. Governance Character & UTF-8 Byte Limit Checks
  console.log("\n[4/5] Checking Governance Character & UTF-8 Byte Limits...");
  const limitReport = checkGovernanceLimits(repoRoot);
  if (limitReport.errors.length > 0) {
    console.error("FAIL: Governance limits exceeded:");
    for (const err of limitReport.errors) {
      console.error("  - " + err);
    }
    hasError = true;
  } else {
    console.log(
      "PASS: All rules <= 16,000 chars & <= 24,000 UTF-8 bytes, always_on <= 28,000 chars, and all agents <= 10,000 chars."
    );
  }

  // 5. CHANGELOG Size & Dynamic Headings Verification (if archive exists)
  console.log("\n[5/5] Checking CHANGELOG Size & Headings Integrity...");
  const changelogPath = path.join(repoRoot, "docs", "CHANGELOG.md");
  const legacyChangelogPath = path.join(repoRoot, "docs", "archive", "CHANGELOG-legacy.md");

  const expectedHeadingsArg = argv.find((arg) => arg.startsWith("--expected-headings="));
  /** @type {number | null} */
  let expectedHeadings = null;
  if (expectedHeadingsArg) {
    const val = expectedHeadingsArg.slice("--expected-headings=".length);
    if (!/^\d+$/.test(val)) {
      console.error(
        `FAIL: Invalid value for --expected-headings: '${val}'. Must be a valid integer.`
      );
      hasError = true;
    } else {
      expectedHeadings = parseInt(val, 10);
    }
  }

  if (fs.existsSync(changelogPath) && fs.existsSync(legacyChangelogPath)) {
    const currentContent = fs.readFileSync(changelogPath, "utf8");
    const currentBytes = Buffer.byteLength(currentContent);
    const currentHeadings = currentContent.split("\n").filter((l) => l.startsWith("## ")).length;

    const legacyContent = fs.readFileSync(legacyChangelogPath, "utf8");
    const legacyHeadings = legacyContent.split("\n").filter((l) => l.startsWith("## ")).length;
    const totalHeadings = currentHeadings + legacyHeadings;

    console.log(`Current CHANGELOG size: ${currentBytes} bytes (target: < 35,000 bytes)`);
    console.log(
      `Current Headings: ${currentHeadings}, Legacy Headings: ${legacyHeadings}, Total: ${totalHeadings}`
    );

    if (currentBytes >= 35000) {
      console.error(`FAIL: CHANGELOG.md exceeds 35,000 bytes (${currentBytes} bytes)!`);
      hasError = true;
    } else {
      console.log("PASS: CHANGELOG.md size is strictly under 35,000 bytes.");
    }

    if (expectedHeadings !== null) {
      if (totalHeadings !== expectedHeadings) {
        console.error(
          `FAIL: Headings count mismatch! Expected ${expectedHeadings}, got ${totalHeadings} (Current: ${currentHeadings}, Legacy: ${legacyHeadings}).`
        );
        hasError = true;
      } else {
        console.log(
          `PASS: Total headings count matches expected (${totalHeadings} == ${expectedHeadings}).`
        );
      }
    }
  } else {
    if (expectedHeadings !== null) {
      console.error(
        "FAIL: Both docs/CHANGELOG.md and docs/archive/CHANGELOG-legacy.md must exist when --expected-headings is specified!"
      );
      hasError = true;
    } else {
      console.log(
        "NOTE: Legacy changelog archive does not exist yet (pre-implementation). Size check will run post-migration."
      );
    }
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log("\n>>> ALL DOCUMENTATION VERIFICATION CHECKS PASSED. <<<");
  }
}

if (isMainModule()) {
  runCli();
}
