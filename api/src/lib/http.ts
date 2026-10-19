import type { Context, Hono } from "hono";
import type { Bindings, D1Database } from "./db";

export type App = Hono<{ Bindings: Bindings }>;

type AppContext = Context<{ Bindings: Bindings }>;

export const RELEASE_TYPES = ["LP", "EP", "Split", "Demo", "Single", "Compilation"] as const;

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;

export const DEFAULT_GRAPH_DEPTH = 3;
export const MAX_GRAPH_DEPTH = 4;
export const GRAPH_LIMIT = 500;

export function parseDepth(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return DEFAULT_GRAPH_DEPTH;
  return Math.min(Math.max(n, 1), MAX_GRAPH_DEPTH);
}

// Map raw SQLite/D1 engine errors to stable public responses.
// Never returns engine text; callers log the raw error server-side.
export function publicWriteError(
  err: unknown,
  op: "insert" | "update",
): { status: 409 | 422; code: string; message: string } {
  console.error(op === "insert" ? "Insert failed" : "Update failed", err);
  const raw = err instanceof Error ? err.message : (err as { message?: unknown } | null)?.message ?? err;
  const msg = String(raw ?? "");
  if (/unique constraint/i.test(msg)) {
    return { status: 409, code: "conflict", message: "Resource already exists" };
  }
  if (/check constraint/i.test(msg)) {
    return { status: 422, code: "invalid", message: "Value violates a database check" };
  }
  if (/foreign key/i.test(msg)) {
    return { status: 422, code: "invalid", message: "Referenced record does not exist" };
  }
  if (/not null/i.test(msg)) {
    return { status: 422, code: "invalid", message: "A required field is missing" };
  }
  return {
    status: 422,
    code: "invalid",
    message: op === "insert" ? "Insert failed" : "Update failed",
  };
}

export function publicInternalError(): { status: 500; code: string; message: string } {
  return { status: 500, code: "internal", message: "Internal server error" };
}

export function publicD1Unavailable(): { status: 500; code: string; message: string } {
  return { status: 500, code: "d1_unavailable", message: "D1 unavailable" };
}

// Lowercase, de-punctuated search target for `name_norm` (LIKE-search target
// per the schema). Server-computed on writes; client-supplied values ignored.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Escape LIKE wildcards so `?search=` is a literal substring match.
export function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Timing-safe string compare for the ingestion Bearer [REDACTED] Both sides
// are hashed to a fixed-length SHA-256 digest before comparing, so rejection
// cost does not depend on the presented token's length (no early length
// return). Async: crypto.subtle is Workers-safe.
const enc = new TextEncoder();

export async function tokensEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const xa = new Uint8Array(da);
  const xb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) {
    diff |= xa[i] ^ xb[i];
  }
  return diff === 0;
}

export function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function readBody(c: AppContext): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false }> {
  try {
    const parsed = await c.req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

// One bounded sidecar read per detail response: winners and disputed
// rivals alike, unfiltered (absence of a row is the unconfirmed signal).
// The note column stays internal and is never selected.
export type ClaimSourceRef = { entity_type: string; entity_id: string };

export type ClaimSourceRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  value: string | null;
  status: string;
  tier: number;
  source_url: string;
  accessed_at: string;
  created_at: string;
  updated_at: string;
};

const CLAIM_ENTITY_TYPES = new Set(["band", "member", "band_member", "release", "media_link"]);

export async function fetchClaimSources(
  db: D1Database,
  refs: ClaimSourceRef[],
): Promise<ClaimSourceRow[]> {
  const byType = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref.entity_id || !CLAIM_ENTITY_TYPES.has(ref.entity_type)) continue;
    const ids = byType.get(ref.entity_type) ?? [];
    ids.push(ref.entity_id);
    byType.set(ref.entity_type, ids);
  }
  if (byType.size === 0) return [];
  const clauses: string[] = [];
  const vals: unknown[] = [];
  for (const [type, ids] of byType) {
    clauses.push(`(entity_type = ? AND entity_id IN (${ids.map(() => "?").join(", ")}))`);
    vals.push(type, ...ids);
  }
  const rows = await db
    .prepare(
      `SELECT id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at, created_at, updated_at FROM claim_sources WHERE ${clauses.join(" OR ")} ORDER BY entity_type, entity_id, field LIMIT 200`,
    )
    .bind(...vals)
    .all<ClaimSourceRow>();
  return rows.results;
}

// Writes require `Authorization: Bearer <INGESTION_TOKEN>` (timing-safe
// compare, 401 otherwise). Token comes from `wrangler secret` — never git.
export async function requireAuth(c: AppContext): Promise<Response | null> {
  const token = c.env.INGESTION_TOKEN;
  if (!token) {
    return c.json(
      { error: { code: "server_misconfigured", message: "Ingestion token is not configured" } },
      500,
    );
  }
  const header = c.req.header("Authorization") ?? "";
  const prefix = "Bearer ";
  const presented = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  if (!presented || !(await tokensEqual(presented, token))) {
    return c.json(
      { error: { code: "unauthorized", message: "Valid ingestion token required" } },
      401,
    );
  }
  return null;
}
