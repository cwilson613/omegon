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
                name: crate::tool_registry::context::CONTEXT_STATUS.into(),
                label: "Context Status".into(),
                description: "Show current context window usage, token count, and compression statistics.".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
            ToolDefinition {
                name: crate::tool_registry::context::REQUEST_CONTEXT.into(),
                label: "Request Context".into(),
                description: "Request a compact context pack before making multiple exploratory tool calls. Best for session orientation and recent runtime evidence; returns curated summaries, not raw dumps.".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "requests": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 3,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "kind": {"type": "string", "enum": ["session_state", "recent_runtime", "code", "memory", "decisions", "specs"]},
                                    "query": {"type": "string"},
                                    "reason": {"type": "string"},
                                    "max_items": {"type": "integer", "minimum": 1, "maximum": 4},
                                    "scope": {"type": "array", "items": {"type": "string"}}
                                },
                                "required": ["kind", "query", "reason"]
                            }
                        }
                    },
                    "required": ["requests"]
                }),
            },
            ToolDefinition {
                name: crate::tool_registry::context::CONTEXT_COMPACT.into(),
                label: "Compact Context".into(),
                description: "Compress the conversation history via LLM summarization, freeing tokens for new work.".into(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
            ToolDefinition {
                name: crate::tool_registry::context::CONTEXT_CLEAR.into(),
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
            crate::tool_registry::context::CONTEXT_STATUS => {
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

            crate::tool_registry::context::REQUEST_CONTEXT => {
                let requests = _args
                    .get("requests")
                    .and_then(|v| v.as_array())
                    .ok_or_else(|| anyhow::anyhow!("request_context requires a requests array"))?;
                if requests.len() > 3 {
                    anyhow::bail!("request_context accepts at most 3 requests per call");
                }

                let metrics = self.metrics.lock().unwrap();
                let mut sections = Vec::new();
                let mut supported = 0usize;
                let mut unsupported = 0usize;

                for req in requests {
                    let kind = req.get("kind").and_then(|v| v.as_str()).unwrap_or("unknown");
                    let query = req.get("query").and_then(|v| v.as_str()).unwrap_or("");
                    let reason = req.get("reason").and_then(|v| v.as_str()).unwrap_or("");
                    match kind {
                        "session_state" => {
                            supported += 1;
                            sections.push(format!(
                                "### Session State\n- Why selected: session orientation request for `{query}`\n- Reason: {reason}\n- Current context: {}/{} tokens ({}%)\n- Policy: {}\n- Thinking: {}",
                                metrics.tokens_used,
                                metrics.context_window,
                                metrics.usage_percent(),
                                metrics.context_class,
                                metrics.thinking_level
                            ));
                        }
                        "recent_runtime" => {
                            supported += 1;
                            sections.push(format!(
                                "### Recent Runtime\n- Why selected: recent runtime evidence request for `{query}`\n- Reason: {reason}\n- Current runtime snapshot: context {}/{} tokens ({}%), policy {}, thinking {}",
                                metrics.tokens_used,
                                metrics.context_window,
                                metrics.usage_percent(),
                                metrics.context_class,
                                metrics.thinking_level
                            ));
                        }
                        "code" | "memory" | "decisions" | "specs" => {
                            unsupported += 1;
                            sections.push(format!(
                                "### {kind}\n- Reason: {reason}\n- Query: {query}\n- Status: request_context v1 does not yet curate {kind} packs. Use targeted retrieval tools for this category right now."
                            ));
                        }
                        other => {
                            anyhow::bail!("unknown request_context kind: {other}");
                        }
                    }
                }

                let summary = format!(
                    "Retrieved {} supported context pack(s); {} request(s) still require dedicated tools.",
                    supported, unsupported
                );
                let mut blocks = vec![ContentBlock::Text { text: summary.clone() }];
                blocks.push(ContentBlock::Text {
                    text: sections.join("\n\n"),
                });
                Ok(ToolResult {
                    content: blocks,
                    details: json!({
                        "supported": supported,
                        "unsupported": unsupported,
                        "context_window": metrics.context_window,
                        "tokens_used": metrics.tokens_used,
                        "thinking": metrics.thinking_level,
                        "class": metrics.context_class,
                    }),
                })
            }

            crate::tool_registry::context::CONTEXT_COMPACT => {
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

            crate::tool_registry::context::CONTEXT_CLEAR => {
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
                crate::tool_registry::context::CONTEXT_STATUS,
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
                crate::tool_registry::context::CONTEXT_COMPACT,
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
                    crate::tool_registry::context::CONTEXT_COMPACT,
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
                    crate::tool_registry::context::CONTEXT_CLEAR,
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

    #[tokio::test]
    async fn request_context_returns_compact_session_pack() {
        let metrics = SharedContextMetrics::new();
        {
            let mut m = metrics.lock().unwrap();
            m.update(96_433, 272_000, "Maniple (272k)", "medium");
        }
        let provider = ContextProvider::new(metrics, new_shared_command_tx());
        let result = provider
            .execute(
                crate::tool_registry::context::REQUEST_CONTEXT,
                "call-ctx-1",
                json!({
                    "requests": [
                        {
                            "kind": "session_state",
                            "query": "orient me before planning",
                            "reason": "Need session context before exploratory reads"
                        }
                    ]
                }),
                tokio_util::sync::CancellationToken::new(),
            )
            .await
            .expect("tool result");
        let text = result
            .content
            .iter()
            .filter_map(|c| match c {
                ContentBlock::Text { text } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            text.contains("Retrieved 1 supported context pack"),
            "unexpected text: {text}"
        );
        assert!(text.contains("Session State"), "unexpected text: {text}");
        assert!(text.contains("96433/272000"), "unexpected text: {text}");
    }

    #[tokio::test]
    async fn request_context_rejects_too_many_requests() {
        let provider = ContextProvider::new(SharedContextMetrics::new(), new_shared_command_tx());
        let err = provider
            .execute(
                crate::tool_registry::context::REQUEST_CONTEXT,
                "call-ctx-2",
                json!({
                    "requests": [
                        {"kind": "session_state", "query": "a", "reason": "a"},
                        {"kind": "session_state", "query": "b", "reason": "b"},
                        {"kind": "session_state", "query": "c", "reason": "c"},
                        {"kind": "session_state", "query": "d", "reason": "d"}
                    ]
                }),
                tokio_util::sync::CancellationToken::new(),
            )
            .await
            .expect_err("should reject oversized request batch");
        assert!(
            err.to_string().contains("at most 3 requests"),
            "unexpected error: {err}"
        );
    }
}
