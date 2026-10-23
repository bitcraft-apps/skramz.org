# Custom event analytics (Analytics Engine dataset `skramz_events`)

What visitors do (plays, graph opens, searches, page views). Edge HTTP
traffic is a separate source; for that query see the chat skill
(`.agents/skills/skramz-analytics/SKILL.md`).

## Write path

- `POST /api/events` (`api/src/routes/events.ts`, per ADR-0002) accepts
  `{ action, path }`, drops anything else, and writes one data point via
  `EVENTS.writeDataPoint`. Fixed vocabulary, kept in sync with
  `TrackedAction` in `web/src/events.ts`:
  `page_view | play | graph_open | search`.
- Point layout: `blob1` = action, `blob2` = SPA path, `double1` = 1,
  `index` = action. No D1 row per event, so volume never touches the
  row-read/CPU budget.
- Binding (`api/wrangler.toml`): `[[analytics_engine_datasets]]`
  `binding = "EVENTS"`, `dataset = "skramz_events"`.

## Read path

Query the unified Analytics SQL API — not the legacy `analytics_engine/sql`
endpoint, which rejects valid tokens. Credentials: `CLOUDFLARE_API_TOKEN`
(needs Account | Account Analytics | Read) plus the account ID; both live in
GitHub secrets / gitignored `.env`, never in git. Keep reads small (7-day
window, `LIMIT 20` or less); reads share the 10k/day free quota. Counts are
sampled approximations; allow a few minutes of ingestion delay. Empty results
usually mean no traffic — re-confirm the write path is live first.

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

Ad-hoc queries above are the read path until a persistent dashboard is
requested; only then consider a cron-to-D1 rollup.
