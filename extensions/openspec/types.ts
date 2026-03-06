/**
 * openspec/types — Shared type definitions for the OpenSpec extension.
 *
 * OpenSpec is the specification layer that sits between design exploration
 * and implementation. It defines what must be true (specs) before any code
 * is written, making the development loop: spec → test → code → verify.
 */

// ─── Spec Format ─────────────────────────────────────────────────────────────

/**
 * A Given/When/Then scenario for a requirement.
 *
 * Format in spec.md files:
 *   #### Scenario: <title>
 *   Given <precondition>
 *   When <action>
 *   Then <expected outcome>
 */
export interface Scenario {
	title: string;
	given: string;
	when: string;
	then: string;
	/** Optional additional then-clauses ("And ...") */
	and?: string[];
}

/**
 * A requirement within a spec domain.
 *
 * Format in spec.md files:
 *   ### Requirement: <title>
 *   <description>
 *   #### Scenario: ...
 */
export interface Requirement {
	title: string;
	description: string;
	scenarios: Scenario[];
}

/**
 * A section in a spec file grouping requirements by change type.
 */
export interface SpecSection {
	type: "added" | "modified" | "removed";
	requirements: Requirement[];
}

/**
 * A parsed spec file with domain name and sections.
 */
export interface SpecFile {
	/** Domain name derived from file path (e.g., "auth/tokens") */
	domain: string;
	/** Absolute path to the spec.md file */
	filePath: string;
	sections: SpecSection[];
}

// ─── Change Lifecycle ────────────────────────────────────────────────────────

/**
 * Lifecycle stages of an OpenSpec change:
 *
 *   proposed → specified → planned → implementing → verifying → archived
 *
 * - proposed: proposal.md exists, no specs yet
 * - specified: specs/ directory has scenario files
 * - planned: tasks.md exists (ready for /cleave)
 * - implementing: tasks partially done
 * - verifying: all tasks done, awaiting /assess spec
 * - archived: moved to openspec/archive/
 */
export type ChangeStage =
	| "proposed"
	| "specified"
	| "planned"
	| "implementing"
	| "verifying"
	| "archived";

/**
 * Full status of an OpenSpec change including computed lifecycle stage.
 */
export interface ChangeInfo {
	name: string;
	path: string;
	stage: ChangeStage;
	hasProposal: boolean;
	hasDesign: boolean;
	hasSpecs: boolean;
	hasTasks: boolean;
	totalTasks: number;
	doneTasks: number;
	specs: SpecFile[];
}
