//! Fractal rendering demo — compare algorithms and rendering techniques.
//! Run: cargo run --example fractal_demo

use std::io;
use std::time::{Duration, Instant};
use crossterm::{
    ExecutableCommand,
    event::{self, Event, KeyCode, KeyEvent},
    terminal::{self, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::prelude::*;
use ratatui::widgets::{Block, Borders, Paragraph};

fn main() -> io::Result<()> {
    terminal::enable_raw_mode()?;
    io::stdout().execute(EnterAlternateScreen)?;
    let mut terminal = Terminal::new(CrosstermBackend::new(io::stdout()))?;

    let start = Instant::now();
    let mut mode = 0u8;
    let modes = [
        "Perlin — idle",
        "Perlin — idle (warm)",
        "Perlin — idle (violet)",
        "Plasma — thinking",
        "Plasma — thinking (warm)",
        "Plasma — thinking (intense)",
        "Attractor — working",
        "Attractor — working (warm)",
        "Attractor — working (dense)",
        "Lissajous — cleave",
        "Lissajous — cleave (fast)",
        "Lissajous — cleave (many)",
    ];

    loop {
        let t = start.elapsed().as_secs_f64();

        terminal.draw(|f| {
            let area = f.area();

            // Fill bg
            let bg = Color::Rgb(6, 10, 18);
            let fg = Color::Rgb(196, 216, 228);
            for y in area.top()..area.bottom() {
                for x in area.left()..area.right() {
                    let cell = &mut f.buffer_mut()[(x, y)];
                    cell.set_bg(bg);
                    cell.set_fg(fg);
                }
            }

            // Layout: label at top, render area below, controls at bottom
            let chunks = Layout::vertical([
                Constraint::Length(2),
                Constraint::Min(8),
                Constraint::Length(2),
            ]).split(area);

            // Label
            let label = Paragraph::new(format!(
                " Mode {}/{}: {}  |  t={:.1}s",
                mode + 1, modes.len(), modes[mode as usize], t
            )).style(Style::default().fg(Color::Rgb(42, 180, 200)));
            f.render_widget(label, chunks[0]);

            // Render area — simulate 36×8 dashboard region
            let render_area = Rect {
                x: chunks[1].x + 2,
                y: chunks[1].y,
                width: 36.min(chunks[1].width - 4),
                height: 8.min(chunks[1].height),
            };

            // Border around render area
            let border = Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Rgb(32, 72, 96)))
                .title(format!(" {}×{} ", render_area.width, render_area.height));
            let bordered = Rect {
                x: render_area.x - 1,
                y: render_area.y.saturating_sub(1),
                width: render_area.width + 2,
                height: render_area.height + 2,
            };
            f.render_widget(border, bordered);

            // Also show a wider version next to it
            let wide_area = Rect {
                x: bordered.right() + 2,
                y: render_area.y,
                width: 60.min(area.width.saturating_sub(bordered.right() + 4)),
                height: 8.min(chunks[1].height),
            };
            if wide_area.width >= 20 {
                let wide_border = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Rgb(32, 72, 96)))
                    .title(format!(" {}×{} wide ", wide_area.width, wide_area.height));
                let wide_bordered = Rect {
                    x: wide_area.x - 1,
                    y: wide_area.y.saturating_sub(1),
                    width: wide_area.width + 2,
                    height: wide_area.height + 2,
                };
                f.render_widget(wide_border, wide_bordered);
                render_mode(mode, t, wide_area, f.buffer_mut());
            }

            render_mode(mode, t, render_area, f.buffer_mut());

            // Controls
            let controls = Paragraph::new(" ←/→ switch mode  |  q quit")
                .style(Style::default().fg(Color::Rgb(96, 120, 136)));
            f.render_widget(controls, chunks[2]);
        })?;

        if event::poll(Duration::from_millis(33))? { // ~30fps
            if let Event::Key(KeyEvent { code, .. }) = event::read()? {
                match code {
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Right => mode = (mode + 1) % modes.len() as u8,
                    KeyCode::Left => mode = (mode + modes.len() as u8 - 1) % modes.len() as u8,
                    _ => {}
                }
            }
        }
    }

    terminal::disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;
    Ok(())
}

fn render_mode(mode: u8, t: f64, area: Rect, buf: &mut Buffer) {
    match mode {
        // Perlin variants — idle state
        0 => render_perlin_variant(t, area, buf, ColorScheme::Ocean, 0.5, 8.0),
        1 => render_perlin_variant(t, area, buf, ColorScheme::Amber, 0.5, 8.0),
        2 => render_perlin_variant(t, area, buf, ColorScheme::Violet, 0.5, 8.0),
        // Plasma variants — thinking state
        3 => render_plasma_variant(t, area, buf, ColorScheme::Ocean, 0.3, 1.0),
        4 => render_plasma_variant(t, area, buf, ColorScheme::Amber, 0.3, 1.0),
        5 => render_plasma_variant(t, area, buf, ColorScheme::Ocean, 0.6, 1.5),
        // Attractor variants — working state
        6 => render_attractor_variant(t, area, buf, ColorScheme::Ocean, 8000, 0.02),
        7 => render_attractor_variant(t, area, buf, ColorScheme::Amber, 8000, 0.02),
        8 => render_attractor_variant(t, area, buf, ColorScheme::Ocean, 16000, 0.02),
        // Lissajous variants — cleave state
        9 => render_lissajous_variant(t, area, buf, ColorScheme::Ocean, 3, 0.3),
        10 => render_lissajous_variant(t, area, buf, ColorScheme::Amber, 3, 0.6),
        11 => render_lissajous_variant(t, area, buf, ColorScheme::Ocean, 6, 0.3),
        _ => {}
    }
}

#[derive(Clone, Copy)]
enum ColorScheme { Ocean, Amber, Violet }

fn scheme_color(scheme: ColorScheme, t: f64) -> Color {
    let t = t.sqrt().clamp(0.0, 1.0);
    match scheme {
        ColorScheme::Ocean => Color::Rgb(
            (t * 12.0) as u8,
            (t * 36.0 + t * t * 20.0) as u8,
            (t * 50.0 + t * t * 30.0) as u8,
        ),
        ColorScheme::Amber => Color::Rgb(
            (t * 65.0 + t * t * 20.0) as u8,
            (t * 30.0 + t * t * 10.0) as u8,
            (t * 8.0) as u8,
        ),
        ColorScheme::Violet => Color::Rgb(
            (t * 35.0 + t * t * 15.0) as u8,
            (t * 12.0) as u8,
            (t * 55.0 + t * t * 25.0) as u8,
        ),
    }
}

fn bg_color() -> Color { Color::Rgb(6, 10, 18) }

// ── Perlin variants (idle) ──────────────────────────────────────────────────

fn render_perlin_variant(time: f64, area: Rect, buf: &mut Buffer, scheme: ColorScheme, speed: f64, scale: f64) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top = perlin_sample(px as f64 / scale, py as f64 / scale, time * speed);
            let bot = perlin_sample(px as f64 / scale, (py+1) as f64 / scale, time * speed);
            let tc = scheme_color(scheme, (top * 0.5 + 0.5).clamp(0.0, 1.0));
            let bc = scheme_color(scheme, (bot * 0.5 + 0.5).clamp(0.0, 1.0));
            if let Some(cell) = buf.cell_mut(Position::new(area.x + px as u16, area.y + row as u16)) {
                cell.set_char('▀');
                cell.set_fg(tc);
                cell.set_bg(bc);
            }
        }
    }
}

// ── Plasma variants (thinking) ──────────────────────────────────────────────

fn render_plasma_variant(time: f64, area: Rect, buf: &mut Buffer, scheme: ColorScheme, speed: f64, complexity: f64) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top = plasma_sample(px as f64, py as f64, time, speed, complexity);
            let bot = plasma_sample(px as f64, (py+1) as f64, time, speed, complexity);
            let tc = scheme_color(scheme, (top * 0.5 + 0.5).clamp(0.0, 1.0));
            let bc = scheme_color(scheme, (bot * 0.5 + 0.5).clamp(0.0, 1.0));
            if let Some(cell) = buf.cell_mut(Position::new(area.x + px as u16, area.y + row as u16)) {
                cell.set_char('▀');
                cell.set_fg(tc);
                cell.set_bg(bc);
            }
        }
    }
}

fn plasma_sample(x: f64, y: f64, t: f64, speed: f64, complexity: f64) -> f64 {
    let s = t * speed;
    let v1 = (x / (6.0 / complexity) + s).sin();
    let v2 = ((y / (4.0 / complexity) + s * 0.7).sin() + (x / (8.0 / complexity)).cos()).sin();
    let v3 = ((x * x + y * y).sqrt() / (6.0 / complexity) - s * 1.3).sin();
    (v1 + v2 + v3) / 3.0
}

// ── Attractor variants (working) ────────────────────────────────────────────

fn render_attractor_variant(time: f64, area: Rect, buf: &mut Buffer, scheme: ColorScheme, iterations: usize, evolve_speed: f64) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    let mut grid = vec![0u16; w * h];

    let a = -1.4 + (time * evolve_speed).sin() * 0.3;
    let b = 1.6 + (time * evolve_speed * 0.75).cos() * 0.2;
    let c = 1.0 + (time * evolve_speed * 1.25).sin() * 0.2;
    let d = 0.7 + (time * evolve_speed * 1.5).cos() * 0.1;

    let mut x = 0.1_f64;
    let mut y = 0.1_f64;
    for _ in 0..iterations {
        let nx = (a * y).sin() + c * (a * x).cos();
        let ny = (b * x).sin() + d * (b * y).cos();
        x = nx;
        y = ny;
        let gx = ((x + 3.0) / 6.0 * w as f64) as usize;
        let gy = ((y + 3.0) / 6.0 * h as f64) as usize;
        if gx < w && gy < h {
            grid[gy * w + gx] = grid[gy * w + gx].saturating_add(1);
        }
    }

    let max_hits = (*grid.iter().max().unwrap_or(&1)).max(1) as f64;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top_v = (grid[py * w + px] as f64 / max_hits).min(1.0);
            let bot_v = if py + 1 < h { (grid[(py+1) * w + px] as f64 / max_hits).min(1.0) } else { 0.0 };
            let tc = if top_v < 0.01 { bg_color() } else { scheme_color(scheme, top_v) };
            let bc = if bot_v < 0.01 { bg_color() } else { scheme_color(scheme, bot_v) };
            if let Some(cell) = buf.cell_mut(Position::new(area.x + px as u16, area.y + row as u16)) {
                cell.set_char('▀');
                cell.set_fg(tc);
                cell.set_bg(bc);
            }
        }
    }
}

// ── Lissajous variants (cleave) ─────────────────────────────────────────────

fn render_lissajous_variant(time: f64, area: Rect, buf: &mut Buffer, scheme: ColorScheme, num_curves: usize, speed: f64) {
    let w = area.width as usize;
    let h = area.height as usize * 2;
    let mut grid = vec![0u16; w * h];

    for curve in 0..num_curves {
        let freq_x = 3.0 + curve as f64 * 0.7;
        let freq_y = 2.0 + curve as f64 * 1.1;
        let phase = time * (speed + curve as f64 * 0.05);
        for i in 0..2000 {
            let t = i as f64 / 2000.0 * std::f64::consts::TAU;
            let x = (freq_x * t + phase).sin();
            let y = (freq_y * t + phase * 0.3).cos();
            let gx = ((x * 0.45 + 0.5) * w as f64) as usize;
            let gy = ((y * 0.45 + 0.5) * h as f64) as usize;
            if gx < w && gy < h {
                grid[gy * w + gx] = grid[gy * w + gx].saturating_add(1);
            }
        }
    }

    let max_hits = (*grid.iter().max().unwrap_or(&1)).max(1) as f64;
    for py in (0..h).step_by(2) {
        let row = py / 2;
        if row >= area.height as usize { break; }
        for px in 0..w {
            if px >= area.width as usize { break; }
            let top_v = (grid[py * w + px] as f64 / max_hits).min(1.0);
            let bot_v = if py + 1 < h { (grid[(py+1) * w + px] as f64 / max_hits).min(1.0) } else { 0.0 };
            let tc = if top_v < 0.01 { bg_color() } else { scheme_color(scheme, top_v) };
            let bc = if bot_v < 0.01 { bg_color() } else { scheme_color(scheme, bot_v) };
            if let Some(cell) = buf.cell_mut(Position::new(area.x + px as u16, area.y + row as u16)) {
                cell.set_char('▀');
                cell.set_fg(tc);
                cell.set_bg(bc);
            }
        }
    }
}

// ── Math helpers ────────────────────────────────────────────────────────────

/// Smooth flowing noise (sine interference, not true Perlin but visually similar)
fn perlin_sample(x: f64, y: f64, z: f64) -> f64 {
    let v1 = (x * 1.3 + z).sin() * (y * 0.7 + z * 0.5).cos();
    let v2 = ((x + y) * 0.8 - z * 0.3).sin();
    let v3 = (x * 2.1 - z * 0.7).cos() * (y * 1.5 + z * 0.4).sin();
    (v1 + v2 + v3) / 3.0
}
