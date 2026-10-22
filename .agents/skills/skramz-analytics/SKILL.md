---
name: skramz-analytics
description: Answer questions about skramz.org visitor activity and edge web traffic by querying Cloudflare analytics and presenting compact chat tables.
---

# Skramz Analytics

Use when the user asks what visitors are doing on skramz.org: views, plays,
graph opens, searches, top paths, edge traffic, or trends over a time range.
Two sources: custom interaction events (what visitors do) and edge HTTP
traffic (what hits the zone, bots included).

Do not use for changing tracking code or for D1/R2 queries. This skill is
read-only reporting; writes happen only through real app traffic to
`POST /api/events`, never by hand-writing data points.

## Custom events

- Dataset `skramz_events`, written only by `POST /api/events`.
- Fixed actions: `page_view`, `play`, `graph_open`, `search`.
- Point layout: `blob1` is the action, `blob2` is the SPA path, `double1` is 1.
- Query the unified Analytics SQL API (not the legacy
  `analytics_engine/sql` endpoint, which rejects valid tokens).
  Credentials come from the environment or the gitignored `.env`; the token
  needs Account | Account Analytics | Read. Never print, commit, or paste it.

  ```sql
  SELECT blob1 AS action, count() AS count FROM events.analyticsEngine.skramz_events
  WHERE accountTag = '...' AND timestamp > NOW() - INTERVAL '7' DAY
  GROUP BY action ORDER BY count DESC LIMIT 10
  ```

- Top paths for one action: select `blob2 AS path` instead, add
  `AND blob1 = 'play'`, and group by path.
- Keep reads small: one bounded query (default last 7 days, `LIMIT 20`
  or less); reads share the 10k/day free quota.
- Counts are sampled approximations (`count()` applies sample weights).
  Allow a few minutes of ingestion delay.
- Empty results usually mean no traffic, but first confirm the write path is
  live (`POST /api/events` route present). One-time setup: Analytics Engine
  must be enabled in the dashboard, or nothing is ever written.

## Web traffic (edge HTTP, same endpoint and token)

- Source: `events.httpRequests`. Fields: `clientRequestHttpHost`,
  `clientRequestPath`, `edgeResponseStatus`, `verifiedBotCategory`
  (empty string means not a verified bot). Always filter `accountTag` plus host.

  ```sql
  SELECT clientRequestPath AS path, count() AS n
  FROM events.httpRequests
  WHERE accountTag = '...' AND timestamp > NOW() - INTERVAL '1' DAY
    AND clientRequestHttpHost = 'skramz.org' AND edgeResponseStatus = 200
    AND verifiedBotCategory = ''
  GROUP BY path ORDER BY n DESC LIMIT 20
  ```

- Ignore bots by default (`AND verifiedBotCategory = ''`); drop that line
  only when the user explicitly asks about crawler traffic.
- Stealth scanners also carry an empty category, so probe paths
  (`/wp-admin/*`, `/.env`, `/administrator/*`) are not filterable by bot
  field. When they dominate, say so and offer a path-excluded rerun instead
  of silently dropping rows.
- Edge traffic misses SPA client-side navigations (never hit the edge); for
  what visitors actually do, custom events are the truth, not edge hits. The
  beacon Web Analytics product has no public query API: dashboard only.

## Presentation

- State the interval first, e.g. "Last 7 days, all actions."
- Lead with one totals table (action, count), then only the breakdown asked for.
- Keep tables narrow for chat: at most 4 columns, short cells, truncate long
  paths instead of wrapping.
- Say plainly when the dataset has no rows for the interval rather than
  showing zeros as success.
