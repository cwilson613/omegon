import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PiPackageJson {
	pi?: { extensions?: string[] };
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as PiPackageJson;
const extensionPaths = pkg.pi?.extensions ?? [];

describe("extension module contracts", () => {
	for (const extPath of extensionPaths) {
		const resolvedDir = resolve(root, extPath);
		// Determine the actual .ts file
		let tsFile: string;
		if (extPath.endsWith(".ts")) {
			tsFile = resolvedDir;
		} else if (existsSync(resolvedDir) && statSync(resolvedDir).isDirectory()) {
			tsFile = join(resolvedDir, "index.ts");
		} else {
			tsFile = resolvedDir + ".ts";
		}

		it(`${extPath} has a default export`, () => {
			assert.ok(existsSync(tsFile), `Extension file not found: ${tsFile}`);
			const src = readFileSync(tsFile, "utf-8");
			const hasDefault = /export\s+default\s+(async\s+)?function/.test(src);
			assert.ok(
				hasDefault,
				`Extension ${extPath} must use "export default function" — the loader imports the default export. ` +
					`Found file: ${tsFile}`,
			);
		});
	}
});
