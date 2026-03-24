//! Startup systems check — probe the environment to discover capabilities.
//!
//! Each probe runs independently and sends its result through a channel.
//! The splash screen receives results via `try_recv()` each frame and
//! updates the checklist grid. After all probes complete, results are
//! classified into a `CapabilityTier` for tutorial and routing decisions.

use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;

// ─── Types ──────────────────────────────────────────────────────────────────

/// Result of a single startup probe.
#[derive(Debug, Clone)]
pub struct ProbeResult {
    pub label: &'static str,
    pub state: ProbeState,
    pub summary: String,
}

/// Outcome of a probe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeState {
    Done,
    Failed,
}

/// Capability tier derived from probe results. Drives tutorial variant
/// selection, default routing policy, and bootstrap panel messaging.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapabilityTier {
    /// Anthropic or OpenAI API key present. Full experience.
    FullCloud,
    /// Ollama running with 14B+ model, 32GB+ RAM. Full experience, local.
    BeefyLocal,
    /// OpenRouter or other free cloud API key present.
    FreeCloud,
    /// Ollama with small model (4B-8B). Abbreviated experience.
    SmallLocal,
    /// Nothing available. UI tour only.
    Offline,
}

// ─── Probe orchestrator ─────────────────────────────────────────────────────

/// Run all startup probes in parallel and send results through `tx`.
/// Each probe sends its result independently as it completes.
/// The entire function completes within 2 seconds even if endpoints are unreachable.
pub async fn run_probes(tx: mpsc::Sender<ProbeResult>, cwd: String) {
    let tx1 = tx.clone();
    let tx2 = tx.clone();
    let tx3 = tx.clone();
    let tx4 = tx.clone();
    let tx5 = tx.clone();
    let tx6 = tx.clone();
    let tx7 = tx.clone();
    let tx8 = tx.clone();
    let tx9 = tx;
    let cwd2 = cwd.clone();
    let cwd3 = cwd.clone();

    // Fire all probes concurrently. Each sends its result as it completes.
    // The tokio::time::timeout wraps the entire join to enforce the 2s ceiling.
    let _ = tokio::time::timeout(Duration::from_secs(2), async {
        tokio::join!(
            async { let _ = tx1.send(probe_cloud()); },
            async { let _ = tx2.send(probe_local().await); },
            async { let _ = tx3.send(probe_hardware()); },
            async { let _ = tx4.send(probe_memory(&cwd)); },
            async { let _ = tx5.send(probe_tools()); },
            async { let _ = tx6.send(probe_design(&cwd2)); },
            async { let _ = tx7.send(probe_secrets()); },
            async { let _ = tx8.send(probe_container()); },
            async { let _ = tx9.send(probe_mcp(&cwd3)); },
        )
    }).await;
}

/// Classify probe results into a capability tier.
pub fn classify_tier(results: &[ProbeResult]) -> CapabilityTier {
    let cloud = results.iter().find(|r| r.label == "cloud");
    let local = results.iter().find(|r| r.label == "local");
    let hw = results.iter().find(|r| r.label == "hardware");

    // Full cloud: any major cloud provider key present
    if let Some(r) = cloud {
        if r.state == ProbeState::Done && (r.summary.contains("anthropic") || r.summary.contains("openai")) {
            return CapabilityTier::FullCloud;
        }
    }

    // Beefy local: Ollama with models + sufficient RAM
    let has_good_local = local
        .is_some_and(|r| r.state == ProbeState::Done && !r.summary.contains("no models"));
    let has_beefy_hw = hw
        .is_some_and(|r| r.state == ProbeState::Done && r.summary.contains("32GB")
            || r.summary.contains("64GB") || r.summary.contains("96GB")
            || r.summary.contains("128GB") || r.summary.contains("192GB"));

    if has_good_local && has_beefy_hw {
        return CapabilityTier::BeefyLocal;
    }

    // Free cloud: OpenRouter key present
    if let Some(r) = cloud {
        if r.state == ProbeState::Done && r.summary.contains("openrouter") {
            return CapabilityTier::FreeCloud;
        }
    }

    // Small local: Ollama running with any model
    if has_good_local {
        return CapabilityTier::SmallLocal;
    }

    CapabilityTier::Offline
}

// ─── Individual probes ──────────────────────────────────────────────────────

fn probe_cloud() -> ProbeResult {
    let mut providers = Vec::new();

    // Check env vars
    if std::env::var("ANTHROPIC_API_KEY").is_ok() {
        providers.push("anthropic");
    }
    if std::env::var("OPENAI_API_KEY").is_ok() {
        providers.push("openai");
    }
    if std::env::var("OPENROUTER_API_KEY").is_ok() {
        providers.push("openrouter");
    }

    // Check stored credentials
    if providers.is_empty() {
        for name in &["anthropic", "openai-codex", "openrouter"] {
            if crate::auth::read_credentials(name)
                .is_some_and(|c| !c.access.is_empty())
            {
                let label = if *name == "openai-codex" { "openai" } else { name };
                if !providers.contains(&label) {
                    providers.push(label);
                }
            }
        }
    }

    if providers.is_empty() {
        ProbeResult { label: "cloud", state: ProbeState::Failed, summary: "none".into() }
    } else {
        ProbeResult { label: "cloud", state: ProbeState::Done, summary: providers.join(", ") }
    }
}

async fn probe_local() -> ProbeResult {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(150))
        .timeout(Duration::from_millis(500))
        .build()
        .unwrap_or_default();

    let mut found = Vec::new();

    // Ollama
    if let Ok(resp) = client.get("http://localhost:11434/api/tags").send().await {
        if let Ok(body) = resp.text().await {
            let count = body.matches("\"name\"").count();
            if count > 0 {
                found.push(format!("ollama: {count}"));
            } else {
                found.push("ollama: no models".into());
            }
        }
    }

    // LM Studio
    if let Ok(resp) = client.get("http://localhost:1234/v1/models").send().await {
        if resp.status().is_success() {
            found.push("lmstudio".into());
        }
    }

    // vLLM / TGI
    if let Ok(resp) = client.get("http://localhost:8080/v1/models").send().await {
        if resp.status().is_success() {
            found.push("vllm".into());
        }
    }

    if found.is_empty() {
        ProbeResult { label: "local", state: ProbeState::Failed, summary: "not found".into() }
    } else {
        ProbeResult { label: "local", state: ProbeState::Done, summary: found.join(", ") }
    }
}

fn probe_hardware() -> ProbeResult {
    let mut parts = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // Detect chip
        if let Ok(out) = std::process::Command::new("sysctl").args(["-n", "machdep.cpu.brand_string"]).output() {
            let brand = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if brand.contains("Apple") {
                // Apple Silicon — get chip name from sysctl
                if let Ok(chip) = std::process::Command::new("sysctl").args(["-n", "machdep.cpu.brand_string"]).output() {
                    let s = String::from_utf8_lossy(&chip.stdout).trim().to_string();
                    // Extract "M2 Pro" from "Apple M2 Pro"
                    let name = s.strip_prefix("Apple ").unwrap_or(&s);
                    parts.push(name.to_string());
                }
            }
        }

        // RAM via sysctl
        if let Ok(out) = std::process::Command::new("sysctl").args(["-n", "hw.memsize"]).output() {
            if let Ok(bytes) = String::from_utf8_lossy(&out.stdout).trim().parse::<u64>() {
                let gb = bytes / (1024 * 1024 * 1024);
                parts.push(format!("{gb}GB"));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // GPU via nvidia-smi
        if let Ok(out) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if out.status.success() {
                let line = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Some((name, vram)) = line.split_once(',') {
                    let vram = vram.trim();
                    parts.push(format!("{}, {vram}MB VRAM", name.trim()));
                }
            }
        }

        // RAM via /proc/meminfo
        if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
            if let Some(line) = content.lines().find(|l| l.starts_with("MemTotal:")) {
                if let Some(kb_str) = line.split_whitespace().nth(1) {
                    if let Ok(kb) = kb_str.parse::<u64>() {
                        let gb = kb / (1024 * 1024);
                        parts.push(format!("{gb}GB"));
                    }
                }
            }
        }
    }

    if parts.is_empty() {
        // Fallback — at least report the architecture
        parts.push(std::env::consts::ARCH.to_string());
    }

    ProbeResult {
        label: "hardware",
        state: ProbeState::Done,
        summary: parts.join(", "),
    }
}

fn probe_memory(cwd: &str) -> ProbeResult {
    // Check for facts.jsonl
    let facts_paths = [
        Path::new(cwd).join(".pi/memory/facts.jsonl"),
        Path::new(cwd).join("ai/memory/facts.jsonl"),
    ];

    for path in &facts_paths {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                let count = content.lines().filter(|l| !l.trim().is_empty() && !l.starts_with('#')).count();
                if count > 0 {
                    return ProbeResult {
                        label: "memory",
                        state: ProbeState::Done,
                        summary: format!("{count} facts"),
                    };
                }
            }
        }
    }

    ProbeResult { label: "memory", state: ProbeState::Done, summary: "empty".into() }
}

fn probe_tools() -> ProbeResult {
    // Count from the static tool registry
    let count = crate::tool_registry::TOOL_COUNT;
    ProbeResult {
        label: "tools",
        state: ProbeState::Done,
        summary: format!("{count} registered"),
    }
}

fn probe_design(cwd: &str) -> ProbeResult {
    let docs_dir = Path::new(cwd).join("docs");
    if !docs_dir.is_dir() {
        return ProbeResult { label: "design", state: ProbeState::Done, summary: "empty".into() };
    }

    let count = std::fs::read_dir(&docs_dir)
        .map(|entries| entries.filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "md"))
            .count())
        .unwrap_or(0);

    ProbeResult {
        label: "design",
        state: ProbeState::Done,
        summary: if count > 0 { format!("{count} nodes") } else { "empty".into() },
    }
}

fn probe_secrets() -> ProbeResult {
    // Check if vault CLI is available
    let vault_available = std::process::Command::new("vault")
        .arg("status")
        .output()
        .is_ok();

    if vault_available {
        ProbeResult { label: "secrets", state: ProbeState::Done, summary: "vault".into() }
    } else {
        ProbeResult { label: "secrets", state: ProbeState::Done, summary: "keyring".into() }
    }
}

fn probe_container() -> ProbeResult {
    // Try podman first, then docker
    for (cmd, name) in &[("podman", "podman"), ("docker", "docker")] {
        if let Ok(out) = std::process::Command::new(cmd).arg("--version").output() {
            if out.status.success() {
                let ver = String::from_utf8_lossy(&out.stdout);
                let version = ver.split_whitespace()
                    .find(|s| s.chars().next().is_some_and(|c| c.is_ascii_digit()))
                    .unwrap_or("unknown");
                return ProbeResult {
                    label: "container",
                    state: ProbeState::Done,
                    summary: format!("{name} {version}"),
                };
            }
        }
    }

    ProbeResult { label: "container", state: ProbeState::Failed, summary: "not found".into() }
}

fn probe_mcp(cwd: &str) -> ProbeResult {
    // Count MCP server configs from plugin manifests
    let plugin_dir = Path::new(cwd).join(".omegon/plugins");
    if !plugin_dir.is_dir() {
        return ProbeResult { label: "mcp", state: ProbeState::Done, summary: "none".into() };
    }

    // Simple: count TOML files that contain [mcp]
    let count = std::fs::read_dir(&plugin_dir)
        .map(|entries| entries.filter_map(|e| e.ok())
            .filter(|e| {
                e.path().extension().is_some_and(|ext| ext == "toml")
                    && std::fs::read_to_string(e.path())
                        .is_ok_and(|c| c.contains("[mcp"))
            })
            .count())
        .unwrap_or(0);

    if count > 0 {
        ProbeResult {
            label: "mcp",
            state: ProbeState::Done,
            summary: format!("{count} server{}", if count == 1 { "" } else { "s" }),
        }
    } else {
        ProbeResult { label: "mcp", state: ProbeState::Done, summary: "none".into() }
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_cloud_checks_env() {
        // This test runs in whatever env CI/dev has — just ensure no panic
        let result = probe_cloud();
        assert_eq!(result.label, "cloud");
        assert!(!result.summary.is_empty());
    }

    #[test]
    fn probe_hardware_doesnt_panic() {
        let result = probe_hardware();
        assert_eq!(result.label, "hardware");
        assert_eq!(result.state, ProbeState::Done);
        assert!(!result.summary.is_empty());
    }

    #[test]
    fn probe_memory_empty_dir() {
        let tmp = tempfile::TempDir::new().unwrap();
        let result = probe_memory(tmp.path().to_str().unwrap());
        assert_eq!(result.label, "memory");
        assert_eq!(result.summary, "empty");
    }

    #[test]
    fn probe_memory_with_facts() {
        let tmp = tempfile::TempDir::new().unwrap();
        let pi_dir = tmp.path().join(".pi/memory");
        std::fs::create_dir_all(&pi_dir).unwrap();
        std::fs::write(pi_dir.join("facts.jsonl"), "{\"id\":\"1\"}\n{\"id\":\"2\"}\n").unwrap();
        let result = probe_memory(tmp.path().to_str().unwrap());
        assert_eq!(result.summary, "2 facts");
    }

    #[test]
    fn probe_design_empty() {
        let tmp = tempfile::TempDir::new().unwrap();
        let result = probe_design(tmp.path().to_str().unwrap());
        assert_eq!(result.summary, "empty");
    }

    #[test]
    fn probe_design_with_nodes() {
        let tmp = tempfile::TempDir::new().unwrap();
        let docs = tmp.path().join("docs");
        std::fs::create_dir_all(&docs).unwrap();
        std::fs::write(docs.join("node-a.md"), "# A").unwrap();
        std::fs::write(docs.join("node-b.md"), "# B").unwrap();
        std::fs::write(docs.join("readme.txt"), "not md").unwrap();
        let result = probe_design(tmp.path().to_str().unwrap());
        assert_eq!(result.summary, "2 nodes");
    }

    #[test]
    fn classify_tier_full_cloud() {
        let results = vec![
            ProbeResult { label: "cloud", state: ProbeState::Done, summary: "anthropic, openai".into() },
            ProbeResult { label: "local", state: ProbeState::Failed, summary: "not found".into() },
            ProbeResult { label: "hardware", state: ProbeState::Done, summary: "M2 Pro, 32GB".into() },
        ];
        assert_eq!(classify_tier(&results), CapabilityTier::FullCloud);
    }

    #[test]
    fn classify_tier_beefy_local() {
        let results = vec![
            ProbeResult { label: "cloud", state: ProbeState::Failed, summary: "none".into() },
            ProbeResult { label: "local", state: ProbeState::Done, summary: "ollama: 7".into() },
            ProbeResult { label: "hardware", state: ProbeState::Done, summary: "M2 Pro, 32GB".into() },
        ];
        assert_eq!(classify_tier(&results), CapabilityTier::BeefyLocal);
    }

    #[test]
    fn classify_tier_free_cloud() {
        let results = vec![
            ProbeResult { label: "cloud", state: ProbeState::Done, summary: "openrouter".into() },
            ProbeResult { label: "local", state: ProbeState::Failed, summary: "not found".into() },
            ProbeResult { label: "hardware", state: ProbeState::Done, summary: "16GB".into() },
        ];
        assert_eq!(classify_tier(&results), CapabilityTier::FreeCloud);
    }

    #[test]
    fn classify_tier_small_local() {
        let results = vec![
            ProbeResult { label: "cloud", state: ProbeState::Failed, summary: "none".into() },
            ProbeResult { label: "local", state: ProbeState::Done, summary: "ollama: 1".into() },
            ProbeResult { label: "hardware", state: ProbeState::Done, summary: "16GB".into() },
        ];
        assert_eq!(classify_tier(&results), CapabilityTier::SmallLocal);
    }

    #[test]
    fn classify_tier_offline() {
        let results = vec![
            ProbeResult { label: "cloud", state: ProbeState::Failed, summary: "none".into() },
            ProbeResult { label: "local", state: ProbeState::Failed, summary: "not found".into() },
            ProbeResult { label: "hardware", state: ProbeState::Done, summary: "8GB".into() },
        ];
        assert_eq!(classify_tier(&results), CapabilityTier::Offline);
    }
}
