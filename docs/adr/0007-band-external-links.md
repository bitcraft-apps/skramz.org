# 0007: Band external profile links

- Status: proposed
- Date: 2026-10-19 (issue #94)

## Context

Band profiles have no way to link out to canonical external profiles
(MusicBrainz, Discogs, RateYourMusic). V1 adds these three portals,
shown as an icon strip under the band header. More portals (YouTube,
streaming, Bandcamp, official sites, merch) are coming next, so the
schema and the icon map must accept new portals without rework.
Everything stays inside the free-tier walls (ADR-0001): no extra
requests per page, `LIMIT`-bounded reads, portable SQLite.

## Decision

- Table `band_links` (migration `0007_band_links.sql`, portable SQLite,
  no seed rows in the migration): `id TEXT PK`, `band_id TEXT NOT NULL
  REFERENCES bands(id) ON DELETE CASCADE`, `portal TEXT NOT NULL CHECK
  (portal IN ('musicbrainz', 'discogs', 'rym'))`, `url TEXT NOT NULL`,
  `created_at` / `updated_at`, `UNIQUE (band_id, portal, url)`, index
  `idx_band_links_band` on `band_id`.
- Freshness follows ADR-0006 conventions: insert/update triggers
  self-stamp the row (explicit writes win) and touch the parent band's
  `updated_at`.
- API (route module `src/routes/band-links.ts`, per ADR-0002):
  `POST /api/band-links` and `PATCH /api/band-links/:id`
  (auth + `publicWriteError` envelope per ADR-0003). Writes validate
  `https:` plus a portal host allowlist (`PORTAL_HOSTS`:
  `musicbrainz.org`, `discogs.com`, `rateyourmusic.com`, apex or any
  subdomain); PATCH merges with the stored row before validating, so a
  url-only patch still checks against the stored portal. Adding a
  portal is one allowlist entry + one DDL `CHECK` value + one web
  icon-map entry.
- Reads: `GET /bands/:id` embeds `links: [{portal, url}]` (ordered,
  `LIMIT 50`) — no extra request.
- Seeds: example inserts live commented in `api/seeds/templates/band_links.sql`
  (per-band files via `task seed`); `_verify.sql` rejects orphan
  `band_links` rows. Link URLs are factual claims, so writes follow
  `docs/content-policy.md`.
- Web: `ElsewhereStrip` in `encyclopedia.tsx` — brutalist bordered
  buttons, `currentColor` inline SVG, `aria-label` + `title`, text
  fallback (`MB` / `DISCOGS` / `RYM`), `target="_blank"
  rel="noopener noreferrer"`. Hidden entirely when `links` is empty.
  MusicBrainz + Discogs marks are the official Simple Icons paths
  (CC0, source URLs in a code comment — never redrawn); RYM has no
  Simple Icons entry, so it uses a generic disc glyph + text label.
  Server state via TanStack Query (`BandDetail.links` in `hooks.ts`);
  no player-structure change, so layout persistence (uninterrupted
  audio) is untouched.

## Consequences

- One bounded indexed lookup per band page, inside the free-tier
  budget; deleting a band cascades its links.
- V1 ships no rows/UI for future portals and no profile-editor or CLI
  write path (writes via seeds/API only); no live portal-API fetching.
- Regression cover: `api/test/band-links.test.ts` (validation, embed,
  cascade) + `api/test/migrations.test.ts` (`EXPECTED_INDEXES`) +
  `web/src/encyclopedia.test.tsx` (strip renders 0–3 icons, hides when
  empty, accessible names, new-tab links).
