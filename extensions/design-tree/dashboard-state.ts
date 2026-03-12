import * as fs from "node:fs";
import * as path from "node:path";

import type { ExtensionAPI } from "@cwilson613/pi-coding-agent";

import type { DesignNode, DesignTree } from "./types.ts";
import { getAllOpenQuestions, countAcceptanceCriteria } from "./tree.ts";
import { sharedState, DASHBOARD_UPDATE_EVENT } from "../shared-state.ts";
import type { DesignTreeDashboardState } from "../shared-state.ts";
import type { DesignAssessmentResult, DesignPipelineCounts } from "../dashboard/types.ts";
import { resolveDesignSpecBinding } from "../openspec/archive-gate.ts";
import { debug } from "../debug.ts";

/** Read assessment.json from openspec/design/<id>/assessment.json if it exists. */
function readAssessmentResult(cwd: string, nodeId: string): DesignAssessmentResult | null {
	const assessmentPath = path.join(cwd, "openspec", "design", nodeId, "assessment.json");
	if (!fs.existsSync(assessmentPath)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(assessmentPath, "utf-8"));
		return {
			outcome: raw.outcome ?? "ambiguous",
			timestamp: raw.timestamp ?? "",
			summary: raw.summary,
		};
	} catch {
		return null;
	}
}

export function emitDesignTreeState(pi: ExtensionAPI, dt: DesignTree, focused: DesignNode | null): void {
	if (dt.nodes.size === 0) return;
	const cwd = process.cwd();
	const allNodes = Array.from(dt.nodes.values());
	// Exclude implemented nodes from the active dashboard view — they're done work.
	// Deferred nodes remain visible: they are future work, not OBE.
	const nodes = allNodes.filter((n) => n.status !== "implemented");

	// Compute design pipeline funnel counts across ALL nodes
	const pipelineCounts: DesignPipelineCounts = {
		needsSpec: 0,
		designing: 0,
		decided: 0,
		implementing: 0,
		done: allNodes.filter((n) => n.status === "implemented").length,
	};

	const enrichedNodes = nodes.map((n) => {
		const isSeedLike = n.status === "seed";
		const isActivePhase = ["exploring", "decided", "implementing"].includes(n.status);

		// Resolve binding for non-seed nodes
		let designSpec: { active: boolean; archived: boolean; missing: boolean } | undefined;
		let acSummary: ReturnType<typeof countAcceptanceCriteria> | null | undefined;
		let assessmentResult: DesignAssessmentResult | null | undefined;

		if (isSeedLike) {
			// Seeds have no binding yet — emit neutral sentinel
			designSpec = { active: false, archived: false, missing: false };
		} else if (isActivePhase) {
			designSpec = resolveDesignSpecBinding(cwd, n.id);
			acSummary = countAcceptanceCriteria(n);
			assessmentResult = readAssessmentResult(cwd, n.id);
		}

		// Accumulate pipeline counts
		if (n.status === "decided") {
			pipelineCounts.decided++;
		} else if (n.status === "implementing") {
			pipelineCounts.implementing++;
		} else if (n.status === "exploring" || n.status === "seed") {
			const bound = designSpec && (designSpec.active || designSpec.archived);
			if (bound) {
				pipelineCounts.designing++;
			} else {
				pipelineCounts.needsSpec++;
			}
		}

		return {
			id: n.id,
			title: n.title,
			status: n.status,
			questionCount: n.open_questions.length,
			filePath: n.filePath,
			branches: n.branches ?? [],
			designSpec,
			acSummary,
			assessmentResult,
		};
	});

	const state: DesignTreeDashboardState = {
		nodeCount: nodes.length,
		decidedCount: nodes.filter((n) => n.status === "decided").length,
		exploringCount: nodes.filter((n) => n.status === "exploring" || n.status === "seed").length,
		implementingCount: nodes.filter((n) => n.status === "implementing").length,
		implementedCount: allNodes.filter((n) => n.status === "implemented").length,
		blockedCount: nodes.filter((n) => n.status === "blocked").length,
		deferredCount: nodes.filter((n) => n.status === "deferred").length,
		openQuestionCount: getAllOpenQuestions(dt).length,
		focusedNode: focused
			? {
					id: focused.id,
					title: focused.title,
					status: focused.status,
					questions: [...focused.open_questions],
					branch: focused.branches?.[0],
					branchCount: focused.branches?.length ?? 0,
					filePath: focused.filePath,
				}
			: null,
		nodes: enrichedNodes,
		implementingNodes: nodes
			.filter((n) => n.status === "implementing")
			.map((n) => ({ id: n.id, title: n.title, branch: n.branches?.[0], filePath: n.filePath })),
		designPipeline: pipelineCounts,
	};

	sharedState.designTree = state;
	debug("design-tree", "emitState", { nodeCount: nodes.length, decided: state.decidedCount, exploring: state.exploringCount });
	pi.events.emit(DASHBOARD_UPDATE_EVENT, { source: "design-tree" });
}
