import type { App } from "../lib/http";
import { fetchClaimSources, publicWriteError, readBody, requireAuth } from "../lib/http";

function singleParentViolation(releaseId: unknown, bandId: unknown): boolean {
  // Exactly one parent required (mirrors the DDL CHECK at handler layer).
  const hasRelease = releaseId !== undefined && releaseId !== null;
  const hasBand = bandId !== undefined && bandId !== null;
  return hasRelease === hasBand;
}

export function registerMediaLinks(app: App): void {
  // GET /api/media-links/:id — media link + its sources.
  app.get("/api/media-links/:id", async (c) => {
    const id = c.req.param("id");
    const row = await c.env.DB.prepare("SELECT * FROM media_links WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) {
      return c.json({ error: { code: "not_found", message: "Media link not found" } }, 404);
    }
    const sources = await fetchClaimSources(c.env.DB, [{ entity_type: "media_link", entity_id: id }]);
    return c.json({ data: row, sources });
  });

  // POST /api/media-links
  app.post("/api/media-links", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (
      !parsed.ok ||
      typeof parsed.body.provider !== "string" ||
      typeof parsed.body.url !== "string" ||
      !parsed.body.url.trim()
    ) {
      return c.json({ error: { code: "invalid", message: "Fields provider and url are required" } }, 422);
    }
    if (singleParentViolation(parsed.body.release_id, parsed.body.band_id)) {
      return c.json(
        { error: { code: "invalid", message: "Exactly one of release_id or band_id is required" } },
        422,
      );
    }
    const row = {
      id: crypto.randomUUID(),
      release_id: parsed.body.release_id ?? null,
      band_id: parsed.body.band_id ?? null,
      provider: parsed.body.provider,
      url: parsed.body.url.trim(),
      embed_url: parsed.body.embed_url ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO media_links (id, release_id, band_id, provider, url, embed_url) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.release_id, row.band_id, row.provider, row.url, row.embed_url)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/media-links/:id — merges with the stored row before checking
  // the single-parent rule, so setting one parent while the other is stored
  // is still a 422 unless the stored one is cleared in the same patch.
  app.patch("/api/media-links/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM media_links WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Media link not found" } }, 404);
    }
    const mergedRelease = parsed.body.release_id !== undefined ? parsed.body.release_id : existing.release_id;
    const mergedBand = parsed.body.band_id !== undefined ? parsed.body.band_id : existing.band_id;
    if (singleParentViolation(mergedRelease, mergedBand)) {
      return c.json(
        { error: { code: "invalid", message: "Exactly one of release_id or band_id is required" } },
        422,
      );
    }
    const patch: Record<string, unknown> = {};
    for (const key of ["release_id", "band_id", "provider", "url", "embed_url"]) {
      if (parsed.body[key] !== undefined) patch[key] = parsed.body[key];
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE media_links SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "update");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM media_links WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });
}
