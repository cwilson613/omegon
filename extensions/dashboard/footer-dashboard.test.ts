/**
 * Tests for dashboard footer rendering of implementing/implemented statuses.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { sharedState } from "../shared-state.ts";

// We test the rendering logic indirectly by verifying sharedState shapes
// match what the footer expects, since DashboardFooter requires TUI/Theme.

describe("dashboard types — implementing/implemented fields", () => {
	beforeEach(() => {
		(sharedState as any).designTree = null;
		delete (sharedState as any).lastMemoryInjection;
	});

	it("DesignTreeDashboardState accepts implementingCount and implementedCount", () => {
		const state = {
			nodeCount: 5,
			decidedCount: 2,
			exploringCount: 1,
			implementingCount: 1,
			implementedCount: 1,
			blockedCount: 0,
			openQuestionCount: 0,
			focusedNode: null,
			implementingNodes: [],
		};
		(sharedState as any).designTree = state;
		assert.strictEqual(sharedState.designTree?.implementingCount, 1);
		assert.strictEqual(sharedState.designTree?.implementedCount, 1);
	});

	it("focusedNode includes branch field", () => {
		const state = {
			nodeCount: 1,
			decidedCount: 0,
			exploringCount: 0,
			implementingCount: 1,
			implementedCount: 0,
			blockedCount: 0,
			openQuestionCount: 0,
			focusedNode: {
				id: "my-node",
				title: "My Node",
				status: "implementing",
				questions: [],
				branch: "feature/my-node",
			},
			implementingNodes: [{ id: "my-node", title: "My Node", branch: "feature/my-node" }],
		};
		(sharedState as any).designTree = state;
		assert.strictEqual(sharedState.designTree?.focusedNode?.branch, "feature/my-node");
	});

	it("implementingNodes lists nodes with branch associations", () => {
		const state = {
			nodeCount: 3,
			decidedCount: 1,
			exploringCount: 0,
			implementingCount: 2,
			implementedCount: 0,
			blockedCount: 0,
			openQuestionCount: 0,
			focusedNode: null,
			implementingNodes: [
				{ id: "a", title: "Node A", branch: "feature/a" },
				{ id: "b", title: "Node B" },
			],
		};
		(sharedState as any).designTree = state;
		assert.strictEqual(sharedState.designTree?.implementingNodes?.length, 2);
		assert.strictEqual(sharedState.designTree?.implementingNodes?.[0].branch, "feature/a");
		assert.strictEqual(sharedState.designTree?.implementingNodes?.[1].branch, undefined);
	});

	it("sharedState can expose last memory injection metrics for dashboard audit views", () => {
		(sharedState as any).lastMemoryInjection = {
			mode: "semantic",
			projectFactCount: 30,
			edgeCount: 0,
			workingMemoryFactCount: 4,
			semanticHitCount: 12,
			episodeCount: 3,
			globalFactCount: 15,
			payloadChars: 4800,
			estimatedTokens: 1200,
		};

		assert.strictEqual(sharedState.lastMemoryInjection?.mode, "semantic");
		assert.strictEqual(sharedState.lastMemoryInjection?.projectFactCount, 30);
		assert.strictEqual(sharedState.lastMemoryInjection?.estimatedTokens, 1200);
	});
});
