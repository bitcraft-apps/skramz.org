import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Applies the real api/migrations/*.sql and then the real api/seeds files
// (in documented apply order) to a local SQLite database — the same engine
// D1/miniflare uses locally — via Node's built-in node:sqlite, so the
// shared-member scheme is observed, not mocked. Requires Node >= 22 (repo
// toolchain); FK enforcement is enabled explicitly because SQLite FKs are
// connection-scoped (PRAGMA foreign_keys).
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

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const seedsDir = join(here, "..", "seeds");

// Shared members first, then band files in an order that proves no sibling
// dependency: yaphet-kotto applies before saetia even though Steve Roche
// plays in both (his row lives in the shared seed, not in saetia's file).
// Member-id assertions only need person rows + edges; the full order below
// additionally covers links/evidence for the clean-verify test.
const CORE_SEEDS = [
  ["members", "001-shared.sql"],
  ["pg-99", "001-band.sql"],
  ["yaphet-kotto", "001-band.sql"],
  ["saetia", "001-band.sql"],
] as const;
const SEED_ORDER = [
  ...CORE_SEEDS,
  ["pg-99", "002-links.sql"],
  ["yaphet-kotto", "002-links.sql"],
  ["saetia", "002-links.sql"],
  ["yaphet-kotto", "003-evidence.sql"],
] as const;

function seededDb(order: readonly (readonly [string, string])[] = SEED_ORDER): Db {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  for (const [band, name] of order) {
    db.exec(readFileSync(join(seedsDir, band, name), "utf8"));
  }
  return db;
}

function verifyRows(db: Db): Record<string, unknown>[] {
  return readFileSync(join(seedsDir, "_verify.sql"), "utf8")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .flatMap((stmt) => db.prepare(stmt).all());
}

describe("seeds (real seed files applied shared-first to local SQLite/D1-like DB)", () => {
  let db: Db;
  beforeEach(() => {
    db = seededDb(CORE_SEEDS);
  });
  afterEach(() => {
    db.close();
  });

  it("verifies clean: no orphan edges, no orphan evidence", () => {
    const full = seededDb();
    try {
      expect(verifyRows(full)).toEqual([]);
    } finally {
      full.close();
    }
  });

  it("shares one neutral person row across Saetia and Yaphet Kotto", () => {
    const rows = db
      .prepare("SELECT id FROM members WHERE name_norm = ?")
      .all("steve roche");
    expect(rows.map((r) => r.id)).toEqual(["m-steve-roche"]);
    const edgeBands = db
      .prepare("SELECT DISTINCT band_id AS b FROM band_members WHERE member_id = ? ORDER BY b")
      .all("m-steve-roche")
      .map((r) => r.b);
    expect(edgeBands).toEqual(["band-saetia", "band-yaphet-kotto"]);
  });

  it("keeps the Saetia/Yaphet graph join working through the shared row", () => {
    const pairs = db
      .prepare(
        `SELECT DISTINCT bm1.band_id AS a, bm2.band_id AS b
         FROM band_members bm1 JOIN band_members bm2 ON bm2.member_id = bm1.member_id
         WHERE bm1.band_id = 'band-saetia' AND bm2.band_id = 'band-yaphet-kotto'`,
      )
      .all();
    expect(pairs).toHaveLength(1);
  });

  it("keeps every member id band-neutral", () => {
    expect(db.prepare("SELECT id FROM members WHERE id NOT LIKE 'm-%'").all()).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n).toBe(22);
  });
});

describe("0008_member_ids_neutral migration (old prod shape remapped in place)", () => {
  const MIGRATION_0008 = "0008_member_ids_neutral.sql";

  function oldShapedDb(): Db {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
      if (file >= MIGRATION_0008) continue;
      db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    }
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("band-saetia", "Saetia", "saetia");
    db.prepare("INSERT INTO bands (id, name, name_norm) VALUES (?, ?, ?)").run("band-yaphet-kotto", "Yaphet Kotto", "yaphet kotto");
    db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run(
      "saetia-m-steve-roche",
      "Steve Roche",
      "steve roche",
    );
    db.prepare("INSERT INTO members (id, name, name_norm) VALUES (?, ?, ?)").run(
      "yaphet-kotto-m-keith-miller",
      "Keith Miller",
      "keith miller",
    );
    db.prepare("INSERT INTO band_members (id, band_id, member_id, role) VALUES (?, ?, ?, ?)").run(
      "saetia-bm-steve-roche",
      "band-saetia",
      "saetia-m-steve-roche",
      "bass",
    );
    db.prepare("INSERT INTO band_members (id, band_id, member_id, role) VALUES (?, ?, ?, ?)").run(
      "yaphet-kotto-bm-steve-roche",
      "band-yaphet-kotto",
      "saetia-m-steve-roche",
      "bass",
    );
    db.prepare("INSERT INTO band_members (id, band_id, member_id) VALUES (?, ?, ?)").run(
      "yaphet-kotto-bm-keith-miller",
      "band-yaphet-kotto",
      "yaphet-kotto-m-keith-miller",
    );
    db.prepare(
      "INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "yaphet-kotto-cs-name-keith-a",
      "member",
      "yaphet-kotto-m-keith-miller",
      "name",
      "Keith Milller",
      "disputed",
      2,
      "https://www.discogs.com/artist/445131-Yaphet-Kotto",
      "2026-10-20",
    );
    return db;
  }

  it("remaps band-prefixed ids to neutral slugs with edges and evidence intact", () => {
    const db = oldShapedDb();
    try {
      db.exec(readFileSync(join(migrationsDir, MIGRATION_0008), "utf8"));
      expect(db.prepare("SELECT id FROM members ORDER BY id").all().map((r) => r.id)).toEqual([
        "m-keith-miller",
        "m-steve-roche",
      ]);
      expect(db.prepare("SELECT DISTINCT band_id AS b FROM band_members WHERE member_id = ? ORDER BY b").all("m-steve-roche").map((r) => r.b)).toEqual([
        "band-saetia",
        "band-yaphet-kotto",
      ]);
      expect(
        db.prepare("SELECT entity_id AS e FROM claim_sources WHERE id = ?").get("yaphet-kotto-cs-name-keith-a")?.e,
      ).toBe("m-keith-miller");
      expect(verifyRows(db)).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("is a no-op on databases already on neutral ids", () => {
    const db = seededDb();
    try {
      const before = {
        members: db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n,
        edges: db.prepare("SELECT COUNT(*) AS n FROM band_members").get()?.n,
        evidence: db.prepare("SELECT COUNT(*) AS n FROM claim_sources").get()?.n,
      };
      db.exec(readFileSync(join(migrationsDir, MIGRATION_0008), "utf8"));
      expect(db.prepare("SELECT COUNT(*) AS n FROM members").get()?.n).toBe(before.members);
      expect(db.prepare("SELECT COUNT(*) AS n FROM band_members").get()?.n).toBe(before.edges);
      expect(db.prepare("SELECT COUNT(*) AS n FROM claim_sources").get()?.n).toBe(before.evidence);
      expect(verifyRows(db)).toEqual([]);
    } finally {
      db.close();
    }
  });
});
