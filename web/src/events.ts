import { API_URL } from "./api";

// Custom user-event tracking via the API Worker's Analytics Engine dataset
// (POST /api/events). Covers what visitors DO — play, graph open, search —
// which the cookieless Web Analytics beacon (analytics.ts) cannot report.
// Fire-and-forget: never awaited in render paths, silent on every failure
// so tracking can never break playback or navigation.
// Keep in sync with TRACKED_ACTIONS in api/src/routes/events.ts — the server
// allowlist is authoritative, so drift fails closed as a rejected event.
export type TrackedAction = "page_view" | "play" | "graph_open" | "search";

export function trackEvent(action: TrackedAction, path?: string): void {
  try {
    const here =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const payload = JSON.stringify({ action, path: path ?? here });
    const url = `${API_URL}/api/events`;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const beacon = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, beacon)) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Silent: analytics must never surface errors to visitors.
    });
  } catch {
    // Silent: tracking never throws into the calling interaction.
  }
}
