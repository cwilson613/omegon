/**
 * openspec/lifecycle — Canonical lifecycle resolver for OpenSpec surfaces.
 *
 * Exports buildLifecycleSummary, the single shared function that both the
 * status and get surfaces in index.ts call to derive stage, verificationSubstate,
 * and archiveReady.  Extracting it here makes it importable by tests so that
 * cross-surface agreement can be asserted against the actual production logic.
 *
 * No pi dependency — can be tested standalone.
 */

import type { ChangeInfo } from "./types.ts";
import {
	getAssessmentStatus,
	resolveLifecycleSummary,
	type LifecycleSummary,
} from "./spec.ts";
import { evaluateLifecycleReconciliation } from "./reconcile.ts";

export type { LifecycleSummary };

/**
 * Derive the canonical lifecycle summary for a change.
 *
 * This is the single source of truth consumed by:
 *   - the `status` action (list view)
 *   - the `get` action (detail view)
 *   - the `archive` gate
 *   - dashboard-state publication
 *
 * All surfaces must call this function rather than re-deriving lifecycle
 * state locally so that they cannot diverge.
 */
export function buildLifecycleSummary(repoPath: string, change: ChangeInfo): LifecycleSummary {
	const assessment = getAssessmentStatus(repoPath, change.name);
	const reconciliation = evaluateLifecycleReconciliation(repoPath, change.name);
	const archiveBlockedReason = reconciliation.issues.length > 0
		? reconciliation.issues.map((issue) => issue.suggestedAction).join(" ")
		: null;
	return resolveLifecycleSummary({
		change,
		record: assessment.record,
		freshness: assessment.freshness,
		archiveBlocked: reconciliation.issues.length > 0,
		archiveBlockedReason,
		archiveBlockedIssueCodes: reconciliation.issues.map((issue) => issue.code),
		boundNodeIds: reconciliation.boundNodeIds,
	});
}
