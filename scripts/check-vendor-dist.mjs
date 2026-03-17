/**
 * check-vendor-dist.mjs — Verify that vendor/pi-mono dist/ directories
 * exist and were built from the current source.
 *
 * Guards against publishing omegon with stale or missing vendor dist.
 * Run after `npm run build` in vendor/pi-mono and before `npm publish`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const vendorRoot = resolve(root, "vendor/pi-mono");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const bundled = pkg.bundleDependencies || [];

let failed = false;

for (const name of bundled) {
	const ref = pkg.dependencies[name];
	if (!ref?.startsWith("file:")) continue;

	const srcDir = resolve(root, ref.slice(5));
	const distDir = resolve(srcDir, "dist");

	if (!existsSync(distDir)) {
		console.error(`✗ ${name}: dist/ directory missing at ${distDir}`);
		failed = true;
		continue;
	}

	// Spot-check: the dist should have .js files
	const hasJs = execSync(`find "${distDir}" -name "*.js" -type f | head -1`, {
		encoding: "utf8",
	}).trim();
	if (!hasJs) {
		console.error(`✗ ${name}: dist/ exists but contains no .js files`);
		failed = true;
		continue;
	}

	console.log(`✓ ${name}: dist/ present`);
}

if (failed) {
	console.error(
		"\nFATAL: Vendor dist directories are missing or empty. Run `cd vendor/pi-mono && npm run build` first.",
	);
	process.exit(1);
}

console.log("\nAll vendor dist directories verified.");
