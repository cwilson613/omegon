/**
 * clipboard-diag — Diagnostic command for clipboard image paste.
 *
 * Registers /cliptest to diagnose why Ctrl+V image paste may fail.
 */
import type { ExtensionAPI } from "../../vendor/pi-mono/packages/coding-agent/src/core/extensions/types.js";

export default function clipboardDiag(pi: ExtensionAPI) {
	pi.registerCommand("cliptest", {
		description: "Test clipboard image access (diagnostic)",
		async handler() {
			const lines: string[] = ["**Clipboard Image Diagnostic**", ""];

			// 1. Check native module
			let clipModule: string | null = null;
			let clipboard: { hasImage: () => boolean; getImageBinary: () => Promise<unknown> } | null = null;
			const candidates = ["@cwilson613/clipboard", "@mariozechner/clipboard"];
			for (const name of candidates) {
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					const mod = require(name);
					clipboard = mod;
					clipModule = name;
					break;
				} catch {
					// next
				}
			}

			if (!clipboard) {
				lines.push("❌ No clipboard native module found");
				lines.push(`   Tried: ${candidates.join(", ")}`);
			} else {
				lines.push(`✓ Module: ${clipModule}`);

				// 2. Check hasImage
				try {
					const has = clipboard.hasImage();
					lines.push(`${has ? "✓" : "❌"} hasImage(): ${has}`);

					// 3. Try reading
					if (has) {
						try {
							const data = await clipboard.getImageBinary();
							const len = Array.isArray(data) ? data.length : (data as Uint8Array)?.length ?? 0;
							lines.push(`${len > 0 ? "✓" : "❌"} getImageBinary(): ${len} bytes`);
						} catch (e) {
							lines.push(`❌ getImageBinary() threw: ${e instanceof Error ? e.message : String(e)}`);
						}
					}
				} catch (e) {
					lines.push(`❌ hasImage() threw: ${e instanceof Error ? e.message : String(e)}`);
				}
			}

			// 4. Platform info
			lines.push("");
			lines.push(`Platform: ${process.platform}, TERM: ${process.env.TERM ?? "unset"}`);
			lines.push(`DISPLAY: ${process.env.DISPLAY ?? "unset"}, WAYLAND: ${process.env.WAYLAND_DISPLAY ?? "unset"}`);

			pi.sendMessage({ customType: "view", content: lines.join("\n"), display: true });
		},
	});
}
