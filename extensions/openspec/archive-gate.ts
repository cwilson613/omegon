/**
 * Design tree archive gate — transition implementing nodes to implemented on archive.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { scanDesignDocs, setNodeStatus } from "../design-tree/tree.js";

/**
 * Scan the design tree for nodes whose openspec_change matches the archived
 * change name. Transition any node in "implementing" status to "implemented".
 * Returns the list of transitioned node IDs.
 */
export function transitionDesignNodesOnArchive(cwd: string, changeName: string): string[] {
	const docsDir = path.join(cwd, "docs");
	if (!fs.existsSync(docsDir)) return [];

	const tree = scanDesignDocs(docsDir);
	const transitioned: string[] = [];

	for (const node of tree.nodes.values()) {
		if (node.openspec_change === changeName && node.status === "implementing") {
			setNodeStatus(node, "implemented");
			transitioned.push(node.id);
		}
	}
	return transitioned;
}
