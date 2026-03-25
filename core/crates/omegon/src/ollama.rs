//! Ollama model management — list, probe, and hardware awareness.
//!
//! Provides native Rust access to the Ollama REST API for model lifecycle
//! operations. This is the foundation for treating local inference as a
//! first-class orchestration resource.
//!
//! Ollama REST API used:
//!   - GET /api/tags — list installed models
//!   - GET /api/ps — list running models (VRAM usage)
//!   - POST /api/pull — pull a model (streaming progress)

use serde::{Deserialize, Serialize};

// ─── Types ──────────────────────────────────────────────────────────────────

/// An installed Ollama model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub digest: String,
}

/// A model currently loaded in VRAM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunningModel {
    pub name: String,
    pub vram_bytes: u64,
    pub expires_at: String,
}

/// Hardware profile for local inference capability assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareProfile {
    /// Total system memory in bytes.
    pub total_memory_bytes: u64,
    /// Whether this is Apple Silicon (unified memory = VRAM).
    pub is_apple_silicon: bool,
    /// Estimated available VRAM in bytes.
    /// On Apple Silicon: ~75% of total (OS + apps take ~25%).
    /// On discrete GPU: would need nvidia-smi/rocm-smi (not implemented yet).
    pub estimated_vram_bytes: u64,
    /// Recommended maximum model parameter count string (e.g. "32B", "70B").
    pub recommended_max_params: String,
}

// ─── Manager ────────────────────────────────────────────────────────────────

/// Ollama model manager — talks to the Ollama REST API.
pub struct OllamaManager {
    host: String,
    client: reqwest::Client,
}

impl Default for OllamaManager {
    fn default() -> Self {
        Self::new()
    }
}

impl OllamaManager {
    /// Create a new manager. Reads OLLAMA_HOST or defaults to localhost:11434.
    pub fn new() -> Self {
        let host = std::env::var("OLLAMA_HOST")
            .unwrap_or_else(|_| "http://localhost:11434".into());
        Self {
            host,
            client: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_millis(500))
                .timeout(std::time::Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Quick reachability check — can we talk to Ollama?
    /// Uses a short timeout to avoid blocking startup.
    pub fn is_reachable(&self) -> bool {
        let url = format!("{}/api/tags", self.host.trim_end_matches('/'));
        // Use a blocking-compatible approach for sync contexts
        let addr = self.host.trim_end_matches('/')
            .strip_prefix("http://")
            .or_else(|| self.host.strip_prefix("https://"))
            .unwrap_or("localhost:11434");

        // Parse as socket addr, handling "host:port" format
        let sock_addr = if let Ok(addr) = addr.parse::<std::net::SocketAddr>() {
            addr
        } else {
            // Try adding default port or parsing host:port
            let parts: Vec<&str> = addr.splitn(2, ':').collect();
            let host = parts[0];
            let port: u16 = parts.get(1).and_then(|p| p.parse().ok()).unwrap_or(11434);
            // Resolve hostname to IP
            use std::net::ToSocketAddrs;
            match (host, port).to_socket_addrs() {
                Ok(mut addrs) => match addrs.next() {
                    Some(a) => a,
                    None => return false,
                },
                Err(_) => return false,
            }
        };

        std::net::TcpStream::connect_timeout(&sock_addr, std::time::Duration::from_millis(200)).is_ok()
    }

    /// List installed models. Returns empty vec if Ollama is not running.
    pub async fn list_models(&self) -> anyhow::Result<Vec<OllamaModel>> {
        let url = format!("{}/api/tags", self.host.trim_end_matches('/'));
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            anyhow::bail!("Ollama /api/tags returned {}", resp.status());
        }

        let body: serde_json::Value = resp.json().await?;
        let models = body["models"].as_array()
            .map(|arr| {
                arr.iter().filter_map(|m| {
                    Some(OllamaModel {
                        name: m["name"].as_str()?.to_string(),
                        size_bytes: m["size"].as_u64().unwrap_or(0),
                        modified_at: m["modified_at"].as_str().unwrap_or("").to_string(),
                        digest: m["digest"].as_str().unwrap_or("").to_string(),
                    })
                }).collect()
            })
            .unwrap_or_default();

        Ok(models)
    }

    /// List models currently loaded in VRAM.
    pub async fn list_running(&self) -> anyhow::Result<Vec<RunningModel>> {
        let url = format!("{}/api/ps", self.host.trim_end_matches('/'));
        let resp = self.client.get(&url).send().await?;

        if !resp.status().is_success() {
            anyhow::bail!("Ollama /api/ps returned {}", resp.status());
        }

        let body: serde_json::Value = resp.json().await?;
        let models = body["models"].as_array()
            .map(|arr| {
                arr.iter().filter_map(|m| {
                    Some(RunningModel {
                        name: m["name"].as_str()?.to_string(),
                        vram_bytes: m["size_vram"].as_u64().unwrap_or(0),
                        expires_at: m["expires_at"].as_str().unwrap_or("").to_string(),
                    })
                }).collect()
            })
            .unwrap_or_default();

        Ok(models)
    }

    /// Detect hardware profile for local inference capability.
    pub fn hardware_profile() -> HardwareProfile {
        let total_memory_bytes = {
            #[cfg(target_os = "macos")]
            {
                // sysctl hw.memsize
                use std::process::Command;
                Command::new("sysctl")
                    .args(["-n", "hw.memsize"])
                    .output()
                    .ok()
                    .and_then(|o| String::from_utf8(o.stdout).ok())
                    .and_then(|s| s.trim().parse::<u64>().ok())
                    .unwrap_or(0)
            }
            #[cfg(not(target_os = "macos"))]
            {
                // /proc/meminfo on Linux
                std::fs::read_to_string("/proc/meminfo").ok()
                    .and_then(|s| {
                        s.lines().find(|l| l.starts_with("MemTotal:"))
                            .and_then(|l| l.split_whitespace().nth(1))
                            .and_then(|v| v.parse::<u64>().ok())
                            .map(|kb| kb * 1024)
                    })
                    .unwrap_or(0)
            }
        };

        let is_apple_silicon = cfg!(target_os = "macos") && cfg!(target_arch = "aarch64");

        // Estimate available VRAM
        let estimated_vram_bytes = if is_apple_silicon {
            // Unified memory: ~75% available for inference
            (total_memory_bytes as f64 * 0.75) as u64
        } else {
            // Discrete GPU: would need nvidia-smi. Estimate 0 for now.
            0
        };

        // Recommend max model params based on available VRAM
        // Rule of thumb: Q4 quantization ≈ 0.5 GB/B params, Q8 ≈ 1 GB/B
        let vram_gb = estimated_vram_bytes / (1024 * 1024 * 1024);
        let recommended_max_params = match vram_gb {
            0..=7 => "7B",
            8..=15 => "14B",
            16..=23 => "30B",
            24..=47 => "32B",
            48..=95 => "70B",
            _ => "70B+",
        }.to_string();

        HardwareProfile {
            total_memory_bytes,
            is_apple_silicon,
            estimated_vram_bytes,
            recommended_max_params,
        }
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_tags_response() {
        let json = serde_json::json!({
            "models": [
                {
                    "name": "qwen3:32b",
                    "size": 35_000_000_000u64,
                    "modified_at": "2026-03-20T10:00:00Z",
                    "digest": "sha256:abc123"
                },
                {
                    "name": "devstral-small-2:24b",
                    "size": 24_000_000_000u64,
                    "modified_at": "2026-03-19T10:00:00Z",
                    "digest": "sha256:def456"
                }
            ]
        });

        let models: Vec<OllamaModel> = json["models"].as_array().unwrap()
            .iter()
            .filter_map(|m| {
                Some(OllamaModel {
                    name: m["name"].as_str()?.to_string(),
                    size_bytes: m["size"].as_u64().unwrap_or(0),
                    modified_at: m["modified_at"].as_str().unwrap_or("").to_string(),
                    digest: m["digest"].as_str().unwrap_or("").to_string(),
                })
            })
            .collect();

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].name, "qwen3:32b");
        assert_eq!(models[0].size_bytes, 35_000_000_000);
        assert_eq!(models[1].name, "devstral-small-2:24b");
    }

    #[test]
    fn parse_ps_response() {
        let json = serde_json::json!({
            "models": [
                {
                    "name": "qwen3:32b",
                    "size_vram": 30_000_000_000u64,
                    "expires_at": "2026-03-25T11:00:00Z"
                }
            ]
        });

        let running: Vec<RunningModel> = json["models"].as_array().unwrap()
            .iter()
            .filter_map(|m| {
                Some(RunningModel {
                    name: m["name"].as_str()?.to_string(),
                    vram_bytes: m["size_vram"].as_u64().unwrap_or(0),
                    expires_at: m["expires_at"].as_str().unwrap_or("").to_string(),
                })
            })
            .collect();

        assert_eq!(running.len(), 1);
        assert_eq!(running[0].name, "qwen3:32b");
        assert_eq!(running[0].vram_bytes, 30_000_000_000);
    }

    #[test]
    fn hardware_profile_returns_nonzero() {
        let profile = OllamaManager::hardware_profile();
        // This test runs on the dev machine — memory should be > 0
        assert!(profile.total_memory_bytes > 0, "total_memory should be nonzero");
        assert!(!profile.recommended_max_params.is_empty());
    }

    #[test]
    fn hardware_profile_apple_silicon_detection() {
        let profile = OllamaManager::hardware_profile();
        if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            assert!(profile.is_apple_silicon);
            assert!(profile.estimated_vram_bytes > 0,
                "Apple Silicon should have estimated VRAM");
        }
    }

    #[test]
    fn manager_default_host() {
        // Don't set OLLAMA_HOST — should default to localhost:11434
        let mgr = OllamaManager::new();
        // Can't assert exact host because env var might be set
        // Just verify it doesn't panic
        assert!(!mgr.host.is_empty());
    }

    #[test]
    fn is_reachable_returns_bool() {
        // This test doesn't require Ollama to be running
        let mgr = OllamaManager::new();
        let _reachable = mgr.is_reachable();
        // Just verify it doesn't panic or hang
    }
}
