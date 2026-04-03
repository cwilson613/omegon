//! Bash tool — execute shell commands with output capture.

use anyhow::Result;
use omegon_traits::{ContentBlock, ToolResult};
use std::path::Path;
use std::time::Instant;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

const MAX_OUTPUT_BYTES: usize = 50 * 1024;
const MAX_OUTPUT_LINES: usize = 2000;

pub async fn execute(
    command: &str,
    cwd: &Path,
    timeout_secs: Option<u64>,
    cancel: CancellationToken,
) -> Result<ToolResult> {
    let start = Instant::now();

    // Static blocklist: commands that are known to require interactive input.
    // This is best-effort — programs can prompt from anywhere — but catches
    // the common footguns before they wedge the process.
    static INTERACTIVE_PREFIXES: &[&str] = &[
        "sudo ", "sudo\t",
        "ssh ", "ssh\t",
        "passwd",
        "su ", "su\t",
        "kinit",
    ];
    let trimmed = command.trim_start();
    for prefix in INTERACTIVE_PREFIXES {
        if trimmed.starts_with(prefix) || trimmed == prefix.trim() {
            return Ok(ToolResult {
                content: vec![ContentBlock::Text {
                    text: format!(
                        "Blocked: `{}` requires interactive input (password/passphrase) \
                         which the agent cannot provide.\n\n\
                         Ask the operator to run this command in their terminal, \
                         then retry the dependent step.",
                        trimmed.split_whitespace().next().unwrap_or(trimmed)
                    ),
                }],
                details: serde_json::json!({
                    "exitCode": -1,
                    "durationMs": 0,
                    "blocked": true,
                    "reason": "interactive_input_required",
                }),
            });
        }
    }

    let mut cmd = Command::new("bash");
    cmd.args(["-c", command])
        .current_dir(cwd)
        .stdin(std::process::Stdio::null())  // /dev/null — commands needing input fail fast
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    let child = cmd.spawn()?;

    let output = tokio::select! {
        result = child.wait_with_output() => result?,
        _ = cancel.cancelled() => {
            anyhow::bail!("Command aborted");
        }
        _ = async {
            if let Some(secs) = timeout_secs {
                tokio::time::sleep(std::time::Duration::from_secs(secs)).await;
            } else {
                std::future::pending::<()>().await;
            }
        } => {
            anyhow::bail!("Command timed out after {} seconds", timeout_secs.unwrap());
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;
    let exit_code = output.status.code().unwrap_or(-1);

    // Combine stdout + stderr
    let mut full_output = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !stderr.is_empty() {
        if !full_output.is_empty() {
            full_output.push('\n');
        }
        full_output.push_str(&stderr);
    }

    // Strip terminal control noise (mouse reports, bracketed paste, etc.)
    let clean_output = strip_terminal_noise(&full_output);

    // Tail-truncate if needed
    let truncated = truncate_tail(&clean_output);
    let mut text = truncated.content;

    if exit_code != 0 {
        text.push_str(&format!("\n\nCommand exited with code {exit_code}"));
    }

    Ok(ToolResult {
        content: vec![ContentBlock::Text { text }],
        details: serde_json::json!({
            "exitCode": exit_code,
            "durationMs": duration_ms,
            "truncated": truncated.was_truncated,
            "totalLines": truncated.total_lines,
            "totalBytes": truncated.total_bytes,
        }),
    })
}

/// Strip CSI terminal control sequences that aren't SGR color codes.
///
/// Piped stdout/stderr shouldn't contain these, but they can leak through
/// when programs detect a pseudo-tty or when terminal multiplexers inject
/// mouse-tracking reports, bracketed-paste markers, or cursor positioning.
///
/// We preserve SGR (Select Graphic Rendition, ending with 'm') because
/// the TUI renderer converts those to styled spans via `ansi_to_tui`.
fn strip_terminal_noise(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let bytes = input.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        if bytes[i] == b'\x1b' && i + 1 < len && bytes[i + 1] == b'[' {
            // CSI sequence: ESC [ ... <final byte>
            let start = i;
            i += 2; // skip ESC [
            // Skip parameter bytes (0x30–0x3F) and intermediate bytes (0x20–0x2F)
            while i < len && bytes[i] >= 0x20 && bytes[i] <= 0x3F {
                i += 1;
            }
            // Final byte (0x40–0x7E)
            if i < len && bytes[i] >= 0x40 && bytes[i] <= 0x7E {
                let final_byte = bytes[i];
                i += 1;
                if final_byte == b'm' {
                    // SGR — keep it for color rendering, BUT the SGR mouse
                    // protocol also ends with 'm' (button release). Distinguish
                    // by the leading '<' parameter byte that SGR mouse always has.
                    let params = &input[start + 2..i - 1]; // between ESC[ and final byte
                    if !params.starts_with('<') {
                        result.push_str(&input[start..i]);
                    }
                    // else: SGR mouse release — drop
                }
                // All other CSI sequences (mouse reports, cursor movement, etc.) — drop
            } else {
                // Malformed CSI — drop the whole thing
                if i < len {
                    i += 1;
                }
            }
        } else if bytes[i] == b'\x1b' && i + 1 < len && bytes[i + 1] == b']' {
            // OSC sequence: ESC ] ... (ST or BEL)
            i += 2;
            while i < len {
                if bytes[i] == b'\x07' {
                    i += 1;
                    break;
                }
                if bytes[i] == b'\x1b' && i + 1 < len && bytes[i + 1] == b'\\' {
                    i += 2;
                    break;
                }
                i += 1;
            }
            // OSC sequences (title changes, hyperlinks) — drop entirely
        } else {
            result.push(input[i..].chars().next().unwrap());
            i += input[i..].chars().next().unwrap().len_utf8();
        }
    }

    result
}

struct Truncated {
    content: String,
    was_truncated: bool,
    total_lines: usize,
    total_bytes: usize,
}

fn truncate_tail(output: &str) -> Truncated {
    let total_bytes = output.len();
    let lines: Vec<&str> = output.lines().collect();
    let total_lines = lines.len();

    if total_bytes <= MAX_OUTPUT_BYTES && total_lines <= MAX_OUTPUT_LINES {
        return Truncated {
            content: output.to_string(),
            was_truncated: false,
            total_lines,
            total_bytes,
        };
    }

    // Take the last N lines within byte budget
    let mut kept = Vec::new();
    let mut bytes = 0;
    for line in lines.iter().rev() {
        let line_bytes = line.len() + 1; // +1 for newline
        if bytes + line_bytes > MAX_OUTPUT_BYTES || kept.len() >= MAX_OUTPUT_LINES {
            break;
        }
        kept.push(*line);
        bytes += line_bytes;
    }
    kept.reverse();

    let content = kept.join("\n");
    Truncated {
        content,
        was_truncated: true,
        total_lines,
        total_bytes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_tail_no_truncation() {
        let output = "line1\nline2\nline3";
        let result = truncate_tail(output);
        assert!(!result.was_truncated);
        assert_eq!(result.total_lines, 3);
        assert_eq!(result.content, output);
    }

    #[test]
    fn truncate_tail_by_lines() {
        let output = (0..3000)
            .map(|i| format!("line {i}"))
            .collect::<Vec<_>>()
            .join("\n");
        let result = truncate_tail(&output);
        assert!(result.was_truncated);
        assert_eq!(result.total_lines, 3000);
        assert!(result.content.lines().count() <= MAX_OUTPUT_LINES);
        // Should keep the LAST lines (tail)
        assert!(result.content.contains("line 2999"));
    }

    #[test]
    fn truncate_tail_by_bytes() {
        let output = (0..100)
            .map(|_| "x".repeat(1000))
            .collect::<Vec<_>>()
            .join("\n");
        let result = truncate_tail(&output);
        assert!(result.was_truncated);
        assert!(result.content.len() <= MAX_OUTPUT_BYTES);
    }

    #[test]
    fn truncate_empty() {
        let result = truncate_tail("");
        assert!(!result.was_truncated);
        assert_eq!(result.total_lines, 0);
    }

    #[test]
    fn strip_terminal_noise_preserves_sgr_colors() {
        let input = "\x1b[32mhello\x1b[0m world";
        let result = strip_terminal_noise(input);
        assert_eq!(result, "\x1b[32mhello\x1b[0m world");
    }

    #[test]
    fn strip_terminal_noise_removes_mouse_reports() {
        // SGR mouse report: ESC [ < Ps ; Ps ; Ps M
        let input = "before\x1b[<39;80;45Mafter";
        let result = strip_terminal_noise(input);
        assert_eq!(result, "beforeafter", "mouse report should be stripped");
    }

    #[test]
    fn strip_terminal_noise_removes_cursor_movement() {
        // Cursor up: ESC [ A
        let input = "line1\x1b[Aline2";
        let result = strip_terminal_noise(input);
        assert_eq!(result, "line1line2");
    }

    #[test]
    fn strip_terminal_noise_removes_bracketed_paste() {
        // Bracketed paste mode: ESC [ ? 2004 h / l
        let input = "before\x1b[?2004hpasted\x1b[?2004lafter";
        let result = strip_terminal_noise(input);
        assert_eq!(result, "beforepastedafter");
    }

    #[test]
    fn strip_terminal_noise_removes_osc_sequences() {
        // Title change: ESC ] 0 ; title BEL
        let input = "before\x1b]0;window title\x07after";
        let result = strip_terminal_noise(input);
        assert_eq!(result, "beforeafter");
    }

    #[test]
    fn strip_terminal_noise_plain_text_unchanged() {
        let input = "just plain text\nwith newlines\n";
        assert_eq!(strip_terminal_noise(input), input);
    }

    #[test]
    fn strip_terminal_noise_mixed_sgr_and_mouse() {
        let input = "\x1b[1;31merror:\x1b[0m failed\x1b[<0;10;20M\x1b[<0;10;20m";
        let result = strip_terminal_noise(input);
        // SGR (31m, 0m) preserved, mouse reports (M, m endings with <) stripped
        assert_eq!(result, "\x1b[1;31merror:\x1b[0m failed");
    }

    #[test]
    fn strip_terminal_noise_empty_input() {
        assert_eq!(strip_terminal_noise(""), "");
    }

    #[tokio::test]
    async fn blocks_sudo() {
        let cancel = CancellationToken::new();
        let result = execute("sudo chown user file", Path::new("."), None, cancel)
            .await
            .unwrap();
        let text = result.content[0].as_text().unwrap();
        assert!(text.contains("Blocked"), "should block sudo: {text}");
        assert_eq!(result.details["blocked"], true);
        assert_eq!(result.details["reason"], "interactive_input_required");
    }

    #[tokio::test]
    async fn blocks_sudo_with_leading_whitespace() {
        let cancel = CancellationToken::new();
        let result = execute("  sudo rm -rf /", Path::new("."), None, cancel)
            .await
            .unwrap();
        assert_eq!(result.details["blocked"], true);
    }

    #[tokio::test]
    async fn blocks_ssh() {
        let cancel = CancellationToken::new();
        let result = execute("ssh user@host", Path::new("."), None, cancel)
            .await
            .unwrap();
        assert_eq!(result.details["blocked"], true);
    }

    #[tokio::test]
    async fn does_not_block_echo_sudo() {
        let cancel = CancellationToken::new();
        let result = execute("echo sudo is great", Path::new("."), None, cancel)
            .await
            .unwrap();
        assert_eq!(result.details["exitCode"], 0);
        assert!(result.details.get("blocked").is_none());
    }

    #[tokio::test]
    async fn stdin_is_null_so_read_fails() {
        let cancel = CancellationToken::new();
        // `read` from stdin should get immediate EOF, not hang
        let result = execute("read -t 1 VAR; echo \"got: $VAR\"", Path::new("."), Some(5), cancel)
            .await
            .unwrap();
        // Should complete quickly (not timeout), read gets EOF
        let text = result.content[0].as_text().unwrap();
        assert!(text.contains("got:"), "read should get EOF, not hang: {text}");
    }

    #[tokio::test]
    async fn execute_echo() {
        let cancel = CancellationToken::new();
        let result = execute("echo hello", Path::new("."), None, cancel)
            .await
            .unwrap();
        let text = result.content[0].as_text().unwrap();
        assert!(text.contains("hello"), "should contain output: {text}");
        assert_eq!(result.details["exitCode"], 0);
    }

    #[tokio::test]
    async fn execute_nonzero_exit() {
        let cancel = CancellationToken::new();
        let result = execute("exit 42", Path::new("."), None, cancel)
            .await
            .unwrap();
        assert_eq!(result.details["exitCode"], 42);
        let text = result.content[0].as_text().unwrap();
        assert!(text.contains("42"), "should mention exit code: {text}");
    }

    #[tokio::test]
    async fn execute_stderr() {
        let cancel = CancellationToken::new();
        let result = execute("echo err >&2", Path::new("."), None, cancel)
            .await
            .unwrap();
        let text = result.content[0].as_text().unwrap();
        assert!(text.contains("err"), "should capture stderr: {text}");
    }

    #[tokio::test]
    async fn execute_cancel() {
        let cancel = CancellationToken::new();
        cancel.cancel();
        let result = execute("sleep 10", Path::new("."), None, cancel).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn execute_timeout() {
        let cancel = CancellationToken::new();
        let result = execute("sleep 10", Path::new("."), Some(1), cancel).await;
        assert!(result.is_err());
    }
}
