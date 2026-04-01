//! RPC method dispatcher — routes incoming requests to handlers.

use serde_json::{json, Value};
use std::sync::Arc;
use super::RpcResponse;

use crate::scribe;

pub async fn handle(
    _state: &Arc<super::RpcState>,
    method: &str,
    id: Option<u64>,
    params: Value,
) -> String {
    let response_json = match method {
        "get_context" => {
            match handle_get_context(&params).await {
                Ok(result) => {
                    let response: RpcResponse<Value> = RpcResponse::success(id, result);
                    serde_json::to_string(&response)
                }
                Err(e) => {
                    let response: RpcResponse<()> = super::error_response(id, -32603, &e.to_string());
                    serde_json::to_string(&response)
                }
            }
        }

        "get_status" => {
            match handle_get_status(&params).await {
                Ok(result) => {
                    let response: RpcResponse<Value> = RpcResponse::success(id, result);
                    serde_json::to_string(&response)
                }
                Err(e) => {
                    let response: RpcResponse<()> = super::error_response(id, -32603, &e.to_string());
                    serde_json::to_string(&response)
                }
            }
        }

        "write_log" => {
            match handle_write_log(&params).await {
                Ok(result) => {
                    let response: RpcResponse<Value> = RpcResponse::success(id, result);
                    serde_json::to_string(&response)
                }
                Err(e) => {
                    let response: RpcResponse<()> = super::error_response(id, -32603, &e.to_string());
                    serde_json::to_string(&response)
                }
            }
        }

        "get_timeline" => {
            match handle_get_timeline(&params).await {
                Ok(result) => {
                    let response: RpcResponse<Value> = RpcResponse::success(id, result);
                    serde_json::to_string(&response)
                }
                Err(e) => {
                    let response: RpcResponse<()> = super::error_response(id, -32603, &e.to_string());
                    serde_json::to_string(&response)
                }
            }
        }

        "shutdown" => {
            let response: RpcResponse<Value> = RpcResponse::success(id, json!({"status": "shutting down"}));
            serde_json::to_string(&response)
        }

        _ => {
            let response: RpcResponse<()> = super::error_response(id, -32601, &format!("unknown method: {}", method));
            serde_json::to_string(&response)
        }
    };

    response_json.unwrap_or_default()
}

async fn handle_get_context(params: &Value) -> anyhow::Result<Value> {
    let cwd = params
        .get("cwd")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let context = scribe::resolve_context(cwd).await?;
    Ok(serde_json::to_value(context)?)
}

async fn handle_get_status(params: &Value) -> anyhow::Result<Value> {
    let cwd = params
        .get("cwd")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let status = scribe::get_engagement_status(cwd).await?;
    Ok(serde_json::to_value(status)?)
}

async fn handle_write_log(params: &Value) -> anyhow::Result<Value> {
    let content = params
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing 'content' parameter"))?;

    let category = params
        .get("category")
        .and_then(|v| v.as_str())
        .unwrap_or("development");

    scribe::write_log_entry(content, category).await?;
    Ok(json!({"success": true, "message": "log entry written"}))
}

async fn handle_get_timeline(params: &Value) -> anyhow::Result<Value> {
    let cwd = params
        .get("cwd")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let page = params
        .get("page")
        .and_then(|v| v.as_u64())
        .unwrap_or(1);

    let per_page = params
        .get("per_page")
        .and_then(|v| v.as_u64())
        .unwrap_or(20);

    let timeline = scribe::get_timeline(cwd, page as usize, per_page as usize).await?;
    Ok(timeline)
}
