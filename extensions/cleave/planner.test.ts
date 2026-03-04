/**
 * Tests for cleave/planner — plan parsing, wave computation, and cycle detection.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parsePlanResponse, computeDispatchWaves, buildPlannerPrompt } from "./planner.js";

// ─── parsePlanResponse ──────────────────────────────────────────────────────

describe("parsePlanResponse", () => {
	const validPlan = {
		children: [
			{ label: "api-layer", description: "Build REST endpoints", scope: ["src/api/**"], depends_on: [] },
			{ label: "db-layer", description: "Create migrations", scope: ["src/db/**"], depends_on: [] },
		],
		rationale: "Standard split",
	};

	it("parses valid JSON", () => {
		const plan = parsePlanResponse(JSON.stringify(validPlan));
		assert.equal(plan.children.length, 2);
		assert.equal(plan.children[0].label, "api-layer");
		assert.equal(plan.rationale, "Standard split");
	});

	it("strips markdown code fences", () => {
		const wrapped = "```json\n" + JSON.stringify(validPlan) + "\n```";
		const plan = parsePlanResponse(wrapped);
		assert.equal(plan.children.length, 2);
	});

	it("strips fences with language tag", () => {
		const wrapped = "```\n" + JSON.stringify(validPlan) + "\n```";
		const plan = parsePlanResponse(wrapped);
		assert.equal(plan.children.length, 2);
	});

	it("extracts JSON from surrounding text", () => {
		const response = "Here's my plan:\n\n" + JSON.stringify(validPlan) + "\n\nLet me know if this works.";
		const plan = parsePlanResponse(response);
		assert.equal(plan.children.length, 2);
	});

	it("normalizes labels to kebab-case", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "API Layer", description: "a", scope: [], depends_on: [] },
				{ label: "DB_Layer!", description: "b", scope: [], depends_on: [] },
			],
			rationale: "",
		}));
		assert.equal(plan.children[0].label, "api-layer");
		assert.equal(plan.children[1].label, "db-layer");
	});

	it("truncates labels to 40 chars", () => {
		const longLabel = "a".repeat(60);
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: longLabel, description: "a", scope: [], depends_on: [] },
				{ label: "other", description: "b", scope: [], depends_on: [] },
			],
			rationale: "",
		}));
		assert.ok(plan.children[0].label.length <= 40);
	});

	it("accepts both camelCase and snake_case depends_on", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "first", description: "a", scope: [], dependsOn: [] },
				{ label: "second", description: "b", scope: [], depends_on: ["first"] },
			],
			rationale: "",
		}));
		assert.deepEqual(plan.children[1].dependsOn, ["first"]);
	});

	it("removes self-dependencies", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "first", description: "a", scope: [], depends_on: ["first"] },
				{ label: "second", description: "b", scope: [], depends_on: [] },
			],
			rationale: "",
		}));
		assert.deepEqual(plan.children[0].dependsOn, []);
	});

	it("removes unknown dependency references", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "first", description: "a", scope: [], depends_on: ["nonexistent"] },
				{ label: "second", description: "b", scope: [], depends_on: [] },
			],
			rationale: "",
		}));
		assert.deepEqual(plan.children[0].dependsOn, []);
	});

	it("truncates to 4 children max", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "a", description: "1", scope: [], depends_on: [] },
				{ label: "b", description: "2", scope: [], depends_on: [] },
				{ label: "c", description: "3", scope: [], depends_on: [] },
				{ label: "d", description: "4", scope: [], depends_on: [] },
				{ label: "e", description: "5", scope: [], depends_on: [] },
			],
			rationale: "",
		}));
		assert.equal(plan.children.length, 4);
	});

	it("breaks dependency cycles", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "a", description: "1", scope: [], depends_on: ["b"] },
				{ label: "b", description: "2", scope: [], depends_on: ["a"] },
			],
			rationale: "",
		}));
		// After cycle breaking, at least one should have empty deps
		const totalDeps = plan.children.reduce((s, c) => s + c.dependsOn.length, 0);
		assert.ok(totalDeps < 2, `Cycle should be broken but total deps = ${totalDeps}`);
	});

	it("preserves valid dependency chains (no false cycle detection)", () => {
		const plan = parsePlanResponse(JSON.stringify({
			children: [
				{ label: "first", description: "a", scope: [], depends_on: [] },
				{ label: "second", description: "b", scope: [], depends_on: ["first"] },
				{ label: "third", description: "c", scope: [], depends_on: ["second"] },
			],
			rationale: "",
		}));
		assert.deepEqual(plan.children[0].dependsOn, []);
		assert.deepEqual(plan.children[1].dependsOn, ["first"]);
		assert.deepEqual(plan.children[2].dependsOn, ["second"]);
	});

	// ── Error cases ─────────────────────────────────────────────────────────

	it("throws on invalid JSON", () => {
		assert.throws(() => parsePlanResponse("not json at all"), /JSON/i);
	});

	it("throws on fewer than 2 children", () => {
		assert.throws(() => parsePlanResponse(JSON.stringify({
			children: [{ label: "solo", description: "alone", scope: [], depends_on: [] }],
			rationale: "",
		})), /at least 2/i);
	});

	it("throws when children is not an array", () => {
		assert.throws(() => parsePlanResponse(JSON.stringify({
			children: "not an array",
			rationale: "",
		})), /at least 2/i);
	});

	it("throws when child lacks label", () => {
		assert.throws(() => parsePlanResponse(JSON.stringify({
			children: [
				{ description: "no label", scope: [] },
				{ label: "ok", description: "has label", scope: [] },
			],
			rationale: "",
		})), /label/i);
	});

	it("throws when child lacks description", () => {
		assert.throws(() => parsePlanResponse(JSON.stringify({
			children: [
				{ label: "first", scope: [] },
				{ label: "second", description: "ok", scope: [] },
			],
			rationale: "",
		})), /description/i);
	});
});

// ─── computeDispatchWaves ───────────────────────────────────────────────────

describe("computeDispatchWaves", () => {
	it("returns empty for empty input", () => {
		assert.deepEqual(computeDispatchWaves([]), []);
	});

	it("puts all independent children in wave 0", () => {
		const waves = computeDispatchWaves([
			{ label: "a", dependsOn: [] },
			{ label: "b", dependsOn: [] },
			{ label: "c", dependsOn: [] },
		]);
		assert.equal(waves.length, 1);
		assert.deepEqual(waves[0].sort(), ["a", "b", "c"]);
	});

	it("puts dependent children in later waves", () => {
		const waves = computeDispatchWaves([
			{ label: "api", dependsOn: [] },
			{ label: "db", dependsOn: [] },
			{ label: "frontend", dependsOn: ["api"] },
		]);
		assert.equal(waves.length, 2);
		assert.ok(waves[0].includes("api"));
		assert.ok(waves[0].includes("db"));
		assert.ok(waves[1].includes("frontend"));
	});

	it("handles linear dependency chain", () => {
		const waves = computeDispatchWaves([
			{ label: "first", dependsOn: [] },
			{ label: "second", dependsOn: ["first"] },
			{ label: "third", dependsOn: ["second"] },
		]);
		assert.equal(waves.length, 3);
		assert.deepEqual(waves[0], ["first"]);
		assert.deepEqual(waves[1], ["second"]);
		assert.deepEqual(waves[2], ["third"]);
	});

	it("handles diamond dependency pattern", () => {
		const waves = computeDispatchWaves([
			{ label: "root", dependsOn: [] },
			{ label: "left", dependsOn: ["root"] },
			{ label: "right", dependsOn: ["root"] },
			{ label: "join", dependsOn: ["left", "right"] },
		]);
		assert.equal(waves.length, 3);
		assert.deepEqual(waves[0], ["root"]);
		assert.deepEqual(waves[1].sort(), ["left", "right"]);
		assert.deepEqual(waves[2], ["join"]);
	});

	it("breaks deadlocks by dispatching remaining", () => {
		// Circular deps that somehow survived cycle detection
		const waves = computeDispatchWaves([
			{ label: "a", dependsOn: ["b"] },
			{ label: "b", dependsOn: ["a"] },
		]);
		// Should still produce waves (deadlock breaker)
		assert.ok(waves.length >= 1);
		const allLabels = waves.flat();
		assert.ok(allLabels.includes("a"));
		assert.ok(allLabels.includes("b"));
	});

	it("ignores unknown dependencies", () => {
		const waves = computeDispatchWaves([
			{ label: "a", dependsOn: ["nonexistent"] },
			{ label: "b", dependsOn: [] },
		]);
		// "a" depends on "nonexistent" which isn't in the childMap,
		// so the filter `d => childMap.has(d)` removes it → a is ready in wave 0
		assert.equal(waves.length, 1);
		assert.deepEqual(waves[0].sort(), ["a", "b"]);
	});
});

// ─── buildPlannerPrompt ─────────────────────────────────────────────────────

describe("buildPlannerPrompt", () => {
	it("includes directive in prompt", () => {
		const prompt = buildPlannerPrompt("Add dark mode", "src/\n  app.ts", []);
		assert.ok(prompt.includes("Add dark mode"));
	});

	it("includes repo tree in prompt", () => {
		const prompt = buildPlannerPrompt("Add dark mode", "src/\n  app.ts\n  styles/", []);
		assert.ok(prompt.includes("src/"));
		assert.ok(prompt.includes("app.ts"));
	});

	it("includes success criteria when provided", () => {
		const prompt = buildPlannerPrompt("Add dark mode", "", [
			"Toggle works in settings",
			"System preference detected",
		]);
		assert.ok(prompt.includes("Toggle works in settings"));
		assert.ok(prompt.includes("System preference detected"));
	});

	it("omits criteria block when empty", () => {
		const prompt = buildPlannerPrompt("Add dark mode", "", []);
		assert.ok(!prompt.includes("Success criteria:"));
	});

	it("includes JSON schema in prompt", () => {
		const prompt = buildPlannerPrompt("anything", "", []);
		assert.ok(prompt.includes('"children"'));
		assert.ok(prompt.includes('"label"'));
		assert.ok(prompt.includes('"depends_on"'));
	});
});
