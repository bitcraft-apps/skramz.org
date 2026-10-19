import type { App } from "../lib/http";
import { RELEASE_TYPES, fetchClaimSources, normalizeName, publicWriteError, readBody, requireAuth } from "../lib/http";

function invalidReleaseType(value: unknown): boolean {
  // releases.release_type is NOT NULL (issue #21); a present value must be in
  // the enum (issue #8: "validate release_type enum"). Undefined (absent on
  // PATCH) is allowed; null is never a valid type.
  if (value === undefined) return false;
  return !(typeof value === "string" && (RELEASE_TYPES as readonly string[]).includes(value));
}

export function registerReleases(app: App): void {
  // GET /api/releases/:id — release + media_links.
  app.get("/api/releases/:id", async (c) => {
    const id = c.req.param("id");
    const release = await c.env.DB.prepare("SELECT * FROM releases WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!release) {
      return c.json({ error: { code: "not_found", message: "Release not found" } }, 404);
    }
    const media = await c.env.DB.prepare("SELECT * FROM media_links WHERE release_id = ? ORDER BY id LIMIT 50")
      .bind(id)
      .all<Record<string, unknown>>();
    const sources = await fetchClaimSources(c.env.DB, [
      { entity_type: "release", entity_id: id },
      ...media.results.map((m) => ({ entity_type: "media_link", entity_id: String(m.id) })),
    ]);
    return c.json({ data: release, media_links: media.results, sources });
  });

  // POST /api/releases
  app.post("/api/releases", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok || typeof parsed.body.band_id !== "string" || typeof parsed.body.title !== "string" || !parsed.body.title.trim()) {
      return c.json({ error: { code: "invalid", message: "Fields band_id and title are required" } }, 422);
    }
    // release_type is required (NOT NULL since issue #21): missing, null, or
    // off-enum values all get the same 422 before hitting the DDL.
    if (typeof parsed.body.release_type !== "string" || invalidReleaseType(parsed.body.release_type)) {
      return c.json(
        { error: { code: "invalid", message: `release_type must be one of ${RELEASE_TYPES.join(", ")}` } },
        422,
      );
    }
    const row = {
      id: crypto.randomUUID(),
      band_id: parsed.body.band_id,
      title: parsed.body.title.trim(),
      // Server-computed; a client-supplied title_norm is ignored.
      title_norm: normalizeName(parsed.body.title.trim()),
      release_type: parsed.body.release_type,
      release_year: parsed.body.release_year ?? null,
      cover_r2_key: parsed.body.cover_r2_key ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO releases (id, band_id, title, title_norm, release_type, release_year, cover_r2_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.band_id, row.title, row.title_norm, row.release_type, row.release_year, row.cover_r2_key)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/releases/:id
  app.patch("/api/releases/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Release not found" } }, 404);
    }
    if (parsed.body.release_type !== undefined && invalidReleaseType(parsed.body.release_type)) {
      return c.json(
        { error: { code: "invalid", message: `release_type must be one of ${RELEASE_TYPES.join(", ")}` } },
        422,
      );
    }
    const patch: Record<string, unknown> = {};
    for (const key of ["band_id", "title", "release_type", "release_year", "cover_r2_key"]) {
      if (parsed.body[key] !== undefined) patch[key] = parsed.body[key];
    }
    if (typeof patch.title === "string") {
      if (!patch.title.trim()) {
        return c.json({ error: { code: "invalid", message: "Field title must be a non-empty string" } }, 422);
      }
      patch.title = patch.title.trim();
      // Server-computed; a client-supplied title_norm is ignored
      // (it is not in the copied key list, so it never reaches the UPDATE).
      patch.title_norm = normalizeName(patch.title as string);
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE releases SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "update");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM releases WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });
}
