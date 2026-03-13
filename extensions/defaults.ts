/**
 * defaults — Auto-configure Omegon defaults on first install
 *
 * - Sets theme to "default" if no theme is configured
 * - Deploys global AGENTS.md to ~/.pi/agent/ for cross-project directives
 *
 * Guards:
 * - Only writes settings/AGENTS.md if not already present or if managed by Omegon
 * - Never overwrites a user-authored AGENTS.md (detected by absence of marker comment)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { ExtensionAPI } from "@cwilson613/pi-coding-agent";

const AGENT_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".pi", "agent",
);

const SETTINGS_PATH = path.join(AGENT_DIR, "settings.json");
const GLOBAL_AGENTS_PATH = path.join(AGENT_DIR, "AGENTS.md");
const THEMES_DIR = path.join(AGENT_DIR, "themes");

/** Themes shipped with Omegon — deployed to ~/.pi/agent/themes/ */
const BUNDLED_THEMES = ["alpharius.json"] as const;

/** Marker embedded in the deployed AGENTS.md to identify Omegon ownership */
const PIKIT_MARKER = "<!-- managed by omegon -->";
const PIKIT_MARKER_LEGACY = "<!-- managed by pi-kit -->"; // legacy — still treated as owned

/** Hash file tracks the last content we deployed, so we detect user edits */
const HASH_PATH = path.join(AGENT_DIR, ".agents-md-hash");

/** Path to the template shipped with the Omegon package */
const TEMPLATE_PATH = path.join(import.meta.dirname, "..", "config", "AGENTS.md");

function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // --- Terminal tab title branding ---
    // Replace the core π symbol with Ω in the terminal tab title.
    // This fires after the core title is set, so it overwrites it.
    if (ctx.hasUI) {
      const sessionName = ctx.sessionManager.getSessionName();
      const cwdBasename = path.basename(ctx.cwd);
      const title = sessionName
        ? `Ω - ${sessionName} - ${cwdBasename}`
        : `Ω - ${cwdBasename}`;
      ctx.ui.setTitle(title);
    }

    // --- Theme default ---
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
      const settings = JSON.parse(raw);

      let changed = false;

      if (!settings.theme) {
        settings.theme = "alpharius";
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
        if (ctx.hasUI) {
          ctx.ui.notify("Omegon: set theme to default (restart to apply)", "info");
        }
      }
    } catch {
      // Best effort
    }

    // --- Theme deployment ---
    // Copy bundled themes to ~/.pi/agent/themes/, overwriting on every session start
    // so updates in the repo propagate automatically.
    try {
      fs.mkdirSync(THEMES_DIR, { recursive: true });
      for (const themeFile of BUNDLED_THEMES) {
        const src = path.join(import.meta.dirname, "..", "themes", themeFile);
        const dst = path.join(THEMES_DIR, themeFile);
        if (!fs.existsSync(src)) continue;
        const srcContent = fs.readFileSync(src, "utf8");
        const dstContent = fs.existsSync(dst) ? fs.readFileSync(dst, "utf8") : null;
        if (srcContent !== dstContent) {
          fs.writeFileSync(dst, srcContent, "utf8");
          if (ctx.hasUI) {
            ctx.ui.notify(`Omegon: updated theme ${themeFile} (restart to apply)`, "info");
          }
        }
      }
    } catch {
      // Best effort
    }

    // --- Global AGENTS.md deployment ---
    try {
      if (!fs.existsSync(TEMPLATE_PATH)) return;
      fs.mkdirSync(AGENT_DIR, { recursive: true });
      const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
      const deployContent = `${template.trimEnd()}\n\n${PIKIT_MARKER}\n`;

      if (fs.existsSync(GLOBAL_AGENTS_PATH)) {
        const existing = fs.readFileSync(GLOBAL_AGENTS_PATH, "utf8");

        if (existing.includes(PIKIT_MARKER) || existing.includes(PIKIT_MARKER_LEGACY)) {
          // We own this file — check if user has edited it since last deploy
          if (existing !== deployContent) {
            const lastHash = fs.existsSync(HASH_PATH) ? fs.readFileSync(HASH_PATH, "utf8").trim() : null;
            const existingHash = contentHash(existing);

            if (!lastHash) {
              // First run with hash tracking — adopt current content as baseline
              // so we don't overwrite edits made before the hash mechanism existed
              fs.writeFileSync(HASH_PATH, existingHash, "utf8");
              if (ctx.hasUI) {
                ctx.ui.notify(
                  "Omegon: AGENTS.md template updated. Changes will apply on next session start.",
                  "info",
                );
              }
            } else if (lastHash !== existingHash) {
              // File was modified externally — warn, don't overwrite
              if (ctx.hasUI) {
                ctx.ui.notify(
                  "Omegon: ~/.pi/agent/AGENTS.md has local edits. Remove the omegon marker to keep them, or delete the file to re-deploy.",
                  "warning",
                );
              }
            } else {
              // File matches our last deploy — safe to update
              fs.writeFileSync(GLOBAL_AGENTS_PATH, deployContent, "utf8");
              fs.writeFileSync(HASH_PATH, contentHash(deployContent), "utf8");
            }
          }
        }
        // else: user-authored file (no marker), don't touch it
      } else {
        // No AGENTS.md exists — deploy ours
        fs.writeFileSync(GLOBAL_AGENTS_PATH, deployContent, "utf8");
        fs.writeFileSync(HASH_PATH, contentHash(deployContent), "utf8");
        if (ctx.hasUI) {
          ctx.ui.notify("Omegon: deployed global directives to ~/.pi/agent/AGENTS.md", "info");
        }
      }
    } catch {
      // Best effort — don't break startup
    }
  });
}
