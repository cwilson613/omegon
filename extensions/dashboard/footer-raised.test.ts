import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { DashboardFooter } from "./footer.ts";
import { sharedState } from "../shared-state.ts";
import type { DashboardState } from "./types.ts";
import { visibleWidth } from "@mariozechner/pi-tui";

function makeTheme() {
  return {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function makeFooterData() {
  return {
    getAvailableProviderCount: () => 2,
    getGitBranch: () => "main",
    getExtensionStatuses: () => new Map<string, string>(),
  };
}

function makeContext() {
  return {
    cwd: "/Users/cwilson/workspace/ai/pi-kit",
    model: {
      provider: "openai-codex",
      id: "gpt-5.4",
      reasoning: true,
    },
    getContextUsage: () => ({ percent: 31, contextWindow: 272000 }),
    sessionManager: {
      getEntries: () => [],
      getSessionName: () => undefined,
    },
  };
}

describe("DashboardFooter raised mode polish", () => {
  beforeEach(() => {
    (sharedState as any).designTree = {
      nodeCount: 4,
      decidedCount: 1,
      exploringCount: 1,
      implementingCount: 1,
      implementedCount: 1,
      blockedCount: 0,
      openQuestionCount: 0,
      focusedNode: null,
      implementingNodes: [{ id: "memory", title: "Memory integration", branch: "feature/memory", filePath: "docs/memory.md" }],
      nodes: [],
    };
    (sharedState as any).openspec = {
      changes: [{ name: "memory-lifecycle-integration", stage: "verifying", tasksDone: 6, tasksTotal: 6 }],
    };
    (sharedState as any).lastMemoryInjection = {
      mode: "semantic",
      projectFactCount: 30,
      edgeCount: 0,
      workingMemoryFactCount: 4,
      semanticHitCount: 12,
      episodeCount: 3,
      globalFactCount: 15,
      payloadChars: 4800,
      estimatedTokens: 1200,
    };
  });

  it("keeps wide raised mode stacked instead of bleeding multiple sections across one row", () => {
    (sharedState as any).cleave = {
      status: "dispatching",
      updatedAt: Date.now(),
      children: [{ label: "memory-core", status: "running" }],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(160);
    assert.ok(lines.some((line) => line.includes("◈ Design Tree")));
    assert.ok(lines.some((line) => line.includes("◎ OpenSpec")));
    // Design tree must appear on its own full-width row (not merged with openspec)
    assert.ok(lines.every((line) => !(line.includes("◈ Design Tree") && line.includes("◎ OpenSpec"))), lines.join("\n"));
  });

  it("hides stale failed cleave state after it ages out", () => {
    (sharedState as any).cleave = {
      status: "failed",
      updatedAt: Date.now() - 60_000,
      children: [{ label: "memory-core", status: "failed" }],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(160);
    assert.ok(lines.every((line) => !line.includes("⚡ Cleave")));
  });

  it("keeps memory audit compact enough for wide raised mode", () => {
    (sharedState as any).cleave = { status: "idle", updatedAt: Date.now(), children: [] };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(160);
    const memoryLine = lines.find((line) => line.includes("Memory "));
    assert.ok(memoryLine);
    assert.ok(!memoryLine?.includes("chars:"));
    assert.ok(!memoryLine?.includes("hits:"));
  });

  it("wide raised mode uses two-column layout — design tree full-width, recovery+cleave left, openspec right", () => {
    (sharedState as any).cleave = {
      status: "dispatching",
      updatedAt: Date.now(),
      children: [
        { label: "task-a", status: "running" },
        { label: "task-b", status: "done" },
      ],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(140);

    // Design tree must appear on its own full-width row
    const dtLine = lines.find((l) => l.includes("◈ Design Tree"));
    assert.ok(dtLine, `expected ◈ Design Tree line; got:\n${lines.join("\n")}`);
    assert.ok(!dtLine!.includes("◎ OpenSpec"), "design tree row must not bleed into openspec");

    // In wide mode, cleave (left column) and openspec (right column) are side-by-side on
    // the SAME merged row — verify at least one such row exists (confirming column layout).
    const mergedRow = lines.find((l) => l.includes("⚡ Cleave") || l.includes("◎ OpenSpec"));
    assert.ok(mergedRow, `expected a row with cleave or openspec in column zone; got:\n${lines.join("\n")}`);

    // There must be a row containing the divider (│) — confirms two-column layout
    const dividerRow = lines.find((l) => l.includes("│"));
    assert.ok(dividerRow, `expected a │ divider row; got:\n${lines.join("\n")}`);

    // All rows must fit within the requested width
    for (const line of lines) {
      const vw = visibleWidth(line);
      assert.ok(vw <= 140, `line too wide (${vw} > 140): ${line}`);
    }
  });

  it("wide mode column rows have consistent visible width (column alignment)", () => {
    (sharedState as any).cleave = {
      status: "dispatching",
      updatedAt: Date.now(),
      children: [{ label: "a", status: "running" }, { label: "b", status: "done" }],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(120);
    const columnRows = lines.filter((l) => l.includes("│"));
    assert.ok(columnRows.length > 0, "expected at least one column row");

    // All column rows should have the same visible width (= terminal width)
    const widths = columnRows.map((l) => visibleWidth(l));
    const allSame = widths.every((w) => w === widths[0]);
    assert.ok(allSame, `column rows have unequal widths: ${widths.join(", ")}`);
    assert.equal(widths[0], 120);
  });

  it("OSC 8 hyperlinks in rendered lines do not inflate visibleWidth (regression)", () => {
    // OSC 8 hyperlinks are zero-width escape sequences; visibleWidth must not
    // count them, ensuring column layout stays aligned when file paths are linked.
    (sharedState as any).designTree = {
      ...(sharedState as any).designTree,
      focusedNode: null,
      implementingNodes: [{
        id: "linked",
        title: "Linked Node",
        branch: "feature/linked",
        filePath: "docs/linked.md",
      }],
    };
    (sharedState as any).cleave = { status: "idle", updatedAt: Date.now(), children: [] };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(120);
    for (const line of lines) {
      const vw = visibleWidth(line);
      assert.ok(
        vw <= 120,
        `visibleWidth ${vw} exceeds 120 — OSC 8 sequences may be inflating width:\n  ${line}`,
      );
    }
  });

  it("raised mode meta line includes context gauge, model, and thinking (not a duplicate stats row)", () => {
    // In raised mode the context/model/thinking info lives in the pinned meta line
    // (buildRaisedMetaLine), not in a separate leftRight stats row. The meta line
    // uses the "Context " prefix label rather than a bare percentage.
    (sharedState as any).cleave = { status: "idle", updatedAt: Date.now(), children: [] };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(100);
    // The meta line includes "Context", "gpt-5.4", and the context gauge percentage.
    const metaLine = lines.find((l) => l.includes("Context") && l.includes("gpt-5.4"));
    assert.ok(metaLine, `expected meta line with Context + gpt-5.4; got:\n${lines.join("\n")}`);
    assert.ok(metaLine!.includes("31%"), `expected context percent in meta line: ${metaLine}`);
    // There must NOT be a separate bare-percentage stats row (no "31%/272k" without "Context ").
    const bareStatsLine = lines.find((l) => l.includes("31%/272k") && l.includes("gpt-5.4") && !l.includes("Context"));
    assert.ok(!bareStatsLine, `raised mode must not emit a duplicate bare stats row:\n${lines.join("\n")}`);
  });

  it("narrow raised mode (<120) stays stacked — no │ divider rows", () => {
    (sharedState as any).cleave = {
      status: "dispatching",
      updatedAt: Date.now(),
      children: [{ label: "x", status: "running" }],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(100);
    assert.ok(
      lines.every((l) => !l.includes("│")),
      `narrow mode must not use column divider:\n${lines.join("\n")}`,
    );
  });

  it("pinned bottom block always contains context/model/thinking in raised mode", () => {
    // Populate several upper sections so there is content pressure above the footer zone.
    (sharedState as any).cleave = {
      status: "dispatching",
      updatedAt: Date.now(),
      children: [
        { label: "child-a", status: "running" },
        { label: "child-b", status: "running" },
        { label: "child-c", status: "done" },
      ],
    };
    (sharedState as any).openspec = {
      changes: [
        { name: "change-one", stage: "implementing", tasksDone: 3, tasksTotal: 10 },
        { name: "change-two", stage: "specified", tasksDone: 0, tasksTotal: 5 },
      ],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(140);

    // The pinned bottom block must include context gauge info (percent visible)
    assert.ok(
      lines.some((l) => l.includes("31%") || l.includes("Context")),
      `expected context info in pinned block;\n${lines.join("\n")}`,
    );
    // Model name must appear
    assert.ok(
      lines.some((l) => l.includes("gpt-5.4")),
      `expected model name in pinned block;\n${lines.join("\n")}`,
    );
    // Compact/raise hint must appear
    assert.ok(
      lines.some((l) => l.includes("/dash to compact") || l.includes("compact")),
      `expected compact hint in pinned block;\n${lines.join("\n")}`,
    );
  });

  it("raised mode does not duplicate context/model stats as a second footer row", () => {
    (sharedState as any).cleave = { status: "idle", updatedAt: Date.now(), children: [] };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(140);

    // The model name must not appear more than once (no duplicate stats row)
    const modelLines = lines.filter((l) => l.includes("gpt-5.4"));
    assert.ok(
      modelLines.length <= 1,
      `model name appeared ${modelLines.length} times — raised mode emitted a duplicate stats row:\n${lines.join("\n")}`,
    );

    // context% also must not appear more than once
    const ctxLines = lines.filter((l) => l.includes("31%"));
    assert.ok(
      ctxLines.length <= 1,
      `context% appeared ${ctxLines.length} times — raised mode emitted duplicate context rows:\n${lines.join("\n")}`,
    );
  });

  it("compact hint appears in the pinned footer zone, not below duplicate generic rows", () => {
    (sharedState as any).cleave = {
      status: "dispatching",
      updatedAt: Date.now(),
      children: [{ label: "x", status: "running" }],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(140);

    const hintIdx = lines.findIndex((l) => l.includes("compact") || l.includes("/dash"));
    assert.ok(hintIdx !== -1, `compact hint not found in output:\n${lines.join("\n")}`);

    // The hint must appear before the pwd line (⌂) — it is in the pinned zone
    // above the footer data, not pushed below a duplicate stats block.
    const pwdIdx = lines.findIndex((l) => l.includes("⌂"));
    if (pwdIdx !== -1) {
      assert.ok(
        hintIdx < pwdIdx,
        `hint (line ${hintIdx}) appeared after pwd line (line ${pwdIdx}) — hint may be displaced:\n${lines.join("\n")}`,
      );
    }
  });

  it("openspec rows use compact separator — no double-punctuation in progress+stage", () => {
    (sharedState as any).cleave = { status: "idle", updatedAt: Date.now(), children: [] };
    (sharedState as any).openspec = {
      changes: [
        { name: "my-change", stage: "implementing", tasksDone: 3, tasksTotal: 10, path: undefined },
      ],
    };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(140);
    const specRow = lines.find((l) => l.includes("my-change"));
    assert.ok(specRow, `expected openspec row for my-change;\n${lines.join("\n")}`);

    // Must NOT contain " ·  · " or "· ·" (the double-separator artifact)
    assert.ok(
      !specRow!.includes(" ·  · ") && !specRow!.includes("· ·"),
      `openspec row has double-separator noise: ${specRow}`,
    );
    // Progress and stage should be present
    assert.ok(specRow!.includes("3/10"), `expected progress in row: ${specRow}`);
    assert.ok(specRow!.includes("impl"), `expected stage label in row: ${specRow}`);
  });

  it("truncates raised rows by dropping metadata before the primary label", () => {
    (sharedState as any).designTree = {
      nodeCount: 1,
      decidedCount: 0,
      exploringCount: 0,
      implementingCount: 1,
      implementedCount: 0,
      blockedCount: 0,
      openQuestionCount: 4,
      focusedNode: {
        id: "long-node",
        title: "I2P Integration With An Extremely Verbose Title That Must Stay Recognizable",
        status: "implementing",
        questions: ["one", "two", "three", "four"],
        branch: "feature/i2p-integration-with-a-very-very-long-branch-name",
        filePath: "docs/unified-dashboard.md",
      },
      implementingNodes: [],
      nodes: [],
    };
    (sharedState as any).openspec = {
      changes: [{
        name: "very-long-openspec-change-name-that-should-still-show-before-progress-metadata",
        stage: "implementing",
        tasksDone: 25,
        tasksTotal: 27,
        path: `${process.cwd()}/openspec/changes/dashboard-wide-truncation`,
      }],
    };
    (sharedState as any).cleave = { status: "idle", updatedAt: Date.now(), children: [] };

    const footer = new DashboardFooter(
      {} as any,
      makeTheme() as any,
      makeFooterData() as any,
      { mode: "raised", turns: 0 } satisfies DashboardState,
    );
    footer.setContext(makeContext() as any);

    const lines = footer.render(110);
    const designLine = lines.find((line) => line.includes("I2P Integration"));
    const specLine = lines.find((line) => line.includes("very-long-openspec-change-name"));
    assert.ok(designLine, lines.join("\n"));
    assert.ok(specLine, lines.join("\n"));
    assert.ok(designLine!.includes("⚙"), designLine);
    assert.ok(specLine!.includes("◦"), specLine);
  });
});
