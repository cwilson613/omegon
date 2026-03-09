import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emitResolvedBugCandidate } from "./lifecycle-emitter.ts";

describe("cleave lifecycle emitter", () => {
  it("emits durable resolved bug conclusions", () => {
    const candidates = emitResolvedBugCandidate(
      "Fixed duplicate lifecycle fact storage by reinforcing existing facts.",
      "openspec/changes/memory-lifecycle-integration/tasks.md",
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].section, "Known Issues");
  });

  it("ignores transient chatter", () => {
    const candidates = emitResolvedBugCandidate(
      "Intermediate plan: maybe we could change this later.",
      "review.md",
    );
    assert.equal(candidates.length, 0);
  });
});
