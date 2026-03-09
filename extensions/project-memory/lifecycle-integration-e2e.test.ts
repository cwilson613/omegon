import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { FactStore } from "./factstore.ts";
import { ingestLifecycleCandidatesBatch } from "./lifecycle.ts";
import { emitDecisionCandidates } from "../design-tree/lifecycle-emitter.ts";
import { emitArchiveCandidates, emitReconcileCandidates } from "../openspec/lifecycle-emitter.ts";
import { emitResolvedBugCandidate } from "../cleave/lifecycle-emitter.ts";
import type { DesignNode } from "../design-tree/types.ts";
import type { ChangeInfo } from "../openspec/types.ts";

let tempDir = "";
let store: FactStore;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "memory-lifecycle-e2e-"));
  store = new FactStore(tempDir, { dbName: "facts.db" });
});

afterEach(() => {
  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeDesignDoc(): DesignNode {
  const docPath = path.join(tempDir, "memory-lifecycle-integration.md");
  fs.writeFileSync(docPath, `---
id: memory-lifecycle-integration
title: Memory integration
status: decided
---

## Decisions
### Decision: Use hybrid lifecycle-driven memory writes

**Status:** decided

**Rationale:** Store stable conclusions only.
`);

  return {
    id: "memory-lifecycle-integration",
    title: "Memory integration",
    status: "decided",
    dependencies: [],
    related: [],
    tags: [],
    open_questions: [],
    branches: [],
    filePath: docPath,
    lastModified: Date.now(),
  };
}

function makeArchivedChange(): ChangeInfo {
  return {
    name: "memory-lifecycle-integration",
    path: path.join(tempDir, "openspec/changes/memory-lifecycle-integration"),
    stage: "archived",
    hasProposal: true,
    hasDesign: true,
    hasSpecs: true,
    hasTasks: true,
    totalTasks: 1,
    doneTasks: 1,
    specs: [{
      domain: "memory/lifecycle",
      filePath: path.join(tempDir, "openspec/archive/2026-03-09-memory-lifecycle-integration/specs/memory/lifecycle.md"),
      sections: [{
        type: "added",
        requirements: [{
          title: "Structured lifecycle conclusions create memory candidates",
          description: "",
          scenarios: [],
        }],
      }],
    }],
  };
}

describe("lifecycle integration end-to-end", () => {
  it("stores a decided design decision as a pointer fact in Decisions", () => {
    const node = writeDesignDoc();
    const candidates = emitDecisionCandidates(node, "Use hybrid lifecycle-driven memory writes", "decided");
    const result = ingestLifecycleCandidatesBatch(store, "default", candidates);

    assert.equal(result.autoStored, 1);
    const facts = store.getActiveFacts("default");
    assert.equal(facts.length, 1);
    assert.equal(facts[0].section, "Decisions");
    assert.match(facts[0].content, /Use hybrid lifecycle-driven memory writes/);
    assert.match(facts[0].content, /See .*memory-lifecycle-integration\.md/);
  });

  it("stores archived OpenSpec requirements from baseline authority, not proposal intent", () => {
    const archived = emitArchiveCandidates(makeArchivedChange());
    const proposed = emitArchiveCandidates({ ...makeArchivedChange(), stage: "planned" });
    assert.equal(proposed.length, 0);

    const result = ingestLifecycleCandidatesBatch(store, "default", archived);
    assert.equal(result.autoStored, 1);

    const facts = store.getActiveFacts("default");
    assert.equal(facts[0].section, "Specs");
    assert.match(facts[0].content, /Structured lifecycle conclusions create memory candidates/);
    assert.match(facts[0].content, /openspec\/baseline\/memory\/lifecycle\.md/);
  });

  it("stores one durable conclusion for resolved outcomes rather than breadcrumb spam", () => {
    const reconcile = emitReconcileCandidates(
      "memory-lifecycle-integration",
      "Fixed duplicate lifecycle fact storage by reinforcing existing facts.",
      ["Could consider another approach?"],
    );
    const cleave = emitResolvedBugCandidate(
      "Fixed duplicate lifecycle fact storage by reinforcing existing facts.",
      "openspec/changes/memory-lifecycle-integration/tasks.md",
    );

    const result = ingestLifecycleCandidatesBatch(store, "default", [...reconcile, ...cleave]);
    assert.equal(result.autoStored, 1);
    assert.equal(result.reinforced, 1);

    const issueFacts = store.getActiveFacts("default").filter((fact) => fact.section === "Known Issues");
    assert.equal(issueFacts.length, 1);
    assert.match(issueFacts[0].content, /Fixed duplicate lifecycle fact storage/);

    const constraintFacts = store.getActiveFacts("default").filter((fact) => fact.section === "Constraints");
    assert.equal(constraintFacts.length, 0);
  });
});
