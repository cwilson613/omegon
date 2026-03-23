//! Bridge types for converting between opsx-core and external type systems.
//!
//! opsx-core defines its own enums (NodeState, ChangeState) to avoid coupling
//! to any specific consumer. This module provides conversion utilities.

use crate::types::NodeState;

impl NodeState {
    /// Convert from a status string (the common interchange format).
    /// This is the bridge point — callers pass status strings from whatever
    /// type system they use, and opsx-core converts internally.
    ///
    /// Returns None for unknown strings.
    pub fn from_status_str(s: &str) -> Option<Self> {
        Self::parse(s)
    }
}
