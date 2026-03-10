import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildAssessBridgeResult } from "./bridge.ts";
import type { AssessStructuredResult } from "./assessment.ts";

describe("buildAssessBridgeResult", () => {
	it("preserves the full original bridged args while keeping structured assess metadata", () => {
		const result: AssessStructuredResult<{ decision: string }> = {
			command: "assess",
			subcommand: "complexity",
			args: "rename helper function",
			ok: true,
			summary: "Complexity decision: execute",
			humanText: "Execute directly",
			data: { decision: "execute" },
			effects: [{ type: "view", content: "Execute directly" }],
			nextSteps: ["Execute directly"],
			completion: {
				completed: true,
				completedInBand: true,
				requiresFollowUp: false,
				outcome: "pass",
			},
		};

		const bridged = buildAssessBridgeResult(["complexity", "rename", "helper", "function"], result);

		assert.deepEqual(bridged.args, ["complexity", "rename", "helper", "function"]);
		assert.equal(bridged.command, "assess");
		assert.equal((bridged.data as any).subcommand, "complexity");
		assert.deepEqual((bridged.data as any).data, { decision: "execute" });
		assert.deepEqual((bridged.data as any).completion, {
			completed: true,
			completedInBand: true,
			requiresFollowUp: false,
			outcome: "pass",
		});
		assert.deepEqual((bridged.data as any).bridge, {
			completionSemantics: "synchronous",
			completionState: "completed",
			originalArgs: ["complexity", "rename", "helper", "function"],
		});
	});

	it("marks follow-up-driven assess results as pending without rewriting args", () => {
		const result: AssessStructuredResult<{ changeName: string }> = {
			command: "assess",
			subcommand: "spec",
			args: "my-change",
			ok: true,
			summary: "Prepared spec assessment for my-change",
			humanText: "Prepared spec assessment for my-change",
			data: { changeName: "my-change" },
			effects: [{ type: "follow_up", content: "Assess scenarios" }],
			nextSteps: ["Assess each scenario"],
			completion: {
				completed: false,
				completedInBand: false,
				requiresFollowUp: true,
			},
		};

		const bridged = buildAssessBridgeResult(["spec", "my-change"], result);

		assert.deepEqual(bridged.args, ["spec", "my-change"]);
		assert.deepEqual((bridged.data as any).completion, {
			completed: false,
			completedInBand: false,
			requiresFollowUp: true,
		});
		assert.deepEqual((bridged.data as any).bridge, {
			completionSemantics: "follow-up-driven",
			completionState: "pending",
			originalArgs: ["spec", "my-change"],
		});
	});

	it("keeps completed lifecycle metadata aligned with the bridged assessment outcome", () => {
		const result: AssessStructuredResult<{ changeName: string; outcome: string }> = {
			command: "assess",
			subcommand: "spec",
			args: "my-change",
			ok: true,
			summary: "Completed spec assessment for my-change: 2/2 pass, 0 fail, 0 unclear",
			humanText: "Assessment complete",
			data: { changeName: "my-change", outcome: "pass" },
			effects: [],
			nextSteps: ["Call openspec_manage reconcile_after_assess for my-change with outcome pass"],
			completion: {
				completed: true,
				completedInBand: true,
				requiresFollowUp: false,
				outcome: "pass",
			},
			lifecycle: {
				changeName: "my-change",
				assessmentKind: "spec",
				outcomes: ["pass", "reopen", "ambiguous"],
			},
			lifecycleRecord: {
				changeName: "my-change",
				assessmentKind: "spec",
				outcome: "pass",
				timestamp: "2026-03-10T00:00:00.000Z",
				snapshot: { gitHead: "abc123", fingerprint: "fingerprint" },
				reconciliation: {
					reopen: false,
					changedFiles: [],
					constraints: [],
					recommendedAction: null,
				},
			},
		};

		const bridged = buildAssessBridgeResult(["spec", "my-change"], result);

		assert.equal((bridged.data as any).data.outcome, "pass");
		assert.equal((bridged.data as any).completion.outcome, "pass");
		assert.equal((bridged.lifecycle as any).outcome, "pass");
		assert.deepEqual(bridged.args, ["spec", "my-change"]);
	});
});
