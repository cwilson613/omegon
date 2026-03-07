/**
 * vault — Markdown viewport extension
 *
 * Spawns mdserve to render interlinked project markdown as a navigable
 * web UI with wikilink resolution, graph view, and live reload.
 *
 * Commands:
 *   /vault           — Start mdserve on the project root (or resume if running)
 *   /vault [path]    — Start mdserve on a specific directory
 *   /vault stop      — Stop the running mdserve instance
 *   /vault status    — Show whether mdserve is running and on which port
 *   /vault graph     — Open the graph view in the browser
 *   /vault install   — Install mdserve from source
 *
 * Bootstrap:
 *   On first session start, checks for mdserve binary. If missing, emits
 *   a one-time notification with install instructions. The /vault install
 *   command handles the actual cargo install.
 */

import { execSync, spawn, type ChildProcess } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const DEFAULT_PORT = 3333;
const BINARY_NAME = "mdserve";
const REPO_URL = "https://github.com/cwilson613/mdserve";
const REPO_BRANCH = "feature/wikilinks-graph";

// Track running mdserve process per session
let mdserveProcess: ChildProcess | null = null;
let mdservePort: number | null = null;
let mdserveDir: string | null = null;

function hasBinary(): boolean {
	try {
		execSync(`which ${BINARY_NAME}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function hasCargoInstalled(): boolean {
	try {
		execSync("which cargo", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function openBrowser(url: string): void {
	try {
		const cmd = process.platform === "darwin" ? "open" : "xdg-open";
		spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
	} catch {
		// ignore — user can open manually
	}
}

function stopMdserve(): string {
	if (mdserveProcess) {
		mdserveProcess.kill("SIGTERM");
		mdserveProcess = null;
		const msg = `Stopped mdserve (was serving ${mdserveDir} on port ${mdservePort})`;
		mdservePort = null;
		mdserveDir = null;
		return msg;
	}
	return "mdserve is not running.";
}

function startMdserve(dir: string, port: number): string {
	if (mdserveProcess) {
		if (mdserveDir === dir) {
			return `mdserve already running at http://127.0.0.1:${mdservePort}\n` +
				`Serving: ${mdserveDir}\n` +
				`Use \`/vault stop\` to stop, or \`/vault graph\` to open graph view.`;
		}
		// Different directory — stop and restart
		stopMdserve();
	}

	const child = spawn(BINARY_NAME, [dir, "--port", String(port)], {
		stdio: ["ignore", "pipe", "pipe"],
		detached: false,
	});

	mdserveProcess = child;
	mdservePort = port;
	mdserveDir = dir;

	child.stdout?.on("data", (data: Buffer) => {
		const match = data.toString().match(/using (\d+) instead/);
		if (match) {
			mdservePort = parseInt(match[1], 10);
		}
	});

	child.on("exit", () => {
		if (mdserveProcess === child) {
			mdserveProcess = null;
			mdservePort = null;
			mdserveDir = null;
		}
	});

	openBrowser(`http://127.0.0.1:${port}`);

	return `Started mdserve at http://127.0.0.1:${port}\n` +
		`Serving: ${dir}\n` +
		`Graph view: http://127.0.0.1:${port}/graph\n` +
		`Use \`/vault stop\` to stop.`;
}

const INSTALL_MSG_NO_CARGO =
	`\`mdserve\` requires the Rust toolchain to build from source.\n` +
	`Install Rust first: https://rustup.rs\n` +
	`Then run: \`/vault install\``;

const INSTALL_MSG =
	`\`mdserve\` is not installed. Run \`/vault install\` to build and install it.\n` +
	`(Requires Rust toolchain — takes ~60s on first build)`;

export default function (pi: ExtensionAPI) {
	// --- Bootstrap: check for mdserve on session start ---
	pi.on("session_start", async (_event, ctx) => {
		if (!hasBinary()) {
			if (ctx.hasUI) {
				if (hasCargoInstalled()) {
					ctx.ui.notify(
						"vault: mdserve not found. Run /vault install to set up.",
						"info",
					);
				} else {
					ctx.ui.notify(
						"vault: mdserve requires Rust toolchain. See https://rustup.rs",
						"info",
					);
				}
			}
		}
	});

	// --- Cleanup on session end ---
	pi.on("session_end", () => {
		if (mdserveProcess) {
			mdserveProcess.kill("SIGTERM");
			mdserveProcess = null;
		}
	});

	pi.addCommand({
		name: "vault",
		description: "Markdown viewport — serve project docs with wikilinks and graph view",
		execute: async (ctx, args) => {
			const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase() || "";

			switch (subcommand) {
				case "install": {
					if (hasBinary()) {
						ctx.say("mdserve is already installed.");
						return;
					}
					if (!hasCargoInstalled()) {
						ctx.say(INSTALL_MSG_NO_CARGO);
						return;
					}

					ctx.say("Installing mdserve from source... (this takes ~60s on first build)");

					try {
						execSync(
							`cargo install --git ${REPO_URL} --branch ${REPO_BRANCH}`,
							{
								stdio: "inherit",
								timeout: 300_000, // 5 min max
							},
						);
						ctx.say("✅ mdserve installed successfully. Run `/vault` to start.");
					} catch (e: any) {
						ctx.say(
							`❌ Installation failed.\n\n` +
							`You can try manually:\n` +
							`\`\`\`\n` +
							`cargo install --git ${REPO_URL} --branch ${REPO_BRANCH}\n` +
							`\`\`\`\n\n` +
							`Error: ${e.message || e}`,
						);
					}
					return;
				}

				case "stop":
					ctx.say(stopMdserve());
					return;

				case "status":
					if (mdserveProcess) {
						ctx.say(
							`mdserve is running at http://127.0.0.1:${mdservePort}\n` +
							`Serving: ${mdserveDir}`,
						);
					} else if (!hasBinary()) {
						ctx.say(hasCargoInstalled() ? INSTALL_MSG : INSTALL_MSG_NO_CARGO);
					} else {
						ctx.say("mdserve is not running. Use `/vault` to start.");
					}
					return;

				case "graph":
					if (!hasBinary()) {
						ctx.say(hasCargoInstalled() ? INSTALL_MSG : INSTALL_MSG_NO_CARGO);
						return;
					}
					if (mdserveProcess && mdservePort) {
						openBrowser(`http://127.0.0.1:${mdservePort}/graph`);
						ctx.say(`Opened graph view at http://127.0.0.1:${mdservePort}/graph`);
					} else {
						const dir = process.cwd();
						ctx.say(startMdserve(dir, DEFAULT_PORT));
						setTimeout(() => {
							if (mdservePort) {
								openBrowser(`http://127.0.0.1:${mdservePort}/graph`);
							}
						}, 1000);
					}
					return;

				default: {
					if (!hasBinary()) {
						ctx.say(hasCargoInstalled() ? INSTALL_MSG : INSTALL_MSG_NO_CARGO);
						return;
					}
					// Default: start serving. Subcommand might be a path.
					const dir = subcommand || process.cwd();
					ctx.say(startMdserve(dir, DEFAULT_PORT));
					return;
				}
			}
		},
	});
}
