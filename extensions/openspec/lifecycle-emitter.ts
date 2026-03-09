import type { ChangeInfo } from "./types.ts";
import type { LifecycleMemoryCandidate } from "../project-memory/types.ts";

export function emitArchiveCandidates(change: ChangeInfo): LifecycleMemoryCandidate[] {
  if (change.stage !== "archived") return [];

  const candidates: LifecycleMemoryCandidate[] = [];
  for (const spec of change.specs) {
    for (const section of spec.sections) {
      if (section.type === "removed") continue;
      for (const requirement of section.requirements) {
        candidates.push({
          sourceKind: "openspec-archive",
          authority: "explicit",
          section: "Specs",
          content: `${requirement.title} (${section.type})`,
          artifactRef: {
            type: "openspec-baseline",
            path: `openspec/baseline/${spec.domain}.md`,
            subRef: requirement.title,
          },
        });
      }
    }
  }
  return candidates;
}

export function emitReconcileCandidates(changeName: string, summary?: string, constraints?: string[]): LifecycleMemoryCandidate[] {
  const candidates: LifecycleMemoryCandidate[] = [];

  for (const constraint of constraints ?? []) {
    const trimmed = constraint.trim();
    if (!trimmed || /\b(might|could|should|consider|possible|likely)\b/i.test(trimmed) || /\?$/.test(trimmed)) {
      continue;
    }
    candidates.push({
      sourceKind: "openspec-assess",
      authority: "explicit",
      section: "Constraints",
      content: trimmed,
      artifactRef: {
        type: "openspec-spec",
        path: `openspec/changes/${changeName}/tasks.md`,
        subRef: "reconcile_after_assess",
      },
    });
  }

  if (summary && /\b(fixed|resolved|workaround)\b/i.test(summary)) {
    candidates.push({
      sourceKind: "openspec-assess",
      authority: "explicit",
      section: "Known Issues",
      content: summary.trim(),
      artifactRef: {
        type: "openspec-spec",
        path: `openspec/changes/${changeName}/tasks.md`,
        subRef: "reconcile_after_assess",
      },
    });
  }

  return candidates;
}
