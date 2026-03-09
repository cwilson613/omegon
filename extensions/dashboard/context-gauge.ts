import type { MemoryInjectionMetrics } from "../project-memory/injection-metrics.ts";

export interface ContextGaugeInput {
  percent: number | null | undefined;
  contextWindow: number;
  memoryTokenEstimate: number;
  turns: number;
}

export interface ContextGaugeModel {
  state: "known" | "unknown";
  turns: number;
  contextWindow: number;
  percent: number | null;
  memoryPercent: number;
  otherPercent: number;
  memoryBlocks: number;
  otherBlocks: number;
  freeBlocks: number;
}

export function buildContextGaugeModel(input: ContextGaugeInput, barWidth: number): ContextGaugeModel {
  const contextWindow = input.contextWindow;
  const pct = input.percent ?? null;

  if (pct === null) {
    return {
      state: "unknown",
      turns: input.turns,
      contextWindow,
      percent: null,
      memoryPercent: 0,
      otherPercent: 0,
      memoryBlocks: 0,
      otherBlocks: 0,
      freeBlocks: barWidth,
    };
  }

  const memoryPercent = contextWindow > 0 ? (input.memoryTokenEstimate / contextWindow) * 100 : 0;
  const otherPercent = Math.max(0, pct - memoryPercent);
  const memoryBlocks = memoryPercent > 0 ? Math.ceil((memoryPercent / 100) * barWidth) : 0;
  const otherBlocks = otherPercent > 0 ? Math.ceil((otherPercent / 100) * barWidth) : 0;
  const totalFilled = Math.min(memoryBlocks + otherBlocks, barWidth);
  const freeBlocks = barWidth - totalFilled;

  return {
    state: "known",
    turns: input.turns,
    contextWindow,
    percent: pct,
    memoryPercent,
    otherPercent,
    memoryBlocks,
    otherBlocks,
    freeBlocks,
  };
}
