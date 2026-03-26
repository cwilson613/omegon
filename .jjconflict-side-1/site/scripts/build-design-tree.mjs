#!/usr/bin/env node
/**
 * Build a force-directed SVG of the omegon design tree.
 *
 * Reads docs/*.md frontmatter → extracts nodes + edges → runs d3-force simulation → emits SVG.
 * Output: site/public/design-tree.svg
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";

const DOCS_DIR = join(import.meta.dirname, "..", "..", "docs");
const OUT_DIR = join(import.meta.dirname, "..", "public");

// ── Parse nodes from frontmatter ────────────────────────────

const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
const nodes = [];
const edges = [];

for (const file of files) {
  try {
    const content = readFileSync(join(DOCS_DIR, file), "utf-8");
    const { data } = matter(content);
    if (!data.id || !data.title) continue;

    nodes.push({
      id: data.id,
      title: data.title,
      status: data.status || "seed",
      parent: data.parent || null,
      tags: data.tags || [],
    });

    if (data.parent) {
      edges.push({ source: data.parent, target: data.id });
    }
    if (data.dependencies) {
      for (const dep of data.dependencies) {
        edges.push({ source: dep, target: data.id });
      }
    }
  } catch {
    // Skip malformed files
  }
}

console.log(`Design tree: ${nodes.length} nodes, ${edges.length} edges`);

// ── Force simulation (simplified — no d3-force, just layout) ─

// Since d3-force requires ESM + async setup, use a deterministic grid layout
// grouped by status. This is simpler and produces a clean, readable SVG.

const STATUS_ORDER = [
  "implemented",
  "implementing",
  "decided",
  "resolved",
  "exploring",
  "seed",
  "deferred",
  "blocked",
];
const STATUS_COLORS = {
  implemented: "#22c55e",
  implementing: "#2ab4c8",
  decided: "#f59e0b",
  resolved: "#607888",
  exploring: "#405870",
  seed: "#1a4458",
  deferred: "#1a4458",
  blocked: "#ef4444",
};

// Group nodes by status
const groups = new Map();
for (const status of STATUS_ORDER) groups.set(status, []);
for (const node of nodes) {
  const g = groups.get(node.status) || groups.get("seed");
  g.push(node);
}

// Layout: columns by status, nodes stacked vertically
const COL_WIDTH = 180;
const ROW_HEIGHT = 20;
const PADDING = 40;
const NODE_R = 5;

const positions = new Map();
let col = 0;
let maxRows = 0;

for (const [status, group] of groups) {
  if (group.length === 0) continue;
  for (let i = 0; i < group.length; i++) {
    positions.set(group[i].id, {
      x: PADDING + col * COL_WIDTH + COL_WIDTH / 2,
      y: PADDING + 40 + i * ROW_HEIGHT,
    });
  }
  maxRows = Math.max(maxRows, group.length);
  col++;
}

const width = PADDING * 2 + col * COL_WIDTH;
const height = PADDING * 2 + 40 + maxRows * ROW_HEIGHT;

// ── Generate SVG ────────────────────────────────────────────

const svgParts = [];
svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
svgParts.push(`<style>
  text { font-family: 'Tomorrow', sans-serif; font-size: 9px; fill: #607888; }
  .label { font-size: 11px; font-weight: 600; fill: #c4d8e4; text-transform: uppercase; letter-spacing: 0.5px; }
  line { stroke: #0c1828; stroke-width: 0.5; }
</style>`);
svgParts.push(`<rect width="${width}" height="${height}" fill="#02030a" rx="8"/>`);

// Column headers
col = 0;
for (const [status, group] of groups) {
  if (group.length === 0) continue;
  const x = PADDING + col * COL_WIDTH + COL_WIDTH / 2;
  const color = STATUS_COLORS[status] || "#405870";
  svgParts.push(`<text x="${x}" y="${PADDING + 20}" class="label" text-anchor="middle" fill="${color}">${status} (${group.length})</text>`);
  col++;
}

// Edges
for (const edge of edges) {
  const from = positions.get(edge.source);
  const to = positions.get(edge.target);
  if (from && to) {
    svgParts.push(`<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`);
  }
}

// Nodes
for (const node of nodes) {
  const pos = positions.get(node.id);
  if (!pos) continue;
  const color = STATUS_COLORS[node.status] || "#405870";
  const rawTitle =
    node.title.length > 28 ? node.title.slice(0, 26) + "…" : node.title;
  // Escape XML entities to prevent invalid SVG
  const shortTitle = rawTitle
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  svgParts.push(`<circle cx="${pos.x - 60}" cy="${pos.y}" r="${NODE_R}" fill="${color}"/>`);
  svgParts.push(`<text x="${pos.x - 52}" y="${pos.y + 3}">${shortTitle}</text>`);
}

svgParts.push("</svg>");

// ── Write output ────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "design-tree.svg"), svgParts.join("\n"));
console.log(`Wrote ${join(OUT_DIR, "design-tree.svg")}`);
