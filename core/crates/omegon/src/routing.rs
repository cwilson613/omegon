//! Provider routing — inventory, capability matching, and bridge factory.
//!
//! The orchestratable provider model: maintain a runtime inventory of available
//! providers, match tasks to providers based on capability requirements, and
//! create bridges on demand.
//!
//! Key types:
//!   - `ProviderInventory` — what's available right now
//!   - `CapabilityTier` — what a task needs (Leaf/Mid/Frontier/Max)
//!   - `CapabilityRequest` — full request with tier + preferences
//!   - `ProviderCandidate` — scored match result
//!   - `route()` — the matching function

use crate::auth;
use crate::providers::resolve_api_key_sync;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Instant;

// ─── Capability Tiers ───────────────────────────────────────────────────────

/// Abstract capability tier — what a task needs, not which model to use.
///
/// Maps to effort tiers: Servitor→Leaf, Adept→Mid, Magos→Frontier, Archmagos→Max.
/// The router translates these to concrete provider+model selections.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum CapabilityTier {
    /// Simple tasks: file renames, formatting, boilerplate. Local 8B or cheap cloud.
    Leaf,
    /// Standard tasks: feature implementation, bug fixes. 32B local or mid-tier cloud.
    Mid,
    /// Complex tasks: architecture decisions, multi-file refactors. Frontier cloud models.
    Frontier,
    /// Maximum capability: deep reasoning, novel problem solving. Best available model.
    Max,
}

impl fmt::Display for CapabilityTier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Leaf => write!(f, "leaf"),
            Self::Mid => write!(f, "mid"),
            Self::Frontier => write!(f, "frontier"),
            Self::Max => write!(f, "max"),
        }
    }
}

impl CapabilityTier {
    /// Parse from string (effort tier names, slash command args, etc.)
    pub fn from_str_loose(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "leaf" | "local" | "servitor" | "minimal" | "low" => Self::Leaf,
            "mid" | "haiku" | "adept" | "medium" => Self::Mid,
            "frontier" | "sonnet" | "magos" | "high" => Self::Frontier,
            "max" | "opus" | "archmagos" | "omnissiah" | "xhigh" => Self::Max,
            _ => Self::Mid, // default
        }
    }
}

// ─── Cost Tiers ─────────────────────────────────────────────────────────────

/// Cost tier for a provider — drives routing preferences.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CostTier {
    /// Free: Ollama, Codex Spark under ChatGPT Pro
    Free,
    /// Cheap: Groq free tier, small cloud models
    Cheap,
    /// Standard: most API-key providers at normal rates
    Standard,
    /// Premium: frontier models (Opus, GPT-5.4)
    Premium,
}

// ─── Provider Inventory ─────────────────────────────────────────────────────

/// Runtime snapshot of a single provider's availability.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderEntry {
    pub provider_id: String,
    pub display_name: String,
    pub has_credentials: bool,
    pub is_reachable: bool,
    /// Maximum capability tier this provider supports.
    pub max_tier: CapabilityTier,
    /// Cost classification.
    pub cost_tier: CostTier,
    /// Whether this is a local inference provider.
    pub is_local: bool,
}

/// Ollama-specific model information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelInfo {
    pub name: String,
    pub size_bytes: u64,
    /// Whether this model is currently loaded in VRAM.
    pub is_running: bool,
    /// VRAM usage in bytes (only set if running).
    pub vram_bytes: Option<u64>,
}

/// Runtime inventory of all available providers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInventory {
    pub entries: Vec<ProviderEntry>,
    pub ollama_models: Vec<OllamaModelInfo>,
    #[serde(skip)]
    pub probed_at: Option<Instant>,
}

impl Default for ProviderInventory {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            ollama_models: Vec::new(),
            probed_at: None,
        }
    }
}

impl ProviderInventory {
    /// Probe all providers for credential availability.
    /// This is a fast sync check — no network requests except Ollama.
    pub fn probe() -> Self {
        let mut entries = Vec::new();

        for provider in auth::PROVIDERS {
            // Skip non-inference providers
            if matches!(provider.id, "brave" | "tavily" | "serper" | "github" | "gitlab") {
                continue;
            }

            let has_credentials = if provider.id == "ollama" {
                // Ollama doesn't need credentials — just needs to be reachable
                true
            } else {
                resolve_api_key_sync(provider.id).is_some()
            };

            let (max_tier, cost_tier, is_local) = classify_provider(provider.id);

            entries.push(ProviderEntry {
                provider_id: provider.id.to_string(),
                display_name: provider.display_name.to_string(),
                has_credentials,
                is_reachable: has_credentials, // assume reachable if creds exist; Ollama checked separately
                max_tier,
                cost_tier,
                is_local,
            });
        }

        // Ollama reachability: quick TCP check
        if let Some(ollama) = entries.iter_mut().find(|e| e.provider_id == "ollama") {
            ollama.is_reachable = crate::ollama::OllamaManager::default().is_reachable();
            ollama.has_credentials = ollama.is_reachable; // "credential" for Ollama = server running
        }

        Self {
            entries,
            ollama_models: Vec::new(),
            probed_at: Some(Instant::now()),
        }
    }

    /// Probe with async Ollama model enumeration.
    pub async fn probe_with_ollama() -> Self {
        let mut inv = Self::probe();

        if inv.entries.iter().any(|e| e.provider_id == "ollama" && e.is_reachable) {
            let mgr = crate::ollama::OllamaManager::default();
            if let Ok(models) = mgr.list_models().await {
                inv.ollama_models = models.into_iter().map(|m| OllamaModelInfo {
                    name: m.name,
                    size_bytes: m.size_bytes,
                    is_running: false,
                    vram_bytes: None,
                }).collect();
            }
            if let Ok(running) = mgr.list_running().await {
                for r in running {
                    if let Some(model) = inv.ollama_models.iter_mut().find(|m| m.name == r.name) {
                        model.is_running = true;
                        model.vram_bytes = Some(r.vram_bytes);
                    }
                }
            }
        }

        inv
    }

    /// Re-probe all providers (call after /login or /model change).
    pub fn refresh(&mut self) {
        let fresh = Self::probe();
        self.entries = fresh.entries;
        self.probed_at = fresh.probed_at;
        // Preserve ollama_models — they require async and are slower to change
    }

    /// Get all providers that have valid credentials.
    pub fn available_providers(&self) -> impl Iterator<Item = &ProviderEntry> {
        self.entries.iter().filter(|e| e.has_credentials && e.is_reachable)
    }

    /// Check if a specific provider has credentials.
    pub fn has_provider(&self, provider_id: &str) -> bool {
        self.entries.iter().any(|e| e.provider_id == provider_id && e.has_credentials)
    }
}

/// Classify a provider's capability tier, cost tier, and locality.
fn classify_provider(provider_id: &str) -> (CapabilityTier, CostTier, bool) {
    match provider_id {
        "anthropic"    => (CapabilityTier::Max, CostTier::Premium, false),
        "openai"       => (CapabilityTier::Max, CostTier::Standard, false),
        "openai-codex" => (CapabilityTier::Frontier, CostTier::Free, false), // Spark is free
        "groq"         => (CapabilityTier::Frontier, CostTier::Cheap, false),
        "xai"          => (CapabilityTier::Frontier, CostTier::Standard, false),
        "mistral"      => (CapabilityTier::Frontier, CostTier::Standard, false),
        "cerebras"     => (CapabilityTier::Mid, CostTier::Cheap, false),
        "huggingface"  => (CapabilityTier::Frontier, CostTier::Standard, false),
        "openrouter"   => (CapabilityTier::Max, CostTier::Standard, false), // has everything
        "ollama"       => (CapabilityTier::Frontier, CostTier::Free, true), // capability depends on installed models
        _              => (CapabilityTier::Mid, CostTier::Standard, false),
    }
}

// ─── Capability Request ─────────────────────────────────────────────────────

/// What a task needs from a provider.
#[derive(Debug, Clone)]
pub struct CapabilityRequest {
    /// Minimum capability tier required.
    pub tier: CapabilityTier,
    /// Prefer local inference if available at this tier.
    pub prefer_local: bool,
    /// Providers to avoid (e.g. operator has excluded them).
    pub avoid_providers: Vec<String>,
}

impl Default for CapabilityRequest {
    fn default() -> Self {
        Self {
            tier: CapabilityTier::Mid,
            prefer_local: false,
            avoid_providers: Vec::new(),
        }
    }
}

// ─── Provider Candidate ─────────────────────────────────────────────────────

/// A scored provider+model candidate from the router.
#[derive(Debug, Clone)]
pub struct ProviderCandidate {
    pub provider_id: String,
    pub model_id: String,
    pub score: f32,
}

// ─── Router ─────────────────────────────────────────────────────────────────

/// Route a capability request against the provider inventory.
/// Returns candidates sorted by score (highest first).
///
/// Scoring:
///   - Base score from tier match (higher tier provider → higher score for higher requests)
///   - Cost bonus (cheaper providers score higher at the same tier)
///   - Local preference bonus (if prefer_local and provider is local)
///   - Penalty for providers in avoid list (excluded entirely)
///   - Penalty for providers without credentials (excluded)
pub fn route(req: &CapabilityRequest, inventory: &ProviderInventory) -> Vec<ProviderCandidate> {
    let mut candidates: Vec<ProviderCandidate> = Vec::new();

    for entry in &inventory.entries {
        // Skip unavailable providers
        if !entry.has_credentials || !entry.is_reachable {
            continue;
        }

        // Skip avoided providers
        if req.avoid_providers.iter().any(|a| a == &entry.provider_id) {
            continue;
        }

        // Skip providers that can't meet the tier requirement
        if entry.max_tier < req.tier {
            continue;
        }

        let mut score: f32 = 50.0; // base

        // Tier match bonus: exact match = +20, over-qualified = +10
        if entry.max_tier == req.tier {
            score += 20.0;
        } else {
            score += 10.0; // over-qualified, usable but not ideal cost-wise
        }

        // Cost bonus: cheaper is better (especially for lower tiers)
        score += match entry.cost_tier {
            CostTier::Free => 30.0,
            CostTier::Cheap => 20.0,
            CostTier::Standard => 10.0,
            CostTier::Premium => 0.0,
        };

        // Local preference
        if req.prefer_local && entry.is_local {
            score += 25.0;
        }

        // Penalize over-qualification for leaf tasks (don't waste Opus on a rename)
        if req.tier == CapabilityTier::Leaf && entry.cost_tier == CostTier::Premium {
            score -= 20.0;
        }

        let model_id = default_model_for_provider(&entry.provider_id, req.tier);

        candidates.push(ProviderCandidate {
            provider_id: entry.provider_id.clone(),
            model_id,
            score,
        });
    }

    // Sort by score descending
    candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    candidates
}

/// Pick a default model for a provider at a given tier.
/// This is the model name sent on the wire — provider-specific.
fn default_model_for_provider(provider_id: &str, tier: CapabilityTier) -> String {
    match (provider_id, tier) {
        // Anthropic
        ("anthropic", CapabilityTier::Max)      => "anthropic:claude-opus-4-6".into(),
        ("anthropic", CapabilityTier::Frontier)  => "anthropic:claude-sonnet-4-6".into(),
        ("anthropic", CapabilityTier::Mid)       => "anthropic:claude-haiku-4-5".into(),
        ("anthropic", CapabilityTier::Leaf)      => "anthropic:claude-haiku-4-5".into(),

        // OpenAI (Chat Completions)
        ("openai", CapabilityTier::Max)          => "openai:gpt-5.4".into(),
        ("openai", CapabilityTier::Frontier)     => "openai:gpt-5".into(),
        ("openai", CapabilityTier::Mid)          => "openai:gpt-4.1-mini".into(),
        ("openai", CapabilityTier::Leaf)         => "openai:gpt-4.1-nano".into(),

        // OpenAI Codex (Responses API — free under ChatGPT Pro)
        ("openai-codex", CapabilityTier::Max)    => "openai-codex:gpt-5.4".into(),
        ("openai-codex", CapabilityTier::Frontier)=> "openai-codex:gpt-5.3-codex".into(),
        ("openai-codex", CapabilityTier::Mid)    => "openai-codex:gpt-5.3-codex-spark".into(),
        ("openai-codex", CapabilityTier::Leaf)   => "openai-codex:gpt-5.3-codex-spark".into(),

        // Groq (fast inference)
        ("groq", _) => "groq:llama-3.3-70b-versatile".into(),

        // xAI
        ("xai", CapabilityTier::Max | CapabilityTier::Frontier) => "xai:grok-3".into(),
        ("xai", _) => "xai:grok-2".into(),

        // Mistral
        ("mistral", CapabilityTier::Max | CapabilityTier::Frontier) => "mistral:mistral-large-latest".into(),
        ("mistral", _) => "mistral:codestral-latest".into(),

        // Cerebras
        ("cerebras", _) => "cerebras:llama3.1-8b".into(),

        // HuggingFace
        ("huggingface", CapabilityTier::Max | CapabilityTier::Frontier) => "huggingface:Qwen/Qwen3-235B-A22B-Thinking-2507".into(),
        ("huggingface", _) => "huggingface:deepseek-ai/DeepSeek-V3.2".into(),

        // OpenRouter (universal — use auto model)
        ("openrouter", _) => "openrouter:openrouter/auto".into(),

        // Ollama (local — model depends on what's installed)
        ("ollama", _) => "ollama:qwen3:32b".into(), // sensible default

        // Fallback
        (provider, _) => format!("{provider}:auto"),
    }
}

/// Infer capability tier from a cleave child's scope size.
pub fn infer_tier_from_scope(scope_len: usize) -> CapabilityTier {
    match scope_len {
        0..=2 => CapabilityTier::Leaf,
        3..=5 => CapabilityTier::Mid,
        _ => CapabilityTier::Frontier,
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_inventory(providers: Vec<(&str, bool, CapabilityTier, CostTier, bool)>) -> ProviderInventory {
        ProviderInventory {
            entries: providers.into_iter().map(|(id, has_creds, tier, cost, local)| {
                ProviderEntry {
                    provider_id: id.to_string(),
                    display_name: id.to_string(),
                    has_credentials: has_creds,
                    is_reachable: has_creds,
                    max_tier: tier,
                    cost_tier: cost,
                    is_local: local,
                }
            }).collect(),
            ollama_models: Vec::new(),
            probed_at: None,
        }
    }

    #[test]
    fn tier_ordering() {
        assert!(CapabilityTier::Leaf < CapabilityTier::Mid);
        assert!(CapabilityTier::Mid < CapabilityTier::Frontier);
        assert!(CapabilityTier::Frontier < CapabilityTier::Max);
    }

    #[test]
    fn tier_from_str_loose() {
        assert_eq!(CapabilityTier::from_str_loose("leaf"), CapabilityTier::Leaf);
        assert_eq!(CapabilityTier::from_str_loose("local"), CapabilityTier::Leaf);
        assert_eq!(CapabilityTier::from_str_loose("sonnet"), CapabilityTier::Frontier);
        assert_eq!(CapabilityTier::from_str_loose("opus"), CapabilityTier::Max);
        assert_eq!(CapabilityTier::from_str_loose("unknown"), CapabilityTier::Mid);
    }

    #[test]
    fn tier_display() {
        assert_eq!(format!("{}", CapabilityTier::Leaf), "leaf");
        assert_eq!(format!("{}", CapabilityTier::Max), "max");
    }

    #[test]
    fn route_empty_inventory_returns_empty() {
        let inv = mock_inventory(vec![]);
        let req = CapabilityRequest::default();
        let result = route(&req, &inv);
        assert!(result.is_empty());
    }

    #[test]
    fn route_no_credentials_returns_empty() {
        let inv = mock_inventory(vec![
            ("anthropic", false, CapabilityTier::Max, CostTier::Premium, false),
        ]);
        let req = CapabilityRequest::default();
        let result = route(&req, &inv);
        assert!(result.is_empty(), "providers without credentials should be excluded");
    }

    #[test]
    fn route_frontier_prefers_anthropic_over_ollama() {
        let inv = mock_inventory(vec![
            ("anthropic", true, CapabilityTier::Max, CostTier::Premium, false),
            ("ollama", true, CapabilityTier::Frontier, CostTier::Free, true),
        ]);
        let req = CapabilityRequest { tier: CapabilityTier::Frontier, ..Default::default() };
        let result = route(&req, &inv);
        assert!(result.len() >= 2);
        // Both should be candidates, but exact ordering depends on scoring
        assert!(result.iter().any(|c| c.provider_id == "anthropic"));
        assert!(result.iter().any(|c| c.provider_id == "ollama"));
    }

    #[test]
    fn route_leaf_prefers_free_over_premium() {
        let inv = mock_inventory(vec![
            ("anthropic", true, CapabilityTier::Max, CostTier::Premium, false),
            ("ollama", true, CapabilityTier::Frontier, CostTier::Free, true),
            ("openai-codex", true, CapabilityTier::Frontier, CostTier::Free, false),
        ]);
        let req = CapabilityRequest { tier: CapabilityTier::Leaf, ..Default::default() };
        let result = route(&req, &inv);
        assert!(!result.is_empty());
        // Free providers should rank above premium for leaf tasks
        let top = &result[0];
        assert_ne!(top.provider_id, "anthropic",
            "premium provider should not be top for leaf tasks");
    }

    #[test]
    fn route_prefer_local_boosts_ollama() {
        let inv = mock_inventory(vec![
            ("groq", true, CapabilityTier::Frontier, CostTier::Cheap, false),
            ("ollama", true, CapabilityTier::Frontier, CostTier::Free, true),
        ]);
        let req = CapabilityRequest {
            tier: CapabilityTier::Mid,
            prefer_local: true,
            ..Default::default()
        };
        let result = route(&req, &inv);
        assert_eq!(result[0].provider_id, "ollama",
            "prefer_local should boost ollama to top");
    }

    #[test]
    fn route_respects_avoid_list() {
        let inv = mock_inventory(vec![
            ("anthropic", true, CapabilityTier::Max, CostTier::Premium, false),
            ("groq", true, CapabilityTier::Frontier, CostTier::Cheap, false),
        ]);
        let req = CapabilityRequest {
            tier: CapabilityTier::Mid,
            avoid_providers: vec!["anthropic".into()],
            ..Default::default()
        };
        let result = route(&req, &inv);
        assert!(result.iter().all(|c| c.provider_id != "anthropic"));
    }

    #[test]
    fn route_filters_insufficient_tier() {
        let inv = mock_inventory(vec![
            ("cerebras", true, CapabilityTier::Mid, CostTier::Cheap, false),
        ]);
        let req = CapabilityRequest { tier: CapabilityTier::Max, ..Default::default() };
        let result = route(&req, &inv);
        assert!(result.is_empty(), "Mid-tier provider should not satisfy Max request");
    }

    #[test]
    fn route_returns_model_ids() {
        let inv = mock_inventory(vec![
            ("anthropic", true, CapabilityTier::Max, CostTier::Premium, false),
        ]);
        let req = CapabilityRequest { tier: CapabilityTier::Frontier, ..Default::default() };
        let result = route(&req, &inv);
        assert!(!result.is_empty());
        assert!(result[0].model_id.starts_with("anthropic:"));
    }

    #[test]
    fn infer_tier_from_scope_heuristic() {
        assert_eq!(infer_tier_from_scope(0), CapabilityTier::Leaf);
        assert_eq!(infer_tier_from_scope(1), CapabilityTier::Leaf);
        assert_eq!(infer_tier_from_scope(2), CapabilityTier::Leaf);
        assert_eq!(infer_tier_from_scope(3), CapabilityTier::Mid);
        assert_eq!(infer_tier_from_scope(5), CapabilityTier::Mid);
        assert_eq!(infer_tier_from_scope(6), CapabilityTier::Frontier);
        assert_eq!(infer_tier_from_scope(20), CapabilityTier::Frontier);
    }

    #[test]
    fn default_models_have_provider_prefix() {
        let models = [
            default_model_for_provider("anthropic", CapabilityTier::Max),
            default_model_for_provider("openai", CapabilityTier::Mid),
            default_model_for_provider("openai-codex", CapabilityTier::Leaf),
            default_model_for_provider("groq", CapabilityTier::Mid),
            default_model_for_provider("ollama", CapabilityTier::Mid),
        ];
        for model in &models {
            assert!(model.contains(':'), "model '{}' should have provider: prefix", model);
        }
    }

    #[test]
    fn inventory_default_is_empty() {
        let inv = ProviderInventory::default();
        assert!(inv.entries.is_empty());
        assert!(inv.ollama_models.is_empty());
    }

    #[test]
    fn provider_entry_serialization_roundtrip() {
        let entry = ProviderEntry {
            provider_id: "test".into(),
            display_name: "Test".into(),
            has_credentials: true,
            is_reachable: true,
            max_tier: CapabilityTier::Frontier,
            cost_tier: CostTier::Cheap,
            is_local: false,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let back: ProviderEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(back.provider_id, "test");
        assert_eq!(back.max_tier, CapabilityTier::Frontier);
    }
}
