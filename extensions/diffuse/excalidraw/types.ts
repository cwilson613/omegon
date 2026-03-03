/**
 * Excalidraw Element Type Definitions
 *
 * Vendored from @swiftlysingh/excalidraw-cli@1.1.0 (src/types/excalidraw.ts)
 * with additions for semantic palette system. See UPSTREAM.md for sync guide.
 *
 * Based on Excalidraw JSON schema v2 (excalidraw.com)
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ExcalidrawElementType =
	| "rectangle"
	| "diamond"
	| "ellipse"
	| "text"
	| "arrow"
	| "line"
	| "freedraw";

export type FillStyle = "solid" | "hachure" | "cross-hatch";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Arrowhead = "arrow" | "bar" | "dot" | "triangle" | null;
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

export interface Roundness {
	type: 1 | 2 | 3; // 1=legacy, 2=proportional, 3=adaptive
}

export interface BoundElement {
	id: string;
	type: "arrow" | "text";
}

export interface ArrowBinding {
	elementId: string;
	mode: "orbit" | "point";
	fixedPoint: [number, number]; // Normalized [0-1] coordinates
}

// ---------------------------------------------------------------------------
// Element types
// ---------------------------------------------------------------------------

export interface ElementBase {
	id: string;
	type: ExcalidrawElementType;
	x: number;
	y: number;
	width: number;
	height: number;
	angle: number;
	strokeColor: string;
	backgroundColor: string;
	fillStyle: FillStyle;
	strokeWidth: number;
	strokeStyle: StrokeStyle;
	roughness: number;
	opacity: number;
	groupIds: string[];
	frameId: string | null;
	index: string;
	roundness: Roundness | null;
	seed: number;
	version: number;
	versionNonce: number;
	isDeleted: boolean;
	boundElements: BoundElement[] | null;
	updated: number;
	link: string | null;
	locked: boolean;
}

export interface RectangleElement extends ElementBase {
	type: "rectangle";
}

export interface DiamondElement extends ElementBase {
	type: "diamond";
}

export interface EllipseElement extends ElementBase {
	type: "ellipse";
}

export interface TextElement extends ElementBase {
	type: "text";
	text: string;
	fontSize: number;
	fontFamily: number; // 1=Virgil, 2=Helvetica, 3=Cascadia, 5=Excalifont
	textAlign: TextAlign;
	verticalAlign: VerticalAlign;
	containerId: string | null;
	originalText: string;
	autoResize: boolean;
	lineHeight: number;
}

export interface ArrowElement extends ElementBase {
	type: "arrow";
	points: Array<[number, number]>;
	lastCommittedPoint: [number, number] | null;
	startBinding: ArrowBinding | null;
	endBinding: ArrowBinding | null;
	startArrowhead: Arrowhead;
	endArrowhead: Arrowhead;
	elbowed: boolean;
}

export interface LineElement extends ElementBase {
	type: "line";
	points: Array<[number, number]>;
	lastCommittedPoint: [number, number] | null;
	startBinding: ArrowBinding | null;
	endBinding: ArrowBinding | null;
	startArrowhead: Arrowhead;
	endArrowhead: Arrowhead;
}

export type ExcalidrawElement =
	| RectangleElement
	| DiamondElement
	| EllipseElement
	| TextElement
	| ArrowElement
	| LineElement;

// ---------------------------------------------------------------------------
// File structure
// ---------------------------------------------------------------------------

export interface AppState {
	gridSize: number;
	gridStep: number;
	gridModeEnabled: boolean;
	viewBackgroundColor: string;
}

export interface ExcalidrawFile {
	type: "excalidraw";
	version: 2;
	source: string;
	elements: ExcalidrawElement[];
	appState: AppState;
	files: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_APP_STATE: AppState = {
	gridSize: 20,
	gridStep: 5,
	gridModeEnabled: false,
	viewBackgroundColor: "#ffffff",
};

export const DEFAULT_ELEMENT_STYLE = {
	strokeColor: "#1e1e1e",
	backgroundColor: "transparent",
	fillStyle: "solid" as FillStyle,
	strokeWidth: 2,
	strokeStyle: "solid" as StrokeStyle,
	roughness: 0, // Clean/modern default (upstream uses 1)
	opacity: 100,
};

export const FONT_FAMILIES = {
	Virgil: 1,
	Helvetica: 2,
	Cascadia: 3,
	Excalifont: 5,
} as const;

// ---------------------------------------------------------------------------
// Semantic palette (pi-kit addition, not from upstream)
// ---------------------------------------------------------------------------

export type SemanticPurpose =
	| "primary"
	| "secondary"
	| "tertiary"
	| "start"
	| "end"
	| "warning"
	| "decision"
	| "ai"
	| "inactive"
	| "error"
	| "evidence";

export interface ColorPair {
	fill: string;
	stroke: string;
}

export const SEMANTIC_COLORS: Record<SemanticPurpose, ColorPair> = {
	primary:   { fill: "#3b82f6", stroke: "#1e3a5f" },
	secondary: { fill: "#60a5fa", stroke: "#1e3a5f" },
	tertiary:  { fill: "#93c5fd", stroke: "#1e3a5f" },
	start:     { fill: "#fed7aa", stroke: "#c2410c" },
	end:       { fill: "#a7f3d0", stroke: "#047857" },
	warning:   { fill: "#fee2e2", stroke: "#dc2626" },
	decision:  { fill: "#fef3c7", stroke: "#b45309" },
	ai:        { fill: "#ddd6fe", stroke: "#6d28d9" },
	inactive:  { fill: "#dbeafe", stroke: "#1e40af" },
	error:     { fill: "#fecaca", stroke: "#b91c1c" },
	evidence:  { fill: "#1e293b", stroke: "#334155" },
};

export const TEXT_COLORS = {
	title:   "#1e40af",
	subtitle: "#3b82f6",
	body:    "#64748b",
	onLight: "#374151",
	onDark:  "#ffffff",
} as const;

export type TextLevel = keyof typeof TEXT_COLORS;
