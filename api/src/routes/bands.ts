import type { App } from "../lib/http";
import {
  GRAPH_LIMIT,
  escapeLike,
  fetchClaimSources,
  normalizeName,
  parseDepth,
  parseLimit,
  publicWriteError,
  readBody,
  requireAuth,
} from "../lib/http";

export function registerBands(app: App): void {
  // GET /api/bands?search=&limit=&cursor= — LIKE on name_norm (idx_bands_norm).
  // Cursor is the last-seen row id (`WHERE id > ? ORDER BY id`).
  app.get("/api/bands", async (c) => {
    const search = c.req.query("search") ?? "";
    const limit = parseLimit(c.req.query("limit"));
    const cursor = c.req.query("cursor") ?? "";
    const where: string[] = [];
    const vals: unknown[] = [];
    if (search) {
      where.push("name_norm LIKE (?) ESCAPE '\\'");
      vals.push(`%${escapeLike(normalizeName(search))}%`);
    }
    if (cursor) {
      where.push("id > ?");
      vals.push(cursor);
    }
    const rows = await c.env.DB.prepare(
      `SELECT * FROM bands${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id LIMIT ${limit + 1}`,
    )
      .bind(...vals)
      .all<Record<string, unknown>>();
    const page = rows.results.slice(0, limit);
    const nextCursor = rows.results.length > limit ? String(page[page.length - 1].id) : null;
    return c.json({ data: page, nextCursor });
  });

  // GET /api/bands/:id — band + members + releases + media_links.
  app.get("/api/bands/:id", async (c) => {
    const id = c.req.param("id");
    const band = await c.env.DB.prepare("SELECT * FROM bands WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!band) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const members = await c.env.DB.prepare(
      "SELECT m.*, bm.role, bm.joined_year, bm.left_year, bm.id AS band_member_id FROM members m JOIN band_members bm ON bm.member_id = m.id WHERE bm.band_id = ? ORDER BY m.id LIMIT 50",
    )
      .bind(id)
      .all<Record<string, unknown>>();
    const releases = await c.env.DB.prepare("SELECT * FROM releases WHERE band_id = ? ORDER BY id LIMIT 50")
      .bind(id)
      .all<Record<string, unknown>>();
    const media = await c.env.DB.prepare("SELECT * FROM media_links WHERE band_id = ? ORDER BY id LIMIT 50")
      .bind(id)
      .all<Record<string, unknown>>();
    const sources = await fetchClaimSources(c.env.DB, [
      { entity_type: "band", entity_id: id },
      ...members.results.flatMap((m) => [
        { entity_type: "member", entity_id: String(m.id) },
        { entity_type: "band_member", entity_id: String(m.band_member_id) },
      ]),
      ...releases.results.map((r) => ({ entity_type: "release", entity_id: String(r.id) })),
      ...media.results.map((m) => ({ entity_type: "media_link", entity_id: String(m.id) })),
    ]);
    // band_member_id is only the join key for the sources lookup above,
    // not part of the public member shape.
    for (const m of members.results) delete m.band_member_id;
    return c.json({
      data: band,
      members: members.results,
      releases: releases.results,
      media_links: media.results,
      sources,
    });
  });

  // GET /api/bands/:id/graph?depth=3 — multi-hop relationship tree as
  // { nodes: [{id,type,name}], edges: [{from,to,via}] }. One Recursive CTE
  // (SQLite, no graph DB): parameterized depth clamped to 1..4, path-string
  // cycle guard, LIMIT 500 to bound row-reads and the 10ms CPU budget.
  app.get("/api/bands/:id/graph", async (c) => {
    const id = c.req.param("id");
    const depth = parseDepth(c.req.query("depth"));
    const root = await c.env.DB.prepare("SELECT id, name FROM bands WHERE id = ?")
      .bind(id)
      .first<{ id: string; name: string }>();
    if (!root) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const edgeRows = await c.env.DB.prepare(
      `WITH RECURSIVE tree(id, depth, path, from_id, via) AS (
        SELECT bm2.band_id, 1, '/' || b.id || '/' || bm2.band_id || '/', b.id, m.name
        FROM bands b
        JOIN band_members bm1 ON bm1.band_id = b.id
        JOIN members m ON m.id = bm1.member_id
        JOIN band_members bm2 ON bm2.member_id = m.id AND bm2.band_id <> b.id
        WHERE b.id = ?1
        UNION
        SELECT bm2.band_id, t.depth + 1, t.path || bm2.band_id || '/', t.id, m.name
        FROM tree t
        JOIN band_members bm1 ON bm1.band_id = t.id
        JOIN band_members bm2 ON bm2.member_id = bm1.member_id
          AND instr(t.path, '/' || bm2.band_id || '/') = 0
        JOIN members m ON m.id = bm1.member_id
        WHERE t.depth < ?2
      )
      SELECT from_id, id AS to_id, via, MIN(depth) AS depth
      FROM tree GROUP BY from_id, id, via LIMIT ${GRAPH_LIMIT}`,
    )
      .bind(id, depth)
      .all<{ from_id: string; to_id: string; via: string; depth: number }>();
    const depthById = new Map<string, number>([[root.id, 0]]);
    for (const row of edgeRows.results) {
      const prev = depthById.get(row.to_id);
      if (prev === undefined || row.depth < prev) depthById.set(row.to_id, row.depth);
    }
    const ids = [...depthById.keys()];
    const placeholders = ids.map(() => "?").join(", ");
    const nameRows = await c.env.DB.prepare(`SELECT id, name FROM bands WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<{ id: string; name: string }>();
    const nameById = new Map(nameRows.results.map((r) => [r.id, r.name]));
    const nodes = [...depthById.entries()]
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
      .filter(([bandId]) => nameById.has(bandId))
      .map(([bandId]) => ({ id: bandId, type: "band", name: nameById.get(bandId) as string }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = edgeRows.results
      .filter((r) => nodeIds.has(r.from_id) && nodeIds.has(r.to_id))
      .map((r) => ({ from: r.from_id, to: r.to_id, via: r.via }))
      .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : a.via < b.via ? -1 : 1));
    return c.json({ nodes, edges });
  });

  // POST /api/bands
  app.post("/api/bands", async (c) => {
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
      formed_year: parsed.body.formed_year ?? null,
      disbanded_year: parsed.body.disbanded_year ?? null,
      location: parsed.body.location ?? null,
      bio: parsed.body.bio ?? null,
      photo_r2_key: parsed.body.photo_r2_key ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio, photo_r2_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.name, row.name_norm, row.formed_year, row.disbanded_year, row.location, row.bio, row.photo_r2_key)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    return c.json({ data: row }, 201);
  });

  // POST /api/bands/:id/members — link an existing member to the band.
  app.post("/api/bands/:id/members", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const id = c.req.param("id");
    const band = await c.env.DB.prepare("SELECT id FROM bands WHERE id = ?").bind(id).first();
    if (!band) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const parsed = await readBody(c);
    if (!parsed.ok || typeof parsed.body.member_id !== "string" || !parsed.body.member_id) {
      return c.json({ error: { code: "invalid", message: "Field member_id is required" } }, 422);
    }
    const member = await c.env.DB.prepare("SELECT id FROM members WHERE id = ?")
      .bind(parsed.body.member_id)
      .first();
    if (!member) {
      return c.json({ error: { code: "not_found", message: "Member not found" } }, 404);
    }
    const row = {
      id: crypto.randomUUID(),
      band_id: id,
      member_id: parsed.body.member_id,
      role: parsed.body.role ?? null,
      joined_year: parsed.body.joined_year ?? null,
      left_year: parsed.body.left_year ?? null,
    };
    try {
      await c.env.DB.prepare(
        "INSERT INTO band_members (id, band_id, member_id, role, joined_year, left_year) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(row.id, row.band_id, row.member_id, row.role, row.joined_year, row.left_year)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "insert");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    return c.json({ data: row }, 201);
  });

  // PATCH /api/bands/:id
  app.patch("/api/bands/:id", async (c) => {
    const denied = await requireAuth(c);
    if (denied) return denied;
    const parsed = await readBody(c);
    if (!parsed.ok) {
      return c.json({ error: { code: "invalid", message: "Invalid JSON body" } }, 422);
    }
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT * FROM bands WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ error: { code: "not_found", message: "Band not found" } }, 404);
    }
    const patch: Record<string, unknown> = {};
    if (parsed.body.name !== undefined) {
      if (typeof parsed.body.name !== "string" || !parsed.body.name.trim()) {
        return c.json({ error: { code: "invalid", message: "Field name must be a non-empty string" } }, 422);
      }
      patch.name = parsed.body.name.trim();
      patch.name_norm = normalizeName(parsed.body.name);
    }
    for (const key of ["formed_year", "disbanded_year", "location", "bio", "photo_r2_key"]) {
      if (parsed.body[key] !== undefined) patch[key] = parsed.body[key];
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: { code: "invalid", message: "Nothing to update" } }, 422);
    }
    const sets = [...Object.keys(patch).map((k) => `${k} = ?`), "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"];
    try {
      await c.env.DB.prepare(`UPDATE bands SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...Object.values(patch), id)
        .run();
    } catch (err) {
      const pub = publicWriteError(err, "update");
      return c.json({ error: { code: pub.code, message: pub.message } }, pub.status);
    }
    const updated = await c.env.DB.prepare("SELECT * FROM bands WHERE id = ?").bind(id).first();
    return c.json({ data: updated });
  });
}
