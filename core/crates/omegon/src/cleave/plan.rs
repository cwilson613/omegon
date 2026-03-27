//! Cleave plan — the input specification for a cleave run.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A cleave plan describes children to dispatch and their dependencies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleavePlan {
    pub children: Vec<ChildPlan>,
    #[serde(default)]
    pub rationale: String,
}

/// A single child in the plan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChildPlan {
    pub label: String,
    pub description: String,
    pub scope: Vec<String>,
    #[serde(default)]
    pub depends_on: Vec<String>,
}

impl CleavePlan {
    /// Parse a plan from JSON.
    pub fn from_json(json: &str) -> anyhow::Result<Self> {
        let mut raw: Value = serde_json::from_str(json)?;
        normalize_depends_on(&mut raw)?;
        let plan: CleavePlan = serde_json::from_value(raw)?;
        if plan.children.is_empty() {
            anyhow::bail!("Cleave plan must have at least 1 child");
        }
        // Validate dependency references
        let labels: Vec<&str> = plan.children.iter().map(|c| c.label.as_str()).collect();
        for child in &plan.children {
            for dep in &child.depends_on {
                if !labels.contains(&dep.as_str()) {
                    anyhow::bail!(
                        "Child '{}' depends on '{}' which is not in the plan",
                        child.label,
                        dep
                    );
                }
            }
        }
        Ok(plan)
    }
}

fn normalize_depends_on(raw: &mut Value) -> anyhow::Result<()> {
    let children = raw
        .get_mut("children")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| anyhow::anyhow!("Cleave plan must contain a children array"))?;

    let labels: Vec<String> = children
        .iter()
        .enumerate()
        .map(|(idx, child)| {
            child.get("label")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .ok_or_else(|| anyhow::anyhow!("Child at index {idx} is missing a string label"))
        })
        .collect::<Result<_, _>>()?;

    for (child_idx, child) in children.iter_mut().enumerate() {
        let Some(obj) = child.as_object_mut() else {
            anyhow::bail!("Child at index {child_idx} must be an object");
        };

        let Some(depends_on) = obj.get_mut("depends_on") else {
            continue;
        };

        let Some(deps) = depends_on.as_array_mut() else {
            anyhow::bail!("Child at index {child_idx} has non-array depends_on");
        };

        let mut normalized = Vec::with_capacity(deps.len());
        for dep in deps.iter() {
            match dep {
                Value::String(label) => normalized.push(Value::String(label.clone())),
                Value::Number(n) => {
                    let idx = n.as_u64().ok_or_else(|| {
                        anyhow::anyhow!(
                            "Child at index {child_idx} has non-integer numeric dependency {n}"
                        )
                    })? as usize;
                    let label = labels.get(idx).ok_or_else(|| {
                        anyhow::anyhow!(
                            "Child at index {child_idx} depends on child index {idx}, but only {} children exist",
                            labels.len()
                        )
                    })?;
                    normalized.push(Value::String(label.clone()));
                }
                other => {
                    anyhow::bail!(
                        "Child at index {child_idx} has invalid dependency type: {other}"
                    );
                }
            }
        }
        *deps = normalized;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_plan() {
        let json = r#"{
            "children": [
                {"label": "a", "description": "do A", "scope": ["a.rs"], "depends_on": []},
                {"label": "b", "description": "do B", "scope": ["b.rs"], "depends_on": ["a"]}
            ],
            "rationale": "test"
        }"#;
        let plan = CleavePlan::from_json(json).unwrap();
        assert_eq!(plan.children.len(), 2);
        assert_eq!(plan.children[1].depends_on, vec!["a"]);
    }

    #[test]
    fn parse_numeric_dependency_indexes() {
        let json = r#"{
            "children": [
                {"label": "a", "description": "do A", "scope": ["a.rs"], "depends_on": []},
                {"label": "b", "description": "do B", "scope": ["b.rs"], "depends_on": [0]}
            ]
        }"#;
        let plan = CleavePlan::from_json(json).unwrap();
        assert_eq!(plan.children[1].depends_on, vec!["a"]);
    }

    #[test]
    fn reject_out_of_range_numeric_dependency() {
        let json = r#"{
            "children": [
                {"label": "a", "description": "do A", "scope": ["a.rs"]},
                {"label": "b", "description": "do B", "scope": ["b.rs"], "depends_on": [9]}
            ]
        }"#;
        assert!(CleavePlan::from_json(json).is_err());
    }

    #[test]
    fn parse_plan_without_rationale() {
        let json = r#"{
            "children": [
                {"label": "a", "description": "do A", "scope": ["a.rs"]},
                {"label": "b", "description": "do B", "scope": ["b.rs"]}
            ]
        }"#;
        let plan = CleavePlan::from_json(json).unwrap();
        assert_eq!(plan.children.len(), 2);
        assert_eq!(plan.rationale, "");
    }

    #[test]
    fn accept_single_child() {
        let json = r#"{
            "children": [{"label": "a", "description": "do A", "scope": ["a.rs"]}],
            "rationale": "test"
        }"#;
        let plan = CleavePlan::from_json(json).unwrap();
        assert_eq!(plan.children.len(), 1);
    }

    #[test]
    fn reject_bad_dependency() {
        let json = r#"{
            "children": [
                {"label": "a", "description": "do A", "scope": ["a.rs"]},
                {"label": "b", "description": "do B", "scope": ["b.rs"], "depends_on": ["nonexistent"]}
            ],
            "rationale": "test"
        }"#;
        assert!(CleavePlan::from_json(json).is_err());
    }
}
