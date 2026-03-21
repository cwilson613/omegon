---
id: fractal-status-surface
title: Fractal status surface — multi-dimensional state visualization via generative fractal rendering
status: exploring
parent: tui-visual-system
tags: [tui, ux, visualization, fractal, ratatui, generative, status, aesthetic]
open_questions:
  - "Should the fractal render in a dedicated panel (dashboard right-side), as a background behind the spinner/thinking area, or both? Dashboard panel is always visible; background rendering only appears during active operations."
  - Half-block rendering (▀▄) gives 2x vertical resolution but requires true-color terminal support for smooth gradients. Should we require true color, or provide a 256-color fallback with dithering?
  - "How does the fractal interact with tachyonfx effects? Should transitions (palette swap, zoom shift) go through the effects system, or be self-contained in the widget's time parameter?"
issue_type: feature
priority: 3
---

# Fractal status surface — multi-dimensional state visualization via generative fractal rendering

## Overview

Replace conventional loading bars and status indicators with a living fractal viewport that encodes multi-dimensional harness state into visual properties. Instead of reading \"72% context used\" as text, the operator sees a Mandelbrot region whose zoom depth, color palette, animation speed, and structural features all correspond to real system state.\n\nThe fractal is not decorative — each visual dimension maps to a harness signal:\n- **Zoom depth** → context utilization (deeper = fuller)\n- **Color palette** → cognitive mode (design = cool blues, coding = warm ambers, cleave = split complementary)\n- **Animation speed** → agent activity (fast iteration during tool calls, slow drift during thinking)\n- **Center coordinates** → session progression (drifts through the fractal space over time)\n- **Brightness/contrast** → health (high contrast = all systems nominal, washed out = degraded)\n- **Fractal type** → persona (Mandelbrot = default, Burning Ship = aggressive, Julia = creative)\n\nInspiration: rsfrac (github.com/SkwalExe/rsfrac) demonstrates fractal rendering in ratatui at terminal resolution. The approach here is different — not an explorer, but a generative status surface driven by harness telemetry.

## Research

### rsfrac analysis — what's reusable vs what we build

**rsfrac** (github.com/SkwalExe/rsfrac) is a full terminal application, not a widget library. It's GPL-3.0 licensed, 18 stars, built on ratatui. It renders Mandelbrot, Burning Ship, and Julia fractals with interactive navigation (pan, zoom, iterate).

**What's relevant from rsfrac:**
- Demonstrates that terminal-resolution fractal rendering is viable in ratatui — half-block characters (▀▄) give 2x vertical resolution
- Uses `crossterm` color output (true color where available, 256-color fallback)
- Iteration-to-color mapping via configurable palettes
- Proves the math is cheap enough for real-time rendering at terminal resolutions (typically 80-200 columns × 24-50 rows = ~10k pixels max)

**What we'd build fresh (not fork rsfrac):**
- rsfrac is GPL-3.0 — incompatible with our MIT/Apache dual license
- rsfrac is an interactive explorer — we need a headless renderer driven by external parameters
- The fractal math is trivial (~30 lines for Mandelbrot iteration) — no reason to depend on a crate for it

**Implementation approach — FractalWidget:**
```rust
struct FractalWidget {
    // Fractal parameters (driven by HarnessStatus)
    fractal_type: FractalType, // Mandelbrot, BurningShip, Julia
    center: (f64, f64),        // viewport center in complex plane
    zoom: f64,                 // zoom level
    max_iter: u32,             // iteration depth
    palette: ColorPalette,     // maps iteration count → Color
    time: f64,                 // animation time (for smooth transitions)
}

impl Widget for FractalWidget {
    fn render(self, area: Rect, buf: &mut Buffer) {
        // For each cell in the render area:
        // 1. Map (col, row) → complex coordinate based on center + zoom
        // 2. Iterate the fractal function up to max_iter
        // 3. Map iteration count → color via palette
        // 4. Use half-block characters for 2x vertical resolution
    }
}
```

**Performance budget:**
- At 100×50 terminal cells with half-blocks = 100×100 = 10,000 pixel computations
- Mandelbrot at 100 iterations = 1M multiplications worst case
- Modern CPU: ~1ms for the full frame
- Re-render on every TUI tick (16ms) is trivially achievable
- Julia sets are even cheaper (no inner loop escape check variance)

**Color palette mapping — the key design decision:**
The palette is how the fractal becomes a status display. Not arbitrary pretty colors — each palette maps to a cognitive mode:

| Mode | Palette | Visual character |
|---|---|---|
| Idle / waiting | Alpharius ocean (deep blue → teal → white) | Calm, deep water |
| Coding / execution | Amber → gold → white | Forge heat, productive warmth |
| Design / exploration | Violet → cyan → white | Ethereal, open-ended |
| Cleave / parallel | Split complementary (two hue families) | Deliberate tension/duality |
| Error / degraded | Desaturated, low contrast | Washed out, unhealthy |
| Compaction | Brief inversion/negative | Visual "reset" moment |

Transitions between palettes should be smooth (interpolate over ~500ms) via tachyonfx or manual lerp.

### Signal-to-visual mapping — how harness state drives the fractal

The fractal viewport is a function of `HarnessStatus` + `SessionStats` + time. Every visual property maps to an observable signal:

**Continuous signals (smooth animation):**

| Visual property | Harness signal | Mapping |
|---|---|---|
| Zoom depth | Context utilization % | 0% → zoom 1.0 (wide view), 100% → zoom 1e6 (deep spiral) |
| Center X drift | Session elapsed time | Slow rightward drift along real axis (~0.001/minute) |
| Center Y | Turn number (mod period) | Sinusoidal wobble, amplitude decreasing as session ages |
| Animation speed | Tool calls/minute | 0 calls = frozen, high activity = smooth glide |
| Brightness | Provider health | All authenticated = full brightness, degraded = dim |
| Iteration depth | Thinking level | off=50, low=100, medium=200, high=500 |

**Discrete signals (palette/type switches):**

| Visual property | Harness signal | Mapping |
|---|---|---|
| Color palette | Cognitive mode (idle/coding/design/cleave) | Palette swap with 500ms crossfade |
| Fractal type | Active persona | Default=Mandelbrot, persona badge drives Julia c-parameter |
| Inversion flash | Compaction event | 200ms palette inversion on BusEvent::Compacted |
| Border color | MCP server count | 0=dim, 1-3=accent, 4+=bright |

**Julia set personalization:**
Each persona maps to a unique Julia set c-parameter, derived from hashing the persona ID:
```rust
fn persona_to_julia_c(persona_id: &str) -> (f64, f64) {
    let hash = hash64(persona_id);
    let real = (hash & 0xFFFF) as f64 / 65536.0 * 1.5 - 0.75; // [-0.75, 0.75]
    let imag = (hash >> 16 & 0xFFFF) as f64 / 65536.0 * 1.5 - 0.75;
    (real, imag)
}
```
This means each persona has a visually distinct fractal signature — the operator can glance at the status surface and know which persona is active by the fractal's shape, before reading any text.

**Where it renders:**
- **Dashboard panel** — replaces the blank space below lifecycle status with a small fractal viewport (~30×15 cells)
- **Splash screen** — the fractal zooms in during startup, settling at the initial context state
- **Background of thinking indicator** — during extended thinking, the fractal slowly evolves behind the spinner text
- **NOT in the conversation area** — the fractal is ambient, not intrusive

## Open Questions

- Should the fractal render in a dedicated panel (dashboard right-side), as a background behind the spinner/thinking area, or both? Dashboard panel is always visible; background rendering only appears during active operations.
- Half-block rendering (▀▄) gives 2x vertical resolution but requires true-color terminal support for smooth gradients. Should we require true color, or provide a 256-color fallback with dithering?
- How does the fractal interact with tachyonfx effects? Should transitions (palette swap, zoom shift) go through the effects system, or be self-contained in the widget's time parameter?
