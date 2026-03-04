/**
 * cleave/workspace — Lightweight workspace management.
 *
 * Creates and manages .cleave-* workspace directories containing:
 * - state.json: serialized CleaveState (replaces manifest.yaml)
 * - {n}-task.md: child task files
 *
 * Simplified from the Python version — uses JSON instead of YAML,
 * and relies on pi's memory/session system for broader context.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChildPlan, CleaveState, SplitPlan } from "./types.js";

/**
 * Generate a unique workspace directory name from a directive.
 *
 * Creates a human-readable slug: ".cleave-add-jwt-auth"
 * Appends numeric suffix if collision: ".cleave-add-jwt-auth-2"
 */
export function generateWorkspaceName(directive: string, baseDir: string): string {
	let slug = directive
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	if (slug.length > 40) slug = slug.slice(0, 40).replace(/-$/, "");
	if (!slug) slug = "task";

	const base = `.cleave-${slug}`;
	let candidate = join(baseDir, base);
	if (!existsSync(candidate)) return base;

	let counter = 2;
	while (existsSync(join(baseDir, `${base}-${counter}`))) counter++;
	return `${base}-${counter}`;
}

/**
 * Initialize a cleave workspace directory.
 *
 * Creates the workspace directory, state.json, and child task files.
 */
export function initWorkspace(
	state: CleaveState,
	plan: SplitPlan,
	repoPath: string,
): string {
	const wsName = generateWorkspaceName(state.directive, repoPath);
	const wsPath = join(repoPath, wsName);
	mkdirSync(wsPath, { recursive: true });

	state.workspacePath = wsPath;

	// Write initial state
	saveState(state);

	// Generate child task files
	for (let i = 0; i < plan.children.length; i++) {
		const child = plan.children[i];
		const taskContent = generateTaskFile(i, child, plan.children, state.directive);
		writeFileSync(join(wsPath, `${i}-task.md`), taskContent, "utf-8");
	}

	return wsPath;
}

/** Persist CleaveState to workspace/state.json */
export function saveState(state: CleaveState): void {
	if (!state.workspacePath) throw new Error("Cannot save state: workspacePath not set");
	const statePath = join(state.workspacePath, "state.json");
	writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/** Load CleaveState from workspace/state.json */
export function loadState(workspacePath: string): CleaveState {
	const statePath = join(workspacePath, "state.json");
	if (!existsSync(statePath)) {
		throw new Error(`State file not found: ${statePath}`);
	}
	return JSON.parse(readFileSync(statePath, "utf-8"));
}

/**
 * Generate a child task markdown file.
 *
 * Slim template that the child agent reads to understand its mission.
 */
function generateTaskFile(
	taskId: number,
	child: ChildPlan,
	allChildren: ChildPlan[],
	rootDirective: string,
): string {
	const siblingRefs = allChildren
		.filter((_, i) => i !== taskId)
		.map((c, i) => `${i >= taskId ? i + 1 : i}:${c.label}`)
		.join(", ");

	const scopeList = child.scope.length > 0
		? child.scope.map((s) => `- \`${s}\``).join("\n")
		: "- (entire scope defined by description)";

	const depsNote = child.dependsOn.length > 0
		? `**Depends on:** ${child.dependsOn.join(", ")}`
		: "**Depends on:** none (independent)";

	return `---
task_id: ${taskId}
label: ${child.label}
siblings: [${siblingRefs}]
---

# Task ${taskId}: ${child.label}

## Root Directive

> ${rootDirective}

## Mission

${child.description}

## Scope

${scopeList}

${depsNote}

## Contract

1. Only work on files within your scope
2. Update the Result section below when done
3. Commit your work with clear messages — do not push
4. If the task is too complex, set status to NEEDS_DECOMPOSITION

## Result

**Status:** PENDING

**Summary:**

**Artifacts:**

**Decisions Made:**

**Assumptions:**

**Interfaces Published:**

**Verification:**
- Command: \`\`
- Output:
- Edge cases:
`;
}

/**
 * Read all task files from a workspace and return their contents.
 */
export function readTaskFiles(workspacePath: string): Map<number, string> {
	const tasks = new Map<number, string>();
	let i = 0;
	while (true) {
		const taskPath = join(workspacePath, `${i}-task.md`);
		if (!existsSync(taskPath)) break;
		tasks.set(i, readFileSync(taskPath, "utf-8"));
		i++;
	}
	return tasks;
}
