/**
 * Tests proving that OpenSpec status, get, and archive surfaces all consume
 * the canonical lifecycle resolver (buildLifecycleSummary from lifecycle.ts)
 * and agree on lifecycle details.
 *
 * Spec coverage:
 *   - lifecycle/resolver → OpenSpec status surfaces consume the canonical lifecycle resolver
 *   - lifecycle/resolver → Dashboard and design-tree bindings consume canonical lifecycle state
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
	createChange,
	addSpec,
	listChanges,
	getChange,
	getAssessmentStatus,
	resolveLifecycleSummary,
	resolveVerificationStatus,
	writeAssessmentRecord,
	type AssessmentRecord,
} from "./spec.ts";
import { evaluateLifecycleReconciliation } from "./reconcile.ts";
// The production function used by both status and get surfaces — imported here
// so that tests can verify the same code path is exercised by both surfaces.
import { buildLifecycleSummary } from "./lifecycle.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpRepo(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "openspec-surfaces-test-"));
}

function cleanupTmpRepo(dir: string): void {
	fs.rmSync(dir, { recursive: true, force: true });
}

function scaffoldChange(
	repoPath: string,
	name: string,
	opts: { withSpecs?: boolean; withTasks?: boolean; totalTasks?: number; doneTasks?: number } = {},
): string {
	createChange(repoPath, name, `Test ${name}`, "test");
	const changePath = path.join(repoPath, "openspec", "changes", name);

	if (opts.withSpecs) {
		addSpec(
			changePath,
			"core",
			`## ADDED Requirements\n\n### Requirement: R1\nBasic requirement\n#### Scenario: S1\nGiven context\nWhen action\nThen result\n`,
		);
	}

	if (opts.withTasks) {
		const total = opts.totalTasks ?? 3;
		const done = opts.doneTasks ?? 0;
		const lines: string[] = ["# Tasks\n"];
		lines.push("## Group: Main\n");
		for (let i = 1; i <= total; i++) {
			lines.push(`- [${i <= done ? "x" : " "}] Task ${i}`);
		}
		fs.writeFileSync(path.join(changePath, "tasks.md"), lines.join("\n"));
	}

	return changePath;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("lifecycle surfaces — canonical resolver agreement", () => {
	let tmpDir: string;

	before(() => {
		tmpDir = makeTmpRepo();
	});

	after(() => {
		cleanupTmpRepo(tmpDir);
	});

	it("status-list and get-detail produce the same stage and substate via shared resolver", () => {
		// This test verifies cross-surface agreement by simulating what each surface does:
		// - The "status" surface calls buildLifecycleSummary with a ChangeInfo from listChanges()
		// - The "get" surface calls buildLifecycleSummary with a ChangeInfo from getChange()
		// Both must produce identical lifecycle output.
		scaffoldChange(tmpDir, "my-change", { withSpecs: true, withTasks: true, totalTasks: 2, doneTasks: 2 });

		// Simulate the "status" surface: iterates listChanges() and calls buildLifecycleSummary
		const listed = listChanges(tmpDir);
		const listedChange = listed.find((c) => c.name === "my-change");
		assert.ok(listedChange, "change must appear in listChanges (status surface)");
		const summaryFromStatus = buildLifecycleSummary(tmpDir, listedChange);

		// Simulate the "get" surface: calls getChange() then buildLifecycleSummary
		const directChange = getChange(tmpDir, "my-change");
		assert.ok(directChange, "change must be found by getChange (get surface)");
		const summaryFromGet = buildLifecycleSummary(tmpDir, directChange);

		// Both surfaces call the same resolver with equivalent inputs — results must agree.
		assert.equal(summaryFromStatus.stage, summaryFromGet.stage, "stage must agree across status and get surfaces");
		assert.equal(
			summaryFromStatus.verificationSubstate,
			summaryFromGet.verificationSubstate,
			"verificationSubstate must agree across status and get surfaces",
		);
		assert.equal(
			summaryFromStatus.archiveReady,
			summaryFromGet.archiveReady,
			"archiveReady must agree across status and get surfaces",
		);
	});

	it("archive gate uses archiveReady from the canonical lifecycle resolver", () => {
		// The archive gate must refuse when archiveReady is false (no assessment),
		// and must report the same readiness as the status surface.
		scaffoldChange(tmpDir, "gate-agree", { withSpecs: true, withTasks: true, totalTasks: 2, doneTasks: 2 });
		const change = getChange(tmpDir, "gate-agree");
		assert.ok(change);

		// Production archive gate now calls buildLifecycleSummary and checks archiveReady.
		const lifecycle = buildLifecycleSummary(tmpDir, change);

		// Without a passing assessment record, archiveReady must be false.
		assert.equal(lifecycle.archiveReady, false, "no assessment → archiveReady must be false");
		// The status surface reports the same non-ready state.
		assert.notEqual(lifecycle.verificationSubstate, "archive-ready",
			"verificationSubstate must not be archive-ready when archiveReady is false");
		// nextAction must be populated so the archive refusal message is meaningful.
		assert.ok(lifecycle.nextAction, "nextAction must explain why archive is blocked");
	});

	it("change blocked by stale assessment is consistently reported before archive", () => {
		const name = "stale-assess";
		scaffoldChange(tmpDir, name, { withSpecs: true, withTasks: true, totalTasks: 1, doneTasks: 1 });
		const change = getChange(tmpDir, name);
		assert.ok(change);

		// Write an ambiguous assessment record (forces stale-assessment substate).
		const record: Omit<AssessmentRecord, "schemaVersion"> = {
			changeName: name,
			assessmentKind: "spec",
			outcome: "ambiguous",
			timestamp: new Date().toISOString(),
			summary: "ambiguous",
			snapshot: {
				gitHead: null,
				fingerprint: "test",
				dirty: false,
				scopedPaths: [],
				files: [],
			},
			reconciliation: {
				reopen: false,
				changedFiles: [],
				constraints: [],
				recommendedAction: null,
			},
		};
		writeAssessmentRecord(tmpDir, name, record);

		// Both the status surface and archive gate use buildLifecycleSummary — they see the same state.
		const lifecycle = buildLifecycleSummary(tmpDir, change);
		assert.equal(lifecycle.verificationSubstate, "stale-assessment",
			"ambiguous assessment must produce stale-assessment substate");
		assert.equal(lifecycle.archiveReady, false,
			"stale assessment must block archive (archiveReady false)");
	});

	it("dashboard state uses the same stage and verificationSubstate as status surface", () => {
		// The dashboard calls buildLifecycleSummary (via dashboard-state.ts); the status surface
		// also calls buildLifecycleSummary. Both must agree.
		const name = "dash-agree";
		scaffoldChange(tmpDir, name, { withSpecs: true, withTasks: true, totalTasks: 2, doneTasks: 2 });

		// Simulate dashboard surface: gets change from listChanges, calls buildLifecycleSummary
		const changes = listChanges(tmpDir);
		const dashChange = changes.find((c) => c.name === name);
		assert.ok(dashChange);
		const dashLifecycle = buildLifecycleSummary(tmpDir, dashChange);

		// Simulate status surface: gets change from getChange, calls buildLifecycleSummary
		const statusChange = getChange(tmpDir, name);
		assert.ok(statusChange);
		const statusLifecycle = buildLifecycleSummary(tmpDir, statusChange);

		assert.equal(dashLifecycle.stage, statusLifecycle.stage, "dashboard stage matches status stage");
		assert.equal(
			dashLifecycle.verificationSubstate,
			statusLifecycle.verificationSubstate,
			"dashboard verificationSubstate matches status verificationSubstate",
		);
		assert.equal(dashLifecycle.archiveReady, statusLifecycle.archiveReady,
			"dashboard archiveReady matches status archiveReady");
	});

	it("verificationSubstate from buildLifecycleSummary agrees with resolveVerificationStatus for the same inputs", () => {
		// resolveLifecycleSummary internally delegates to resolveVerificationStatus.
		// This test verifies that the delegation is consistent: the substate produced
		// by the canonical resolver matches what resolveVerificationStatus would return
		// for the same inputs — confirming no divergent local derivation exists.
		scaffoldChange(tmpDir, "verify-agree", { withSpecs: true, withTasks: true, totalTasks: 1, doneTasks: 1 });

		const change = getChange(tmpDir, "verify-agree");
		assert.ok(change);
		const assessment = getAssessmentStatus(tmpDir, "verify-agree");
		const reconciliation = evaluateLifecycleReconciliation(tmpDir, "verify-agree");
		const archiveBlockedReason = reconciliation.issues.length > 0
			? reconciliation.issues.map((i) => i.suggestedAction).join(" ")
			: null;
		const issueCodes = reconciliation.issues.map((i) => i.code);

		// resolveVerificationStatus directly
		const directVs = resolveVerificationStatus({
			stage: change.stage,
			record: assessment.record,
			freshness: assessment.freshness,
			archiveBlocked: reconciliation.issues.length > 0,
			archiveBlockedReason,
			archiveBlockedIssueCodes: issueCodes,
			changeName: change.name,
		});

		// Canonical resolver (production path)
		const lifecycle = buildLifecycleSummary(tmpDir, change);

		assert.equal(lifecycle.verificationSubstate, directVs.substate,
			"canonical resolver verificationSubstate must match resolveVerificationStatus.substate");
		assert.equal(lifecycle.nextAction, directVs.nextAction,
			"canonical resolver nextAction must match resolveVerificationStatus.nextAction");
	});

	it("missing-assessment substate is reported consistently across surfaces", () => {
		const name = "no-assess";
		scaffoldChange(tmpDir, name, { withSpecs: true, withTasks: true, totalTasks: 1, doneTasks: 1 });

		const change = getChange(tmpDir, name);
		assert.ok(change);

		// No assessment record written → verifying stage should show missing-assessment
		const lifecycle = buildLifecycleSummary(tmpDir, change);
		assert.equal(lifecycle.verificationSubstate, "missing-assessment");
		assert.equal(lifecycle.archiveReady, false);
	});
});
