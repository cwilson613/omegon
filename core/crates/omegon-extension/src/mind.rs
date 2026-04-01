//! Extension mind types — optional persistent knowledge system.
//!
//! Extensions can declare a persistent mind in their manifest:
//!
//! ```toml
//! [mind]
//! enabled = true
//! description = "Engagement tracking knowledge"
//! ```
//!
//! Then implement mind RPC methods:
//!
//! ```ignore
//! async fn handle_rpc(&self, method: &str, params: Value) -> Result<Value> {
//!     match method {
//!         "get_mind" => {
//!             let query = params["query"].as_str().unwrap_or("");
//!             let facts = self.mind.search(query).await?;
//!             Ok(json!({"facts": facts, "total_facts": self.mind.len()}))
//!         }
//!         "load_mind" => {
//!             self.mind.load_from_disk().await?;
//!             Ok(json!({"loaded": true}))
//!         }
//!         "store_mind" => {
//!             self.mind.save_to_disk().await?;
//!             Ok(json!({"stored": true}))
//!         }
//!         _ => Err(Error::method_not_found(method)),
//!     }
//! }
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single fact in an extension mind.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fact {
    /// Unique identifier (extension-scoped): "ext-scribe-001"
    pub id: String,

    /// Knowledge category: Architecture, Patterns, Decisions, Specs, Constraints, Known Issues
    pub section: String,

    /// Human-readable fact text
    pub content: String,

    /// Tags for discovery and organization
    #[serde(default)]
    pub tags: Vec<String>,

    /// Confidence score (0.0-1.0)
    #[serde(default = "default_confidence")]
    pub confidence: f32,

    /// Number of times fact was accessed/verified (reinforcement)
    #[serde(default)]
    pub reinforced: u32,

    /// RFC 3339 timestamp when fact was created
    pub created_at: String,

    /// RFC 3339 timestamp when fact was last accessed
    pub last_accessed: String,
}

fn default_confidence() -> f32 {
    0.9
}

impl Fact {
    /// Create a new fact.
    pub fn new(
        id: String,
        section: String,
        content: String,
        tags: Vec<String>,
        confidence: f32,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id,
            section,
            content,
            tags,
            confidence: confidence.clamp(0.0, 1.0),
            reinforced: 0,
            created_at: now.clone(),
            last_accessed: now,
        }
    }

    /// Increment reinforcement (fact was useful/verified).
    pub fn reinforce(&mut self) {
        self.reinforced = self.reinforced.saturating_add(1);
        self.last_accessed = chrono::Utc::now().to_rfc3339();
    }

    /// Update last_accessed timestamp.
    pub fn touch(&mut self) {
        self.last_accessed = chrono::Utc::now().to_rfc3339();
    }
}

/// An episode — a grouping of facts by context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    /// Unique identifier (extension-scoped): "ext-scribe-ep-001"
    pub id: String,

    /// Human-readable title
    pub title: String,

    /// Optional longer description
    #[serde(default)]
    pub description: String,

    /// RFC 3339 timestamp when episode was created
    pub created_at: String,

    /// IDs of facts in this episode
    #[serde(default)]
    pub facts: Vec<String>,

    /// Optional context (project name, branch, session ID, etc.)
    #[serde(default)]
    pub context: HashMap<String, String>,
}

impl Episode {
    /// Create a new episode.
    pub fn new(id: String, title: String) -> Self {
        Self {
            id,
            title,
            description: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
            facts: vec![],
            context: HashMap::new(),
        }
    }
}

/// Response from `get_mind()` RPC method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetMindResponse {
    /// Facts matching the query
    pub facts: Vec<Fact>,

    /// Episodes in the mind
    #[serde(default)]
    pub episodes: Vec<Episode>,

    /// Total fact count in mind (not just matched)
    pub total_facts: usize,

    /// Number of facts matched by query
    pub matched: usize,
}

/// Response from `load_mind()` RPC method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadMindResponse {
    /// Whether mind was successfully loaded
    pub loaded: bool,

    /// Number of facts loaded
    pub facts_loaded: usize,

    /// Number of episodes loaded
    #[serde(default)]
    pub episodes_loaded: usize,

    /// Checkpoint path
    #[serde(default)]
    pub checkpoint_path: String,

    /// ISO 8601 timestamp of last checkpoint
    #[serde(default)]
    pub last_checkpoint: String,
}

/// Response from `store_mind()` RPC method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreMindResponse {
    /// Whether mind was successfully stored
    pub stored: bool,

    /// Number of facts stored
    pub facts_count: usize,

    /// Bytes written to disk
    #[serde(default)]
    pub bytes_written: u64,

    /// Checkpoint path
    #[serde(default)]
    pub checkpoint_path: String,

    /// ISO 8601 timestamp of checkpoint
    #[serde(default)]
    pub timestamp: String,
}

/// Response from `add_fact()` RPC method.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddFactResponse {
    /// ID of the new fact
    pub id: String,

    /// Whether fact was stored
    pub stored: bool,

    /// Total facts now in mind
    pub total_facts: usize,
}

/// Response from fact update/delete operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactOpResponse {
    /// ID of the fact
    pub id: String,

    /// Whether operation succeeded
    pub success: bool,

    /// Total facts now in mind
    pub total_facts: usize,
}

/// Mind metadata (stored in metadata.json).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MindMetadata {
    /// Extension name
    pub extension: String,

    /// Extension version
    pub extension_version: String,

    /// SDK version
    pub sdk_version: String,

    /// Mind format version (for future migrations)
    #[serde(default = "default_mind_version")]
    pub mind_version: u16,

    /// ISO 8601 timestamp when mind was created
    pub created_at: String,

    /// ISO 8601 timestamp of last update
    pub last_updated: String,

    /// Total facts in mind
    pub total_facts: usize,

    /// Total episodes in mind
    #[serde(default)]
    pub total_episodes: usize,

    /// Bytes on disk
    #[serde(default)]
    pub bytes_on_disk: u64,

    /// ISO 8601 timestamp of last checkpoint
    #[serde(default)]
    pub last_checkpoint: String,
}

fn default_mind_version() -> u16 {
    1
}

impl MindMetadata {
    /// Create new metadata.
    pub fn new(extension: String, extension_version: String, sdk_version: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            extension,
            extension_version,
            sdk_version,
            mind_version: 1,
            created_at: now.clone(),
            last_updated: now.clone(),
            total_facts: 0,
            total_episodes: 0,
            bytes_on_disk: 0,
            last_checkpoint: now,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fact_creation() {
        let fact = Fact::new(
            "test-001".to_string(),
            "Architecture".to_string(),
            "Team uses async/await".to_string(),
            vec!["patterns".to_string()],
            0.95,
        );

        assert_eq!(fact.id, "test-001");
        assert_eq!(fact.section, "Architecture");
        assert_eq!(fact.reinforced, 0);
        assert_eq!(fact.confidence, 0.95);
    }

    #[test]
    fn test_fact_reinforce() {
        let mut fact = Fact::new(
            "test-001".to_string(),
            "Architecture".to_string(),
            "Team uses async/await".to_string(),
            vec![],
            0.95,
        );

        fact.reinforce();
        assert_eq!(fact.reinforced, 1);

        fact.reinforce();
        assert_eq!(fact.reinforced, 2);
    }

    #[test]
    fn test_confidence_clamped() {
        let fact = Fact::new(
            "test-001".to_string(),
            "Test".to_string(),
            "Test".to_string(),
            vec![],
            1.5, // Should be clamped to 1.0
        );

        assert_eq!(fact.confidence, 1.0);
    }

    #[test]
    fn test_episode_creation() {
        let episode = Episode::new(
            "ep-001".to_string(),
            "Architecture Review".to_string(),
        );

        assert_eq!(episode.id, "ep-001");
        assert_eq!(episode.title, "Architecture Review");
        assert!(episode.facts.is_empty());
    }
}
