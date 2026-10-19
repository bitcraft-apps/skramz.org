import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings, D1Database, D1PreparedStatement } from "./lib/db";
import { publicInternalError } from "./lib/http";
import type { App } from "./lib/http";
import { registerBandLinks } from "./routes/band-links";
import { registerBands } from "./routes/bands";
import { registerHealth } from "./routes/health";
import { registerMediaLinks } from "./routes/media-links";
import { registerMembers } from "./routes/members";
import { registerReleases } from "./routes/releases";
import { registerSearch } from "./routes/search";

export type { Bindings, D1Database, D1PreparedStatement };
export type { App } from "./lib/http";
// Compat: normalizeName was exported from the pre-split module.
export { normalizeName } from "./lib/http";

// Apex + www serve the same SPA (ADR-0004). PR preview versions
// (deploy-web.yml `preview` job) serve from version URLs shaped
// `<version>-skramz-web.s-graczyk.workers.dev` and call the production
// API, so those origins are allowed too. Anything else — including
// other workers' hosts — gets no allow-origin header. Ingestion writes
// stay gated by INGESTION_TOKEN regardless of origin.
const PROD_ORIGINS = ["https://skramz.org", "https://www.skramz.org"];
const PREVIEW_ORIGIN = /^[a-z0-9-]+-skramz-web\.s-graczyk\.workers\.dev$/;

function allowOrigin(origin: string): string | undefined {
  if (PROD_ORIGINS.includes(origin)) {
    return origin;
  }
  try {
    const url = new URL(origin);
    // Local dev loopback (Vite :5173 → worker :8787, plain http). Reads
    // are public and writes stay bearer-gated, so no prod approval needed.
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return origin;
    }
    if (url.protocol === "https:" && PREVIEW_ORIGIN.test(url.hostname)) {
      return origin;
    }
  } catch {
    // Malformed Origin — deny below.
  }
  return undefined;
}

export function createApp(): App {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/*", cors({ origin: (origin) => allowOrigin(origin) }));

  registerHealth(app);
  registerBandLinks(app);
  registerBands(app);
  registerMembers(app);
  registerReleases(app);
  registerMediaLinks(app);
  registerSearch(app);

  // Uniform error shape for unknown routes: { "error": { "code", "message" } }.
  app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found" } }, 404));

  // Uniform error shape for thrown errors (Hono's default is plain-text 500).
  app.onError((err, c) => {
    console.error("Internal server error", err);
    const pub = publicInternalError();
    return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
  });

  return app;
}

const app = createApp();

export default app;
