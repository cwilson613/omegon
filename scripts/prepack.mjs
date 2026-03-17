/**
 * prepack.mjs — Materialize @styrene-lab/* symlinks into real directories
 * so that `npm pack` produces a self-contained tarball via bundleDependencies.
 *
 * Runs automatically before `npm pack` / `npm publish`.
 * Counterpart: postpack.mjs restores symlinks afterward.
 */

import {
	readFileSync,
	writeFileSync,
	rmSync,
	mkdirSync,
	readdirSync,
	copyFileSync,
	lstatSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const bundled = pkg.bundleDependencies || [];

// Build map: package name → absolute vendor source dir
const depMap = {};
for (const name of bundled) {
	const ref = pkg.dependencies[name];
	if (ref && ref.startsWith("file:")) {
		depMap[name] = resolve(root, ref.slice(5));
	}
}

// Collect versions of all bundled packages so we can rewrite file: refs
const versions = {};
for (const [name, srcDir] of Object.entries(depMap)) {
	const srcPkg = JSON.parse(
		readFileSync(join(srcDir, "package.json"), "utf8"),
	);
	versions[name] = srcPkg.version;
}

function shouldExclude(name) {
	if (name === "node_modules" || name === "src" || name === "test") return true;
	if (name.startsWith(".git")) return true;
	if (name.startsWith("tsconfig")) return true;
	return false;
}

function copyDirSync(src, dest) {
	mkdirSync(dest, { recursive: true });
	for (const entry of readdirSync(src)) {
		if (shouldExclude(entry)) continue;
		const srcPath = join(src, entry);
		const destPath = join(dest, entry);
		const stat = lstatSync(srcPath);
		if (stat.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else if (stat.isFile()) {
			copyFileSync(srcPath, destPath);
		}
		// skip symlinks within vendor packages
	}
}

for (const [name, srcDir] of Object.entries(depMap)) {
	const nmDir = join(root, "node_modules", ...name.split("/"));

	// 0. Abort if dist/ is missing — never ship stale/empty vendor packages
	const distDir = join(srcDir, "dist");
	try {
		const distEntries = readdirSync(distDir);
		if (!distEntries.some((e) => e.endsWith(".js"))) {
			throw new Error("no .js files");
		}
	} catch {
		console.error(
			`FATAL: ${name} has no built dist/ at ${distDir}\n` +
				`Run: cd vendor/pi-mono && npm run build`,
		);
		process.exit(1);
	}

	// 1. Remove symlink (or stale real dir)
	rmSync(nmDir, { recursive: true, force: true });

	// 2. Copy vendor package dir (excluding dev artifacts)
	copyDirSync(srcDir, nmDir);

	// 3. Rewrite file: refs in the copied package.json to real version strings
	const copiedPkgPath = join(nmDir, "package.json");
	const copiedPkg = JSON.parse(readFileSync(copiedPkgPath, "utf8"));

	for (const depType of [
		"dependencies",
		"devDependencies",
		"optionalDependencies",
	]) {
		const deps = copiedPkg[depType];
		if (!deps) continue;
		for (const [depName, depRef] of Object.entries(deps)) {
			if (typeof depRef === "string" && depRef.startsWith("file:")) {
				if (versions[depName]) {
					deps[depName] = versions[depName];
				}
			}
		}
	}

	writeFileSync(copiedPkgPath, JSON.stringify(copiedPkg, null, "\t") + "\n");
	console.log(`  materialized ${name} from ${srcDir}`);
}

console.log(
	`prepack: materialized ${Object.keys(depMap).length} @styrene-lab packages`,
);
