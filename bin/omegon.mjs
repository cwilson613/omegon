#!/usr/bin/env node
/**
 * Omegon entry point.
 *
 * Keeps mutable user state in the shared pi-compatible agent directory while
 * injecting Omegon-packaged resources from the installed package root.
 *
 * Resolution order for the underlying agent core:
 *   1. vendor/pi-mono (dev mode — git submodule present)
 *   2. node_modules/@styrene-lab/pi-coding-agent (installed via npm)
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const omegonRoot = dirname(dirname(__filename));
const defaultStateDir = join(homedir(), ".pi", "agent");
const stateDir = process.env.PI_CODING_AGENT_DIR || defaultStateDir;
const usingExplicitStateOverride = Boolean(process.env.PI_CODING_AGENT_DIR);

const vendorCli = join(omegonRoot, "vendor/pi-mono/packages/coding-agent/dist/cli.js");
const npmCli = join(omegonRoot, "node_modules/@styrene-lab/pi-coding-agent/dist/cli.js");
const cli = existsSync(vendorCli) ? vendorCli : npmCli;
const resolutionMode = cli === vendorCli ? "vendor" : "npm";

function migrateLegacyStatePath(relativePath, kind = "file") {
  if (usingExplicitStateOverride) {
    return;
  }

  const legacyPath = join(omegonRoot, relativePath);
  const targetPath = join(stateDir, relativePath);
  if (!existsSync(legacyPath) || existsSync(targetPath)) {
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  if (kind === "directory") {
    cpSync(legacyPath, targetPath, { recursive: true, force: false });
    return;
  }
  copyFileSync(legacyPath, targetPath);
}

function injectBundledResourceArgs(argv) {
  const injected = [...argv];
  const pushPair = (flag, value) => {
    if (existsSync(value)) {
      injected.push(flag, value);
    }
  };

  // Omegon is the sole authority for bundled resources.
  // Suppress pi's auto-discovery of skills, prompts, and themes (which scans
  // ~/.pi/agent/*, installed packages, and project .pi/ dirs) so only our
  // manifest-declared resources load. The --no-* flags disable discovery
  // but still allow CLI-injected paths (our --extension manifest).
  // Extensions are NOT suppressed — project-local .pi/extensions/ should still work.
  injected.push("--no-skills", "--no-prompt-templates", "--no-themes");
  pushPair("--extension", omegonRoot);
  return injected;
}

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  const pkg = JSON.parse(readFileSync(join(omegonRoot, "package.json"), "utf8"));
  process.stdout.write(pkg.version + "\n");
  process.exit(0);
}

if (process.argv.includes("--where")) {
  process.stdout.write(JSON.stringify({
    omegonRoot,
    cli,
    resolutionMode,
    agentDir: stateDir,
    stateDir,
    executable: "omegon",
  }, null, 2) + "\n");
  process.exit(0);
}

process.env.PI_CODING_AGENT_DIR = stateDir;
migrateLegacyStatePath("auth.json");
migrateLegacyStatePath("settings.json");
migrateLegacyStatePath("sessions", "directory");

// Force quiet startup — the splash extension provides the branded header.
// This suppresses the built-in keybinding hints, expanded changelog, and
// resource listing that pi's interactive mode normally renders before
// extensions have a chance to set a custom header.
function forceQuietStartup() {
  try {
    const settingsPath = join(stateDir, "settings.json");
    mkdirSync(stateDir, { recursive: true });
    let settings = {};
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    }
    let changed = false;
    if (settings.quietStartup === undefined) {
      settings.quietStartup = true;
      changed = true;
    }
    if (settings.collapseChangelog === undefined) {
      settings.collapseChangelog = true;
      changed = true;
    }
    if (changed) {
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
    }
  } catch { /* best effort */ }
}
forceQuietStartup();

function purgeSelfReferentialPackages() {
  try {
    const settingsPath = join(stateDir, "settings.json");
    if (!existsSync(settingsPath)) return;
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (!Array.isArray(settings.packages)) return;
    const selfPatterns = [
      /github\.com\/cwilson613\/omegon/i,
      /github\.com\/cwilson613\/pi-kit/i,
      /github\.com\/styrene-lab\/omegon/i,
    ];
    const filtered = settings.packages.filter(
      (pkg) => !selfPatterns.some((re) => re.test(String(pkg))),
    );
    if (filtered.length === settings.packages.length) return;
    settings.packages = filtered;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
  } catch { /* graceful failure — do not block startup */ }
}
purgeSelfReferentialPackages();

process.argv = injectBundledResourceArgs(process.argv);

// ---------------------------------------------------------------------------
// Pre-import splash — show a simple loading indicator while the module graph
// resolves. The TUI takes over once interactive mode starts.
// ---------------------------------------------------------------------------
const isInteractive = process.stdout.isTTY &&
  !process.argv.includes("-p") &&
  !process.argv.includes("--print") &&
  !process.argv.includes("--help") &&
  !process.argv.includes("-h");

let preImportCleanup;
if (isInteractive) {
  const PRIMARY = "\x1b[38;2;42;180;200m";
  const DIM = "\x1b[38;2;64;88;112m";
  const RST = "\x1b[0m";
  const HIDE_CURSOR = "\x1b[?25l";
  const SHOW_CURSOR = "\x1b[?25h";
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;

  // Safety net: restore cursor on any exit path (crash, SIGTERM, etc.)
  const restoreCursor = () => { try { process.stdout.write(SHOW_CURSOR); } catch {} };
  process.on('exit', restoreCursor);

  process.stdout.write(HIDE_CURSOR);
  process.stdout.write(`\n  ${PRIMARY}omegon${RST} ${DIM}loading…${RST}`);

  const spinTimer = setInterval(() => {
    const s = spinner[frame % spinner.length];
    process.stdout.write(`\r  ${PRIMARY}${s} omegon${RST} ${DIM}loading…${RST}`);
    frame++;
  }, 80);

  preImportCleanup = () => {
    clearInterval(spinTimer);
    process.removeListener('exit', restoreCursor);
    // Clear the loading line and restore cursor
    process.stdout.write(`\r\x1b[2K${SHOW_CURSOR}`);
  };
}

try {
  await import(cli);
} finally {
  preImportCleanup?.();
}
