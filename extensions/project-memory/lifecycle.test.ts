/**
 * Project Memory — Lifecycle Integration Tests
 *
 * Unit tests for lifecycle candidate normalization, explicit-vs-inferred routing,
 * pointer-fact formatting, and duplicate/supersede behavior.
 */

import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

import { FactStore } from "./factstore.ts";
import {
  ingestLifecycleCandidate,
  ingestLifecycleCandidatesBatch,
  shouldAutoStore,
  isLowSignalContent,
  formatAsPointerFact,
  findEquivalentFact,
  type LifecycleCandidate,
  type ArtifactReference,
} from "./lifecycle.ts";

describe("Lifecycle Integration", () => {
  // Create a temporary test database for each test
  function createTestStore(): { store: FactStore; cleanup: () => void } {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lifecycle-test-"));
    const store = new FactStore(tempDir);
    return {
      store,
      cleanup: () => {
        store.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
      },
    };
  }

  describe("Candidate Classification", () => {
    test("explicit authority should auto-store", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "design-decision",
        authority: "explicit",
        section: "Decisions",
        content: "Use TypeScript for type safety.",
      };
      assert.equal(shouldAutoStore(candidate), true);
    });

    test("inferred authority should not auto-store", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "cleave-outcome",
        authority: "inferred",
        section: "Architecture",
        content: "System seems to use microservices pattern.",
      };
      assert.equal(shouldAutoStore(candidate), false);
    });

    test("should reject proposal-stage OpenSpec content", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "openspec-archive",
        authority: "explicit",
        section: "Specs",
        content: "This proposal suggests implementing feature X.",
      };
      assert.equal(isLowSignalContent(candidate), true);
    });

    test("should reject cleave child execution chatter", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "cleave-outcome",
        authority: "explicit",
        section: "Architecture",
        content: "Intermediate reasoning shows that...",
      };
      assert.equal(isLowSignalContent(candidate), true);
    });

    test("should reject design constraints with open questions", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "design-constraint",
        authority: "explicit",
        section: "Constraints",
        content: "Should we use React or Vue?",
      };
      assert.equal(isLowSignalContent(candidate), true);
    });

    test("should accept valid design decisions", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "design-decision",
        authority: "explicit",
        section: "Decisions",
        content: "Use React for UI framework based on team expertise.",
      };
      assert.equal(isLowSignalContent(candidate), false);
    });
  });

  describe("Pointer-Fact Formatting", () => {
    test("should append design node reference", () => {
      const artifactRef: ArtifactReference = {
        type: "design-node",
        path: "docs/auth-design.md",
        subRef: "OAuth 2.0 Decision",
      };
      const candidate: LifecycleCandidate = {
        sourceKind: "design-decision",
        authority: "explicit",
        section: "Decisions",
        content: "Use OAuth 2.0 for authentication",
        artifactRef,
      };
      const formatted = formatAsPointerFact(candidate);
      assert.equal(formatted, "Use OAuth 2.0 for authentication. See docs/auth-design.md, decision: OAuth 2.0 Decision");
    });

    test("should append OpenSpec baseline reference", () => {
      const artifactRef: ArtifactReference = {
        type: "openspec-baseline",
        path: "openspec/baseline/auth/tokens.md",
        subRef: "JWT validation",
      };
      const candidate: LifecycleCandidate = {
        sourceKind: "openspec-archive",
        authority: "explicit",
        section: "Specs",
        content: "JWT tokens must be validated against issuer",
        artifactRef,
      };
      const formatted = formatAsPointerFact(candidate);
      assert.equal(formatted, "JWT tokens must be validated against issuer. See openspec/baseline/auth/tokens.md#JWT validation");
    });

    test("should not duplicate existing path reference", () => {
      const artifactRef: ArtifactReference = {
        type: "cleave-review",
        path: "review-123.md",
      };
      const candidate: LifecycleCandidate = {
        sourceKind: "cleave-bug-fix",
        authority: "explicit",
        section: "Known Issues",
        content: "Fixed race condition in review-123.md analysis",
        artifactRef,
      };
      const formatted = formatAsPointerFact(candidate);
      assert.equal(formatted, "Fixed race condition in review-123.md analysis");
    });

    test("should return content unchanged without artifact reference", () => {
      const candidate: LifecycleCandidate = {
        sourceKind: "design-constraint",
        authority: "explicit",
        section: "Constraints",
        content: "Must support Node.js 18+",
      };
      const formatted = formatAsPointerFact(candidate);
      assert.equal(formatted, "Must support Node.js 18+");
    });
  });

  describe("Deduplication & Equivalent Facts", () => {
    test("should find exact content match", () => {
      const { store, cleanup } = createTestStore();
      try {
        // Store an existing fact
        const result = store.storeFact({
          mind: "default",
          section: "Decisions",
          content: "Use TypeScript for type safety",
          source: "manual",
        });

        const candidate: LifecycleCandidate = {
          sourceKind: "design-decision",
          authority: "explicit",
          section: "Decisions",
          content: "Use TypeScript for type safety",
        };

        const existing = findEquivalentFact(store, "default", candidate);
        assert.equal(existing, result.id);
      } finally {
        cleanup();
      }
    });

    test("should find semantically equivalent content", () => {
      const { store, cleanup } = createTestStore();
      try {
        // Store an existing fact
        store.storeFact({
          mind: "default",
          section: "Architecture",
          content: "The system uses microservices architecture pattern",
          source: "manual",
        });

        const candidate: LifecycleCandidate = {
          sourceKind: "design-decision",
          authority: "explicit",
          section: "Architecture",
          content: "System uses microservices architecture pattern",
        };

        const existing = findEquivalentFact(store, "default", candidate);
        assert.notEqual(existing, null);
      } finally {
        cleanup();
      }
    });

    test("should not match different sections", () => {
      const { store, cleanup } = createTestStore();
      try {
        // Store an existing fact in Decisions
        store.storeFact({
          mind: "default",
          section: "Decisions",
          content: "Use TypeScript for type safety",
          source: "manual",
        });

        const candidate: LifecycleCandidate = {
          sourceKind: "design-decision",
          authority: "explicit",
          section: "Architecture", // Different section
          content: "Use TypeScript for type safety",
        };

        const existing = findEquivalentFact(store, "default", candidate);
        assert.equal(existing, null);
      } finally {
        cleanup();
      }
    });
  });

  describe("Candidate Ingestion", () => {
    test("should auto-store explicit design decision", () => {
      const { store, cleanup } = createTestStore();
      try {
        const candidate: LifecycleCandidate = {
          sourceKind: "design-decision",
          authority: "explicit",
          section: "Decisions",
          content: "Use React for UI components",
          artifactRef: {
            type: "design-node",
            path: "docs/ui-framework.md",
            subRef: "React Decision",
          },
        };

        const result = ingestLifecycleCandidate(store, "default", candidate);

        assert.equal(result.autoStored, true);
        assert.equal(result.duplicate, false);
        assert.notEqual(result.factId, undefined);

        // Verify fact was stored with correct source
        const fact = store.getFact(result.factId!);
        assert.notEqual(fact, null);
        assert.equal(fact!.source, "lifecycle");
        assert.equal(fact!.section, "Decisions");
        assert.equal(fact!.content, "Use React for UI components. See docs/ui-framework.md, decision: React Decision");
      } finally {
        cleanup();
      }
    });

    test("should reject low-signal workflow chatter", () => {
      const { store, cleanup } = createTestStore();
      try {
        const candidate: LifecycleCandidate = {
          sourceKind: "cleave-outcome",
          authority: "explicit",
          section: "Architecture",
          content: "Intermediate reasoning suggests microservices",
        };

        const result = ingestLifecycleCandidate(store, "default", candidate);

        assert.equal(result.autoStored, false);
        assert.equal(result.reason, "Rejected as low-signal workflow chatter");
      } finally {
        cleanup();
      }
    });

    test("should defer inferred candidates", () => {
      const { store, cleanup } = createTestStore();
      try {
        const candidate: LifecycleCandidate = {
          sourceKind: "cleave-outcome",
          authority: "inferred",
          section: "Architecture",
          content: "System appears to use event-driven architecture",
        };

        const result = ingestLifecycleCandidate(store, "default", candidate);

        assert.equal(result.autoStored, false);
        assert.equal(result.reason, "Inferred candidate requires operator confirmation");
      } finally {
        cleanup();
      }
    });

    test("should reinforce existing equivalent explicit fact", () => {
      const { store, cleanup } = createTestStore();
      try {
        // Store initial fact
        const initialResult = store.storeFact({
          mind: "default",
          section: "Constraints",
          content: "Must support Node.js 18+",
          source: "manual",
        });

        const candidate: LifecycleCandidate = {
          sourceKind: "design-constraint",
          authority: "explicit",
          section: "Constraints",
          content: "Must support Node.js 18+",
        };

        const result = ingestLifecycleCandidate(store, "default", candidate);

        assert.equal(result.autoStored, true);
        assert.equal(result.duplicate, true);
        assert.equal(result.factId, initialResult.id);
        assert.equal(result.reason, "Reinforced existing equivalent fact");

        // Verify fact was reinforced
        const fact = store.getFact(initialResult.id);
        assert.notEqual(fact, null);
        assert.equal(fact!.reinforcement_count, 2); // Should be incremented from initial 1 to 2
      } finally {
        cleanup();
      }
    });

    test("should not store inferred duplicate", () => {
      const { store, cleanup } = createTestStore();
      try {
        // Store initial fact
        store.storeFact({
          mind: "default",
          section: "Architecture",
          content: "Uses microservices pattern",
          source: "manual",
        });

        const candidate: LifecycleCandidate = {
          sourceKind: "cleave-outcome",
          authority: "inferred",
          section: "Architecture",
          content: "Uses microservices pattern",
        };

        const result = ingestLifecycleCandidate(store, "default", candidate);

        assert.equal(result.autoStored, false);
        assert.equal(result.duplicate, true);
        assert.equal(result.reason, "Equivalent fact already exists");
      } finally {
        cleanup();
      }
    });
  });

  describe("Batch Ingestion", () => {
    test("should process multiple candidates in transaction", () => {
      const { store, cleanup } = createTestStore();
      try {
        const candidates: LifecycleCandidate[] = [
          {
            sourceKind: "design-decision",
            authority: "explicit",
            section: "Decisions",
            content: "Use TypeScript",
          },
          {
            sourceKind: "design-constraint",
            authority: "explicit",
            section: "Constraints",
            content: "Support Node.js 18+",
          },
          {
            sourceKind: "cleave-outcome",
            authority: "inferred",
            section: "Architecture",
            content: "Appears to use REST API",
          },
          {
            sourceKind: "openspec-archive",
            authority: "explicit",
            section: "Specs",
            content: "This proposal suggests...", // Low signal
          },
        ];

        const result = ingestLifecycleCandidatesBatch(store, "default", candidates);

        assert.equal(result.autoStored, 2);    // TypeScript and Node.js constraint
        assert.equal(result.reinforced, 0);
        assert.equal(result.deferred, 1);     // Inferred REST API
        assert.equal(result.rejected, 1);     // Low signal proposal
        assert.equal(result.factIds.length, 2);

        // Verify facts were stored
        const facts = store.getActiveFacts("default");
        assert.equal(facts.length, 2);
        assert.equal(facts.filter(f => f.source === "lifecycle").length, 2);
      } finally {
        cleanup();
      }
    });

    test("should handle empty candidate array", () => {
      const { store, cleanup } = createTestStore();
      try {
        const result = ingestLifecycleCandidatesBatch(store, "default", []);

        assert.equal(result.autoStored, 0);
        assert.equal(result.reinforced, 0);
        assert.equal(result.deferred, 0);
        assert.equal(result.rejected, 0);
        assert.equal(result.factIds.length, 0);
      } finally {
        cleanup();
      }
    });
  });
});