import type { LifecycleMemoryCandidate } from "../project-memory/types.ts";

export function emitResolvedBugCandidate(summary: string, artifactPath: string): LifecycleMemoryCandidate[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];
  if (!/\b(fixed|resolved|workaround)\b/i.test(trimmed)) return [];
  if (/\b(intermediate|thinking|plan|maybe|could|might)\b/i.test(trimmed)) return [];

  return [{
    sourceKind: "cleave-bug-fix",
    authority: "explicit",
    section: "Known Issues",
    content: trimmed,
    artifactRef: {
      type: "cleave-review",
      path: artifactPath,
      subRef: "final-outcome",
    },
  }];
}
