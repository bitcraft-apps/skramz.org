import type { App } from "../lib/http";
import { publicWriteError, readBody, requireAuth } from "../lib/http";

// Portal allowlist: adding a portal (YouTube, Bandcamp, ...) is one map
// entry here, one DDL CHECK value, one icon-map entry on the web side.
export const PORTAL_HOSTS: Record<string, string[]> = {
  musicbrainz: ["musicbrainz.org"],
  discogs: ["discogs.com"],
  rym: ["rateyourmusic.com"],
};

// https: + portal host match (apex or any subdomain). Returns null when valid.
export function invalidBandLink(portal: unknown, url: unknown): string | null {
  if (typeof portal !== "string" || !(portal in PORTAL_HOSTS)) {
    return "Field portal must be one of: musicbrainz, discogs, rym";
  }
  if (typeof url !== "string" || !url.trim()) {
    return "Field url is required";
  }
  let host: string;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return "Field url must be a valid https URL";
    host = parsed.hostname.toLowerCase();
  } catch {
    return "Field url must be a valid https URL";
  }
  const ok = PORTAL_HOSTS[portal].some((base) => host === base || host.endsWith(`.${base}`));
  if (!ok) {
    return `Field url must be on ${PORTAL_HOSTS[portal].join(", ")}`;
  }
  return null;
}

export function registerBandLinks(app: App): void {
  // POST /api/band-links
  app.post("/api/band-links", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    const body = parsed.ok ? parsed.body : null;
    if (!body || typeof body.band_id !== "string" || !body.band_id) {
      return c.json({ error: { code: "invalid", message: "Field band_id is required" } }, 422);
    }
    const problem = invalidBandLink(body.portal, body.url);
    if (problem) {
      return c.json({ error: { code: "invalid", message: problem } }, 422);
    }
    const row = {
      id: crypto.randomUUID(),
      band_id: body.band_id,
      portal: body.portal,
      url: (body.url as string).trim(),
    };
    try {
      await c.env.DB.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)")
        .bind(row.id, row.band_id, row.portal, row.url)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/band-links/:id — merges with the stored row before
  // validating, so a url-only patch still checks against the stored portal.
  app.patch("/api/band-links/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM band_links WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Band link not found" } }, 404);
    }
    const body = parsed.body;
    // Stored rows are valid, so merged values always validate — no need to
    // gate validation on which keys the patch carries.
    const problem = invalidBandLink(
      body.portal !== undefined ? body.portal : existing.portal,
      body.url !== undefined ? body.url : existing.url,
    );
    if (problem) {
      return c.json({ error: { code: "invalid", message: problem } }, 422);
    }
    const patch: Record<string, unknown> = {};
    for (const key of ["band_id", "portal", "url"]) {
      const value = body[key];
      if (value !== undefined) patch[key] = typeof value === "string" ? value.trim() : value;
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE band_links SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "update");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM band_links WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });
}
