import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { DesignNode } from "./types.ts";
import { emitConstraintCandidates, emitDecisionCandidates } from "./lifecycle-emitter.ts";

let tempDir = "";
let docPath = "";

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "design-lifecycle-"));
  docPath = path.join(tempDir, "memory-lifecycle-integration.md");
  fs.writeFileSync(docPath, `---
id: memory-lifecycle-integration
title: Memory integration
status: decided
---

## Decisions
### Decision: Use hybrid lifecycle-driven memory writes

**Status:** decided

**Rationale:** Store stable conclusions only.

## Open Questions
- Should we do this?

## Implementation Notes
Constraints:
- Do not store open questions.
`);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeNode(): DesignNode {
  return {
    id: "memory-lifecycle-integration",
    title: "Memory integration",
    status: "decided",
    dependencies: [],
    related: [],
    tags: [],
    open_questions: ["Should we do this?"],
    branches: [],
    filePath: docPath,
    lastModified: Date.now(),
  };
}

describe("design-tree lifecycle emitter", () => {
  it("emits decided decision candidates with source reference", () => {
    const node = makeNode();
    const candidates = emitDecisionCandidates(node, "Use hybrid lifecycle-driven memory writes", "decided");
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].section, "Decisions");
    assert.equal(candidates[0].artifactRef?.path, docPath);
  });

  it("does not emit non-decided decisions", () => {
    const node = makeNode();
    const candidates = emitDecisionCandidates(node, "Use hybrid lifecycle-driven memory writes", "exploring");
    assert.equal(candidates.length, 0);
  });

  it("emits only explicit constraints", () => {
    const node = makeNode();
    const candidates = emitConstraintCandidates(node, ["Auto-store explicit structured conclusions."]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].section, "Constraints");
    assert.match(candidates[0].content, /Auto-store explicit/);
  });
});
