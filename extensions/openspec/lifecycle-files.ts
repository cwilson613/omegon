import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DURABLE_ROOTS = ["docs", "openspec"] as const;

export interface LifecycleArtifactCheckResult {
	untracked: string[];
}

export function isDurableLifecycleArtifact(filePath: string): boolean {
	const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
	return DURABLE_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

export function parsePorcelainZ(stdout: string): string[] {
	const entries = stdout.split("\0").filter(Boolean);
	const untracked: string[] = [];
	for (const entry of entries) {
		if (entry.startsWith("?? ")) {
			untracked.push(entry.slice(3));
		}
	}
	return untracked;
}

export function detectUntrackedLifecycleArtifacts(repoPath: string): string[] {
	try {
		const stdout = execFileSync(
			"git",
			["status", "--porcelain", "--untracked-files=all", "-z", "--", ...DURABLE_ROOTS],
			{ cwd: repoPath, encoding: "utf-8" },
		);
		return parsePorcelainZ(stdout)
			.filter(isDurableLifecycleArtifact)
			.sort((a, b) => a.localeCompare(b));
	} catch {
		return [];
	}
}

export function formatLifecycleArtifactError(result: LifecycleArtifactCheckResult): string {
	const lines = [
		"Untracked durable lifecycle artifacts detected.",
		"",
		"The following files live under docs/ or openspec/ and are treated as version-controlled project documentation:",
		...result.untracked.map((file) => `- ${file}`),
		"",
		"Resolution:",
		"- git add the durable lifecycle files listed above, or",
		"- move transient scratch artifacts outside docs/ and openspec/.",
	];
	return lines.join("\n");
}

export function assertTrackedLifecycleArtifacts(repoPath: string): void {
	const untracked = detectUntrackedLifecycleArtifacts(repoPath);
	if (untracked.length === 0) return;
	throw new Error(formatLifecycleArtifactError({ untracked }));
}

function runCli(): void {
	const repoPath = process.cwd();
	assertTrackedLifecycleArtifacts(repoPath);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	runCli();
}
