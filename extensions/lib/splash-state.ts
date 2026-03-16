/**
 * Shared splash state helpers — used by extensions to report loading status.
 *
 * Uses Symbol.for to share state across extension boundaries without imports.
 */

const SPLASH_KEY = Symbol.for("omegon:splash");

interface SplashItem {
  label: string;
  state: "hidden" | "pending" | "active" | "done" | "failed";
}

interface SplashState {
  items: SplashItem[];
  loadingComplete: boolean;
}

/** Update a checklist item by label. No-ops if splash not loaded yet. */
export function splashUpdate(label: string, state: SplashItem["state"]): void {
  const s = (globalThis as any)[SPLASH_KEY] as SplashState | undefined;
  if (!s) return;
  const item = s.items.find(i => i.label === label);
  if (item) item.state = state;
}
