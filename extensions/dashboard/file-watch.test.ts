import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldRefreshDesignTreeForPath, shouldRefreshOpenSpecForPath } from "./file-watch.ts";

describe("dashboard file watch path filters", () => {
  it("matches design-tree markdown files under docs", () => {
    assert.equal(shouldRefreshDesignTreeForPath("/repo/docs/node.md", "/repo/docs"), true);
    assert.equal(shouldRefreshDesignTreeForPath("/repo/docs/nested/node.md", "/repo/docs"), true);
  });

  it("ignores paths outside docs for design-tree refresh", () => {
    assert.equal(shouldRefreshDesignTreeForPath("/repo/README.md", "/repo/docs"), false);
    assert.equal(shouldRefreshDesignTreeForPath("/repo/docs/node.txt", "/repo/docs"), false);
  });

  it("matches openspec markdown files under openspec", () => {
    assert.equal(shouldRefreshOpenSpecForPath("/repo/openspec/changes/x/proposal.md", "/repo"), true);
    assert.equal(shouldRefreshOpenSpecForPath("/repo/openspec/changes/x/specs/a.md", "/repo"), true);
  });

  it("ignores paths outside openspec for openspec refresh", () => {
    assert.equal(shouldRefreshOpenSpecForPath("/repo/docs/node.md", "/repo"), false);
    assert.equal(shouldRefreshOpenSpecForPath("/repo/openspec/changes/x/tasks.txt", "/repo"), false);
  });
});
