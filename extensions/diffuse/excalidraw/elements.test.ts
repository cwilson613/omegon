/**
 * Tests for Excalidraw element factories.
 *
 * Run: node --experimental-strip-types --test extensions/diffuse/excalidraw/elements.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
	rect, diamond, ellipse, dot, text, arrow, line,
	bindArrow, createDocument, validateDocument,
	resetIndexCounter, fanOut, timeline, grid,
	type ExcalidrawElement,
} from "./elements.ts";
import { SEMANTIC_COLORS, TEXT_COLORS } from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findByType<T extends ExcalidrawElement>(
	elements: ExcalidrawElement[],
	type: string,
): T {
	const found = elements.find((e) => e.type === type);
	assert.ok(found, `Expected element of type '${type}'`);
	return found as T;
}

// ---------------------------------------------------------------------------
// Shape factories
// ---------------------------------------------------------------------------

describe("rect", () => {
	beforeEach(() => resetIndexCounter());

	it("creates a rectangle without label", () => {
		const els = rect(10, 20, 100, 50);
		assert.equal(els.length, 1);
		const r = els[0];
		assert.equal(r.type, "rectangle");
		assert.equal(r.x, 10);
		assert.equal(r.y, 20);
		assert.equal(r.width, 100);
		assert.equal(r.height, 50);
	});

	it("creates rectangle + text when label provided", () => {
		const els = rect(0, 0, 180, 90, { label: "Server" });
		assert.equal(els.length, 2);
		assert.equal(els[0].type, "rectangle");
		assert.equal(els[1].type, "text");
		const t = els[1] as any;
		assert.equal(t.text, "Server");
		assert.equal(t.containerId, els[0].id);
		// Container must reference text in boundElements
		assert.ok(els[0].boundElements);
		assert.ok(els[0].boundElements!.some((b) => b.id === t.id && b.type === "text"));
	});

	it("applies semantic colors", () => {
		const els = rect(0, 0, 100, 50, { semantic: "error" });
		const r = els[0];
		assert.equal(r.backgroundColor, SEMANTIC_COLORS.error.fill);
		assert.equal(r.strokeColor, SEMANTIC_COLORS.error.stroke);
	});

	it("uses white text on dark backgrounds", () => {
		const els = rect(0, 0, 100, 50, { semantic: "evidence", label: "Code" });
		const t = els.find((e) => e.type === "text")!;
		assert.equal(t.strokeColor, TEXT_COLORS.onDark);
	});

	it("uses dark text on light backgrounds", () => {
		const els = rect(0, 0, 100, 50, { semantic: "warning", label: "Warn" });
		const t = els.find((e) => e.type === "text")!;
		assert.equal(t.strokeColor, TEXT_COLORS.onLight);
	});

	it("does not leak non-ElementBase keys into output", () => {
		const els = rect(0, 0, 100, 50, { semantic: "primary", label: "Test" });
		const r = els[0];
		assert.equal((r as any).label, undefined);
		assert.equal((r as any).semantic, undefined);
		assert.equal((r as any).labelFontSize, undefined);
	});

	it("accepts explicit id", () => {
		const els = rect(0, 0, 100, 50, { id: "my-rect" });
		assert.equal(els[0].id, "my-rect");
	});
});

describe("diamond", () => {
	beforeEach(() => resetIndexCounter());

	it("creates a diamond with label", () => {
		const els = diamond(0, 0, 120, 80, { label: "Decision?", semantic: "decision" });
		assert.equal(els.length, 2);
		assert.equal(els[0].type, "diamond");
		assert.equal(els[0].backgroundColor, SEMANTIC_COLORS.decision.fill);
	});
});

describe("ellipse", () => {
	beforeEach(() => resetIndexCounter());

	it("creates an ellipse", () => {
		const els = ellipse(0, 0, 100, 100, { semantic: "start" });
		assert.equal(els.length, 1);
		assert.equal(els[0].type, "ellipse");
		assert.equal(els[0].backgroundColor, SEMANTIC_COLORS.start.fill);
	});
});

describe("dot", () => {
	beforeEach(() => resetIndexCounter());

	it("returns an array with one element", () => {
		const els = dot(50, 50);
		assert.ok(Array.isArray(els), "dot() should return an array");
		assert.equal(els.length, 1);
		assert.equal(els[0].type, "ellipse");
	});

	it("centers the dot on the given point", () => {
		const els = dot(100, 200, { size: 20 });
		assert.equal(els[0].x, 90);  // 100 - 20/2
		assert.equal(els[0].y, 190); // 200 - 20/2
		assert.equal(els[0].width, 20);
		assert.equal(els[0].height, 20);
	});
});

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

describe("text", () => {
	beforeEach(() => resetIndexCounter());

	it("creates free-floating text", () => {
		const t = text(10, 20, "Hello");
		assert.equal(t.type, "text");
		assert.equal((t as any).text, "Hello");
		assert.equal((t as any).containerId, null);
	});

	it("title level gets larger font", () => {
		const t = text(0, 0, "Title", { level: "title" });
		assert.equal((t as any).fontSize, 28);
	});
});

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

describe("arrow", () => {
	beforeEach(() => resetIndexCounter());

	it("creates arrow with correct points", () => {
		const els = arrow(0, 0, 200, 100);
		assert.equal(els.length, 1);
		const a = els[0] as any;
		assert.equal(a.type, "arrow");
		assert.deepEqual(a.points, [[0, 0], [200, 100]]);
	});

	it("creates bindings when fromId/toId provided", () => {
		const els = arrow(0, 0, 200, 0, { fromId: "a", toId: "b" });
		const a = els[0] as any;
		assert.equal(a.startBinding.elementId, "a");
		assert.equal(a.endBinding.elementId, "b");
	});

	it("includes label as bound text", () => {
		const els = arrow(0, 0, 200, 0, { label: "sends" });
		assert.equal(els.length, 2);
		assert.equal(els[0].type, "arrow");
		assert.equal(els[1].type, "text");
		assert.equal((els[1] as any).containerId, els[0].id);
	});

	it("supports waypoints", () => {
		const els = arrow(0, 0, 200, 200, { waypoints: [[100, 0]] });
		const a = els[0] as any;
		assert.deepEqual(a.points, [[0, 0], [100, 0], [200, 200]]);
	});
});

describe("line", () => {
	beforeEach(() => resetIndexCounter());

	it("creates a line with relative points", () => {
		const l = line([[10, 20], [110, 20], [110, 120]]);
		assert.equal(l.type, "line");
		assert.deepEqual((l as any).points, [[0, 0], [100, 0], [100, 100]]);
	});

	it("throws on fewer than 2 points", () => {
		assert.throws(() => line([[0, 0]]), /at least 2 points/);
	});
});

// ---------------------------------------------------------------------------
// Binding
// ---------------------------------------------------------------------------

describe("bindArrow", () => {
	beforeEach(() => resetIndexCounter());

	it("wires arrow to start and end elements", () => {
		const elements: ExcalidrawElement[] = [
			...rect(0, 0, 100, 50, { id: "src" }),
			...rect(200, 0, 100, 50, { id: "dst" }),
			...arrow(100, 25, 200, 25, { id: "arr" }),
		];
		bindArrow(elements, "arr", "src", "dst");

		const a = elements.find((e) => e.id === "arr") as any;
		assert.equal(a.startBinding.elementId, "src");
		assert.equal(a.endBinding.elementId, "dst");

		const src = elements.find((e) => e.id === "src")!;
		assert.ok(src.boundElements!.some((b) => b.id === "arr"));

		const dst = elements.find((e) => e.id === "dst")!;
		assert.ok(dst.boundElements!.some((b) => b.id === "arr"));
	});

	it("throws on missing arrow", () => {
		assert.throws(() => bindArrow([], "nope", "a", "b"), /not found/);
	});

	it("does not duplicate binding on repeat call", () => {
		const elements: ExcalidrawElement[] = [
			...rect(0, 0, 100, 50, { id: "s" }),
			...rect(200, 0, 100, 50, { id: "e" }),
			...arrow(100, 25, 200, 25, { id: "a" }),
		];
		bindArrow(elements, "a", "s", "e");
		bindArrow(elements, "a", "s", "e"); // idempotent
		const src = elements.find((e) => e.id === "s")!;
		assert.equal(src.boundElements!.filter((b) => b.id === "a").length, 1);
	});
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

describe("createDocument", () => {
	beforeEach(() => resetIndexCounter());

	it("wraps elements in a valid document", () => {
		const els = rect(0, 0, 100, 50, { label: "X" });
		const doc = createDocument(els);
		assert.equal(doc.type, "excalidraw");
		assert.equal(doc.version, 2);
		assert.equal(doc.elements.length, 2);
	});

	it("resets index counter", () => {
		// Build two documents — second should start with fresh indices
		const doc1 = createDocument(rect(0, 0, 100, 50));
		const doc2 = createDocument(rect(0, 0, 100, 50));
		assert.equal(doc1.elements[0].index, doc2.elements[0].index);
	});

	it("accepts custom background", () => {
		const doc = createDocument([], { background: "#f0f0f0" });
		assert.equal(doc.appState.viewBackgroundColor, "#f0f0f0");
	});
});

describe("validateDocument", () => {
	beforeEach(() => resetIndexCounter());

	it("returns empty array for valid document", () => {
		const doc = createDocument(rect(0, 0, 100, 50, { label: "OK" }));
		const errors = validateDocument(doc);
		assert.deepEqual(errors, []);
	});

	it("catches duplicate IDs", () => {
		const els = [
			...rect(0, 0, 100, 50, { id: "dup" }),
			...rect(200, 0, 100, 50, { id: "dup" }),
		];
		const doc = createDocument(els);
		const errors = validateDocument(doc);
		assert.ok(errors.some((e) => e.includes("Duplicate")));
	});

	it("catches dangling arrow bindings", () => {
		const els = arrow(0, 0, 100, 0, { fromId: "nonexistent", toId: "also-missing" });
		const doc = createDocument(els);
		const errors = validateDocument(doc);
		assert.ok(errors.some((e) => e.includes("missing element")));
	});

	it("catches dangling text containerId", () => {
		const t = text(0, 0, "Orphan");
		(t as any).containerId = "ghost";
		const doc = createDocument([t]);
		const errors = validateDocument(doc);
		assert.ok(errors.some((e) => e.includes("containerId")));
	});
});

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

describe("fanOut", () => {
	it("produces correct count", () => {
		const points = fanOut([0, 0], 5, 100);
		assert.equal(points.length, 5);
	});

	it("handles count=0", () => {
		assert.deepEqual(fanOut([0, 0], 0, 100), []);
	});

	it("count=1 places single point at start angle", () => {
		const points = fanOut([0, 0], 1, 100);
		assert.equal(points.length, 1);
		// Default arc is PI, startAngle is -PI/2 (top)
		assert.ok(Math.abs(points[0][1] - (-100)) < 1, `y should be ~-100, got ${points[0][1]}`);
	});

	it("points are at the correct radius", () => {
		const points = fanOut([0, 0], 4, 200);
		for (const [x, y] of points) {
			const dist = Math.sqrt(x * x + y * y);
			assert.ok(Math.abs(dist - 200) < 0.01, `Expected radius 200, got ${dist}`);
		}
	});
});

describe("timeline", () => {
	it("vertical: evenly spaced", () => {
		const pts = timeline([10, 20], 4, 50);
		assert.equal(pts.length, 4);
		assert.deepEqual(pts[0], [10, 20]);
		assert.deepEqual(pts[1], [10, 70]);
		assert.deepEqual(pts[3], [10, 170]);
	});

	it("horizontal: evenly spaced", () => {
		const pts = timeline([0, 0], 3, 100, "horizontal");
		assert.deepEqual(pts[0], [0, 0]);
		assert.deepEqual(pts[2], [200, 0]);
	});
});

describe("grid", () => {
	it("produces correct count", () => {
		const pts = grid([0, 0], 3, 2, 100, 80);
		assert.equal(pts.length, 6);
	});

	it("row-major order", () => {
		const pts = grid([10, 20], 2, 2, 100, 50);
		assert.deepEqual(pts[0], [10, 20]);   // row 0, col 0
		assert.deepEqual(pts[1], [110, 20]);  // row 0, col 1
		assert.deepEqual(pts[2], [10, 70]);   // row 1, col 0
		assert.deepEqual(pts[3], [110, 70]);  // row 1, col 1
	});
});

// ---------------------------------------------------------------------------
// Unique IDs and indices
// ---------------------------------------------------------------------------

describe("id and index generation", () => {
	beforeEach(() => resetIndexCounter());

	it("all elements in a document have unique IDs", () => {
		const els = [
			...rect(0, 0, 100, 50, { label: "A" }),
			...rect(200, 0, 100, 50, { label: "B" }),
			...diamond(400, 0, 100, 80, { label: "C" }),
			...arrow(100, 25, 200, 25, { label: "link" }),
			...dot(50, 50),
		];
		const ids = els.map((e) => e.id);
		assert.equal(new Set(ids).size, ids.length, `Duplicate IDs found: ${ids}`);
	});

	it("all elements have unique index values", () => {
		const els = [
			...rect(0, 0, 100, 50),
			...rect(200, 0, 100, 50),
			...rect(400, 0, 100, 50),
		];
		const indices = els.map((e) => e.index);
		assert.equal(new Set(indices).size, indices.length, `Duplicate indices: ${indices}`);
	});
});

// ---------------------------------------------------------------------------
// JSON round-trip
// ---------------------------------------------------------------------------

describe("JSON round-trip", () => {
	beforeEach(() => resetIndexCounter());

	it("document serializes to valid JSON and back", () => {
		const els = [
			...rect(0, 0, 180, 90, { semantic: "primary", label: "Server" }),
			...rect(300, 0, 180, 90, { semantic: "evidence", label: "DB" }),
			...arrow(180, 45, 300, 45, { label: "queries" }),
		];
		const doc = createDocument(els);
		const json = JSON.stringify(doc);
		const parsed = JSON.parse(json);

		assert.equal(parsed.type, "excalidraw");
		assert.equal(parsed.version, 2);
		assert.equal(parsed.elements.length, doc.elements.length);

		// Validate the round-tripped version
		const errors = validateDocument(parsed);
		assert.deepEqual(errors, [], `Validation errors: ${errors.join(", ")}`);
	});
});
