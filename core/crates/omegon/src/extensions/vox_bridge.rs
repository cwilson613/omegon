//! Vox event bridge — polls `vox_route` on an extension subprocess and injects
//! inbound messages as `DaemonEventEnvelope`s into the daemon's event queue.
//!
//! This enables the extension-driven bot pattern: vox provides the communication
//! connectors (Discord, Slack, etc.) and omegon provides the agent brain. The
//! bridge polls vox for new messages, formats them as prompts with reply context,
//! and feeds them through the standard daemon event processing pipeline. The agent
//! then uses `vox_reply` to send responses back through the originating connector.
//!
//! # Architecture
//!
//! ```text
//! Discord/Slack/... → vox connector → vox_route (polled by bridge)
//!                                         ↓
//!                              DaemonEventEnvelope (prompt)
//!                                         ↓
//!                              Daemon event worker → Agent turn
//!                                         ↓
//!                              Agent calls vox_reply tool
//!                                         ↓
//!                              Extension RPC → vox → Discord/Slack/...
//! ```

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};
use tokio_util::sync::CancellationToken;

use super::ExtensionPollingHandle;

/// Configuration for the vox event bridge.
#[derive(Debug, Clone)]
pub struct VoxBridgeConfig {
    /// How often to poll vox_route (milliseconds).
    pub poll_interval_ms: u64,
}

impl Default for VoxBridgeConfig {
    fn default() -> Self {
        Self {
            poll_interval_ms: 500,
        }
    }
}

/// Start the vox event bridge as a background task.
///
/// Polls `vox_route` on the extension subprocess and pushes inbound messages
/// into the daemon event queue as formatted prompts with reply context.
pub fn start_vox_bridge(
    handle: ExtensionPollingHandle,
    daemon_events: Arc<Mutex<Vec<omegon_traits::DaemonEventEnvelope>>>,
    config: VoxBridgeConfig,
    cancel: CancellationToken,
) {
    let ext_name = handle.extension_name().to_string();
    tracing::info!(
        extension = %ext_name,
        poll_ms = config.poll_interval_ms,
        "starting vox event bridge"
    );

    crate::task_spawn::spawn_best_effort_result("vox-event-bridge", async move {
        let mut interval = tokio::time::interval(Duration::from_millis(config.poll_interval_ms));

        loop {
            tokio::select! {
                _ = cancel.cancelled() => {
                    tracing::info!("vox event bridge shutting down");
                    return Ok(());
                }
                _ = interval.tick() => {}
            }

            // Poll vox_route via direct RPC (not through the agent/EventBus)
            let result = handle
                .rpc_call("execute_vox_route", json!({}))
                .await;

            let route_result = match result {
                Ok(v) => v,
                Err(e) => {
                    tracing::debug!(error = %e, "vox_route poll failed");
                    continue;
                }
            };

            let messages = match route_result.get("messages").and_then(|v| v.as_array()) {
                Some(msgs) if !msgs.is_empty() => msgs.clone(),
                _ => continue,
            };

            for msg in &messages {
                let envelope = match format_vox_event(msg) {
                    Some(env) => env,
                    None => continue,
                };

                tracing::info!(
                    source = %envelope.source,
                    event_id = %envelope.event_id,
                    "vox bridge: injecting inbound message"
                );

                match daemon_events.lock() {
                    Ok(mut queue) => queue.push(envelope),
                    Err(e) => {
                        tracing::error!(error = %e, "failed to push vox event to daemon queue");
                    }
                }
            }
        }
    });
}

/// Format a vox_route message into a DaemonEventEnvelope.
///
/// Each routed message has:
///   - `message.body[].content` — the text content
///   - `message.sender` — who sent it
///   - `message.channel` — which connector (discord, slack, etc.)
///   - `session_key` — routing key for session identity
///   - `reply_address` — everything needed to send a response back
///
/// The prompt is formatted so the agent can use the vox_reply tool to respond.
fn format_vox_event(msg: &Value) -> Option<omegon_traits::DaemonEventEnvelope> {
    // Extract text from body parts
    let body = msg.pointer("/message/body")?;
    let text: String = body
        .as_array()?
        .iter()
        .filter_map(|part| {
            let ptype = part.get("type")?.as_str()?;
            match ptype {
                "text" | "rich" => part.get("content")?.as_str().map(|s| s.to_string()),
                _ => None,
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    if text.is_empty() {
        return None;
    }

    let channel = msg
        .pointer("/message/channel")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let sender_name = msg
        .pointer("/message/sender/display_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let sender_id = msg
        .pointer("/message/sender/id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let reply_address = msg.get("reply_address").cloned().unwrap_or(json!(null));
    let session_key = msg.get("session_key").cloned().unwrap_or(json!(null));

    // Format the prompt with reply context.
    // The reply_address is embedded so the agent can pass it directly to vox_reply.
    let prompt = format!(
        "[Inbound via vox:{channel} from {sender_name} ({sender_id})]\n\
         {text}\n\n\
         <vox_reply_context>{}</vox_reply_context>",
        json!({
            "reply_address": reply_address,
            "session_key": session_key,
        })
    );

    Some(omegon_traits::DaemonEventEnvelope {
        event_id: format!(
            "vox-{}",
            msg.pointer("/message/id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
        ),
        source: format!("vox:{channel}"),
        trigger_kind: "prompt".to_string(),
        payload: json!({
            "text": prompt,
        }),
        caller_role: Some("edit".to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_discord_dm() {
        let msg = json!({
            "session_key": {"channel": "discord", "sender_id": "U123", "thread_id": null},
            "reply_address": {"channel": "discord", "envelope": {"kind": "direct", "to": [{"id": "ch1"}]}},
            "message": {
                "id": "msg1",
                "channel": "discord",
                "sender": {"id": "U123", "display_name": "alice"},
                "body": [{"type": "text", "content": "hello bot"}],
            }
        });

        let envelope = format_vox_event(&msg).unwrap();
        assert_eq!(envelope.source, "vox:discord");
        assert_eq!(envelope.trigger_kind, "prompt");
        assert_eq!(envelope.event_id, "vox-msg1");

        let text = envelope.payload["text"].as_str().unwrap();
        assert!(text.contains("hello bot"));
        assert!(text.contains("alice"));
        assert!(text.contains("<vox_reply_context>"));
        assert!(text.contains("reply_address"));
    }

    #[test]
    fn empty_body_returns_none() {
        let msg = json!({
            "session_key": {},
            "reply_address": {},
            "message": {
                "id": "msg1",
                "channel": "discord",
                "sender": {"id": "U1"},
                "body": [],
            }
        });
        assert!(format_vox_event(&msg).is_none());
    }

    #[test]
    fn attachment_only_returns_none() {
        let msg = json!({
            "session_key": {},
            "reply_address": {},
            "message": {
                "id": "msg1",
                "channel": "discord",
                "sender": {"id": "U1"},
                "body": [{"type": "attachment", "name": "f.png", "mime": "image/png", "url": "/tmp/f.png"}],
            }
        });
        assert!(format_vox_event(&msg).is_none());
    }
}
