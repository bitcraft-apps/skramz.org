import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type D1Database, type D1PreparedStatement } from "../src/index";
import { MEMBER_ROLES, publicWriteError, tokensEqual } from "../src/lib/http";

// Real-SQL coverage for issue #8: the actual api/migrations/*.sql files are
// applied to node:sqlite (same engine D1 uses locally) and the Hono app talks
// to it through a small D1-shaped adapter, so handler SQL is observed, not mocked.
const require = createRequire(import.meta.url);
type Db = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...p: unknown[]): unknown;
    all(...p: unknown[]): Record<string, unknown>[];
    get(...p: unknown[]): Record<string, unknown> | undefined;
  };
  close(): void;
};
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => Db;
};

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const TOKEN = "test-ingestion-token";

function adapter(db: Db): D1Database {
  return {
    prepare: (query: string): D1PreparedStatement => {
      let params: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          params = values;
          return stmt;
        },
        async first<T>() {
          const row = db.prepare(query).get(...params) as T | undefined;
          return row ?? null;
        },
        async all<T>() {
          const rows = db.prepare(query).all(...params) as T[];
          return { results: rows };
        },
        async run() {
          return db.prepare(query).run(...params);
        },
      };
      return stmt;
    },
  };
}

const app = createApp();
const ENV = { DB: null as unknown as D1Database, INGESTION_TOKEN: TOKEN };

function seed(db: Db) {
  db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b1", "Saetia", "saetia");
  db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b2", "Orchid", "orchid");
  db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m1", "Billy Werner", "billy werner");
  db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type) VALUES (?, ?, ?, ?, ?)").run("r1", "b1", "Saetia", "saetia", "LP");
}

let db: Db;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  seed(db);
  ENV.DB = adapter(db);
});
afterEach(() => {
  db.close();
});

const auth = { Authorization: `Bearer ${TOKEN}` };

describe("issue #8: ingestion-token auth", () => {
  it("unauthenticated POST returns 401 with the error envelope", async () => {
    const res = await app.request("/api/bands", { method: "POST", body: JSON.stringify({ name: "X" }) }, ENV);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "Valid ingestion token required" },
    });
  });

  it("wrong token returns 401", async () => {
    const res = await app.request(
      "/api/bands",
      { method: "POST", headers: { Authorization: "Bearer wrong" }, body: JSON.stringify({ name: "X" }) },
      ENV,
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("unauthorized");
  });

  it("valid token creates a band (201, server-computed name_norm)", async () => {
    const res = await app.request(
      "/api/bands",
      { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Neil Perry" }) },
      ENV,
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data.name_norm).toBe("neil perry");
    expect(db.prepare("SELECT COUNT(*) AS n FROM bands").get()?.n).toBe(3);
  });

  it("valid token links a member to a band (201, edge readable on the band)", async () => {
    const res = await app.request(
      "/api/bands/b1/members",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: "m1", role: "vocals" }),
      },
      ENV,
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data.band_id).toBe("b1");
    expect(json.data.member_id).toBe("m1");
    const band = (await (await app.request("/api/bands/b1", {}, ENV)).json()) as {
      members: Record<string, unknown>[];
    };
    expect(band.members.map((m) => m.name)).toContain("Billy Werner");
  });

  it("out-of-dict role returns 422", async () => {
    for (const role of ["rhythm guitar", "bass, guitar", "guitar/vocals", "theremin", "", 42]) {
      const res = await app.request(
        "/api/bands/b1/members",
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: "m1", role }),
        },
        ENV,
      );
      expect(res.status).toBe(422);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid");
    }
  });

  it("role is trimmed + lowercased before insert", async () => {
    const res = await app.request(
      "/api/bands/b1/members",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: "m1", role: "  Vocals " }),
      },
      ENV,
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { data: { role: string } }).data.role).toBe("vocals");
  });

  it("accepts + round-trips every dict role", async () => {
    db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m9", "Probe Player", "probe player");
    for (const role of MEMBER_ROLES) {
      const res = await app.request(
        "/api/bands/b1/members",
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: "m9", role }),
        },
        ENV,
      );
      expect(res.status).toBe(201);
    }
    const band = (await (await app.request("/api/bands/b1", {}, ENV)).json()) as {
      members: { name: string; role: string }[];
    };
    const roles = band.members.filter((m) => m.name === "Probe Player").map((m) => m.role);
    expect(roles.sort()).toEqual([...MEMBER_ROLES].sort());
  });

  it("duplicate (band, member, role) is rejected by the unique index", async () => {
    const body = { member_id: "m1", role: "guitar" };
    const first = await app.request(
      "/api/bands/b1/members",
      { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      ENV,
    );
    expect(first.status).toBe(201);
    const second = await app.request(
      "/api/bands/b1/members",
      { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) },
      ENV,
    );
    expect(second.status).toBe(409);
    expect(((await second.json()) as { error: { code: string } }).error.code).toBe("conflict");
  });

  it("guitar + vocals link as two rows for one person", async () => {
    for (const role of ["guitar", "vocals"]) {
      const res = await app.request(
        "/api/bands/b1/members",
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ member_id: "m1", role }),
        },
        ENV,
      );
      expect(res.status).toBe(201);
    }
    const band = (await (await app.request("/api/bands/b1", {}, ENV)).json()) as {
      members: { name: string; role: string }[];
    };
    const rows = band.members.filter((m) => m.name === "Billy Werner");
    expect(rows.map((m) => m.role).sort()).toEqual(["guitar", "vocals"]);
  });

  it("linking to a missing band returns 404", async () => {
    const res = await app.request(
      "/api/bands/nope/members",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: "m1" }),
      },
      ENV,
    );
    expect(res.status).toBe(404);
  });

  it("linking a missing member returns 404", async () => {
    const res = await app.request(
      "/api/bands/b1/members",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: "nope" }),
      },
      ENV,
    );
    expect(res.status).toBe(404);
  });

  it("linking without member_id returns 422", async () => {
    const res = await app.request(
      "/api/bands/b1/members",
      { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: "{}" },
      ENV,
    );
    expect(res.status).toBe(422);
  });

  it("unauthenticated link returns 401", async () => {
    const res = await app.request(
      "/api/bands/b1/members",
      { method: "POST", body: JSON.stringify({ member_id: "m1" }) },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe("issue #8: handler-layer validation", () => {
  it("invalid release_type returns 422 with the error envelope", async () => {
    const res = await app.request(
      "/api/releases",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "b1", title: "Demo Tape", release_type: "7inch" }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.message).toMatch(/release_type/);
  });

  it("missing release_type returns 422 (NOT NULL since issue #21)", async () => {
    const res = await app.request(
      "/api/releases",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "b1", title: "Untitled" }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("invalid");
    expect(json.error.message).toMatch(/release_type/);
  });

  it("null release_type returns 422 (NOT NULL since issue #21)", async () => {
    const res = await app.request(
      "/api/releases",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "b1", title: "Untitled", release_type: null }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid");
  });

  it("a valid release_type creates the release (201)", async () => {
    const res = await app.request(
      "/api/releases",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "b1", title: "Untitled", release_type: "Demo" }),
      },
      ENV,
    );
    expect(res.status).toBe(201);
  });

  it("double-parent media-link returns 422 at the handler layer", async () => {
    const res = await app.request(
      "/api/media-links",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_id: "r1", band_id: "b1", provider: "bandcamp", url: "https://example.com" }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid");
  });

  it("neither-parent media-link returns 422 at the handler layer", async () => {
    const res = await app.request(
      "/api/media-links",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "bandcamp", url: "https://example.com" }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
  });

  it("single-parent media-link writes succeed", async () => {
    const res = await app.request(
      "/api/media-links",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_id: "r1", provider: "bandcamp", url: "https://example.com/r" }),
      },
      ENV,
    );
    expect(res.status).toBe(201);
  });
});

describe("issue #8: reads + paginated search", () => {
  it("GET /api/bands?search= matches LIKE on name_norm", async () => {
    const res = await app.request("/api/bands?search=SAET", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { name: string }[]; nextCursor: null };
    expect(json.data.map((b) => b.name)).toEqual(["Saetia"]);
  });

  it("GET /api/bands paginates with limit/cursor", async () => {
    const first = (await (await app.request("/api/bands?limit=1", {}, ENV)).json()) as {
      data: { id: string }[];
      nextCursor: string | null;
    };
    expect(first.data).toHaveLength(1);
    expect(first.nextCursor).toBe("b1");
    const second = (await (await app.request(`/api/bands?limit=1&cursor=${first.nextCursor}`, {}, ENV)).json()) as {
      data: { id: string }[];
      nextCursor: null;
    };
    expect(second.data.map((b) => b.id)).toEqual(["b2"]);
    expect(second.nextCursor).toBeNull();
  });

  it("GET /api/members/:id returns the member + band history", async () => {
    db.prepare("INSERT INTO band_members (id, band_id, member_id, role, joined_year) VALUES (?, ?, ?, ?, ?)").run(
      "bm1",
      "b1",
      "m1",
      "vocals",
      1997,
    );
    const res = await app.request("/api/members/m1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { name: string }; bands: { name: string }[] };
    expect(json.data.name).toBe("Billy Werner");
    expect(json.bands.map((b) => b.name)).toEqual(["Saetia"]);
  });

  it("GET /api/members/:id for a missing id returns 404 envelope", async () => {
    const res = await app.request("/api/members/nope", {}, ENV);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/releases/:id returns the release + media_links", async () => {
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run(
      "x1",
      "r1",
      "bandcamp",
      "https://example.com/r",
    );
    const res = await app.request("/api/releases/r1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { title: string };
      media_links: { id: string }[];
    };
    expect(json.data.title).toBe("Saetia");
    expect(json.media_links.map((m) => m.id)).toEqual(["x1"]);
  });

  it("GET /api/search?q= returns band/member/release hits paginated", async () => {
    db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type) VALUES (?, ?, ?, ?, ?)").run("r9", "b1", "Saetia Demo", "saetia demo", "Demo");
    const res = await app.request("/api/search?q=saetia", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { hits: { type: string }[]; nextCursor: unknown };
    const types = new Set(json.hits.map((h) => h.type));
    expect(types.has("band")).toBe(true);
    expect(types.has("release")).toBe(true);
    expect("nextCursor" in json).toBe(true);
  });
});

describe("issue #29: /api/search cross-type cursor", () => {
  type Hit = { type: string; id: string; name: string };
  type Page = { hits: Hit[]; nextCursor: string | null };
  async function search(qs: string): Promise<{ status: number; json: Page & { error?: { code: string } } }> {
    const res = await app.request(`/api/search?${qs}`, {}, ENV);
    return { status: res.status, json: (await res.json()) as Page & { error?: { code: string } } };
  }

  it("exact-limit terminal page returns nextCursor null", async () => {
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b9", "Saetia Tribute", "saetia tribute");
    // limit=2 with exactly 2 matching bands, 0 members, 1 release: no table overflows.
    const { status, json } = await search("q=saetia&limit=2");
    expect(status).toBe(200);
    expect(json.hits.filter((h) => h.type === "band")).toHaveLength(2);
    expect(json.nextCursor).toBeNull();
  });

  it("stable multi-page pagination has no duplicates or skips", async () => {
    for (const [id, name, norm] of [
      ["b3", "Saetia Kid", "saetia kid"],
      ["b4", "Saetia Youth", "saetia youth"],
      ["b5", "Saetia End", "saetia end"],
    ] as const) {
      db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run(id, name, norm);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i++) {
      const { status, json } = await search(`q=saetia&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      expect(status).toBe(200);
      for (const h of json.hits.filter((h) => h.type === "band")) {
        expect(seen).not.toContain(`${h.type}:${h.id}`);
        seen.push(`${h.type}:${h.id}`);
      }
      cursor = json.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(["band:b1", "band:b3", "band:b4", "band:b5"]);
    expect(cursor).toBeNull();
  });

  it("malformed cursor is rejected with 400 invalid_cursor", async () => {
    const res = await app.request("/api/search?q=saetia&cursor=not-a-cursor", {}, ENV);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: "invalid_cursor", message: expect.any(String) } });
  });

  it("cursor bound to a different q is rejected with 400", async () => {
    // Seed a second match so page 1 overflows and emits a cursor.
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b9", "Saetia Tribute", "saetia tribute");
    const withCursor = await search("q=saetia&limit=1");
    expect(withCursor.status).toBe(200);
    expect(withCursor.json.nextCursor).not.toBeNull();
    const res = await app.request(
      `/api/search?q=orchid&cursor=${encodeURIComponent(withCursor.json.nextCursor as string)}`,
      {},
      ENV,
    );
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("invalid_cursor");
  });

  it("cursor is bound to the normalized query: case-variant reuse is accepted", async () => {
    // All three tables share the same `%normQ%` LIKE pattern (releases via
    // title_norm), so a case variant pages the identical set — no
    // duplicates/skips, and the cursor must be accepted.
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b9", "Saetia Tribute", "saetia tribute");
    const withCursor = await search("q=saetia&limit=1");
    expect(withCursor.status).toBe(200);
    expect(withCursor.json.nextCursor).not.toBeNull();
    const res = await app.request(
      `/api/search?q=SAETIA&limit=1&cursor=${encodeURIComponent(withCursor.json.nextCursor as string)}`,
      {},
      ENV,
    );
    expect(res.status).toBe(200);
  });

  it("cursor issued for a punctuation variant is accepted for the plain query", async () => {
    // 'Dark-Side!' normalizes to 'dark side': page 1 with the punctuated
    // query, page 2 with the plain spelling, same cursor.
    for (const [id, title, norm] of [
      ["r2", "Dark-Side! One", "dark side one"],
      ["r3", "Dark-Side! Two", "dark side two"],
      ["r4", "Dark-Side! Three", "dark side three"],
    ] as const) {
      db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type) VALUES (?, ?, ?, ?, ?)").run(id, "b1", title, norm, "EP");
    }
    const p1 = await search("q=Dark-Side!&limit=2");
    expect(p1.status).toBe(200);
    expect(p1.json.nextCursor).not.toBeNull();
    const p2 = await search(`q=dark%20side&limit=2&cursor=${encodeURIComponent(p1.json.nextCursor as string)}`);
    expect(p2.status).toBe(200);
    const ids1 = new Set(p1.json.hits.filter((h) => h.type === "release").map((h) => h.id));
    for (const h of p2.json.hits.filter((h) => h.type === "release")) {
      expect(ids1.has(h.id)).toBe(false);
    }
  });
});

describe("releases title_norm", () => {
  it("release search matches case/punctuation variants via title_norm", async () => {
    db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type) VALUES (?, ?, ?, ?, ?)").run(
      "r9", "b1", "Dark-Side! EP", "dark side ep", "EP",
    );
    const res = await app.request("/api/search?q=dark%20side", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { hits: { type: string; id: string }[] };
    expect(json.hits.filter((h) => h.type === "release").map((h) => h.id)).toContain("r9");
  });

  it("POST /api/releases server-computes title_norm and ignores client values", async () => {
    const res = await app.request(
      "/api/releases",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "b1", title: "Dark-Side! EP", release_type: "EP", title_norm: "bogus" }),
      },
      ENV,
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data.title_norm).toBe("dark side ep");
    const row = db.prepare("SELECT title_norm AS n FROM releases WHERE id = ?").get(json.data.id as string) as { n: string };
    expect(row.n).toBe("dark side ep");
  });

  it("PATCH /api/releases/:id recomputes title_norm when the title changes", async () => {
    const res = await app.request(
      "/api/releases/r1",
      {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Saetia / Orchid Split!" }),
      },
      ENV,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { title_norm: string } }).data.title_norm).toBe("saetia orchid split");
    const row = db.prepare("SELECT title_norm AS n FROM releases WHERE id = ?").get("r1") as { n: string };
    expect(row.n).toBe("saetia orchid split");
  });
});

describe("per-type limits in /api/search", () => {
  it("returns up to `limit` hits per type (page total <= 3*limit)", async () => {
    // Seed more matches than limit=2 in every type: 4 bands (b1 + 3),
    // 3 members, 3 releases (r1 + 2). Each type must be capped at 2,
    // so the merged page holds exactly 6 = 3*limit hits.
    for (const [id, name, norm] of [
      ["b3", "Saetia Kid", "saetia kid"],
      ["b4", "Saetia Youth", "saetia youth"],
      ["b5", "Saetia End", "saetia end"],
    ] as const) {
      db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run(id, name, norm);
    }
    for (const [id, name, norm] of [
      ["m2", "Saetia Fan", "saetia fan"],
      ["m3", "Saetia Roadie", "saetia roadie"],
      ["m4", "Saetia Drummer", "saetia drummer"],
    ] as const) {
      db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run(id, name, norm);
    }
    for (const [id, title, norm] of [
      ["r2", "Saetia Live", "saetia live"],
      ["r3", "Saetia Demos", "saetia demos"],
    ] as const) {
      db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type) VALUES (?, ?, ?, ?, ?)").run(id, "b1", title, norm, "LP");
    }
    const res = await app.request("/api/search?q=saetia&limit=2", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { hits: { type: string; id: string }[]; nextCursor: unknown };
    const count = (t: string) => json.hits.filter((h) => h.type === t).length;
    expect(count("band")).toBeLessThanOrEqual(2);
    expect(count("member")).toBeLessThanOrEqual(2);
    expect(count("release")).toBeLessThanOrEqual(2);
    expect(json.hits.length).toBeLessThanOrEqual(6);
    // Tight: every type overflows, so each cap is hit exactly.
    expect(count("band")).toBe(2);
    expect(count("member")).toBe(2);
    expect(count("release")).toBe(2);
  });
});

describe("issue #8: PATCH writes", () => {
  it("PATCH /api/bands/:id updates with a valid token", async () => {
    const res = await app.request(
      "/api/bands/b1",
      { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ location: "NY" }) },
      ENV,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { location: string } }).data.location).toBe("NY");
  });

  it("PATCH without a token returns 401", async () => {
    const res = await app.request(
      "/api/bands/b1",
      { method: "PATCH", body: JSON.stringify({ location: "NY" }) },
      ENV,
    );
    expect(res.status).toBe(401);
  });

  it("PATCH /api/releases/:id rejects an invalid release_type with 422", async () => {
    const res = await app.request(
      "/api/releases/r1",
      {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_type: "VHS" }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
  });

  it("PATCH child moves bands.updated_at through the parent-touch trigger", async () => {
    db.prepare("UPDATE bands SET updated_at = ? WHERE id = ?").run("2000-01-01T00:00:00.000Z", "b1");
    const res = await app.request(
      "/api/releases/r1",
      {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Saetia Remixed" }),
      },
      ENV,
    );
    expect(res.status).toBe(200);
    const band = db.prepare("SELECT updated_at AS u FROM bands WHERE id = ?").get("b1") as { u: unknown };
    expect(typeof band.u).toBe("string");
    expect(band.u).not.toBe("2000-01-01T00:00:00.000Z");
    const release = db.prepare("SELECT updated_at AS u FROM releases WHERE id = ?").get("r1") as { u: unknown };
    expect(typeof release.u).toBe("string");
  });

  it("PATCH /api/releases/:id rejects clearing release_type to null with 422 (issue #21)", async () => {
    const res = await app.request(
      "/api/releases/r1",
      {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_type: null }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
    expect(db.prepare("SELECT release_type AS t FROM releases WHERE id = ?").get("r1")?.t).toBe("LP");
  });
});

describe("sanitized DB errors", () => {
  it("duplicate band name returns 409 conflict without engine text", async () => {
    const res = await app.request(
      "/api/bands",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Saetia" }),
      },
      ENV,
    );
    expect(res.status).toBe(409);
    const text = await res.text();
    expect(text).not.toMatch(/unique|check constraint|sqlite|d1_/i);
    expect(JSON.parse(text)).toEqual({
      error: { code: "conflict", message: "Resource already exists" },
    });
  });

  it("foreign-key violation returns public 422 without engine text", async () => {
    const res = await app.request(
      "/api/releases",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "missing-band", title: "Ghost", release_type: "LP" }),
      },
      ENV,
    );
    expect(res.status).toBe(422);
    const text = await res.text();
    expect(text).not.toMatch(/unique|check constraint|sqlite|d1_/i);
    expect(JSON.parse(text)).toEqual({
      error: { code: "invalid", message: "Referenced record does not exist" },
    });
  });

  it("CHECK mapper returns a public message without engine text", () => {
    const pub = publicWriteError(new Error("CHECK constraint failed: releases"), "insert");
    expect(pub).toEqual({ status: 422, code: "invalid", message: "Value violates a database check" });
    expect(JSON.stringify(pub)).not.toMatch(/unique|check constraint|sqlite|d1_/i);
  });

  it("NOT NULL mapper returns a public message without engine text", () => {
    const pub = publicWriteError(new Error("NOT NULL constraint failed: bands.name"), "insert");
    expect(pub).toEqual({ status: 422, code: "invalid", message: "A required field is missing" });
  });

  it("unknown engine error falls back to a public message without engine text", () => {
    expect(publicWriteError(new Error("D1_ERROR: something exotic"), "insert")).toEqual({
      status: 422,
      code: "invalid",
      message: "Insert failed",
    });
    expect(publicWriteError(new Error("D1_ERROR: something exotic"), "update")).toEqual({
      status: 422,
      code: "invalid",
      message: "Update failed",
    });
  });

  it("maps non-Error values carrying a message field", () => {
    expect(publicWriteError({ message: "FOREIGN KEY constraint failed" }, "insert")).toEqual({
      status: 422,
      code: "invalid",
      message: "Referenced record does not exist",
    });
    expect(publicWriteError("UNIQUE constraint failed: bands.name", "insert")).toEqual({
      status: 409,
      code: "conflict",
      message: "Resource already exists",
    });
  });
});

describe("issue #36: no engine text leaks on any failure path", () => {
  // Spec AC1: no substring matching engine internals in any 4xx/5xx body.
  const ENGINE_RE = /SQLite|D1_ERROR|constraint failed|no such (table|column)|unique|check constraint|sqlite|d1_/i;

  async function expectSanitized(res: Response, status: number, code: string) {
    expect(res.status).toBe(status);
    const text = await res.text();
    expect(text).not.toMatch(ENGINE_RE);
    expect(JSON.parse(text)).toEqual({ error: { code, message: expect.any(String) } });
  }

  it("PATCH band to a duplicate name returns 409 conflict without engine text", async () => {
    const res = await app.request(
      "/api/bands/b2",
      { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Saetia" }) },
      ENV,
    );
    await expectSanitized(res, 409, "conflict");
  });

  it("members validation failure returns 422 without engine text", async () => {
    const res = await app.request(
      "/api/members",
      { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({}) },
      ENV,
    );
    await expectSanitized(res, 422, "invalid");
  });

  it("releases PATCH to a missing band returns 422 without engine text", async () => {
    const res = await app.request(
      "/api/releases/r1",
      {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ band_id: "missing-band" }),
      },
      ENV,
    );
    await expectSanitized(res, 422, "invalid");
  });

  it("media-links insert with a missing parent returns 422 without engine text", async () => {
    const res = await app.request(
      "/api/media-links",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_id: "missing-release", provider: "bandcamp", url: "https://example.com/x" }),
      },
      ENV,
    );
    await expectSanitized(res, 422, "invalid");
  });

  it("media-links PATCH to a missing parent returns 422 without engine text", async () => {
    const created = await app.request(
      "/api/media-links",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_id: "r1", provider: "bandcamp", url: "https://example.com/r" }),
      },
      ENV,
    );
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };
    const res = await app.request(
      `/api/media-links/${data.id}`,
      {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ release_id: "missing-release", band_id: null }),
      },
      ENV,
    );
    await expectSanitized(res, 422, "invalid");
  });

  it("thrown errors return 500 internal without leaking the message", async () => {
    // Fresh app: Hono freezes routing after the first request, so the
    // throwing route must be registered before any request is served.
    // onError wiring under test is the real one from createApp().
    const boom = createApp();
    boom.get("/api/__boom", () => {
      throw new Error("SQLite boom: no such table: secret_schema");
    });
    const res = await boom.request("/api/__boom", {}, ENV);
    await expectSanitized(res, 500, "internal");
  });

  it("unknown routes return the 404 envelope", async () => {
    const res = await app.request("/api/does-not-exist", {}, ENV);
    await expectSanitized(res, 404, "not_found");
  });
});

describe("issue #38: length-independent token compare", () => {
  it("tokensEqual accepts equal tokens", async () => {
    await expect(tokensEqual(TOKEN, TOKEN)).resolves.toBe(true);
    await expect(tokensEqual("", "")).resolves.toBe(true);
    await expect(tokensEqual("tøst-íngestion-tøken", "tøst-íngestion-tøken")).resolves.toBe(true);
  });

  it("tokensEqual rejects mismatches of any length, empty, and unicode", async () => {
    await expect(tokensEqual("wrong-ingestion-token!", TOKEN)).resolves.toBe(false);
    await expect(tokensEqual("x", TOKEN)).resolves.toBe(false);
    await expect(tokensEqual("", TOKEN)).resolves.toBe(false);
    await expect(tokensEqual("tøst-íngestion-tøken", TOKEN)).resolves.toBe(false);
  });

  it("single-char token returns the 401 envelope", async () => {
    const res = await app.request(
      "/api/bands",
      { method: "POST", headers: { Authorization: "Bearer x" }, body: JSON.stringify({ name: "X" }) },
      ENV,
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "Valid ingestion token required" },
    });
  });

  it("unset INGESTION_TOKEN returns the 500 envelope", async () => {
    const res = await app.request(
      "/api/bands",
      { method: "POST", headers: { ...auth }, body: JSON.stringify({ name: "X" }) },
      { DB: ENV.DB, INGESTION_TOKEN: "" },
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "server_misconfigured", message: "Ingestion token is not configured" },
    });
  });
});
