import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

function runJsonScript(script: string) {
	return JSON.parse(execFileSync("node", ["-e", script], {
		cwd: process.cwd(),
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}));
}

function runAssessSpecScenario(mode: "bridged" | "interactive" | "reopen") {
	const script = String.raw`
(async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createAssessStructuredExecutors } = await import('./extensions/cleave/index.ts');
  const mode = ${JSON.stringify(mode)};
  const changeName = '__test-assess-fixture';

  // Scaffold a temporary OpenSpec change so findExecutableChanges discovers it
  const fixtureDir = path.join(process.cwd(), 'openspec', 'changes', changeName);
  const specsDir = path.join(fixtureDir, 'specs', 'test');
  fs.mkdirSync(specsDir, { recursive: true });
  const NL = String.fromCharCode(10);
  fs.writeFileSync(path.join(fixtureDir, 'proposal.md'), ['# Test fixture', '## Intent', 'Test', ''].join(NL));
  fs.writeFileSync(path.join(fixtureDir, 'tasks.md'), ['# Tasks', '- [x] 1.1 Done', ''].join(NL));
  fs.writeFileSync(path.join(specsDir, 'spec.md'), ['# test/spec', '## ADDED Requirements', '### Requirement: Test', '#### Scenario: test passes', 'Given a test', 'When it runs', 'Then it passes', ''].join(NL));
  const cleanup = () => { try { fs.rmSync(fixtureDir, { recursive: true, force: true }); } catch {} };
  const scenarios = [
    { domain: 'test/spec', requirement: 'Test', scenario: 'test passes', status: mode === 'reopen' ? 'FAIL' : 'PASS', evidence: ['extensions/model-budget.ts'], notes: mode === 'reopen' ? 'Reopened work.' : undefined },
  ];
  let runnerCalled = false;
  const pi = {
    exec: async (_cmd, args) => {
      if (args[0] === 'rev-parse') return { code: 0, stdout: 'abc123\n', stderr: '' };
      if (args[0] === 'status') return { code: 0, stdout: '', stderr: '' };
      if (args[0] === 'diff') return { code: 0, stdout: '', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    },
    sendMessage: () => {},
    sendUserMessage: () => {},
  };
  const executors = createAssessStructuredExecutors(pi, {
    runSpecAssessment: async () => {
      runnerCalled = true;
      if (mode === 'interactive') {
        throw new Error('interactive assess should not invoke the bridged runner');
      }
      return {
        assessed: {
          summary: mode === 'reopen'
            ? { total: 1, pass: 0, fail: 1, unclear: 0 }
            : { total: 1, pass: 1, fail: 0, unclear: 0 },
          scenarios,
          changedFiles: mode === 'reopen' ? ['extensions/cleave/index.ts'] : [],
          constraints: mode === 'reopen'
            ? ['Lifecycle metadata must be derived after scenario evaluation']
            : ['Bridge result must remain authoritative in-band'],
        },
      };
    },
  });
  const ctx = mode === 'interactive'
    ? { cwd: process.cwd(), hasUI: true, waitForIdle: async () => {}, model: { id: 'test-model' } }
    : { cwd: process.cwd(), bridgeInvocation: true, hasUI: false, model: { id: 'test-model' } };
  const result = await executors.spec(changeName, ctx);
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
  cleanup();
})();
`;

	return runJsonScript(script);
}

function runDirtyTreePreflightScenario(mode: "clean" | "volatile-only" | "checkpoint" | "checkpoint-clipboard" | "generic" | "unknowns" | "checkpoint-post-dirty" | "checkpoint-commit-fail" | "checkpoint-empty-scope" | "select-checkpoint" | "select-stash-unrelated" | "select-proceed-without-cleave" | "select-cancel" | "select-checkpoint-post-dirty") {
	const script = String.raw`
(async () => {
  const { runDirtyTreePreflight } = await import('./extensions/cleave/index.ts');
  const mode = ${JSON.stringify(mode)};
  const commands = [];
  const updates = [];

  // ── Input-based action sequences (fallback path) ──────────────────────────────
  const answersByMode = {
    clean: [],
    'volatile-only': [],
    // checkpoint: first input selects action, second approves commit message (empty = use suggested).
    // The post-checkpoint git status returns clean, so the loop exits after one successful checkpoint.
    checkpoint: ['checkpoint', ''],
    // Same as checkpoint but commit message response is a transient clipboard path — should be treated as empty.
    'checkpoint-clipboard': ['checkpoint', '/var/folders/vl/w3m4rq616c9gv9cmbj99kz_80000gn/T/pi-clipboard-9b123c74-47d4-4fd6-8185-c57d16f4433a.png'],
    generic: ['proceed-without-cleave'],
    unknowns: ['stash-unrelated'],
    // checkpoint-post-dirty: first checkpoint attempt leaves excluded files dirty,
    // operator then stashes unrelated files to resolve.
    'checkpoint-post-dirty': ['checkpoint', '', 'stash-unrelated'],
    // checkpoint-commit-fail: git commit fails, error surfaces in preflight, operator cancels.
    'checkpoint-commit-fail': ['checkpoint', '', 'cancel'],
    // checkpoint-empty-scope: only untracked unknown file — explicit checkpoint commits it, then clean.
    'checkpoint-empty-scope': ['checkpoint', ''],
    // select-* modes use select UI — no input-based action answers needed.
    'select-checkpoint': [],
    'select-stash-unrelated': [],
    'select-proceed-without-cleave': [],
    'select-cancel': [],
    'select-checkpoint-post-dirty': [],
  };
  const inputs = [...(answersByMode[mode] ?? [])];

  // ── Select-based action sequences (modal path) ────────────────────────────────
  // Each entry is either a labelled option string (as rendered) or the bare keyword — both work.
  const selectActionsByMode = {
    'select-checkpoint': [
      'checkpoint        — commit related changes and continue  [use when work is ready to save before cleaving]',
    ],
    'select-stash-unrelated': [
      'stash-unrelated   — stash unrelated/unknown files and continue  [use when dirty files are not part of this change]',
    ],
    'select-proceed-without-cleave': [
      'proceed-without-cleave — skip cleave and continue working  [use when you want to defer parallel dispatch]',
    ],
    'select-cancel': [
      'cancel            — abort cleave  [use to exit without making any changes]',
    ],
    // First call: checkpoint action; second call (post-dirty loop): stash-unrelated.
    'select-checkpoint-post-dirty': [
      'checkpoint        — commit related changes and continue  [use when work is ready to save before cleaving]',
      'stash-unrelated   — stash unrelated/unknown files and continue  [use when dirty files are not part of this change]',
    ],
  };
  const selectActions = [...(selectActionsByMode[mode] ?? [])];

  // Commit-message approvals for select modes that trigger checkpoint.
  const commitInputsByMode = {
    'select-checkpoint': [''],
    'select-checkpoint-post-dirty': [''],
  };
  const commitInputs = [...(commitInputsByMode[mode] ?? [])];

  // Stateful git status call counter — enables per-call sequence responses (W2).
  // Some modes need "dirty on call 1, clean on call 2" to exercise post-checkpoint re-verification.
  let statusCallCount = 0;

  // Per-mode status sequences: each element is the stdout for that status call (0-indexed).
  // If a call index exceeds the array, the last element is reused.
  const dirtyCheckpointStatus = ' M openspec/changes/cleave-dirty-tree-checkpointing/tasks.md\n?? docs/cleave-dirty-tree-checkpointing.md\n';
  const statusSequencesByMode = {
    clean: [''],
    'volatile-only': [' M .pi/memory/facts.jsonl\n'],
    // call 0: initial dirty check; call 1: post-checkpoint re-verify → clean (C1 fix)
    checkpoint: [dirtyCheckpointStatus, ''],
    'checkpoint-clipboard': [dirtyCheckpointStatus, ''],
    generic: [' M README.md\n'],
    unknowns: [' M openspec/changes/other-change/tasks.md\n?? scratch/notes.md\n'],
    // call 0: initial dirty; call 1: post-checkpoint still dirty (excluded file remains); call 2+: operator resolves via stash
    'checkpoint-post-dirty': [dirtyCheckpointStatus, '?? docs/cleave-dirty-tree-checkpointing.md\n'],
    // commit-fail: status always dirty (commit never actually happens)
    'checkpoint-commit-fail': [dirtyCheckpointStatus],
    // empty-scope: only untracked docs file — checkpoint now commits it (call 0: dirty, call 1: clean)
    'checkpoint-empty-scope': ['?? docs/cleave-dirty-tree-checkpointing.md\n', ''],
    // select modal modes
    'select-checkpoint': [dirtyCheckpointStatus, ''],
    'select-stash-unrelated': [' M openspec/changes/other-change/tasks.md\n?? scratch/notes.md\n'],
    'select-proceed-without-cleave': [' M README.md\n'],
    'select-cancel': [' M README.md\n'],
    'select-checkpoint-post-dirty': [dirtyCheckpointStatus, '?? docs/cleave-dirty-tree-checkpointing.md\n'],
  };

  const pi = {
    exec: async (cmd, args) => {
      commands.push([cmd, ...args]);
      if (cmd !== 'git') return { code: 0, stdout: '', stderr: '' };
      if (args[0] === 'status') {
        const seq = statusSequencesByMode[mode] ?? [''];
        const stdout = seq[Math.min(statusCallCount, seq.length - 1)];
        statusCallCount++;
        return { code: 0, stdout, stderr: '' };
      }
      if (args[0] === 'add') {
        return { code: 0, stdout: '', stderr: '' };
      }
      if (args[0] === 'commit') {
        if (mode === 'checkpoint-commit-fail') {
          return { code: 1, stdout: '', stderr: 'error: nothing to commit, working tree clean' };
        }
        return { code: 0, stdout: '', stderr: '' };
      }
      if (args[0] === 'stash') {
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    },
  };

  const noUiModes = new Set(['clean', 'volatile-only']);
  const isSelectMode = mode.startsWith('select-');

  let ui;
  if (noUiModes.has(mode)) {
    ui = undefined;
  } else if (isSelectMode) {
    // Modal select path: select drives action choice; input handles commit-message approval.
    const selectTitlesSeen = [];
    const selectOptionsSeen = [];
    ui = {
      select: async (title, options) => {
        selectTitlesSeen.push(title);
        selectOptionsSeen.push(options);
        return selectActions.shift();
      },
      input: async (_prompt, initial) => commitInputs.shift() ?? initial ?? '',
    };
    // Attach seen arrays to updates for test assertions.
    updates.push({ selectTitlesSeen, selectOptionsSeen });
  } else {
    // Fallback input path (legacy / headless).
    ui = { input: async (_prompt, initial) => inputs.shift() ?? initial ?? '' };
  }

  const result = await runDirtyTreePreflight(pi, {
    repoPath: process.cwd(),
    openspecChangePath: (mode === 'generic' || mode === 'select-proceed-without-cleave' || mode === 'select-cancel') ? undefined : 'openspec/changes/cleave-dirty-tree-checkpointing',
    onUpdate: (payload) => updates.push(payload),
    ui,
  });
  process.stdout.write(JSON.stringify({ result, commands, updates }));
})();
`;

	return runJsonScript(script);
}

describe("createAssessStructuredExecutors", () => {
	it("returns a follow-up driven result for bridged /assess spec", () => {
		const result = runAssessSpecScenario("bridged");

		assert.match(result.summary, /prepared spec assessment/i);
		assert.deepEqual(result.completion, {
			completed: false,
			completedInBand: false,
			requiresFollowUp: true,
		});
		// Effects are eagerly applied and cleared before return
		assert.deepEqual(result.effectTypes, []);
		assert.equal(result.runnerCalled, false);
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

	it("reopen scenario also uses follow-up pattern for bridged invocation", () => {
		const result = runAssessSpecScenario("reopen");

		// Bridge invocations now always use follow-up pattern — outcome is
		// determined after the LLM evaluates scenarios, not in-band.
		assert.match(result.summary, /prepared spec assessment/i);
		assert.deepEqual(result.completion, {
			completed: false,
			completedInBand: false,
			requiresFollowUp: true,
		});
		assert.equal(result.runnerCalled, false);
	});
});

describe("dirty-tree preflight acceptance coverage", () => {
	it("clean tree proceeds without a dirty-tree checkpoint prompt", () => {
		const result = runDirtyTreePreflightScenario("clean");
		assert.equal(result.result, "continue");
		assert.deepEqual(result.updates, []);
		assert.deepEqual(result.commands, [["git", "status", "--porcelain"]]);
	});

	it("dirty tree summary distinguishes related, unrelated or unknown, and volatile files", () => {
		const result = runDirtyTreePreflightScenario("unknowns");
		const summary = result.updates[0]?.content?.[0]?.text ?? "";
		assert.match(summary, /related changes/i);
		assert.match(summary, /unrelated \/ unknown changes/i);
		assert.match(summary, /volatile artifacts/i);
		assert.match(summary, /openspec\/changes\/other-change\/tasks\.md/);
		assert.match(summary, /scratch\/notes\.md/);
	});

	it("volatile-only dirt does not block cleave by default", () => {
		const result = runDirtyTreePreflightScenario("volatile-only");
		const summary = result.updates[0]?.content?.[0]?.text ?? "";
		const autoSummary = result.updates[1]?.content?.[0]?.text ?? "";
		assert.equal(result.result, "continue");
		assert.match(summary, /volatile artifacts/i);
		assert.match(autoSummary, /stashed volatile artifacts automatically/i);
		assert.doesNotMatch(summary, /interactive input is unavailable/i);
		assert.equal(result.commands.filter((command: string[]) => command[1] === "stash").length, 1);
	});

	it("low-confidence unknown files are excluded from checkpoint scope by default", () => {
		const result = runDirtyTreePreflightScenario("unknowns");
		const stashCommand = result.commands.find((command: string[]) => command[1] === "stash");
		assert.equal(result.result, "continue");
		assert.ok(stashCommand, "expected stash command for unrelated/unknown files");
		assert.ok(stashCommand.includes("openspec/changes/other-change/tasks.md"));
		assert.ok(stashCommand.includes("scratch/notes.md"));
		assert.equal(result.commands.some((command: string[]) => command[1] === "add"), false);
		assert.equal(result.commands.some((command: string[]) => command[1] === "commit"), false);
	});

	it("generic classification still works when no active OpenSpec change exists", () => {
		const result = runDirtyTreePreflightScenario("generic");
		const summary = result.updates[0]?.content?.[0]?.text ?? "";
		assert.equal(result.result, "skip_cleave");
		assert.match(summary, /generic preflight fallback without OpenSpec context/i);
		assert.match(summary, /proceed-without-cleave/i);
	});

	it("checkpoint plans stage related files and wait for explicit approval before committing", () => {
		const result = runDirtyTreePreflightScenario("checkpoint");
		const summary = result.updates[0]?.content?.[0]?.text ?? "";
		const addCommand = result.commands.find((command: string[]) => command[1] === "add");
		const commitCommand = result.commands.find((command: string[]) => command[1] === "commit");
		assert.equal(result.result, "continue");
		assert.match(summary, /Suggested checkpoint commit:/i);
		assert.ok(addCommand, "expected git add to stage checkpoint files");
		assert.ok(commitCommand, "expected git commit after explicit approval");
		assert.ok(addCommand.includes("openspec/changes/cleave-dirty-tree-checkpointing/tasks.md"));
		assert.ok(!addCommand.includes("docs/cleave-dirty-tree-checkpointing.md"));
		assert.ok(commitCommand.some((part: string) => /checkpoint/i.test(String(part))));
	});

	it("ignores transient clipboard attachment paths during checkpoint approval", () => {
		const result = runDirtyTreePreflightScenario("checkpoint-clipboard");
		const commitCommand = result.commands.find((command: string[]) => command[1] === "commit");
		assert.equal(result.result, "continue");
		assert.ok(commitCommand, "expected git commit after checkpoint approval");
		assert.match(String(commitCommand[3] ?? ""), /checkpoint/i);
		assert.ok(!commitCommand.includes("/var/folders/vl/w3m4rq616c9gv9cmbj99kz_80000gn/T/pi-clipboard-9b123c74-47d4-4fd6-8185-c57d16f4433a.png"));
	});

	it("post-checkpoint diagnosis names remaining dirty paths when excluded files still exist after commit", () => {
		// Spec: "checkpoint leaves excluded files dirty" — the unrelated docs file was never in checkpoint
		// scope, so it remains dirty. Preflight must emit explicit diagnosis and NOT return success yet.
		const result = runDirtyTreePreflightScenario("checkpoint-post-dirty");
		// After the first checkpoint attempt, a diagnosis update fires before the operator resolves remaining files.
		const diagnosisUpdate = result.updates.find((u: { content: Array<{ text: string }> }) =>
			/checkpoint committed successfully.*dirty files remain/i.test(u.content?.[0]?.text ?? "")
		);
		assert.ok(diagnosisUpdate, "expected post-checkpoint diagnosis naming remaining dirty paths");
		const diagText: string = diagnosisUpdate.content[0].text;
		assert.match(diagText, /docs\/cleave-dirty-tree-checkpointing\.md/);
		// Operator stashes unrelated files in the second loop iteration — cleave must continue.
		assert.equal(result.result, "continue");
	});

	it("git commit failure during checkpoint surfaces the error in preflight rather than pretending success", () => {
		// Spec: "git commit fails during checkpoint creation"
		const result = runDirtyTreePreflightScenario("checkpoint-commit-fail");
		// A preflight error update must contain the git failure reason.
		const errorUpdate = result.updates.find((u: { content: Array<{ text: string }> }) =>
			/preflight action failed/i.test(u.content?.[0]?.text ?? "")
		);
		assert.ok(errorUpdate, "expected preflight error update for git commit failure");
		const errorText: string = errorUpdate.content[0].text;
		assert.match(errorText, /git commit failed/i);
		assert.match(errorText, /nothing to commit/i);
		// Operator cancels after failure — must not return "continue".
		assert.equal(result.result, "cancelled");
	});

	it("checkpoint with only-untracked unknown files still commits them (explicit user choice)", () => {
		// When the user explicitly selects checkpoint, ALL non-volatile dirty files are
		// committed — even untracked unknowns. The conservative classification only gates
		// automatic decisions, not explicit operator choices.
		// scenario: only an untracked doc file, no OpenSpec context — checkpoint commits it.
		const result = runDirtyTreePreflightScenario("checkpoint-empty-scope");
		// Expect success (checkpoint resolved the dirty tree)
		assert.equal(result.result, "continue", `expected continue; updates:\n${result.updates.map((u: any) => u.content?.[0]?.text).join("\n")}`);
		// A git add + commit must have been issued for the untracked file
		const gitCommands = result.commands.filter((c: string[]) => c[0] === "git");
		const addCmd = gitCommands.find((c: string[]) => c[1] === "add");
		assert.ok(addCmd, `expected git add; commands: ${JSON.stringify(gitCommands)}`);
		const commitCmd = gitCommands.find((c: string[]) => c[1] === "commit");
		assert.ok(commitCmd, `expected git commit; commands: ${JSON.stringify(gitCommands)}`);
	});
});

describe("dirty-tree preflight — modal select UI path", () => {
	it("invokes select with a descriptive title and all five labelled options", () => {
		const result = runDirtyTreePreflightScenario("select-proceed-without-cleave");
		// The first entry pushed to updates is the select metadata object.
		const selectMeta = result.updates[0];
		assert.ok(selectMeta?.selectTitlesSeen?.length >= 1, "expected select to be called once");
		const title: string = selectMeta.selectTitlesSeen[0];
		assert.match(title, /dirty tree/i);
		const options: string[] = selectMeta.selectOptionsSeen[0];
		assert.equal(options.length, 5, "expected exactly 5 preflight options");
		const optionText = options.join("\n");
		assert.match(optionText, /checkpoint/);
		assert.match(optionText, /stash-unrelated/);
		assert.match(optionText, /stash-volatile/);
		assert.match(optionText, /proceed-without-cleave/);
		assert.match(optionText, /cancel/);
	});

	it("each option includes a description and a when-to-use note", () => {
		const result = runDirtyTreePreflightScenario("select-proceed-without-cleave");
		const selectMeta = result.updates[0];
		const options: string[] = selectMeta.selectOptionsSeen[0];
		for (const opt of options) {
			assert.match(opt, / — .+\[use when/i, `option missing description/note: "${opt}"`);
		}
	});

	it("select checkpoint — stages and commits related files then returns continue", () => {
		const result = runDirtyTreePreflightScenario("select-checkpoint");
		assert.equal(result.result, "continue");
		const gitCmds = result.commands.filter((c: string[]) => c[0] === "git");
		assert.ok(gitCmds.find((c: string[]) => c[1] === "add"), "expected git add");
		assert.ok(gitCmds.find((c: string[]) => c[1] === "commit"), "expected git commit");
	});

	it("select stash-unrelated — stashes unrelated files and returns continue", () => {
		const result = runDirtyTreePreflightScenario("select-stash-unrelated");
		assert.equal(result.result, "continue");
		assert.ok(result.commands.find((c: string[]) => c[1] === "stash"), "expected git stash");
		assert.equal(result.commands.some((c: string[]) => c[1] === "commit"), false);
	});

	it("select proceed-without-cleave — returns skip_cleave without modifying the tree", () => {
		const result = runDirtyTreePreflightScenario("select-proceed-without-cleave");
		assert.equal(result.result, "skip_cleave");
		assert.equal(result.commands.filter((c: string[]) => c[0] === "git" && c[1] !== "status").length, 0);
	});

	it("select cancel — returns cancelled without modifying the tree", () => {
		const result = runDirtyTreePreflightScenario("select-cancel");
		assert.equal(result.result, "cancelled");
		assert.equal(result.commands.filter((c: string[]) => c[0] === "git" && c[1] !== "status").length, 0);
	});

	it("select checkpoint loop — re-prompts via select after partial checkpoint leaves remaining files dirty", () => {
		const result = runDirtyTreePreflightScenario("select-checkpoint-post-dirty");
		// select must have been called twice (once per loop iteration)
		const selectMeta = result.updates[0];
		assert.equal(selectMeta.selectTitlesSeen.length, 2, "expected select called twice");
		assert.equal(result.result, "continue");
	});

	it("falls back to input-based action when select is not provided", () => {
		// The 'generic' mode uses input-only ui — must still work via the fallback path.
		const result = runDirtyTreePreflightScenario("generic");
		assert.equal(result.result, "skip_cleave");
	});
});
