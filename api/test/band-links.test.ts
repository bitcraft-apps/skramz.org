import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type D1Database, type D1PreparedStatement } from "../src/index";

// Same real-SQL harness as crud.test.ts: actual api/migrations/*.sql applied
// to node:sqlite behind a D1-shaped adapter.
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

function postLink(body: unknown, headers: Record<string, string> = { ...auth, "Content-Type": "application/json" }) {
  return app.request("/api/band-links", { method: "POST", headers, body: JSON.stringify(body) }, ENV);
}

describe("band_links table (real DDL)", () => {
  it("creates band_links with the band index", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='band_links'")
      .all()
      .map((r) => r.name);
    expect(names).toEqual(["band_links"]);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_band_links_band'").all(),
    ).toHaveLength(1);
  });

  it("rejects an unknown portal via CHECK", () => {
    expect(() =>
      db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "youtube", "https://example.com"),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("rejects duplicate (band_id, portal, url) via UNIQUE", () => {
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "discogs", "https://www.discogs.com/artist/1-X");
    expect(() =>
      db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x2", "b1", "discogs", "https://www.discogs.com/artist/1-X"),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it("cascades band delete to band_links", () => {
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "rym", "https://rateyourmusic.com/artist/x");
    db.prepare("DELETE FROM bands WHERE id = ?").run("b1");
    expect(db.prepare("SELECT COUNT(*) AS n FROM band_links").get()?.n).toBe(0);
  });

  it("link writes stamp the row and touch the parent band", () => {
    const OLD = "2000-01-01T00:00:00.000Z";
    db.prepare("UPDATE bands SET updated_at = ? WHERE id = ?").run(OLD, "b1");
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "musicbrainz", "https://musicbrainz.org/artist/1");
    expect(db.prepare("SELECT updated_at AS u FROM band_links WHERE id = ?").get("x1")?.u).not.toBeNull();
    expect(db.prepare("SELECT updated_at AS u FROM bands WHERE id = ?").get("b1")?.u).not.toBe(OLD);
  });
});

describe("POST /api/band-links", () => {
  it("creates a link (201) for a valid https portal URL", async () => {
    const res = await postLink({ band_id: "b1", portal: "discogs", url: "https://www.discogs.com/artist/123-Saetia" });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: Record<string, unknown> };
    expect(json.data.portal).toBe("discogs");
  });

  it("rejects non-https URLs (422)", async () => {
    const res = await postLink({ band_id: "b1", portal: "discogs", url: "http://www.discogs.com/artist/123" });
    expect(res.status).toBe(422);
  });

  it("rejects off-allowlist hosts (422)", async () => {
    const res = await postLink({ band_id: "b1", portal: "discogs", url: "https://example.com/artist/123" });
    expect(res.status).toBe(422);
  });

  it("rejects unknown portals (422)", async () => {
    const res = await postLink({ band_id: "b1", portal: "youtube", url: "https://www.youtube.com/@x" });
    expect(res.status).toBe(422);
  });

  it("rejects inherited-property portals without crashing (422, not 500)", async () => {
    for (const portal of ["toString", "constructor", "__proto__"]) {
      const res = await postLink({ band_id: "b1", portal, url: "https://www.discogs.com/artist/123" });
      expect(res.status).toBe(422);
    }
  });

  it("rejects missing band links with FK 422 and no engine text", async () => {
    const res = await postLink({ band_id: "nope", portal: "rym", url: "https://rateyourmusic.com/artist/x" });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.message).not.toMatch(/FOREIGN KEY/i);
  });

  it("requires auth (401 without token)", async () => {
    const res = await app.request(
      "/api/band-links",
      { method: "POST", body: JSON.stringify({ band_id: "b1", portal: "rym", url: "https://rateyourmusic.com/artist/x" }) },
      ENV,
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/bands/:id embeds links", () => {
  it("returns links[] with no extra request", async () => {
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "discogs", "https://www.discogs.com/artist/1-X");
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x2", "b1", "rym", "https://rateyourmusic.com/artist/x");
    const res = await app.request("/api/bands/b1", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { links: { portal: string; url: string }[] };
    expect(json.links).toEqual([
      { portal: "discogs", url: "https://www.discogs.com/artist/1-X" },
      { portal: "rym", url: "https://rateyourmusic.com/artist/x" },
    ]);
  });

  it("returns an empty links[] when the band has none", async () => {
    const res = await app.request("/api/bands/b2", {}, ENV);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { links: unknown[] };
    expect(json.links).toEqual([]);
  });
});

describe("PATCH /api/band-links/:id", () => {
  it("rejects a url-only patch that leaves the allowlist (422)", async () => {
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "discogs", "https://www.discogs.com/artist/1-X");
    const res = await app.request(
      "/api/band-links/x1",
      { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://example.com/evil" }) },
      ENV,
    );
    expect(res.status).toBe(422);
  });

  it("accepts a valid url patch (200)", async () => {
    db.prepare("INSERT INTO band_links (id, band_id, portal, url) VALUES (?, ?, ?, ?)").run("x1", "b1", "discogs", "https://www.discogs.com/artist/1-X");
    const res = await app.request(
      "/api/band-links/x1",
      { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://www.discogs.com/artist/2-Y" }) },
      ENV,
    );
    expect(res.status).toBe(200);
  });
});
