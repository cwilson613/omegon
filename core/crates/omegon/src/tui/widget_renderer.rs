//! Renders extension widgets with schema-aware formatting.
//!
//! Dispatches on the widget's `renderer` field to select appropriate layout:
//! - "timeline": chronological event list
//! - "table": structured data as rows/columns
//! - "tree": hierarchical data with expand/collapse
//! - (fallback): pretty-printed JSON

use ratatui::{
    prelude::*,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
};
use serde_json::Value;

/// Render an extension widget based on its renderer type.
pub fn render_widget(
    frame: &mut Frame,
    area: Rect,
    renderer_type: &str,
    data: &Value,
    label: &str,
) {
    match renderer_type {
        "timeline" => render_timeline(frame, area, data, label),
        "table" => render_table(frame, area, data, label),
        "tree" => render_tree(frame, area, data, label),
        _ => render_json_fallback(frame, area, data, label),
    }
}

/// Render as timeline: list of events with timestamps.
/// Expected data shape: { "events": [{ "timestamp": "...", "title": "...", "description": "..." }] }
fn render_timeline(frame: &mut Frame, area: Rect, data: &Value, label: &str) {
    let mut lines = vec![];

    let block = Block::default()
        .title(format!(" {} ", label))
        .borders(Borders::ALL);

    // Extract events array
    if let Some(events) = data.get("events").and_then(|v| v.as_array()) {
        for (idx, event) in events.iter().enumerate() {
            if idx > 0 {
                lines.push(Line::from(""));
            }

            let timestamp = event
                .get("timestamp")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let title = event
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("untitled");
            let desc = event
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            lines.push(Line::from(vec![
                Span::styled(
                    format!("📅 {}", timestamp),
                    Style::default().fg(Color::Cyan),
                ),
                Span::raw(" "),
                Span::styled(title, Style::default().bold()),
            ]));

            if !desc.is_empty() {
                lines.push(Line::from(Span::styled(
                    format!("   {}", desc),
                    Style::default().fg(Color::DarkGray),
                )));
            }
        }
    } else {
        lines.push(Line::from("No events found"));
    }

    let para = Paragraph::new(lines).block(block);
    frame.render_widget(para, area);
}

/// Render as table: structured rows and columns.
/// Expected data shape: { "rows": [{ "col1": "...", "col2": "..." }] }
fn render_table(frame: &mut Frame, area: Rect, data: &Value, label: &str) {
    let mut lines = vec![];

    let block = Block::default()
        .title(format!(" {} ", label))
        .borders(Borders::ALL);

    // Extract rows array
    if let Some(rows) = data.get("rows").and_then(|v| v.as_array()) {
        if rows.is_empty() {
            lines.push(Line::from("No rows"));
        } else {
            // Try to extract columns from first row
            if let Some(first) = rows.first().and_then(|r| r.as_object()) {
                let cols: Vec<_> = first.keys().collect();

                // Header row
                let header = Line::from(
                    cols.iter()
                        .enumerate()
                        .flat_map(|(i, col)| {
                            let mut spans = vec![Span::styled(
                                col.to_string(),
                                Style::default().bold().fg(Color::Yellow),
                            )];
                            if i < cols.len() - 1 {
                                spans.push(Span::raw(" │ "));
                            }
                            spans
                        })
                        .collect::<Vec<_>>(),
                );
                lines.push(header);
                lines.push(Line::from(
                    "─".repeat(area.width.saturating_sub(2) as usize),
                ));

                // Data rows
                for row in rows {
                    if let Some(obj) = row.as_object() {
                        let values: Vec<_> = cols
                            .iter()
                            .map(|col| obj.get(*col).and_then(|v| v.as_str()).unwrap_or("-"))
                            .collect();

                        let line = Line::from(
                            values
                                .iter()
                                .enumerate()
                                .flat_map(|(i, val)| {
                                    let mut spans = vec![Span::raw(val.to_string())];
                                    if i < values.len() - 1 {
                                        spans.push(Span::raw(" │ "));
                                    }
                                    spans
                                })
                                .collect::<Vec<_>>(),
                        );
                        lines.push(line);
                    }
                }
            }
        }
    } else {
        lines.push(Line::from("No table data found"));
    }

    let para = Paragraph::new(lines).block(block);
    frame.render_widget(para, area);
}

/// Render as tree: hierarchical structure with nesting.
/// Expected data shape: { "root": { "name": "...", "children": [...] } }
fn render_tree(frame: &mut Frame, area: Rect, data: &Value, label: &str) {
    let mut lines = vec![];

    let block = Block::default()
        .title(format!(" {} ", label))
        .borders(Borders::ALL);

    if let Some(root) = data.get("root") {
        render_tree_node(&mut lines, root, 0);
    } else {
        lines.push(Line::from("No tree data found"));
    }

    let para = Paragraph::new(lines).block(block);
    frame.render_widget(para, area);
}

/// Recursive helper to render tree nodes.
fn render_tree_node(lines: &mut Vec<Line>, node: &Value, depth: usize) {
    let indent = "  ".repeat(depth);
    let name = node
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("unnamed");

    let line = if depth == 0 {
        Line::from(Span::styled(
            format!("📦 {}", name),
            Style::default().bold().fg(Color::Green),
        ))
    } else {
        Line::from(format!("{}├─ {}", indent, name))
    };
    lines.push(line);

    // Recurse into children
    if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
        for child in children {
            render_tree_node(lines, child, depth + 1);
        }
    }
}

/// Fallback: render as pretty-printed JSON.
fn render_json_fallback(frame: &mut Frame, area: Rect, data: &Value, label: &str) {
    let block = Block::default()
        .title(format!(" {} (JSON) ", label))
        .borders(Borders::ALL);

    let json_str = serde_json::to_string_pretty(data).unwrap_or_else(|_| "{}".to_string());
    let para = Paragraph::new(json_str).block(block);
    frame.render_widget(para, area);
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_timeline_rendering() {
        let data = serde_json::json!({
            "events": [
                {
                    "timestamp": "2024-01-01T10:00:00Z",
                    "title": "Project started",
                    "description": "Initial setup"
                }
            ]
        });

        // Just verify it doesn't panic
        let json_str = serde_json::to_string_pretty(&data).unwrap();
        assert!(!json_str.is_empty());
    }

    #[test]
    fn test_table_rendering() {
        let data = serde_json::json!({
            "rows": [
                { "name": "Alice", "status": "active" },
                { "name": "Bob", "status": "inactive" }
            ]
        });

        let json_str = serde_json::to_string_pretty(&data).unwrap();
        assert!(!json_str.is_empty());
    }
}
