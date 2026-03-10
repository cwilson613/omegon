import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

function runAssessSpecScenario(mode: "bridged" | "interactive" | "reopen") {
	const script = String.raw`
(async () => {
  const { createAssessStructuredExecutors } = await import('./extensions/cleave/index.ts');
  const mode = ${JSON.stringify(mode)};
  let runnerCalled = false;
  const pi = {
    exec: async (_cmd, args) => {
      if (args[0] === 'rev-parse') return { code: 0, stdout: 'abc123\n', stderr: '' };
      if (args[0] === 'status') return { code: 0, stdout: '', stderr: '' };
      if (args[0] === 'diff') return { code: 0, stdout: '', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    },
  };
  const executors = createAssessStructuredExecutors(pi, {
    runSpecAssessment: async () => {
      runnerCalled = true;
      if (mode === 'interactive') {
        throw new Error('interactive assess should not invoke the bridged runner');
      }
      if (mode === 'reopen') {
        return {
          assessed: {
            summary: { total: 4, pass: 3, fail: 1, unclear: 0 },
            scenarios: [
              { domain: 'harness/slash-commands', requirement: 'Bridged /assess spec returns a completed structured result', scenario: 'scenario 1', status: 'PASS', evidence: ['extensions/cleave/index.ts'] },
              { domain: 'harness/slash-commands', requirement: 'Interactive /assess may remain follow-up driven without corrupting the bridge contract', scenario: 'scenario 2', status: 'PASS', evidence: ['extensions/cleave/index.ts'] },
              { domain: 'harness/slash-commands', requirement: 'Bridged assess lifecycle metadata is trustworthy for reconciliation', scenario: 'scenario 3', status: 'FAIL', evidence: ['extensions/cleave/index.ts'], notes: 'Reopened work.' },
              { domain: 'harness/slash-commands', requirement: 'Bridged /assess preserves normalized invocation args', scenario: 'scenario 4', status: 'PASS', evidence: ['extensions/cleave/bridge.ts'] },
            ],
            changedFiles: ['extensions/cleave/index.ts'],
            constraints: ['Lifecycle metadata must be derived after scenario evaluation'],
          },
        };
      }
      return {
        assessed: {
          summary: { total: 4, pass: 4, fail: 0, unclear: 0 },
          scenarios: [
            { domain: 'harness/slash-commands', requirement: 'Bridged /assess spec returns a completed structured result', scenario: 'scenario 1', status: 'PASS', evidence: ['extensions/cleave/index.ts'] },
            { domain: 'harness/slash-commands', requirement: 'Interactive /assess may remain follow-up driven without corrupting the bridge contract', scenario: 'scenario 2', status: 'PASS', evidence: ['extensions/cleave/index.ts'] },
            { domain: 'harness/slash-commands', requirement: 'Bridged assess lifecycle metadata is trustworthy for reconciliation', scenario: 'scenario 3', status: 'PASS', evidence: ['extensions/cleave/index.ts'] },
            { domain: 'harness/slash-commands', requirement: 'Bridged /assess preserves normalized invocation args', scenario: 'scenario 4', status: 'PASS', evidence: ['extensions/cleave/bridge.ts'] },
          ],
          changedFiles: [],
          constraints: ['Bridge result must remain authoritative in-band'],
        },
      };
    },
  });
  const ctx = mode === 'interactive'
    ? { cwd: process.cwd(), hasUI: true, waitForIdle: async () => {}, model: { id: 'test-model' } }
    : { cwd: process.cwd(), bridgeInvocation: true, hasUI: false, model: { id: 'test-model' } };
  const result = await executors.spec('assess-bridge-completed-results', ctx);
  process.stdout.write(JSON.stringify({
    summary: result.summary,
    completion: result.completion,
    lifecycleOutcome: result.lifecycleRecord?.outcome,
    effectTypes: result.effects.map((effect) => effect.type),
    recommendedReconcileOutcome: result.data?.recommendedReconcileOutcome,
    reopen: result.lifecycleRecord?.reconciliation.reopen,
    changedFiles: result.lifecycleRecord?.reconciliation.changedFiles,
    constraints: result.lifecycleRecord?.reconciliation.constraints,
    runnerCalled,
  }));
})();
`;

	return JSON.parse(execFileSync("node", ["-e", script], {
		cwd: process.cwd(),
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}));
}

describe("createAssessStructuredExecutors", () => {
	it("returns a completed in-band result for bridged /assess spec", () => {
		const result = runAssessSpecScenario("bridged");

		assert.match(result.summary, /completed spec assessment/i);
		assert.deepEqual(result.completion, {
			completed: true,
			completedInBand: true,
			requiresFollowUp: false,
			outcome: "pass",
		});
		assert.equal(result.lifecycleOutcome, "pass");
		assert.deepEqual(result.effectTypes, ["reconcile_hint"]);
		assert.equal(result.recommendedReconcileOutcome, "pass");
		assert.equal(result.runnerCalled, true);
	});

	it("keeps interactive /assess spec follow-up driven", () => {
		const result = runAssessSpecScenario("interactive");

		assert.match(result.summary, /prepared spec assessment/i);
		assert.deepEqual(result.completion, {
			completed: false,
			completedInBand: false,
			requiresFollowUp: true,
		});
		assert.deepEqual(result.effectTypes, ["view", "follow_up", "reconcile_hint"]);
		assert.equal(result.runnerCalled, false);
	});

	it("derives bridged lifecycle metadata from the completed assessment result", () => {
		const result = runAssessSpecScenario("reopen");

		assert.equal(result.completion.outcome, "reopen");
		assert.equal(result.lifecycleOutcome, "reopen");
		assert.equal(result.recommendedReconcileOutcome, "reopen");
		assert.equal(result.reopen, true);
		assert.deepEqual(result.changedFiles, ["extensions/cleave/index.ts"]);
		assert.deepEqual(result.constraints, ["Lifecycle metadata must be derived after scenario evaluation"]);
	});
});
