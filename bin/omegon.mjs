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

await import(cli);
