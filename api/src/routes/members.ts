import type { App } from "../lib/http";
import { fetchClaimSources, normalizeName, publicWriteError, readBody, requireAuth } from "../lib/http";

export function registerMembers(app: App): void {
  // GET /api/members/:id — member + band history.
  app.get("/api/members/:id", async (c) => {
    const id = c.req.param("id");
    const member = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!member) {
      return c.json({ error: { code: "not_found", message: "Member not found" } }, 404);
    }
    const bands = await c.env.DB.prepare(
      "SELECT b.*, bm.role, bm.joined_year, bm.left_year, bm.id AS band_member_id FROM bands b JOIN band_members bm ON bm.band_id = b.id WHERE bm.member_id = ? ORDER BY b.id LIMIT 50",
    )
      .bind(id)
      .all<Record<string, unknown>>();
    const sources = await fetchClaimSources(c.env.DB, [
      { entity_type: "member", entity_id: id },
      ...bands.results.map((b) => ({ entity_type: "band_member", entity_id: String(b.band_member_id) })),
    ]);
    return c.json({ data: member, bands: bands.results, sources });
  });

  // POST /api/members
  app.post("/api/members", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok || typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
      return c.json({ error: { code: "invalid", message: "Field name is required" } }, 422);
    }
    const row = {
      id: crypto.randomUUID(),
      name: parsed.body.name.trim(),
      name_norm: normalizeName(parsed.body.name),
      bio: parsed.body.bio ?? null,
    };
    try {
      await c.env.DB.prepare("INSERT INTO members (id, name, name_norm, bio) VALUES (?, ?, ?, ?)")
        .bind(row.id, row.name, row.name_norm, row.bio)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/members/:id
  app.patch("/api/members/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Member not found" } }, 404);
    }
    const patch: Record<string, unknown> = {};
    if (parsed.body.name !== undefined) {
      if (typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
        return c.json({ error: { code: "invalid", message: "Field name must be a non-empty string" } }, 422);
      }
      patch.name = parsed.body.name.trim();
      patch.name_norm = normalizeName(parsed.body.name);
    }
    if (parsed.body.bio !== undefined) patch.bio = parsed.body.bio;
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    try {
      await c.env.DB.prepare(`UPDATE members SET ${Object.keys(patch).map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "update");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });
}
