import { readBody, type App } from "../lib/http";

// Fixed action vocabulary for custom user-event tracking. The list grows
// only when a new interaction ships a call site — never speculatively.
export const TRACKED_ACTIONS = ["page_view", "play", "graph_open", "search"] as const;

export type TrackedAction = (typeof TRACKED_ACTIONS)[number];

const MAX_PATH_LENGTH = 2048;

export function registerEvents(app: App): void {
  // POST /api/events — accepts { action, path }, drops anything else, and
  // writes one Analytics Engine data point. No D1 row per event, so event
  // volume never touches the row-read/CPU budget. Public endpoint: the
  // payload carries no band/member/media claims, only an allowlisted
  // action plus the SPA path it happened on.
  app.post("/api/events", async (c) => {
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json(
        { error: { code: "invalid", message: "Request body must be a JSON object" } },
        400,
      );
    }
    const { action, path } = parsed.body;
    if (typeof action !== "string" || !(TRACKED_ACTIONS as readonly string[]).includes(action)) {
      return c.json(
        { error: { code: "invalid_action", message: "Action is not tracked" } },
        400,
      );
    }
    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.length > MAX_PATH_LENGTH
    ) {
      return c.json(
        { error: { code: "invalid_path", message: "Path must be a relative URL path" } },
        400,
      );
    }
    // Extra body fields are ignored: only action + path reach the dataset.
    try {
      c.env.EVENTS?.writeDataPoint({
        blobs: [action, path],
        doubles: [1],
        indexes: [action],
      });
    } catch {
      // Analytics must never break the response; the event is dropped.
    }
    return c.json({ ok: true }, 202);
  });
}
