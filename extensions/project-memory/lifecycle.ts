/**
 * Project Memory — Lifecycle Integration
 *
 * Structured lifecycle candidate ingestion from design-tree, openspec, and cleave.
 * Handles explicit vs inferred classification, pointer-fact formatting, and deduplication.
 */

import type { SectionName } from "./template.ts";
import type { FactStore, Fact, StoreFactOptions } from "./factstore.ts";

// --- Lifecycle Candidate Types ---

/** Source kind for lifecycle candidates */
export type LifecycleSourceKind = 
  | "design-decision"      // Design tree decided decision
  | "design-constraint"    // Design tree implementation constraint
  | "openspec-archive"     // OpenSpec archived spec
  | "openspec-assess"      // Post-assess reconciliation finding
  | "cleave-outcome"       // Cleave final durable outcome
  | "cleave-bug-fix";      // Resolved bug fix conclusion

/** Authority level for lifecycle candidates */
export type LifecycleAuthority = 
  | "explicit"    // Structured conclusion from authoritative source
  | "inferred";   // Summary/interpretation requiring confirmation

/** Normalized lifecycle candidate shape */
export interface LifecycleCandidate {
  /** Source kind that generated this candidate */
  sourceKind: LifecycleSourceKind;
  /** Authority level - explicit auto-stores, inferred needs confirmation */
  authority: LifecycleAuthority;
  /** Target memory section */
  section: SectionName;
  /** Fact content */
  content: string;
  /** Reference to authoritative artifact */
  artifactRef?: ArtifactReference;
  /** Optional supersede target if replacing existing fact */
  supersedes?: string;
  /** Optional session identifier */
  session?: string;
}

/** Reference to authoritative source artifact */
export interface ArtifactReference {
  /** Type of artifact */
  type: "design-node" | "openspec-spec" | "openspec-baseline" | "cleave-review";
  /** Path or identifier */
  path: string;
  /** Optional sub-reference (e.g. decision title, spec section) */
  subRef?: string;
}

/** Result of lifecycle candidate processing */
export interface LifecycleCandidateResult {
  /** Whether candidate was auto-stored */
  autoStored: boolean;
  /** Fact ID if stored */
  factId?: string;
  /** Whether it was a duplicate */
  duplicate: boolean;
  /** Reason for rejection or deferral */
  reason?: string;
}

// --- Candidate Classification Rules ---

/**
 * Determine if a lifecycle candidate should auto-store or require confirmation.
 * Explicit structured conclusions from authoritative sources auto-store.
 * Inferred summaries require operator confirmation.
 */
export function shouldAutoStore(candidate: LifecycleCandidate): boolean {
  return candidate.authority === "explicit";
}

/**
 * Check if candidate content represents low-signal workflow chatter
 * that should be rejected by default.
 */
export function isLowSignalContent(candidate: LifecycleCandidate): boolean {
  const content = candidate.content.toLowerCase();
  
  // Reject proposal-stage intent
  if (candidate.sourceKind === "openspec-archive" && 
      (content.includes("proposal") || content.includes("planning"))) {
    return true;
  }
  
  // Reject child execution chatter
  if (candidate.sourceKind === "cleave-outcome" && 
      (content.includes("intermediate") || content.includes("reasoning"))) {
    return true;
  }
  
  // Reject open questions from design constraints
  if (candidate.sourceKind === "design-constraint" && 
      content.includes("?")) {
    return true;
  }
  
  return false;
}

// --- Pointer-Fact Formatting ---

/**
 * Format lifecycle candidate content as a pointer-fact that references
 * authoritative docs/specs rather than copying long-form artifact text.
 */
export function formatAsPointerFact(candidate: LifecycleCandidate): string {
  if (!candidate.artifactRef) {
    return candidate.content;
  }
  
  const { type, path, subRef } = candidate.artifactRef;
  let pointerSuffix = "";
  
  switch (type) {
    case "design-node":
      pointerSuffix = subRef 
        ? ` See ${path}, decision: ${subRef}` 
        : ` See ${path}`;
      break;
    case "openspec-spec":
    case "openspec-baseline":
      pointerSuffix = subRef 
        ? ` See ${path}#${subRef}` 
        : ` See ${path}`;
      break;
    case "cleave-review":
      pointerSuffix = ` See ${path}`;
      break;
  }
  
  // Append pointer suffix if content doesn't already reference the artifact
  if (!candidate.content.includes(path)) {
    return `${candidate.content}.${pointerSuffix}`;
  }
  
  return candidate.content;
}

// --- Deduplication & Supersede Handling ---

/**
 * Check if an equivalent lifecycle fact already exists in project memory.
 * Returns the existing fact ID if found, null otherwise.
 */
export function findEquivalentFact(
  store: FactStore, 
  mind: string, 
  candidate: LifecycleCandidate
): string | null {
  const activeFacts = store.getActiveFacts(mind);
  
  // Check for exact content match in same section
  for (const fact of activeFacts) {
    if (fact.section === candidate.section) {
      const normalizedExisting = fact.content.toLowerCase().trim();
      const normalizedCandidate = candidate.content.toLowerCase().trim();
      
      // Exact match
      if (normalizedExisting === normalizedCandidate) {
        return fact.id;
      }
      
      // Semantic equivalence (simplified - could be enhanced with embeddings)
      if (areSemanticallyEquivalent(normalizedExisting, normalizedCandidate)) {
        return fact.id;
      }
    }
  }
  
  return null;
}

/**
 * Simple semantic equivalence check for lifecycle facts.
 * Could be enhanced with embedding-based similarity in the future.
 */
function areSemanticallyEquivalent(content1: string, content2: string): boolean {
  // Remove common variations
  const normalize = (text: string) => text
    .replace(/\s+/g, " ")
    .replace(/[.,;:]/g, "")
    .replace(/\b(the|a|an|is|are|was|were)\b/g, "")
    .trim();
  
  const norm1 = normalize(content1);
  const norm2 = normalize(content2);
  
  // Check if one is a subset of the other (90% overlap)
  const words1 = norm1.split(" ");
  const words2 = norm2.split(" ");
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(w => set2.has(w)));
  const union = new Set([...set1, ...set2]);
  
  const overlap = intersection.size / Math.min(set1.size, set2.size);
  return overlap > 0.9;
}

// --- Lifecycle Candidate Ingestion API ---

/**
 * Process a lifecycle candidate through the structured ingestion pipeline.
 * Handles classification, deduplication, formatting, and storage.
 */
export function ingestLifecycleCandidate(
  store: FactStore,
  mind: string,
  candidate: LifecycleCandidate
): LifecycleCandidateResult {
  // Reject low-signal workflow chatter
  if (isLowSignalContent(candidate)) {
    return {
      autoStored: false,
      duplicate: false,
      reason: "Rejected as low-signal workflow chatter",
    };
  }
  
  // Check for existing equivalent fact
  const existingFactId = findEquivalentFact(store, mind, candidate);
  if (existingFactId) {
    if (candidate.authority === "explicit") {
      // Reinforce existing fact with newer authoritative version
      store.reinforceFact(existingFactId);
      return {
        autoStored: true,
        factId: existingFactId,
        duplicate: true,
        reason: "Reinforced existing equivalent fact",
      };
    } else {
      // Don't store inferred duplicate
      return {
        autoStored: false,
        duplicate: true,
        reason: "Equivalent fact already exists",
      };
    }
  }
  
  // Auto-store explicit candidates, defer inferred candidates
  if (!shouldAutoStore(candidate)) {
    return {
      autoStored: false,
      duplicate: false,
      reason: "Inferred candidate requires operator confirmation",
    };
  }
  
  // Format as pointer-fact and store
  const formattedContent = formatAsPointerFact(candidate);
  
  const storeOptions: StoreFactOptions = {
    mind,
    section: candidate.section,
    content: formattedContent,
    source: "lifecycle", // New source type for lifecycle ingestion
    session: candidate.session,
    supersedes: candidate.supersedes,
  };
  
  const result = store.storeFact(storeOptions);
  
  return {
    autoStored: true,
    factId: result.id,
    duplicate: result.duplicate,
    reason: result.duplicate ? "Duplicate content hash" : undefined,
  };
}

// --- Batch Processing ---

/**
 * Process multiple lifecycle candidates in a transaction.
 * Returns aggregated results.
 */
export interface BatchIngestResult {
  autoStored: number;
  reinforced: number;
  rejected: number;
  deferred: number;
  factIds: string[];
}

export function ingestLifecycleCandidatesBatch(
  store: FactStore,
  mind: string,
  candidates: LifecycleCandidate[]
): BatchIngestResult {
  const result: BatchIngestResult = {
    autoStored: 0,
    reinforced: 0,
    rejected: 0,
    deferred: 0,
    factIds: [],
  };
  
  // Use transaction for batch processing
  const tx = (store as any).db.transaction(() => {
    for (const candidate of candidates) {
      const candidateResult = ingestLifecycleCandidate(store, mind, candidate);
      
      if (candidateResult.autoStored) {
        if (candidateResult.duplicate) {
          result.reinforced++;
        } else {
          result.autoStored++;
        }
        if (candidateResult.factId) {
          result.factIds.push(candidateResult.factId);
        }
      } else if (candidateResult.reason?.includes("requires operator confirmation")) {
        result.deferred++;
      } else {
        result.rejected++;
      }
    }
  });
  
  tx();
  return result;
}