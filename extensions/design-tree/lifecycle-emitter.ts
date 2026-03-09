import type { DesignNode } from "./types.ts";
import type { LifecycleMemoryCandidate } from "../project-memory/types.ts";
import { getNodeSections } from "./tree.ts";

export function emitDecisionCandidates(node: DesignNode, decisionTitle: string, decisionStatus: string): LifecycleMemoryCandidate[] {
  if (decisionStatus !== "decided") return [];
  const sections = getNodeSections(node);
  const decision = sections.decisions.find((d) => d.title === decisionTitle && d.status === "decided");
  if (!decision) return [];

  return [{
    sourceKind: "design-decision",
    authority: "explicit",
    section: "Decisions",
    content: decision.rationale
      ? `${decision.title} — ${decision.rationale}`
      : decision.title,
    artifactRef: {
      type: "design-node",
      path: node.filePath,
      subRef: decision.title,
    },
  }];
}

export function emitConstraintCandidates(node: DesignNode, constraints?: string[]): LifecycleMemoryCandidate[] {
  return (constraints ?? [])
    .map((constraint) => constraint.trim())
    .filter(Boolean)
    .map((constraint) => ({
      sourceKind: "design-constraint" as const,
      authority: "explicit" as const,
      section: "Constraints" as const,
      content: constraint,
      artifactRef: {
        type: "design-node" as const,
        path: node.filePath,
        subRef: node.id,
      },
    }));
}
