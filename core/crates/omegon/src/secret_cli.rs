//! Operator-facing secret management CLI.
//!
//! ## Set a secret (stored in keyring)
//!
//! ```sh
//! omegon secret set GITHUB_TOKEN ghp_abc123
//! omegon secret set VOX_DISCORD_BOT_TOKEN --recipe "env:DISCORD_TOKEN"
//! ```
//!
//! ## List configured secrets
//!
//! ```sh
//! omegon secret list
//! ```
//!
//! ## Delete a secret
//!
//! ```sh
//! omegon secret delete GITHUB_TOKEN
//! ```

use std::path::PathBuf;

/// Set a secret — either a raw value (stored in keyring) or a recipe.
pub fn set(name: &str, value: Option<&str>, recipe: Option<&str>) -> anyhow::Result<()> {
    let secrets = create_manager()?;

    match (value, recipe) {
        (Some(_), Some(_)) => {
            anyhow::bail!("provide either a value or --recipe, not both");
        }
        (None, None) => {
            anyhow::bail!("provide a secret value or --recipe");
        }
        (Some(val), None) => {
            secrets.set_keyring_secret(name, val)?;
            println!("Stored '{name}' in keyring.");
        }
        (None, Some(recipe)) => {
            secrets.set_recipe(name, recipe)?;
            println!("Stored recipe for '{name}': {recipe}");
        }
    }

    Ok(())
}

/// List all configured secret names and their recipes (values are never shown).
pub fn list() -> anyhow::Result<()> {
    let secrets = create_manager()?;
    let entries = secrets.list_recipes();

    if entries.is_empty() {
        println!("No secrets configured.");
        println!("  Set one with: omegon secret set <NAME> <VALUE>");
        return Ok(());
    }

    println!("{:<30} RECIPE", "NAME");
    println!("{}", "─".repeat(60));
    for (name, recipe) in &entries {
        println!("{:<30} {recipe}", name);
    }

    Ok(())
}

/// Delete a secret recipe (and attempt keyring cleanup).
pub fn delete(name: &str) -> anyhow::Result<()> {
    let secrets = create_manager()?;
    secrets.delete_recipe(name)?;
    println!("Deleted secret '{name}'.");
    Ok(())
}

fn config_dir() -> anyhow::Result<PathBuf> {
    dirs::home_dir()
        .map(|h| h.join(".omegon"))
        .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))
}

fn create_manager() -> anyhow::Result<omegon_secrets::SecretsManager> {
    let dir = config_dir()?;
    std::fs::create_dir_all(&dir)?;
    omegon_secrets::SecretsManager::new(&dir)
}
