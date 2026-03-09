import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildContextGaugeModel } from "./context-gauge.ts";

describe("buildContextGaugeModel", () => {
  it("returns unknown state when context usage percent is null", () => {
    const model = buildContextGaugeModel({
      percent: null,
      contextWindow: 200000,
      memoryTokenEstimate: 1200,
      turns: 7,
    }, 20);

    assert.deepEqual(model, {
      state: "unknown",
      turns: 7,
      contextWindow: 200000,
      percent: null,
      memoryPercent: 0,
      otherPercent: 0,
      memoryBlocks: 0,
      otherBlocks: 0,
      freeBlocks: 20,
    });
  });

  it("splits known usage into memory and other context", () => {
    const model = buildContextGaugeModel({
      percent: 40,
      contextWindow: 1000,
      memoryTokenEstimate: 100,
      turns: 3,
    }, 10);

    assert.equal(model.state, "known");
    assert.equal(model.memoryPercent, 10);
    assert.equal(model.otherPercent, 30);
    assert.equal(model.memoryBlocks, 1);
    assert.equal(model.otherBlocks, 3);
    assert.equal(model.freeBlocks, 6);
  });

  it("never reports negative other context usage", () => {
    const model = buildContextGaugeModel({
      percent: 5,
      contextWindow: 1000,
      memoryTokenEstimate: 100,
      turns: 2,
    }, 10);

    assert.equal(model.memoryPercent, 10);
    assert.equal(model.otherPercent, 0);
    assert.equal(model.memoryBlocks, 1);
    assert.equal(model.otherBlocks, 0);
  });
});
