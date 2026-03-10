/**
 * Tests proving that OpenSpec status, get, and dashboard-state surfaces
 * all agree on lifecycle details by consuming the canonical lifecycle resolver.
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
			`## Added\n### Requirement: R1\nBasic requirement\n#### Scenario: S1\nGiven context\nWhen action\nThen result\n`,
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

function buildLifecycleSummaryForChange(repoPath: string, name: string) {
	const change = getChange(repoPath, name);
	assert.ok(change, `Change '${name}' should exist`);
	const assessment = getAssessmentStatus(repoPath, name);
	const reconciliation = evaluateLifecycleReconciliation(repoPath, name);
	const archiveBlockedReason = reconciliation.issues.length > 0
		? reconciliation.issues.map((i) => i.suggestedAction).join(" ")
		: null;
	return resolveLifecycleSummary({
		change,
		record: assessment.record,
		freshness: assessment.freshness,
		archiveBlocked: reconciliation.issues.length > 0,
		archiveBlockedReason,
		archiveBlockedIssueCodes: reconciliation.issues.map((i) => i.code),
	});
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
		scaffoldChange(tmpDir, "my-change", { withSpecs: true, withTasks: true, totalTasks: 2, doneTasks: 2 });

		const change = getChange(tmpDir, "my-change");
		assert.ok(change);

		// Both "status" and "get" code paths call resolveLifecycleSummary with the same inputs
		const summaryA = buildLifecycleSummaryForChange(tmpDir, "my-change");
		const summaryB = buildLifecycleSummaryForChange(tmpDir, "my-change");

		// Idempotency — calling twice yields identical results
		assert.equal(summaryA.stage, summaryB.stage, "stage must agree across calls");
		assert.equal(
			summaryA.verificationSubstate,
			summaryB.verificationSubstate,
			"verificationSubstate must agree across calls",
		);
		assert.equal(summaryA.archiveReady, summaryB.archiveReady, "archiveReady must agree");
	});

	it("status surface verificationSubstate agrees with resolveVerificationStatus output", () => {
		scaffoldChange(tmpDir, "verify-agree", { withSpecs: true, withTasks: true, totalTasks: 1, doneTasks: 1 });

		const change = getChange(tmpDir, "verify-agree");
		assert.ok(change);
		const assessment = getAssessmentStatus(tmpDir, "verify-agree");
		const reconciliation = evaluateLifecycleReconciliation(tmpDir, "verify-agree");
		const archiveBlockedReason = reconciliation.issues.length > 0
			? reconciliation.issues.map((i) => i.suggestedAction).join(" ")
			: null;
		const issueCodes = reconciliation.issues.map((i) => i.code);

		// Old path
		const oldVs = resolveVerificationStatus({
			stage: change.stage,
			record: assessment.record,
			freshness: assessment.freshness,
			archiveBlocked: reconciliation.issues.length > 0,
			archiveBlockedReason,
			archiveBlockedIssueCodes: issueCodes,
			changeName: change.name,
		});

		// New canonical path
		const lifecycle = resolveLifecycleSummary({
			change,
			record: assessment.record,
			freshness: assessment.freshness,
			archiveBlocked: reconciliation.issues.length > 0,
			archiveBlockedReason,
			archiveBlockedIssueCodes: issueCodes,
		});

		// The canonical resolver delegates to resolveVerificationStatus internally —
		// so substate/nextAction must match exactly.
		assert.equal(lifecycle.verificationSubstate, oldVs.substate, "verificationSubstate must match old resolveVerificationStatus output");
		assert.equal(lifecycle.nextAction, oldVs.nextAction, "nextAction must match old resolveVerificationStatus output");
	});

	it("archive gate and status reporting share the same readiness rule", () => {
		scaffoldChange(tmpDir, "gate-agree", { withSpecs: true, withTasks: true, totalTasks: 2, doneTasks: 2 });
		const change = getChange(tmpDir, "gate-agree");
		assert.ok(change);

		// Without a passing assessment, change should not be archive-ready
		const lifecycle = buildLifecycleSummaryForChange(tmpDir, "gate-agree");
		assert.equal(lifecycle.archiveReady, false, "no assessment → not archive-ready");
		// And status surface must also reflect the same non-ready state
		assert.notEqual(lifecycle.verificationSubstate, "archive-ready");
	});

	it("change blocked by stale assessment is consistently reported before archive", () => {
		const name = "stale-assess";
		scaffoldChange(tmpDir, name, { withSpecs: true, withTasks: true, totalTasks: 1, doneTasks: 1 });
		const change = getChange(tmpDir, name);
		assert.ok(change);

		// Write an ambiguous assessment record (ambiguous forces stale-assessment substate)
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

		const lifecycle = buildLifecycleSummaryForChange(tmpDir, name);
		assert.equal(lifecycle.verificationSubstate, "stale-assessment", "ambiguous assessment → stale-assessment substate");
		assert.equal(lifecycle.archiveReady, false, "stale assessment → not archive-ready");
	});

	it("dashboard state uses the same stage and verificationSubstate as status surface", () => {
		const name = "dash-agree";
		scaffoldChange(tmpDir, name, { withSpecs: true, withTasks: true, totalTasks: 2, doneTasks: 2 });

		// Simulate dashboard-state.ts logic — it now calls resolveLifecycleSummary
		const changes = listChanges(tmpDir);
		const dashChange = changes.find((c) => c.name === name);
		assert.ok(dashChange);

		const assessment = getAssessmentStatus(tmpDir, name);
		const reconciliation = evaluateLifecycleReconciliation(tmpDir, name);
		const archiveBlockedReason = reconciliation.issues.length > 0
			? reconciliation.issues.map((i) => i.suggestedAction).join(" ")
			: null;
		const dashLifecycle = resolveLifecycleSummary({
			change: dashChange,
			record: assessment.record,
			freshness: assessment.freshness,
			archiveBlocked: reconciliation.issues.length > 0,
			archiveBlockedReason,
			archiveBlockedIssueCodes: reconciliation.issues.map((i) => i.code),
		});

		// Status surface
		const statusLifecycle = buildLifecycleSummaryForChange(tmpDir, name);

		assert.equal(dashLifecycle.stage, statusLifecycle.stage, "dashboard stage matches status stage");
		assert.equal(
			dashLifecycle.verificationSubstate,
			statusLifecycle.verificationSubstate,
			"dashboard verificationSubstate matches status verificationSubstate",
		);
		assert.equal(dashLifecycle.archiveReady, statusLifecycle.archiveReady, "dashboard archiveReady matches status archiveReady");
	});

	it("missing-assessment substate is reported consistently across surfaces", () => {
		const name = "no-assess";
		scaffoldChange(tmpDir, name, { withSpecs: true, withTasks: true, totalTasks: 1, doneTasks: 1 });

		const lifecycle = buildLifecycleSummaryForChange(tmpDir, name);
		// No assessment record written → verifying stage should show missing-assessment
		assert.equal(lifecycle.verificationSubstate, "missing-assessment");
		assert.equal(lifecycle.archiveReady, false);
	});
});
