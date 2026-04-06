//! Context management provider — handles context_status, context_compact, context_clear tools.
//!
//! Provides the harness with tools for organic context management:
//! - context_status: show current window usage, token budget
//! - context_compact: compress conversation via LLM
//! - context_clear: clear history, start fresh

use async_trait::async_trait;
use omegon_traits::{ContentBlock, Feature, ToolDefinition, ToolResult};
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot};

fn dispatch_command(command_tx: &SharedCommandTx, command: TuiCommand) -> bool {
    if let Ok(guard) = command_tx.lock()
        && let Some(ref tx) = *guard
    {
        return tx.try_send(command).is_ok();
    }
    false
}

async fn run_context_slash(
    command_tx: &SharedCommandTx,
    args: &str,
) -> anyhow::Result<Option<omegon_traits::SlashCommandResponse>> {
    let (reply_tx, reply_rx) = oneshot::channel();
    if !dispatch_command(
        command_tx,
        TuiCommand::RunSlashCommand {
            name: "context".into(),
            args: args.into(),
            respond_to: Some(reply_tx),
        },
    ) {
        return Ok(None);
    }

    Ok(Some(
        reply_rx
            .await
            .map_err(|_| anyhow::anyhow!("context slash executor dropped response"))?,
    ))
}

use crate::tui::TuiCommand;

/// Shared context metrics — updated by main loop, read by ContextProvider
#[derive(Debug, Clone)]
pub struct SharedContextMetrics {
    pub tokens_used: usize,
    pub context_window: usize,
    pub context_class: String,
    pub thinking_level: String,
}

impl SharedContextMetrics {
    pub fn new() -> Arc<Mutex<Self>> {
        Arc::new(Mutex::new(Self {
            tokens_used: 0,
            context_window: 200000,
            context_class: "unknown".to_string(),
            thinking_level: "unknown".to_string(),
        }))
    }

    pub fn usage_percent(&self) -> u32 {
        if self.context_window > 0 {
            ((self.tokens_used as f64 / self.context_window as f64) * 100.0).min(100.0) as u32
        } else {
            0
        }
    }

    pub fn update(
        &mut self,
        tokens_used: usize,
        context_window: usize,
        context_class: &str,
        thinking_level: &str,
    ) {
        self.tokens_used = tokens_used;
        self.context_window = context_window;
        self.context_class = context_class.to_string();
        self.thinking_level = thinking_level.to_string();
    }
}

/// Shared command channel — created in main, set after TUI init
pub type SharedCommandTx = Arc<Mutex<Option<mpsc::Sender<TuiCommand>>>>;

pub fn new_shared_command_tx() -> SharedCommandTx {
    Arc::new(Mutex::new(None))
}

pub struct ContextProvider {
    command_tx: SharedCommandTx,
    metrics: Arc<Mutex<SharedContextMetrics>>,
}

impl ContextProvider {
    pub fn new(metrics: Arc<Mutex<SharedContextMetrics>>, command_tx: SharedCommandTx) -> Self {
        Self {
            command_tx,
            metrics,
        }
    }
}

#[async_trait]
impl Feature for ContextProvider {
    fn name(&self) -> &str {
        "context-provider"
    }

    fn tools(&self) -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "context_status".into(),
                label: "Context Status".into(),
                description: "Show current context window usage, token count, and compression statistics.".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
            ToolDefinition {
                name: "context_compact".into(),
                label: "Compact Context".into(),
                description: "Compress the conversation history via LLM summarization, freeing tokens for new work.".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
            ToolDefinition {
                name: "context_clear".into(),
                label: "Clear Context".into(),
                description: "Clear all conversation history and start fresh. Archives the current session first.".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
        ]
    }

    async fn execute(
        &self,
        tool_name: &str,
        _call_id: &str,
        _args: Value,
        _cancel: tokio_util::sync::CancellationToken,
    ) -> anyhow::Result<ToolResult> {
        match tool_name {
            "context_status" => {
                let dispatched = dispatch_command(&self.command_tx, TuiCommand::ContextStatus);
                let metrics = self.metrics.lock().unwrap();
                let pct = metrics.usage_percent();
                let result_text = format!(
                    "Context: {}/{} tokens ({}%)\nClass: {}\nThinking: {}",
                    metrics.tokens_used,
                    metrics.context_window,
                    pct,
                    metrics.context_class,
                    metrics.thinking_level
                );

                Ok(ToolResult {
                    content: vec![ContentBlock::Text { text: result_text }],
                    details: json!({
                        "tokens_used": metrics.tokens_used,
                        "context_window": metrics.context_window,
                        "usage_percent": pct,
                        "class": metrics.context_class,
                        "thinking": metrics.thinking_level,
                        "dispatched": dispatched,
                    }),
                })
            }

            "context_compact" => {
                let response = run_context_slash(&self.command_tx, "compact").await?;
                let (text, accepted, dispatched) = if let Some(response) = response {
                    (
                        response.output.unwrap_or_else(|| "Context compaction completed.".into()),
                        response.accepted,
                        true,
                    )
                } else {
                    (
                        "Context compaction is unavailable in this mode (no interactive session command channel).".into(),
                        false,
                        false,
                    )
                };
                Ok(ToolResult {
                    content: vec![ContentBlock::Text { text }],
                    details: json!({ "dispatched": dispatched, "accepted": accepted }),
                })
            }

            "context_clear" => {
                let response = run_context_slash(&self.command_tx, "clear").await?;
                let (text, accepted, dispatched) = if let Some(response) = response {
                    (
                        response.output.unwrap_or_else(|| "Context cleared.".into()),
                        response.accepted,
                        true,
                    )
                } else {
                    (
                        "Context clear is unavailable in this mode (no interactive session command channel).".into(),
                        false,
                        false,
                    )
                };
                Ok(ToolResult {
                    content: vec![ContentBlock::Text { text }],
                    details: json!({ "dispatched": dispatched, "accepted": accepted }),
                })
            }

            _ => Err(anyhow::anyhow!("unknown context tool: {}", tool_name)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn expect_text(result: &ToolResult) -> &str {
        match &result.content[0] {
            ContentBlock::Text { text } => text,
            other => panic!("unexpected content block: {other:?}"),
        }
    }

    #[tokio::test]
    async fn context_status_reports_current_metrics_snapshot() {
        let metrics = SharedContextMetrics::new();
        {
            let mut m = metrics.lock().unwrap();
            m.update(96_433, 272_000, "Maniple (272k)", "medium");
        }
        let command_tx = new_shared_command_tx();
        let provider = ContextProvider::new(metrics, command_tx);
        let result = provider
            .execute(
                "context_status",
                "call-2",
                json!({}),
                tokio_util::sync::CancellationToken::new(),
            )
            .await
            .expect("tool result");

        match &result.content[0] {
            ContentBlock::Text { text } => {
                assert!(
                    text.contains("Context: 96433/272000 tokens (35%)"),
                    "unexpected text: {text}"
                );
                assert!(
                    text.contains("Class: Maniple (272k)"),
                    "unexpected text: {text}"
                );
                assert!(text.contains("Thinking: medium"), "unexpected text: {text}");
            }
            other => panic!("unexpected content block: {other:?}"),
        }
        assert_eq!(result.details["tokens_used"], 96_433);
        assert_eq!(result.details["context_window"], 272_000);
        assert_eq!(result.details["usage_percent"], 35);
    }

    #[tokio::test]
    async fn compact_tool_reports_when_no_command_channel_is_available() {
        let metrics = SharedContextMetrics::new();
        let command_tx = new_shared_command_tx();
        let provider = ContextProvider::new(metrics, command_tx);
        let result = provider
            .execute(
                "context_compact",
                "call-1",
                json!({}),
                tokio_util::sync::CancellationToken::new(),
            )
            .await
            .expect("tool result");

        match &result.content[0] {
            ContentBlock::Text { text } => {
                assert!(
                    text.contains("unavailable in this mode"),
                    "unexpected text: {text}"
                );
            }
            other => panic!("unexpected content block: {other:?}"),
        }
        assert_eq!(result.details["dispatched"], false);
        assert_eq!(result.details["accepted"], false);
    }

    #[tokio::test]
    async fn compact_tool_waits_for_structured_slash_response() {
        let metrics = SharedContextMetrics::new();
        let command_tx = new_shared_command_tx();
        let rx = {
            let (tx, rx) = mpsc::channel(1);
            *command_tx.lock().unwrap() = Some(tx);
            rx
        };
        let provider = ContextProvider::new(metrics, command_tx);

        let exec = tokio::spawn(async move {
            provider
                .execute(
                    "context_compact",
                    "call-3",
                    json!({}),
                    tokio_util::sync::CancellationToken::new(),
                )
                .await
                .expect("tool result")
        });

        let mut rx = rx;
        let command = rx.recv().await.expect("context slash command");
        match command {
            TuiCommand::RunSlashCommand {
                name,
                args,
                respond_to,
            } => {
                assert_eq!(name, "context");
                assert_eq!(args, "compact");
                respond_to
                    .expect("responder")
                    .send(omegon_traits::SlashCommandResponse {
                        accepted: true,
                        output: Some("Context compressed. Now using 1234 tokens.".into()),
                    })
                    .expect("send response");
            }
            other => panic!("unexpected command: {other:?}"),
        }

        let result = exec.await.expect("join");
        assert_eq!(
            expect_text(&result),
            "Context compressed. Now using 1234 tokens."
        );
        assert_eq!(result.details["dispatched"], true);
        assert_eq!(result.details["accepted"], true);
    }

    #[tokio::test]
    async fn clear_tool_waits_for_structured_slash_failure() {
        let metrics = SharedContextMetrics::new();
        let command_tx = new_shared_command_tx();
        let rx = {
            let (tx, rx) = mpsc::channel(1);
            *command_tx.lock().unwrap() = Some(tx);
            rx
        };
        let provider = ContextProvider::new(metrics, command_tx);

        let exec = tokio::spawn(async move {
            provider
                .execute(
                    "context_clear",
                    "call-4",
                    json!({}),
                    tokio_util::sync::CancellationToken::new(),
                )
                .await
                .expect("tool result")
        });

        let mut rx = rx;
        let command = rx.recv().await.expect("context slash command");
        match command {
            TuiCommand::RunSlashCommand {
                name,
                args,
                respond_to,
            } => {
                assert_eq!(name, "context");
                assert_eq!(args, "clear");
                respond_to
                    .expect("responder")
                    .send(omegon_traits::SlashCommandResponse {
                        accepted: false,
                        output: Some("clear failed".into()),
                    })
                    .expect("send response");
            }
            other => panic!("unexpected command: {other:?}"),
        }

        let result = exec.await.expect("join");
        assert_eq!(expect_text(&result), "clear failed");
        assert_eq!(result.details["dispatched"], true);
        assert_eq!(result.details["accepted"], false);
    }
}
