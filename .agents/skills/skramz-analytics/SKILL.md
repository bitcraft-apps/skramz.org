---
name: skramz-analytics
description: Answer questions about skramz.org visitor activity and edge web traffic by querying Cloudflare analytics and presenting compact chat tables.
---

# Skramz Analytics

Use when the user asks what visitors are doing on skramz.org: views, plays,
graph opens, searches, top paths, edge traffic, or trends over a time range.
Two sources: custom interaction events (what visitors do) and edge HTTP
traffic (what hits the zone, bots included).

Do not use for changing tracking code or for D1/R2 queries. Tracking code
changes stay a normal code task; this skill is read-only reporting.

## Data source

- Dataset `skramz_events`, written only by `POST /api/events`.
- Fixed actions: `page_view`, `play`, `graph_open`, `search`.
- Point layout: `blob1` is the action, `blob2` is the SPA path, `double1` is 1.
- Query with the unified Analytics SQL API (the legacy
  `analytics_engine/sql` endpoint rejects valid tokens, so do not use it):

  ```sh
  curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics/sql" \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    --header "Content-Type: application/json" \
    --data '{"query":"SELECT blob1 AS action, count() AS count FROM events.analyticsEngine.skramz_events WHERE accountTag = '"'"'$CLOUDFLARE_ACCOUNT_ID'"'"' AND timestamp > NOW() - INTERVAL '"'"'7'"'"' DAY GROUP BY action ORDER BY count DESC LIMIT 10"}'
  ```

- Credentials come from the environment or the gitignored `.env`. The token
  needs Account | Account Analytics | Read. Never print
  the token, never commit it, never paste it into chat.
- Top paths for one action:

  ```sql
  SELECT blob2 AS path, count() AS count FROM events.analyticsEngine.skramz_events
  WHERE accountTag = '...' AND timestamp > NOW() - INTERVAL '7' DAY AND blob1 = 'play'
  GROUP BY path ORDER BY count DESC LIMIT 20
  ```

## Rules

- Read-only: never hand-write data points. Writes happen only through real
  app traffic to `POST /api/events`.
- Keep reads small: prefer one bounded query (default last 7 days, `LIMIT 20`
  or less). Reads share the 10k/day free quota.
- Counts are sampled approximations: use `count()`, which applies sample
  weights automatically. Allow a few minutes of ingestion delay.
- Empty results with a valid query mean no traffic, but first check the
  write path is live: `POST /api/events` with `{}` must return 400 (route
  present), and the Deploy API workflow must be green. A 404 means the
  Worker predates the events route.
- Prerequisite (one-time, account owner): Analytics Engine must be enabled
  in the dashboard (Workers → Analytics Engine), or deploys fail with code
  10089 and nothing is ever written.

## Web traffic (edge HTTP, same endpoint and token)

- Source: `events.httpRequests`. Fields that matter: `clientRequestHttpHost`,
  `clientRequestPath`, `edgeResponseStatus`, `userAgent`,
  `verifiedBotCategory` (empty string means not a verified bot), `zoneTag`.
  Aggregate with `count()`; always filter `accountTag` plus the host.
- Ignore bots by default: always include `AND verifiedBotCategory = ''`,
  which drops labeled crawlers (search, AI, previews). Remove that line only
  when the user explicitly asks about crawler traffic.
- Stealth scanners carry an empty category too, so they are not filterable by
  bot field. When probe paths (`/wp-admin/*`, `/.env`, `/administrator/*`)
  dominate, say so and offer a path-excluded rerun instead of silently
  dropping rows.

  ```sql
  SELECT clientRequestPath AS path, count() AS n
  FROM events.httpRequests
  WHERE accountTag = '...' AND timestamp > NOW() - INTERVAL '1' DAY
    AND clientRequestHttpHost = 'skramz.org' AND edgeResponseStatus = 200
    AND verifiedBotCategory = ''
  GROUP BY path ORDER BY n DESC LIMIT 20
  ```

## What each source cannot do

- The beacon Web Analytics product (RUM pageviews, visits, Core Web Vitals
  as shown in its dashboard) has no public query API: dashboard only.
- Edge traffic includes bot scans (expect `/wp-admin/*`, `/.env` probes) and
  misses SPA client-side navigations, which never hit the edge. For what
  visitors actually do, the custom events above are the truth, not edge hits.

## Presentation

- State the interval first, e.g. "Last 7 days, all actions."
- Lead with one totals table (action, count), then only the breakdown asked for.
- Keep tables narrow for chat: at most 4 columns, short cells, truncate long
  paths instead of wrapping.
- Say plainly when the dataset has no rows for the interval (e.g. before any
  deploy traffic) rather than showing zeros as success.
