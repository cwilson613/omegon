import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emitArchiveCandidates, emitReconcileCandidates } from "./lifecycle-emitter.ts";
import type { ChangeInfo } from "./types.ts";

function makeChange(stage: ChangeInfo["stage"]): ChangeInfo {
  return {
    name: "memory-lifecycle-integration",
    path: "/repo/openspec/changes/memory-lifecycle-integration",
    stage,
    hasProposal: true,
    hasDesign: true,
    hasSpecs: true,
    hasTasks: true,
    totalTasks: 2,
    doneTasks: 2,
    specs: [{
      domain: "memory/lifecycle",
      filePath: "/repo/openspec/changes/memory-lifecycle-integration/specs/memory/lifecycle.md",
      sections: [{
        type: "added",
        requirements: [{ title: "Structured lifecycle conclusions create memory candidates", description: "", scenarios: [] }],
      }],
    }],
  };
}

describe("openspec lifecycle emitter", () => {
  it("emits archived baseline candidates only after archive", () => {
    assert.equal(emitArchiveCandidates(makeChange("planned")).length, 0);
    const candidates = emitArchiveCandidates(makeChange("archived"));
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].artifactRef?.path, "openspec/baseline/memory/lifecycle.md");
  });

  it("emits non-speculative reconcile constraints", () => {
    const candidates = emitReconcileCandidates("x", undefined, [
      "Auto-store explicit structured lifecycle conclusions.",
      "Could consider another option?",
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].section, "Constraints");
  });

  it("emits resolved bug summaries as known issues conclusions", () => {
    const candidates = emitReconcileCandidates("x", "Fixed duplicate lifecycle fact storage by reinforcing existing facts.");
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].section, "Known Issues");
  });
});
