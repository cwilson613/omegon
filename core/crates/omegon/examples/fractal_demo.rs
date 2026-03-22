//! Fractal CIC instrument demo — four simultaneous displays.
//! Run: cargo run -p omegon --example fractal_demo
//!
//! Shows all four algorithms in a 2×2 grid as they would appear
//! in the system state panel. Color intensity cycles on a sine wave
//! (0→100→0) so you can see the navy→teal→amber ramp while tuning shapes.
//!
//! Controls:
//!   Tab / BackTab  — select instrument (cycles through 4)
//!   ↑/↓            — select parameter within instrument
//!   ←/→            — adjust value (Shift=fine 1%)
//!   Space          — pause/resume color cycling
//!   q              — quit

use std::io;
use std::time::{Duration, Instant};
use crossterm::{
    ExecutableCommand,
    event::{self, Event, KeyCode, KeyEvent, KeyModifiers},
    terminal::{self, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, Paragraph};

fn main() -> io::Result<()> {
    terminal::enable_raw_mode()?;
    io::stdout().execute(EnterAlternateScreen)?;
    let mut terminal = Terminal::new(CrosstermBackend::new(io::stdout()))?;

    let start = Instant::now();
    let mut state = DemoState::default();

    loop {
        let t = start.elapsed().as_secs_f64();

        terminal.draw(|f| {
            let area = f.area();
            let bg = Color::Rgb(0, 1, 3);
            let fg = Color::Rgb(196, 216, 228);
            for y in area.top()..area.bottom() {
                for x in area.left()..area.right() {
                    let cell = &mut f.buffer_mut()[(x, y)];
                    cell.set_bg(bg);
                    cell.set_fg(fg);
                }
            }

            // Color intensity cycles as a sine wave: 0 → 1 → 0
            let intensity = if state.paused { 0.5 } else {
                ((t * 0.3).sin() * 0.5 + 0.5) as f64
            };

            let chunks = Layout::vertical([
                Constraint::Length(1),  // title
                Constraint::Min(8),    // 2x2 grid + params
                Constraint::Length(1), // controls
            ]).split(area);

            // Title
            let title = format!(
                " CIC Instruments · intensity {:.0}% · {} · t={:.1}s",
                intensity * 100.0,
                if state.paused { "PAUSED" } else { "cycling" },
                t,
            );
            f.render_widget(
                Paragraph::new(title).style(Style::default().fg(Color::Rgb(42, 180, 200)).add_modifier(Modifier::BOLD)),
                chunks[0],
            );

            // Main area: 2x2 grid on left, params on right
            let cols = Layout::horizontal([
                Constraint::Min(50),   // instruments grid
                Constraint::Length(35), // params
            ]).split(chunks[1]);

            // 2x2 grid
            let grid_w = cols[0].width / 2;
            let grid_h = cols[0].height / 2;

            let instruments = [
                ("sonar (context)", 0usize),
                ("radar (tools)", 1),
                ("thermal (thinking)", 2),
                ("signal (memory)", 3),
            ];

            for (idx, (label, _algo)) in instruments.iter().enumerate() {
                let gx = (idx % 2) as u16;
                let gy = (idx / 2) as u16;
                let inst_area = Rect {
                    x: cols[0].x + gx * grid_w,
                    y: cols[0].y + gy * grid_h,
                    width: grid_w,
                    height: grid_h,
                };

                // Border
                let selected = idx == state.selected_instrument;
                let border_color = if selected {
                    Color::Rgb(42, 180, 200)
                } else {
                    Color::Rgb(20, 40, 55)
                };
                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(border_color))
                    .title(Span::styled(
                        format!(" {} ", label),
                        Style::default().fg(if selected { Color::Rgb(42, 180, 200) } else { Color::Rgb(64, 88, 112) }),
                    ));
                let inner = block.inner(inst_area);
                f.render_widget(block, inst_area);

                // Render fractal
                if inner.width >= 4 && inner.height >= 2 {
                    render_instrument(idx, t, intensity, inner, f.buffer_mut(), &state);
                }
            }

            // Parameter sliders for selected instrument
            let params = state.params_for(state.selected_instrument);
            let mut lines: Vec<Line<'_>> = vec![
                Line::from(Span::styled(
                    format!(" {} parameters", instruments[state.selected_instrument].0),
                    Style::default().fg(Color::Rgb(42, 180, 200)).add_modifier(Modifier::BOLD),
                )),
                Line::from(""),
            ];
            for (i, (name, val, min, max)) in params.iter().enumerate() {
                let selected = i == state.selected_param;
                let pct = (val - min) / (max - min);
                let bar_w = 14;
                let filled = (pct * bar_w as f64) as usize;
                let bar: String = "█".repeat(filled) + &"░".repeat(bar_w - filled);

                let cursor = if selected { "▸ " } else { "  " };
                let name_style = if selected {
                    Style::default().fg(Color::Rgb(42, 180, 200)).add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::Rgb(96, 120, 136))
                };
                let bar_style = if selected {
                    Style::default().fg(Color::Rgb(42, 180, 200))
                } else {
                    Style::default().fg(Color::Rgb(32, 56, 72))
                };

                lines.push(Line::from(vec![
                    Span::styled(cursor, name_style),
                    Span::styled(format!("{:<11}", name), name_style),
                    Span::styled(format!("{:>7.2} ", val), Style::default().fg(Color::Rgb(196, 216, 228))),
                    Span::styled(bar, bar_style),
                ]));
            }

            // Color ramp preview
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(" color ramp", Style::default().fg(Color::Rgb(64, 88, 112)))));
            let mut ramp_spans = vec![Span::raw(" ")];
            for i in 0..20 {
                let t = i as f64 / 19.0;
                let c = intensity_color(t);
                ramp_spans.push(Span::styled("██", Style::default().fg(c)));
            }
            lines.push(Line::from(ramp_spans));

            f.render_widget(Paragraph::new(lines), cols[1]);

            // Controls
            let controls = " Tab=instrument  ↑↓=param  ←→=adjust (Shift=fine)  Space=pause color  q=quit";
            f.render_widget(
                Paragraph::new(controls).style(Style::default().fg(Color::Rgb(64, 88, 112))),
                chunks[2],
            );
        })?;

        if event::poll(Duration::from_millis(33))? {
            if let Event::Key(KeyEvent { code, modifiers, .. }) = event::read()? {
                let fine = modifiers.contains(KeyModifiers::SHIFT);
                match code {
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Tab => {
                        state.selected_instrument = (state.selected_instrument + 1) % 4;
                        state.selected_param = 0;
                    }
                    KeyCode::BackTab => {
                        state.selected_instrument = (state.selected_instrument + 3) % 4;
                        state.selected_param = 0;
                    }
                    KeyCode::Up => {
                        let n = state.params_for(state.selected_instrument).len();
                        state.selected_param = (state.selected_param + n - 1) % n;
                    }
                    KeyCode::Down => {
                        let n = state.params_for(state.selected_instrument).len();
                        state.selected_param = (state.selected_param + 1) % n;
                    }
                    KeyCode::Left => state.adjust(-1.0, fine),
                    KeyCode::Right => state.adjust(1.0, fine),
                    KeyCode::Char(' ') => state.paused = !state.paused,
                    _ => {}
                }
            }
        }
    }

    terminal::disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;
    Ok(())
}

// ─── Color ramp: navy → teal → amber ───────────────────────────────────

/// Convert intensity (0.0 = idle navy, 0.5 = normal teal, 1.0 = hot amber) to RGB.
fn intensity_color(intensity: f64) -> Color {
    let i = intensity.clamp(0.0, 1.0);

    if i < 0.5 {
        // Navy → Teal (0.0 → 0.5)
        let t = i / 0.5; // 0→1 within this segment
        let r = (t * 2.0) as u8;             // 0 → 2
        let g = (4.0 + t * 36.0) as u8;      // 4 → 40
        let b = (8.0 + t * 32.0) as u8;      // 8 → 40
        Color::Rgb(r, g, b)
    } else {
        // Teal → Amber (0.5 → 1.0)
        let t = (i - 0.5) / 0.5; // 0→1 within this segment
        let r = (2.0 + t * 68.0) as u8;      // 2 → 70
        let g = (40.0 + t * 20.0) as u8;     // 40 → 60
        let b = (40.0 - t * 28.0) as u8;     // 40 → 12
        Color::Rgb(r, g, b)
    }
}

/// Background color for unlit pixels.
fn bg_color() -> Color { Color::Rgb(0, 1, 3) }

// ─── Instrument rendering ──────────────────────────────────────────────

fn render_instrument(idx: usize, time: f64, intensity: f64, area: Rect, buf: &mut Buffer, s: &DemoState) {
    match idx {
        0 => render_perlin(time, intensity, area, buf, s),
        1 => render_lissajous(time, intensity, area, buf, s, false),
        2 => render_plasma(time, intensity, area, buf, s),
        3 => render_attractor(time, intensity, area, buf, s),
        _ => {}
    }
}

fn set_halfblock(buf: &mut Buffer, area: Rect, px: usize, row: usize, top: Color, bot: Color) {
    if let Some(cell) = buf.cell_mut(Position::new(area.x + px as u16, area.y + row as u16)) {
        cell.set_char('▀');
        cell.set_fg(top);
        cell.set_bg(bot);
    }
}

fn pixel_color(value: f64, intensity: f64) -> Color {
    let v = value.clamp(0.0, 1.0);
    if v < 0.01 { return bg_color(); }
    intensity_color(v * intensity)
}

// ─── Perlin (sonar — context health) ────────────────────────────────────

fn render_perlin(time: f64, intensity: f64, area: Rect, buf: &mut Buffer, s: &DemoState) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top = noise_octaves(px as f64 / s.perlin_scale, py as f64 / s.perlin_scale,
                                     time * s.perlin_speed, s.perlin_octaves as usize, s.perlin_lacunarity);
            let bot = noise_octaves(px as f64 / s.perlin_scale, (py+1) as f64 / s.perlin_scale,
                                     time * s.perlin_speed, s.perlin_octaves as usize, s.perlin_lacunarity);
            let tc = pixel_color((top * 0.5 + 0.5) * s.perlin_amplitude, intensity);
            let bc = pixel_color((bot * 0.5 + 0.5) * s.perlin_amplitude, intensity);
            set_halfblock(buf, area, px, row, tc, bc);
        }
    }
}

fn noise_octaves(x: f64, y: f64, z: f64, octaves: usize, lacunarity: f64) -> f64 {
    let mut val = 0.0;
    let mut amp = 1.0;
    let mut freq = 1.0;
    let mut total_amp = 0.0;
    for _ in 0..octaves.max(1) {
        val += noise_sample(x * freq, y * freq, z) * amp;
        total_amp += amp;
        amp *= 0.5;
        freq *= lacunarity;
    }
    val / total_amp
}

fn noise_sample(x: f64, y: f64, z: f64) -> f64 {
    let v1 = (x * 1.3 + z).sin() * (y * 0.7 + z * 0.5).cos();
    let v2 = ((x + y) * 0.8 - z * 0.3).sin();
    let v3 = (x * 2.1 - z * 0.7).cos() * (y * 1.5 + z * 0.4).sin();
    (v1 + v2 + v3) / 3.0
}

// ─── Plasma (thermal — thinking state) ──────────────────────────────────

fn render_plasma(time: f64, intensity: f64, area: Rect, buf: &mut Buffer, s: &DemoState) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top = plasma_sample(px as f64, py as f64, time, s);
            let bot = plasma_sample(px as f64, (py+1) as f64, time, s);
            let tc = pixel_color((top * 0.5 + 0.5) * s.plasma_amplitude, intensity);
            let bc = pixel_color((bot * 0.5 + 0.5) * s.plasma_amplitude, intensity);
            set_halfblock(buf, area, px, row, tc, bc);
        }
    }
}

fn plasma_sample(x: f64, y: f64, t: f64, s: &DemoState) -> f64 {
    let c = s.plasma_complexity;
    let sp = t * s.plasma_speed;
    let v1 = (x / (6.0 / c) + sp).sin();
    let v2 = ((y / (4.0 / c) + sp * 0.7).sin() + (x / (8.0 / c)).cos()).sin();
    let v3 = ((x * x + y * y).sqrt() * s.plasma_distortion / (6.0 / c) - sp * 1.3).sin();
    let v4 = (x / (3.0 / c) - sp * 0.5).cos() * (y / (5.0 / c) + sp * 0.9).sin();
    (v1 + v2 + v3 + v4) / 4.0
}

// ─── Lissajous (radar — tool activity) ──────────────────────────────────

fn render_lissajous(time: f64, intensity: f64, area: Rect, buf: &mut Buffer, s: &DemoState, _intense: bool) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    let mut grid = vec![0u32; w * h];
    let nc = s.liss_num_curves as usize;
    let pts = s.liss_points as usize;

    for curve in 0..nc {
        let fx = s.liss_freq_base + curve as f64 * s.liss_freq_spread / nc.max(1) as f64;
        let fy = s.liss_freq_base + 1.0 + curve as f64 * (s.liss_freq_spread * 0.8) / nc.max(1) as f64;
        let phase = time * (s.liss_speed + curve as f64 * 0.03);
        for i in 0..pts {
            let t = i as f64 / pts as f64 * std::f64::consts::TAU;
            let x = (fx * t + phase).sin();
            let y = (fy * t + phase * 0.3).cos();
            let gx = ((x * s.liss_amplitude + 0.5) * w as f64) as usize;
            let gy = ((y * s.liss_amplitude + 0.5) * h as f64) as usize;
            if gx < w && gy < h { grid[gy * w + gx] += 1; }
        }
    }

    let max_hits = (*grid.iter().max().unwrap_or(&1)).max(1) as f64;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top_v = (grid[py * w + px] as f64 / max_hits).min(1.0);
            let bot_v = if py+1 < h { (grid[(py+1) * w + px] as f64 / max_hits).min(1.0) } else { 0.0 };
            let tc = pixel_color(top_v, intensity);
            let bc = pixel_color(bot_v, intensity);
            set_halfblock(buf, area, px, row, tc, bc);
        }
    }
}

// ─── Clifford attractor (signal — memory activity) ──────────────────────

fn render_attractor(time: f64, intensity: f64, area: Rect, buf: &mut Buffer, s: &DemoState) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    let mut grid = vec![0u32; w * h];

    // Interpolate between known-good parameter sets to avoid sparse orbits
    let phase = (time * s.attr_evolve_speed).sin() * 0.5 + 0.5; // 0→1 oscillation
    let a = s.attr_a + phase * 0.2;
    let b = s.attr_b + (1.0 - phase) * 0.15;
    let c = 1.0 + phase * 0.3;
    let d = 0.7 + (1.0 - phase) * 0.2;

    let iters = s.attr_iterations as usize;
    let spread = s.attr_spread;
    let mut x = 0.1_f64;
    let mut y = 0.1_f64;
    for _ in 0..iters {
        let nx = (a * y).sin() + c * (a * x).cos();
        let ny = (b * x).sin() + d * (b * y).cos();
        x = nx; y = ny;
        let gx = ((x + spread / 2.0) / spread * w as f64) as usize;
        let gy = ((y + spread / 2.0) / spread * h as f64) as usize;
        if gx < w && gy < h { grid[gy * w + gx] += 1; }
    }

    let max_hits = (*grid.iter().max().unwrap_or(&1)).max(1) as f64;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top_v = (grid[py * w + px] as f64 / max_hits).powf(s.attr_gamma);
            let bot_v = if py+1 < h { (grid[(py+1) * w + px] as f64 / max_hits).powf(s.attr_gamma) } else { 0.0 };
            let tc = pixel_color(top_v, intensity);
            let bc = pixel_color(bot_v, intensity);
            set_halfblock(buf, area, px, row, tc, bc);
        }
    }
}

// ─── State ──────────────────────────────────────────────────────────────

struct DemoState {
    selected_instrument: usize,
    selected_param: usize,
    paused: bool,
    // Perlin (sonar)
    perlin_scale: f64,
    perlin_speed: f64,
    perlin_octaves: f64,
    perlin_lacunarity: f64,
    perlin_amplitude: f64,
    // Plasma (thermal)
    plasma_complexity: f64,
    plasma_speed: f64,
    plasma_distortion: f64,
    plasma_amplitude: f64,
    // Lissajous (radar)
    liss_num_curves: f64,
    liss_speed: f64,
    liss_freq_base: f64,
    liss_freq_spread: f64,
    liss_amplitude: f64,
    liss_points: f64,
    // Clifford (signal)
    attr_iterations: f64,
    attr_evolve_speed: f64,
    attr_a: f64,
    attr_b: f64,
    attr_spread: f64,
    attr_gamma: f64,
}

impl Default for DemoState {
    fn default() -> Self {
        Self {
            selected_instrument: 0, selected_param: 0, paused: false,
            // Perlin — tuned from operator session
            perlin_scale: 18.0, perlin_speed: 1.8, perlin_octaves: 2.0,
            perlin_lacunarity: 2.3, perlin_amplitude: 0.5,
            // Plasma — tuned from operator session
            plasma_complexity: 1.65, plasma_speed: 1.46,
            plasma_distortion: 0.8, plasma_amplitude: 0.88,
            // Lissajous — tuned from operator session
            liss_num_curves: 8.0, liss_speed: 0.68, liss_freq_base: 1.9,
            liss_freq_spread: 1.86, liss_amplitude: 0.50, liss_points: 5375.0,
            // Clifford — constrained to known-good region
            attr_iterations: 12000.0, attr_evolve_speed: 0.03, attr_a: -1.4,
            attr_b: 1.6, attr_spread: 5.0, attr_gamma: 0.45,
        }
    }
}

impl DemoState {
    fn params_for(&self, instrument: usize) -> Vec<(&str, f64, f64, f64)> {
        match instrument {
            0 => vec![ // Perlin (sonar)
                ("scale", self.perlin_scale, 4.0, 30.0),
                ("speed", self.perlin_speed, 0.1, 4.0),
                ("octaves", self.perlin_octaves, 1.0, 4.0),
                ("lacunarity", self.perlin_lacunarity, 1.0, 4.0),
                ("amplitude", self.perlin_amplitude, 0.1, 1.0),
            ],
            1 => vec![ // Lissajous (radar)
                ("curves", self.liss_num_curves, 1.0, 12.0),
                ("speed", self.liss_speed, 0.05, 1.5),
                ("freq_base", self.liss_freq_base, 1.0, 7.0),
                ("freq_spread", self.liss_freq_spread, 0.1, 3.0),
                ("amplitude", self.liss_amplitude, 0.15, 0.5),
                ("points", self.liss_points, 500.0, 8000.0),
            ],
            2 => vec![ // Plasma (thermal)
                ("complexity", self.plasma_complexity, 0.3, 3.0),
                ("speed", self.plasma_speed, 0.05, 3.0),
                ("distortion", self.plasma_distortion, 0.0, 1.5),
                ("amplitude", self.plasma_amplitude, 0.1, 1.0),
            ],
            3 => vec![ // Clifford (signal)
                ("iterations", self.attr_iterations, 2000.0, 32000.0),
                ("evolve", self.attr_evolve_speed, 0.005, 0.1),
                ("a", self.attr_a, -2.0, -0.5),
                ("b", self.attr_b, 1.0, 2.0),
                ("spread", self.attr_spread, 3.0, 8.0),
                ("gamma", self.attr_gamma, 0.2, 1.0),
            ],
            _ => vec![],
        }
    }

    fn adjust(&mut self, dir: f64, fine: bool) {
        let params = self.params_for(self.selected_instrument);
        if self.selected_param >= params.len() { return; }
        let (_, val, min, max) = params[self.selected_param];
        let range = max - min;
        let step = if fine { range * 0.01 } else { range * 0.05 };
        let new_val = (val + dir * step).clamp(min, max);

        match self.selected_instrument {
            0 => match self.selected_param {
                0 => self.perlin_scale = new_val,
                1 => self.perlin_speed = new_val,
                2 => self.perlin_octaves = new_val,
                3 => self.perlin_lacunarity = new_val,
                4 => self.perlin_amplitude = new_val,
                _ => {}
            },
            1 => match self.selected_param {
                0 => self.liss_num_curves = new_val,
                1 => self.liss_speed = new_val,
                2 => self.liss_freq_base = new_val,
                3 => self.liss_freq_spread = new_val,
                4 => self.liss_amplitude = new_val,
                5 => self.liss_points = new_val,
                _ => {}
            },
            2 => match self.selected_param {
                0 => self.plasma_complexity = new_val,
                1 => self.plasma_speed = new_val,
                2 => self.plasma_distortion = new_val,
                3 => self.plasma_amplitude = new_val,
                _ => {}
            },
            3 => match self.selected_param {
                0 => self.attr_iterations = new_val,
                1 => self.attr_evolve_speed = new_val,
                2 => self.attr_a = new_val,
                3 => self.attr_b = new_val,
                4 => self.attr_spread = new_val,
                5 => self.attr_gamma = new_val,
                _ => {}
            },
            _ => {}
        }
    }
}
