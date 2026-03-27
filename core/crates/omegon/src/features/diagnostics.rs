//! Diagnostics feature — in-harness behavioral self-tests.
//!
//! Exposes:
//! - slash command `/diag`
//! - tool `run_diagnostic`
//!
//! v1 focuses on real behavioral suites for provider, delegate, and cleave.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use omegon_traits::{
    BusEvent, BusRequest, CommandDefinition, CommandResult, ContentBlock, Feature, ToolDefinition,
    ToolResult,
};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DiagStatus {
    Pass,
    Warn,
    Fail,
    Skip,
}

impl DiagStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Pass => "pass",
            Self::Warn => "warn",
            Self::Fail => "fail",
            Self::Skip => "skip",
        }
    }

    fn icon(self) -> &'static str {
        match self {
            Self::Pass => "✓",
            Self::Warn => "⚠",
            Self::Fail => "✗",
            Self::Skip => "○",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagExpectation {
    pub id: String,
    pub description: String,
    pub required: bool,
    pub status: DiagStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagFailure {
    pub suite: String,
    pub kind: String,
    pub severity: String,
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub evidence: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagStep {
    pub step_id: String,
    pub phase: String,
    pub status: DiagStatus,
    pub wall_time_ms: u128,
    #[serde(default)]
    pub details: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagSuiteReport {
    pub suite: String,
    pub status: DiagStatus,
    pub wall_time_ms: u128,
    pub expectations: Vec<DiagExpectation>,
    pub steps: Vec<DiagStep>,
    #[serde(default)]
    pub metrics: Value,
    #[serde(default)]
    pub failures: Vec<DiagFailure>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagReport {
    pub run_id: String,
    pub started_at: String,
    pub finished_at: String,
    pub wall_time_ms: u128,
    pub cwd: String,
    pub repo_root: String,
    pub omegon_version: String,
    pub overall_status: DiagStatus,
    pub suites: Vec<DiagSuiteReport>,
    pub totals: Value,
    #[serde(default)]
    pub failures: Vec<DiagFailure>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct DiagnosticsFeature {
    cwd: PathBuf,
    repo_root: PathBuf,
    latest: Arc<Mutex<Option<DiagReport>>>,
}

impl DiagnosticsFeature {
    pub fn new(cwd: &Path, repo_root: &Path) -> Self {
        Self {
            cwd: cwd.to_path_buf(),
            repo_root: repo_root.to_path_buf(),
            latest: Arc::new(Mutex::new(None)),
        }
    }

    fn diagnostics_dir(&self) -> PathBuf {
        self.repo_root.join(".omegon/diagnostics")
    }

    fn now_iso() -> String {
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("{secs}")
    }

    fn run_id() -> String {
        format!("diag-{}-{}", Self::now_iso(), std::process::id())
    }

    fn suite_list() -> Vec<&'static str> {
        vec!["provider", "delegate", "cleave", "full"]
    }

    fn persist_report(&self, report: &DiagReport) {
        let dir = self.diagnostics_dir();
        let _ = fs::create_dir_all(&dir);
        let path = dir.join(format!("{}.json", report.run_id));
        let last = dir.join("last.json");
        if let Ok(text) = serde_json::to_string_pretty(report) {
            let _ = fs::write(path, &text);
            let _ = fs::write(last, text);
        }
    }

    fn render_report(report: &DiagReport) -> String {
        let mut out = String::new();
        out.push_str("Diagnostics Report\n");
        out.push_str(&format!("Run ID: {}\n", report.run_id));
        out.push_str(&format!("Overall: {} {}\n", report.overall_status.icon(), report.overall_status.as_str()));
        out.push_str(&format!("Duration: {}ms\n\n", report.wall_time_ms));
        out.push_str("Suites\n");
        for suite in &report.suites {
            out.push_str(&format!(
                "- {:<14} {} {:<4} ({}ms)\n",
                suite.suite,
                suite.status.icon(),
                suite.status.as_str(),
                suite.wall_time_ms
            ));
        }
        out.push_str("\nTotals\n");
        if let Some(obj) = report.totals.as_object() {
            for (k, v) in obj {
                out.push_str(&format!("- {}: {}\n", k, v));
            }
        }
        if !report.failures.is_empty() {
            out.push_str("\nFailures\n");
            for failure in &report.failures {
                out.push_str(&format!(
                    "- [{}:{}] {}\n",
                    failure.suite, failure.code, failure.message
                ));
            }
        }
        if !report.warnings.is_empty() {
            out.push_str("\nWarnings\n");
            for warning in &report.warnings {
                out.push_str(&format!("- {}\n", warning));
            }
        }
        out
    }

    async fn run_suite(&self, suite: &str) -> anyhow::Result<DiagSuiteReport> {
        match suite {
            "provider" => self.run_provider_suite().await,
            "delegate" => self.run_delegate_suite().await,
            "cleave" => self.run_cleave_suite().await,
            other => anyhow::bail!("Unknown diagnostic suite: {other}"),
        }
    }

    async fn run_provider_suite(&self) -> anyhow::Result<DiagSuiteReport> {
        let started = Instant::now();
        let mut expectations = vec![
            DiagExpectation { id: "auth_status".into(), description: "At least one provider should be authenticated".into(), required: true, status: DiagStatus::Fail },
            DiagExpectation { id: "codex_probe".into(), description: "Codex auth status command should succeed".into(), required: true, status: DiagStatus::Fail },
        ];
        let mut steps = Vec::new();
        let mut failures = Vec::new();

        let t0 = Instant::now();
        let output = Command::new("cargo")
            .args(["run", "-p", "omegon", "--", "auth", "status"])
            .current_dir(self.repo_root.join("core"))
            .output()?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let ok = output.status.success() && (stdout.contains("✓") || stderr.contains("✓"));
        expectations[0].status = if ok { DiagStatus::Pass } else { DiagStatus::Fail };
        expectations[1].status = if output.status.success() { DiagStatus::Pass } else { DiagStatus::Fail };
        if !ok {
            failures.push(DiagFailure {
                suite: "provider".into(),
                kind: "auth".into(),
                severity: "error".into(),
                code: "no_authenticated_provider".into(),
                message: "No authenticated provider found in auth status output".into(),
                evidence: json!({"stdout": stdout, "stderr": stderr}),
            });
        }
        steps.push(DiagStep {
            step_id: "auth_status".into(),
            phase: "preflight".into(),
            status: if output.status.success() { DiagStatus::Pass } else { DiagStatus::Fail },
            wall_time_ms: t0.elapsed().as_millis(),
            details: json!({"exit_code": output.status.code(), "stdout_len": stdout.len(), "stderr_len": stderr.len()}),
        });

        let status = if failures.is_empty() { DiagStatus::Pass } else { DiagStatus::Fail };
        Ok(DiagSuiteReport {
            suite: "provider".into(),
            status,
            wall_time_ms: started.elapsed().as_millis(),
            expectations,
            steps,
            metrics: json!({"commands": 1, "authenticated_hint": ok}),
            failures,
            summary: if status == DiagStatus::Pass { "Provider status command succeeded and at least one provider appears authenticated.".into() } else { "Provider diagnostics failed.".into() },
        })
    }

    async fn run_delegate_suite(&self) -> anyhow::Result<DiagSuiteReport> {
        let started = Instant::now();
        let mut expectations = vec![
            DiagExpectation { id: "child_spawn".into(), description: "Delegate child must run to completion".into(), required: true, status: DiagStatus::Fail },
            DiagExpectation { id: "result_returned".into(), description: "Delegate result must be surfaced".into(), required: true, status: DiagStatus::Fail },
        ];
        let mut steps = Vec::new();
        let mut failures = Vec::new();

        let prompt = "Use the delegate tool once with background=false to spawn a trivial subtask that reads CONTRIBUTING.md and returns a one-line summary. Do not use bash for delegation.";
        let t0 = Instant::now();
        let output = Command::new("cargo")
            .args(["run", "-p", "omegon", "--", "--fresh", "--model", "openai-codex:gpt-5.4", "--prompt", prompt])
            .current_dir(self.repo_root.join("core"))
            .output()?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let child_ok = stdout.contains("Delegate result:") || stderr.contains("Delegate result:");
        expectations[0].status = if output.status.success() { DiagStatus::Pass } else { DiagStatus::Fail };
        expectations[1].status = if child_ok { DiagStatus::Pass } else { DiagStatus::Fail };
        if !output.status.success() || !child_ok {
            failures.push(DiagFailure {
                suite: "delegate".into(),
                kind: "child_process".into(),
                severity: "error".into(),
                code: "delegate_probe_failed".into(),
                message: "Delegate probe did not complete successfully".into(),
                evidence: json!({"exit_code": output.status.code(), "stdout": stdout, "stderr": stderr}),
            });
        }
        steps.push(DiagStep {
            step_id: "delegate_probe".into(),
            phase: "execution".into(),
            status: if output.status.success() && child_ok { DiagStatus::Pass } else { DiagStatus::Fail },
            wall_time_ms: t0.elapsed().as_millis(),
            details: json!({"exit_code": output.status.code(), "result_seen": child_ok}),
        });

        let status = if failures.is_empty() { DiagStatus::Pass } else { DiagStatus::Fail };
        Ok(DiagSuiteReport {
            suite: "delegate".into(),
            status,
            wall_time_ms: started.elapsed().as_millis(),
            expectations,
            steps,
            metrics: json!({"commands": 1}),
            failures,
            summary: if status == DiagStatus::Pass { "Delegate child executed and returned a result.".into() } else { "Delegate diagnostics failed.".into() },
        })
    }

    async fn run_cleave_suite(&self) -> anyhow::Result<DiagSuiteReport> {
        let started = Instant::now();
        let mut expectations = vec![
            DiagExpectation { id: "plan_parse".into(), description: "Cleave plan should parse and normalize dependencies".into(), required: true, status: DiagStatus::Fail },
            DiagExpectation { id: "children_complete".into(), description: "Read-only cleave children should complete successfully".into(), required: true, status: DiagStatus::Fail },
            DiagExpectation { id: "final_counts".into(), description: "Final success/failure counts should match observed outcomes".into(), required: true, status: DiagStatus::Fail },
        ];
        let mut steps = Vec::new();
        let mut failures = Vec::new();

        let prompt = "Use cleave_run exactly once with this plan JSON: {\"children\":[{\"label\":\"inspect-contrib\",\"description\":\"Read CONTRIBUTING.md and report one concise workflow rule. Do not modify files.\",\"scope\":[\"CONTRIBUTING.md\"],\"depends_on\":[]},{\"label\":\"inspect-main\",\"description\":\"Read core/crates/omegon/src/main.rs and report one concise observation about startup model resolution. Do not modify files.\",\"scope\":[\"core/crates/omegon/src/main.rs\"],\"depends_on\":[0]}]} and directive: 'Minimal internal cleave_run smoke test on real repo files; read-only only; no commits.' After the tool returns, summarize success/failure counts only.";
        let t0 = Instant::now();
        let output = Command::new("cargo")
            .args(["run", "-p", "omegon", "--", "--fresh", "--model", "openai-codex:gpt-5.4", "--prompt", prompt])
            .current_dir(self.repo_root.join("core"))
            .output()?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let report_text = format!("{stdout}\n{stderr}");
        let parsed = report_text.contains("2 completed, 0 failed") || report_text.contains("Success: 2") || report_text.contains("Success: 2  ");
        expectations[0].status = if !report_text.contains("invalid type: integer") { DiagStatus::Pass } else { DiagStatus::Fail };
        expectations[1].status = if parsed { DiagStatus::Pass } else { DiagStatus::Fail };
        expectations[2].status = if parsed { DiagStatus::Pass } else { DiagStatus::Fail };
        if !output.status.success() || !parsed {
            failures.push(DiagFailure {
                suite: "cleave".into(),
                kind: "reporting".into(),
                severity: "error".into(),
                code: "cleave_probe_failed".into(),
                message: "Cleave probe did not report the expected success counts".into(),
                evidence: json!({"exit_code": output.status.code(), "stdout": stdout, "stderr": stderr}),
            });
        }
        steps.push(DiagStep {
            step_id: "cleave_probe".into(),
            phase: "execution".into(),
            status: if output.status.success() && parsed { DiagStatus::Pass } else { DiagStatus::Fail },
            wall_time_ms: t0.elapsed().as_millis(),
            details: json!({"exit_code": output.status.code(), "success_counts_seen": parsed}),
        });

        let status = if failures.is_empty() { DiagStatus::Pass } else { DiagStatus::Fail };
        Ok(DiagSuiteReport {
            suite: "cleave".into(),
            status,
            wall_time_ms: started.elapsed().as_millis(),
            expectations,
            steps,
            metrics: json!({"commands": 1}),
            failures,
            summary: if status == DiagStatus::Pass { "Cleave behavioral smoke completed with correct success accounting.".into() } else { "Cleave diagnostics failed.".into() },
        })
    }

    async fn run_named(&self, suite: &str) -> anyhow::Result<DiagReport> {
        let started = Instant::now();
        let suites_to_run: Vec<&str> = if suite == "full" {
            vec!["provider", "delegate", "cleave"]
        } else {
            vec![suite]
        };

        let mut suites = Vec::new();
        for suite_name in suites_to_run {
            suites.push(self.run_suite(suite_name).await?);
        }

        let failures: Vec<DiagFailure> = suites.iter().flat_map(|s| s.failures.clone()).collect();
        let overall_status = if failures.is_empty() { DiagStatus::Pass } else { DiagStatus::Fail };
        let report = DiagReport {
            run_id: Self::run_id(),
            started_at: Self::now_iso(),
            finished_at: Self::now_iso(),
            wall_time_ms: started.elapsed().as_millis(),
            cwd: self.cwd.display().to_string(),
            repo_root: self.repo_root.display().to_string(),
            omegon_version: env!("CARGO_PKG_VERSION").to_string(),
            overall_status,
            totals: json!({
                "suite_count": suites.len(),
                "failures": failures.len(),
                "total_wall_time_ms": started.elapsed().as_millis(),
            }),
            suites,
            failures,
            warnings: vec![],
        };
        self.persist_report(&report);
        *self.latest.lock().unwrap() = Some(report.clone());
        Ok(report)
    }
}

#[async_trait]
impl Feature for DiagnosticsFeature {
    fn name(&self) -> &str {
        "diagnostics"
    }

    fn tools(&self) -> Vec<ToolDefinition> {
        vec![ToolDefinition {
            name: crate::tool_registry::diagnostics::RUN_DIAGNOSTIC.into(),
            label: "run_diagnostic".into(),
            description: "Run built-in behavioral diagnostics and emit a structured report. Suites: provider, delegate, cleave, full.".into(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "suite": {
                        "type": "string",
                        "enum": ["provider", "delegate", "cleave", "full"],
                        "default": "full"
                    }
                },
                "required": []
            }),
        }]
    }

    async fn execute(
        &self,
        tool_name: &str,
        _call_id: &str,
        args: Value,
        _cancel: tokio_util::sync::CancellationToken,
    ) -> anyhow::Result<ToolResult> {
        if tool_name != crate::tool_registry::diagnostics::RUN_DIAGNOSTIC {
            anyhow::bail!("Unknown tool: {tool_name}");
        }
        let suite = args.get("suite").and_then(|v| v.as_str()).unwrap_or("full");
        let report = self.run_named(suite).await?;
        Ok(ToolResult {
            content: vec![ContentBlock::Text { text: Self::render_report(&report) }],
            details: serde_json::to_value(report)?,
        })
    }

    fn commands(&self) -> Vec<CommandDefinition> {
        vec![CommandDefinition {
            name: "diag".into(),
            description: "run built-in behavioral diagnostics".into(),
            subcommands: vec!["list".into(), "last".into(), "run".into(), "full".into()],
        }]
    }

    fn handle_command(&mut self, name: &str, args: &str) -> CommandResult {
        if name != "diag" {
            return CommandResult::NotHandled;
        }
        let trimmed = args.trim();
        match trimmed {
            "" | "list" => CommandResult::Display(format!(
                "Available diagnostics:\n\n{}",
                Self::suite_list().into_iter().map(|s| format!("- {s}")).collect::<Vec<_>>().join("\n")
            )),
            "last" => {
                let latest = self.latest.lock().unwrap();
                match latest.as_ref() {
                    Some(report) => CommandResult::Display(Self::render_report(report)),
                    None => CommandResult::Display("No diagnostic report has been run in this session.".into()),
                }
            }
            "full" => CommandResult::Display(
                "Use the run_diagnostic tool with suite=full to execute the full diagnostics gauntlet.".into(),
            ),
            _ if trimmed.starts_with("run ") => {
                let suite = trimmed.trim_start_matches("run ").trim();
                if !Self::suite_list().contains(&suite) {
                    return CommandResult::Display(format!("Unknown diagnostic suite: {suite}"));
                }
                CommandResult::Display(format!(
                    "Use the run_diagnostic tool with suite={suite} to execute this diagnostic."
                ))
            }
            _ => CommandResult::Display("Usage: /diag [list|last|run <suite>|full]".into()),
        }
    }

    fn on_event(&mut self, _event: &BusEvent) -> Vec<BusRequest> {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diag_command_lists_suites() {
        let dir = tempfile::tempdir().unwrap();
        let mut feature = DiagnosticsFeature::new(dir.path(), dir.path());
        let result = feature.handle_command("diag", "list");
        match result {
            CommandResult::Display(text) => {
                assert!(text.contains("provider"));
                assert!(text.contains("delegate"));
                assert!(text.contains("cleave"));
            }
            _ => panic!("expected display result"),
        }
    }

    #[test]
    fn diagnostics_feature_exposes_tool() {
        let dir = tempfile::tempdir().unwrap();
        let feature = DiagnosticsFeature::new(dir.path(), dir.path());
        let tools = feature.tools();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].name, crate::tool_registry::diagnostics::RUN_DIAGNOSTIC);
    }
}
