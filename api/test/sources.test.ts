import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type D1Database, type D1PreparedStatement } from "../src/index";

// Detail readers serve claim_sources alongside data (additive `sources`
// key). Real-SQL coverage like crud.test.ts: migrations apply to
// node:sqlite and the Hono app talks through a D1-shaped adapter.
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
const ENV = { DB: null as unknown as D1Database };

function source(
  db: Db,
  id: string,
  entityType: string,
  entityId: string,
  field: string,
  value: string,
  status: string,
) {
  db.prepare(
    "INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at, note) VALUES (?, ?, ?, ?, ?, ?, 1, 'https://example.com/x', '2026-01-01', 'internal note')",
  ).run(id, entityType, entityId, field, value, status);
}

let db: Db;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b1", "Saetia", "saetia");
  db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b2", "Orchid", "orchid");
  db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m1", "Billy Werner", "billy werner");
  db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type) VALUES (?, ?, ?, ?, ?)").run(
    "r1",
    "b1",
    "Saetia",
    "saetia",
    "LP",
  );
  db.prepare("INSERT INTO band_members (id, band_id, member_id, role) VALUES (?, ?, ?, ?)").run(
    "bm1",
    "b1",
    "m1",
    "vocals",
  );
  db.prepare("INSERT INTO media_links (id, band_id, provider, url) VALUES (?, ?, ?, ?)").run(
    "ml1",
    "b1",
    "bandcamp",
    "https://example.com/b1",
  );
  db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run(
    "ml2",
    "r1",
    "bandcamp",
    "https://example.com/r1",
  );
  source(db, "cs1", "band", "b1", "name", "Saetia", "confirmed");
  source(db, "cs2", "band", "b1", "name", "Saetia VAT", "disputed");
  source(db, "cs3", "member", "m1", "name", "Billy Werner", "confirmed");
  source(db, "cs4", "band_member", "bm1", "role", "vocals", "confirmed");
  source(db, "cs5", "band_member", "bm1", "role", "guitar", "disputed");
  source(db, "cs6", "release", "r1", "title", "Saetia", "confirmed");
  source(db, "cs7", "media_link", "ml1", "url", "https://example.com/b1", "confirmed");
  source(db, "cs8", "media_link", "ml2", "url", "https://example.com/r1", "disputed");
  ENV.DB = adapter(db);
});
afterEach(() => {
  db.close();
});

type SourceRow = { id: string; entity_type: string; entity_id: string; status: string };

function expectNoNotes(sources: SourceRow[]) {
  for (const row of sources) {
    expect(row).not.toHaveProperty("note");
  }
}

describe("readers serve sources", () => {
  it("band detail returns winner + disputed rival rows", async () => {
    const res = await app.request("/api/bands/b1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: unknown;
      members: Record<string, unknown>[];
      releases: unknown[];
      media_links: unknown[];
      sources: SourceRow[];
    };
    expect(Object.keys(json).sort()).toEqual(["data", "media_links", "members", "releases", "sources"]);
    const ids = json.sources.map((s) => s.id).sort();
    expect(ids).toEqual(["cs1", "cs2", "cs3", "cs4", "cs5", "cs6", "cs7"]);
    const rival = json.sources.find((s) => s.id === "cs2");
    expect(rival?.status).toBe("disputed");
    expectNoNotes(json.sources);
    expect(json.members[0]).not.toHaveProperty("band_member_id");
  });

  it("sourceless band returns an empty array without error", async () => {
    const res = await app.request("/api/bands/b2", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { sources: unknown[] };
    expect(json.sources).toEqual([]);
  });

  it("missing band stays a 404", async () => {
    const res = await app.request("/api/bands/nope", {}, ENV);
    expect(res.status).toBe(404);
  });

  it("member detail returns member + edge rows, rivals included", async () => {
    const res = await app.request("/api/members/m1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: unknown;
      bands: Record<string, unknown>[];
      sources: SourceRow[];
    };
    expect(Object.keys(json).sort()).toEqual(["bands", "data", "sources"]);
    expect(json.sources.map((s) => s.id).sort()).toEqual(["cs3", "cs4", "cs5"]);
    expect(json.bands[0]).not.toHaveProperty("band_member_id");
    expectNoNotes(json.sources);
  });

  it("release detail returns release + media rows, rivals included", async () => {
    const res = await app.request("/api/releases/r1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: unknown;
      media_links: unknown[];
      sources: SourceRow[];
    };
    expect(Object.keys(json).sort()).toEqual(["data", "media_links", "sources"]);
    expect(json.sources.map((s) => s.id).sort()).toEqual(["cs6", "cs8"]);
    expectNoNotes(json.sources);
  });

  it("media-link detail returns its own rows, rivals included", async () => {
    const res = await app.request("/api/media-links/ml2", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Record<string, unknown>; sources: SourceRow[] };
    expect(Object.keys(json).sort()).toEqual(["data", "sources"]);
    expect(json.data.id).toBe("ml2");
    expect(json.sources.map((s) => s.id)).toEqual(["cs8"]);
    expectNoNotes(json.sources);
  });

  it("missing media link returns 404", async () => {
    const res = await app.request("/api/media-links/nope", {}, ENV);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("search stays keyword-only with no sources key", async () => {
    const res = await app.request("/api/search?q=saetia", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { hits: unknown[]; nextCursor: unknown };
    expect(Object.keys(json).sort()).toEqual(["hits", "nextCursor"]);
    expect(json.hits.length).toBeGreaterThan(0);
  });
});
