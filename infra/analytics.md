# Custom event analytics (Analytics Engine dataset `skramz_events`)

What visitors DO (play, graph open, search, page views) — the cookieless
Web Analytics beacon cannot report this. Edge HTTP traffic is a separate
source; see the chat skill (`.agents/skills/skramz-analytics/SKILL.md`)
for the edge query.

## Write path (live, tested)

- `POST /api/events` (`api/src/routes/events.ts`, per ADR-0002) accepts
  `{ action, path }` with `action` in `page_view | play | graph_open | search`,
  drops anything else, and writes one data point via `EVENTS.writeDataPoint`.
- Point layout: `blob1` = action, `blob2` = SPA path, `double1` = 1,
  `index` = action. No D1 row per event, so volume never touches the
  row-read/CPU budget.
- Binding (`api/wrangler.toml`): `[[analytics_engine_datasets]]`
  `binding = "EVENTS"`, `dataset = "skramz_events"`.
- Covered by `api/test/events.test.ts` (allowlist, drops, 202-without-binding)
  and `web/src/events.test.ts` (sendBeacon/keepalive fallback, silent failure).

## Read path (issue #126)

Query the unified Analytics SQL API — not the legacy `analytics_engine/sql`
endpoint, which rejects valid tokens. Credentials: `CLOUDFLARE_API_TOKEN`
(needs Account | Account Analytics | Read) plus the account ID; both live in
GitHub secrets / gitignored `.env`, never in git. Keep reads small (7-day
window, `LIMIT 20` or less); reads share the 10k/day free quota. Counts are
sampled approximations; allow a few minutes of ingestion delay.

Counts by action, last 7 days:

```sql
SELECT blob1 AS action, count() AS count FROM events.analyticsEngine.skramz_events
WHERE accountTag = '...' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY action ORDER BY count DESC LIMIT 10
```

Top paths for one action:

```sql
SELECT blob2 AS path, count() AS n FROM events.analyticsEngine.skramz_events
WHERE accountTag = '...' AND timestamp > NOW() - INTERVAL '7' DAY
  AND blob1 = 'play'
GROUP BY path ORDER BY n DESC LIMIT 20
```

## Verification status

- Write path: verified live 2026-10-23 — `POST https://api.skramz.org/api/events`
  `{"action":"page_view","path":"/"}` returned `202 {"ok":true}`.
- Read path: **PENDING** — no credentialed SQL API run yet. Paste the
  counts-by-action result below and close #126. Empty results usually mean no
  traffic; first re-confirm the write path is live (POST above).
- Rollup: only if a persistent dashboard is needed — add the hourly cron-to-D1
  rollup discussed in #112. Until then, ad-hoc queries above are the read path.
