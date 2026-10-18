import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Applies the real api/migrations/*.sql files (in order) to a local SQLite
// database — the same engine D1/miniflare uses locally — via Node's built-in
// node:sqlite, so constraint/cascade semantics are observed, not mocked.
// Requires Node >= 22 (repo toolchain); FK enforcement is enabled explicitly
// because SQLite FKs are connection-scoped (PRAGMA foreign_keys).
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

function migratedDb(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

function seed(db: Db) {
  db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b1", "Saetia", "saetia");
  db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m1", "Billy Werner", "billy werner");
  db.prepare("INSERT INTO band_members (id, band_id, member_id, role, joined_year) VALUES (?, ?, ?, ?, ?)").run("bm1", "b1", "m1", "vocals", 1997);
  db.prepare("INSERT INTO releases (id, band_id, title, title_norm, release_type, release_year) VALUES (?, ?, ?, ?, ?, ?)").run("r1", "b1", "Saetia", "saetia", "LP", 1998);
}

const EXPECTED_INDEXES = [
  "idx_band_members_band",
  "idx_band_members_member",
  "idx_bands_norm",
  "idx_claim_sources_lookup",
  "idx_media_band",
  "idx_media_release",
  "idx_releases_band",
  "idx_releases_title_norm",
  "ux_band_members_nullsafe_dedupe",
];

describe("0002_five_tables migration (real DDL applied to local SQLite/D1-like DB)", () => {
  let db: Db;
  beforeEach(() => {
    db = migratedDb();
  });
  afterEach(() => {
    db.close();
  });

  it("creates all five tables", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["band_members", "bands", "media_links", "members", "releases"]));
  });

  it("has exactly the expected named indexes", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE 'idx_%' OR name LIKE 'ux_%') ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(names).toEqual(EXPECTED_INDEXES);
  });

  it("rejects a double-parent media_links insert", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO media_links (id, release_id, band_id, provider, url) VALUES (?, ?, ?, ?, ?)").run("x1", "r1", "b1", "bandcamp", "https://example.com"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("rejects a neither-parent media_links insert", () => {
    expect(() =>
      db.prepare("INSERT INTO media_links (id, provider, url) VALUES (?, ?, ?)").run("x2", "bandcamp", "https://example.com"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("accepts single-parent media_links inserts (release-only and band-only)", () => {
    seed(db);
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run("x3", "r1", "bandcamp", "https://example.com/r");
    db.prepare("INSERT INTO media_links (id, band_id, provider, url) VALUES (?, ?, ?, ?)").run("x4", "b1", "youtube", "https://example.com/b");
    expect(db.prepare("SELECT COUNT(*) AS n FROM media_links").get()?.n).toBe(2);
  });

  it("enforces ON DELETE CASCADE from bands to children when FKs are on", () => {
    seed(db);
    db.prepare("INSERT INTO media_links (id, band_id, provider, url) VALUES (?, ?, ?, ?)").run("x5", "b1", "youtube", "https://example.com/b");
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run("x6", "r1", "bandcamp", "https://example.com/r");
    db.prepare("DELETE FROM bands WHERE id = ?").run("b1");
    for (const table of ["band_members", "releases", "media_links"]) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n, table).toBe(0);
    }
    // members are not cascaded away by a band delete.
    expect(db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n).toBe(1);
  });

  it("rejects duplicate band name differing only by case (COLLATE NOCASE unique)", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b2", "SAETIA", "saetia2"),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it("rejects duplicate band_members with NULL role/joined_year (issue #20)", () => {
    seed(db);
    db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm-null-1", "b1", "m1");
    expect(() =>
      db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm-null-2", "b1", "m1"),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it("rejects duplicate band_members in every NULL combination (issue #20)", () => {
    seed(db);
    // Non-NULL role and year (seed row is bm1 = b1/m1/vocals/1997)
    expect(() =>
      db.prepare("INSERT INTO band_members (id, band_id, member_id, role, joined_year) VALUES (?, ?, ?, ?, ?)").run("bm-full-2", "b1", "m1", "vocals", 1997),
    ).toThrow(/UNIQUE constraint failed/i);
    // NULL role, non-NULL year
    db.prepare("INSERT INTO band_members (id, band_id, member_id, joined_year) VALUES (?, ?, ?, ?)").run("bm-ny-1", "b1", "m1", 2000);
    expect(() =>
      db.prepare("INSERT INTO band_members (id, band_id, member_id, joined_year) VALUES (?, ?, ?, ?)").run("bm-ny-2", "b1", "m1", 2000),
    ).toThrow(/UNIQUE constraint failed/i);
    // Non-NULL role, NULL year
    db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run("m2", "Jane Doe", "jane doe");
    db.prepare("INSERT INTO band_members (id, band_id, member_id, role) VALUES (?, ?, ?, ?)").run("bm-nr-1", "b1", "m2", "drums");
    expect(() =>
      db.prepare("INSERT INTO band_members (id, band_id, member_id, role) VALUES (?, ?, ?, ?)").run("bm-nr-2", "b1", "m2", "drums"),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it("still allows distinct band_members rows (no false dedupe)", () => {
    seed(db);
    // Existing seed row is (b1, m1, 'vocals', 1997); these differ in one column each.
    db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run("bm-ok-1", "b1", "m1");
    db.prepare("INSERT INTO band_members (id, band_id, member_id, role, joined_year) VALUES (?, ?, ?, ?, ?)").run("bm-ok-2", "b1", "m1", "guitar", 1997);
    db.prepare("INSERT INTO band_members (id, band_id, member_id, role, joined_year) VALUES (?, ?, ?, ?, ?)").run("bm-ok-3", "b1", "m1", "vocals", 1999);
    expect(db.prepare("SELECT COUNT(*) AS n FROM band_members").get()?.n).toBe(4);
  });

  it("rejects an invalid release_type", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO releases (id, band_id, title, release_type) VALUES (?, ?, ?, ?)").run("r2", "b1", "Demo Tape", "7inch"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("rejects a NULL release_type (NOT NULL since issue #21)", () => {
    seed(db);
    expect(() =>
      db.prepare("INSERT INTO releases (id, band_id, title) VALUES (?, ?, ?)").run("r2", "b1", "Untyped Tape"),
    ).toThrow(/NOT NULL constraint failed/i);
    expect(() =>
      db.prepare("INSERT INTO releases (id, band_id, title, release_type) VALUES (?, ?, ?, ?)").run("r2", "b1", "Untyped Tape", null),
    ).toThrow(/NOT NULL constraint failed/i);
  });

  it("keeps media_links children across the 0003 rebuild", () => {
    seed(db);
    db.prepare("INSERT INTO media_links (id, release_id, provider, url) VALUES (?, ?, ?, ?)").run("x1", "r1", "bandcamp", "https://example.com/r");
    expect(db.prepare("SELECT release_type AS t FROM releases WHERE id = ?").get("r1")?.t).toBe("LP");
    expect(db.prepare("SELECT COUNT(*) AS n FROM media_links").get()?.n).toBe(1);
  });

  it("0004 backfills title_norm for pre-existing releases (no NULLs, indexed)", () => {
    // Old-schema DB (migrations before 0004 have no title_norm): insert a
    // release, then apply 0004 and check the backfill.
    const old = new DatabaseSync(":memory:");
    old.exec("PRAGMA foreign_keys = ON;");
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
      if (file >= "0004") continue;
      old.exec(readFileSync(join(migrationsDir, file), "utf8"));
    }
    old.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("b1", "Saetia", "saetia");
    old.prepare("INSERT INTO releases (id, band_id, title, release_type) VALUES (?, ?, ?, ?)").run("r-old", "b1", "Dark-Side! EP", "EP");
    old.exec(readFileSync(join(migrationsDir, "0004_releases_title_norm.sql"), "utf8"));
    const row = old.prepare("SELECT title_norm AS n FROM releases WHERE id = ?").get("r-old") as { n: unknown } | undefined;
    expect(typeof row?.n).toBe("string");
    expect((row?.n as string).length).toBeGreaterThan(0);
    expect(old.prepare("SELECT COUNT(*) AS n FROM releases WHERE title_norm IS NULL").get()?.n).toBe(0);
    expect(old.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_releases_title_norm'").all()).toHaveLength(1);
    old.close();
  });

  it("0005 creates claim_sources with UNIQUE + CHECK guards, defaults, and the lookup index", () => {
    seed(db);
    const insert =
      "INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    db.prepare(insert).run("cs1", "band", "b1", "formed_year", "1997", "confirmed", 1, "https://example.com", "2026-10-18");
    expect(db.prepare("SELECT COUNT(*) AS n FROM claim_sources").get()?.n).toBe(1);
    // A losing rival (same field, different value) is kept.
    db.prepare(insert).run("cs2", "band", "b1", "formed_year", "1998", "disputed", 3, "https://example.com/tip", "2026-10-18");
    expect(db.prepare("SELECT COUNT(*) AS n FROM claim_sources").get()?.n).toBe(2);
    // An exact dupe (same entity, field, value, source) violates UNIQUE.
    expect(() =>
      db.prepare(insert).run("cs3", "band", "b1", "formed_year", "1997", "confirmed", 1, "https://example.com", "2026-10-18"),
    ).toThrow(/UNIQUE constraint failed/i);
    // Tier outside 1-3 violates CHECK.
    expect(() =>
      db.prepare(insert).run("cs4", "band", "b1", "formed_year", "1999", "confirmed", 4, "https://example.com", "2026-10-18"),
    ).toThrow(/CHECK constraint failed/i);
    // Unknown status violates CHECK.
    expect(() =>
      db.prepare(insert).run("cs5", "band", "b1", "formed_year", "1999", "rumored", 2, "https://example.com", "2026-10-18"),
    ).toThrow(/CHECK constraint failed/i);
    // Unknown entity_type violates CHECK.
    expect(() =>
      db.prepare(insert).run("cs6", "label", "b1", "founded", "1990", "confirmed", 2, "https://example.com", "2026-10-18"),
    ).toThrow(/CHECK constraint failed/i);
    // created_at + updated_at default.
    const row = db.prepare("SELECT created_at AS c, updated_at AS u FROM claim_sources WHERE id = ?").get("cs1") as
      | { c: unknown; u: unknown }
      | undefined;
    expect(typeof row?.c).toBe("string");
    expect(typeof row?.u).toBe("string");
    // Lookup index exists.
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_claim_sources_lookup'").all()).toHaveLength(1);
  });
});
