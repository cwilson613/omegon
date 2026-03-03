---
name: visualize
description: Read, understand, write, and visualize Mermaid diagrams, Excalidraw freeform diagrams, and AI-generated images. Renders data models, flowcharts, architectural diagrams, and visual arguments inline.
---

# Visualize Skill

Unified skill for visual content: structured diagrams (Mermaid), freeform visual arguments (Excalidraw), and AI image generation (FLUX.1 via MLX).

## When to Use What

| Need | Tool | Speed | Strengths |
|------|------|-------|-----------|
| Quick structural diagram | `render_diagram` (Mermaid) | ~2s | ER, sequence, flowchart, Gantt, git graph |
| Freeform visual argument | Write `.excalidraw` JSON + `render_excalidraw` | ~30s | Spatial reasoning, evidence artifacts, concept-shape isomorphism |
| AI-generated image | `generate_image_local` (FLUX.1) | ~10-60s | Photorealistic, artistic, abstract concepts |

**Use Mermaid** when the diagram has a well-defined type (ER, sequence, flowchart, state machine, Gantt) and you want speed.

**Use Excalidraw** when you need to make a visual *argument* — architecture overviews, system explanations, educational diagrams where spatial layout, evidence artifacts (code snippets, JSON examples), and concept-to-shape mapping matter.

**Use FLUX.1** for non-diagram images — illustrations, mockups, artistic content.

---

## Mermaid Diagrams

Use the `render_diagram` tool to render inline Mermaid code directly in the terminal:

```
render_diagram(code="flowchart TB\n  A[Start] --> B[End]", title="My Diagram")
```

If `mmdc` (Mermaid CLI) is installed, diagrams render as inline PNG images. Otherwise they display as syntax-highlighted source.

### Supported Diagram Types

| Type | Syntax | Use Case |
|------|--------|----------|
| Flowchart | `flowchart TB/LR` | Process flows, decision trees |
| Sequence | `sequenceDiagram` | API flows, message protocols |
| Class | `classDiagram` | OOP designs, data models |
| ER | `erDiagram` | Database schemas |
| State | `stateDiagram-v2` | State machines |
| Gantt | `gantt` | Project timelines |
| Git Graph | `gitGraph` | Branch strategies |
| Pie | `pie` | Distributions |
| Timeline | `timeline` | Historical events, roadmaps |

### Quick Syntax Reference

**Flowchart:**
```mermaid
flowchart LR
    A[Input] --> B{Decision}
    B -->|yes| C[Action]
    B -->|no| D[Skip]
    C --> E[Output]
    D --> E
```

Node shapes: `[rect]` `(rounded)` `{diamond}` `((circle))` `[(cylinder)]`
Arrows: `-->` `-.->` `==>` `--label-->`

**Sequence:**
```mermaid
sequenceDiagram
    Client->>API: POST /login
    API->>DB: query user
    DB-->>API: user data
    API-->>Client: JWT token
```

**ER:**
```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ITEM : contains
```

### Install mmdc

```bash
npm install -g @mermaid-js/mermaid-cli
```

---

## Excalidraw Diagrams

For freeform visual arguments that go beyond boxes-and-arrows. The Excalidraw pipeline has two parts:

1. **Element factories** (`extensions/diffuse/excalidraw/`) — TypeScript functions that generate valid `.excalidraw` JSON
2. **Renderer** (`render_excalidraw` tool) — Playwright + Chromium → PNG

### Workflow

1. Write `.excalidraw` JSON by hand — use the element template and semantic palette below
2. Save to a `.excalidraw` file
3. Call `render_excalidraw(path="<file>.excalidraw")` to render to PNG
4. View the result, iterate if needed (typically 2-4 cycles)

### Element Template

Each Excalidraw element has 25+ required fields. Use this minimal template and fill in the values that matter — defaults handle the rest. Write the complete JSON document using `write` tool.

**Document wrapper:**
```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [ /* elements here */ ],
  "appState": {
    "gridSize": 20,
    "gridStep": 5,
    "gridModeEnabled": false,
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
```

**Rectangle element:**
```json
{
  "id": "unique-id-1",
  "type": "rectangle",
  "x": 100, "y": 100, "width": 180, "height": 90,
  "angle": 0,
  "strokeColor": "#1e3a5f",
  "backgroundColor": "#3b82f6",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "index": "a0",
  "roundness": { "type": 3 },
  "seed": 12345,
  "version": 1,
  "versionNonce": 67890,
  "isDeleted": false,
  "boundElements": [{ "id": "text-id-1", "type": "text" }],
  "updated": 1709500000000,
  "link": null,
  "locked": false
}
```

**Text element** (bound to container via `containerId`, or `null` for free-floating):
```json
{
  "id": "text-id-1",
  "type": "text",
  "x": 130, "y": 130, "width": 120, "height": 20,
  "text": "API Server",
  "fontSize": 16,
  "fontFamily": 3,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": "unique-id-1",
  "originalText": "API Server",
  "autoResize": true,
  "lineHeight": 1.25,
  "strokeColor": "#ffffff",
  "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
  "roughness": 0, "opacity": 100, "angle": 0,
  "groupIds": [], "frameId": null, "index": "a1",
  "roundness": null, "seed": 11111, "version": 1, "versionNonce": 22222,
  "isDeleted": false, "boundElements": null,
  "updated": 1709500000000, "link": null, "locked": false
}
```

**Arrow element:**
```json
{
  "id": "arrow-1",
  "type": "arrow",
  "x": 280, "y": 145, "width": 100, "height": 0,
  "points": [[0, 0], [100, 0]],
  "lastCommittedPoint": null,
  "startBinding": { "elementId": "unique-id-1", "mode": "orbit", "fixedPoint": [0.5, 0.5] },
  "endBinding": { "elementId": "unique-id-2", "mode": "orbit", "fixedPoint": [0.5, 0.5] },
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "elbowed": false,
  "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "solid", "strokeWidth": 2, "strokeStyle": "solid",
  "roughness": 0, "opacity": 100, "angle": 0,
  "groupIds": [], "frameId": null, "index": "a2",
  "roundness": { "type": 2 }, "seed": 33333, "version": 1, "versionNonce": 44444,
  "isDeleted": false, "boundElements": null,
  "updated": 1709500000000, "link": null, "locked": false
}
```

**Key rules:**
- Every `id` must be unique across the document
- `index` values must be unique and alphabetically ordered (`"a0"`, `"a1"`, `"a2"`, ...)
- If a text element has `containerId`, the container must list that text in `boundElements`
- Arrow `points` are relative to the arrow's `x`/`y` — first point is always `[0, 0]`
- Arrow `startBinding`/`endBinding` reference element IDs — those elements must exist
- `fontFamily`: 1=Virgil (handwritten), 2=Helvetica, 3=Cascadia (monospace), 5=Excalifont
- Text on dark backgrounds: use `strokeColor: "#ffffff"`. On light backgrounds: `"#374151"`

> **Note:** TypeScript element factory functions exist at `extensions/diffuse/excalidraw/` that automate
> ID generation, index ordering, text measurement, and binding wiring. These are available for future
> tool integration but are not currently callable by the agent. See `UPSTREAM.md` for details.

### Semantic Color Palette

Colors encode meaning. Pass `semantic` to shape factories:

| Purpose | Fill | Stroke | Use For |
|---------|------|--------|---------|
| `primary` | `#3b82f6` | `#1e3a5f` | Default, neutral components |
| `secondary` | `#60a5fa` | `#1e3a5f` | Supporting components |
| `start` | `#fed7aa` | `#c2410c` | Entry points, triggers |
| `end` | `#a7f3d0` | `#047857` | Outputs, completion |
| `decision` | `#fef3c7` | `#b45309` | Conditionals, branches |
| `ai` | `#ddd6fe` | `#6d28d9` | AI/LLM components |
| `warning` | `#fee2e2` | `#dc2626` | Warnings, resets |
| `error` | `#fecaca` | `#b91c1c` | Error states |
| `evidence` | `#1e293b` | `#334155` | Code snippets, data examples |

### Design Methodology

When creating Excalidraw diagrams, follow these principles:

**Diagrams argue, not display.** The shape should mirror the concept — fan-outs for one-to-many, convergence for aggregation, timelines for sequences. If you removed all text, the structure alone should communicate the concept.

**Concept → Pattern mapping:**

| If the concept... | Use this pattern |
|-------------------|------------------|
| Spawns multiple outputs | Fan-out (radial arrows from center) |
| Combines inputs into one | Convergence (arrows merging) |
| Has hierarchy/nesting | Tree (lines + free-floating text) |
| Is a sequence of steps | Timeline (line + dots + labels) |
| Loops or improves | Cycle (arrow returning to start) |
| Transforms input to output | Assembly line (before → process → after) |
| Compares two things | Side-by-side (parallel with contrast) |

**Container discipline:** Default to free-floating text. Add containers only when they serve a purpose — the element is a focal point, arrows need to connect to it, or the shape itself carries meaning. Aim for <30% of text elements inside containers.

**Evidence artifacts** (for technical diagrams): Include actual code snippets, JSON payloads, real event names — not just labels. Use `semantic: "evidence"` for dark-background code blocks.

**Hierarchy through scale:**
- Hero: 300×150 — visual anchor, most important
- Primary: 180×90
- Secondary: 120×60
- Small: 60×40

### Render & Validate

After generating the JSON, render and inspect:

```
render_excalidraw(path="diagram.excalidraw", title="Architecture Overview")
```

Check for: text overflow, overlapping elements, arrow misroutes, uneven spacing, unbalanced composition. Fix the JSON and re-render. Typically takes 2-4 iterations.

### First-Time Setup

```bash
cd skills/visualize/references/excalidraw
uv sync
uv run playwright install chromium
```

### Upstream Tracking

The element factory is vendored from `@swiftlysingh/excalidraw-cli@1.1.0`. See `extensions/diffuse/excalidraw/UPSTREAM.md` for sync instructions and breaking change risks.

---

## AI Image Generation (Local Diffusion)

Use `generate_image_local` to generate images on-device using FLUX.1 via MLX. No cloud API — runs entirely on Apple Silicon.

### Presets

| Preset | Model | Speed | Quality | Use For |
|--------|-------|-------|---------|---------|
| `schnell` | FLUX.1-schnell | ~10s | Good | Fast iteration |
| `dev` | FLUX.1-dev | ~60s | Best | Final outputs |
| `dev-fast` | FLUX.1-dev | ~30s | High | Balanced |
| `diagram` | schnell | ~10s | Good | Technical diagrams (1024×768) |
| `portrait` | dev | ~60s | Best | Portrait (768×1024) |
| `wide` | schnell | ~10s | Good | Cinematic (1344×768) |

### Usage

```
generate_image_local(
  prompt="a clean architectural diagram showing microservices with arrows",
  preset="diagram"
)
```

Use quantization to reduce VRAM and speed up generation:
```
generate_image_local(prompt="...", preset="dev", quantize="4")
```

### Tips

- Use `schnell` for fast drafts, `dev` for quality finals
- `diagram` preset gives 4:3 landscape good for technical visuals
- `seed` parameter makes results reproducible
- `/diffuse <prompt>` as a quick command shortcut
