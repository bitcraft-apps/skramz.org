# Web hosting — Workers Static Assets (issue #55, ADR-0004)

## Worker

- **Name:** `skramz-web` — the system's only frontend host (Workers
  Static Assets, free tier).
- **Config:** `web/wrangler.toml`. Assets-only Worker: no `main` entry.
  `[assets] directory = "./dist"` with
  `not_found_handling = "single-page-application"`, so client-side
  routes serve `index.html`.
- **Build:** `vite build` → `dist/`. Local check: `pnpm build` in `web/`
  + `wrangler deploy --dry-run`.
- **Deploy:** `.github/workflows/deploy-web.yml` — `deploy` job on `main`
  push to production, `preview` job on PRs (non-production version;
  fork PRs skip only the upload). No Pages GitHub integration.
- **Supersedes:** `infra/pages.md` (deleted after cutover verification).

## Env vars (Production + Preview)

| Var | Value | Notes |
| --- | ----- | ----- |
| `VITE_API_URL` | `https://api.skramz.org` | Baked at build time: build env in `deploy-web.yml` + fallback in `web/.env.production` (public URL, safe in git). |

The home route (`/`, search-first gateway in `src/App.tsx`) consumes
`src/hooks.ts` (`useBands` idle strip + `useSearch`), so the API client
is bundled and the URL is greppable in `dist/` — the build log's
`VITE_API_URL=…` echo remains the proof it resolved.

## Domains

| Host | How attached | Status |
| ---- | ------------ | ------ |
| `skramz.org` | Worker route (`custom_domain`) in `web/wrangler.toml` | Cutover from Pages — owner runbook below |
| `www.skramz.org` | Same Worker route | Same as above |

## Cutover runbook (account owner only, dashboard)

1. Deploy this branch to `main`; confirm the production deploy serves
   the SPA on `https://skramz-web.<subdomain>.workers.dev`.
2. In Pages → `skramz-web` → Custom domains, remove `skramz.org` and
   `www.skramz.org`.
3. Deploy the Worker (or wait for the deploy in step 1 if routes were
   already applied); the `routes` in `web/wrangler.toml` create the DNS
   records + certificates automatically.
4. Verify:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://skramz.org       # 200
   curl -s -o /dev/null -w '%{http_code}\n' https://www.skramz.org   # 200
   curl https://api.skramz.org/healthz  # 200 {"ok":true,"db":1} (unchanged)
   ```
5. Only then: delete the `skramz-web` Pages project (dashboard →
   Workers & Pages → `skramz-web` → Delete). No dual-host period beyond
   the cutover (ADR-0004 Q2).

## Web Analytics (cookieless pageviews, free tier)

- **Beacon:** `web/src/analytics.ts` (`initWebAnalytics`, called from
  `web/src/main.tsx`) injects
  `https://static.cloudflareinsights.com/beacon.min.js` once, before the
  React tree mounts. Reports go to Cloudflare's beacon host, never to the
  Workers/D1 stack — zero request/CPU/row-read quota impact.
- **Token:** public site token baked at build time via
  `VITE_CF_BEACON_TOKEN` (`.env.example`, `deploy-web.yml` reads GitHub
  secret `CLOUDFLARE_BEACON_TOKEN`). Empty token stays silent: no beacon
  in local dev or token-less previews.
- **SPA route changes:** tracked automatically by the beacon (Soft
  Navigations / Navigation API / patched `pushState` + `popstate`). No
  manual pageview calls; the payload never sets `"spa": false`.
- **`api.skramz.org` excluded:** the API Worker ships no snippet and is
  never added as an Analytics site, so API calls never pollute pageviews.

## Dashboard runbook (account owner only)

1. Web Analytics page → **Add a site** → hostname `skramz.org` → **Done**.
2. **Manage site** → choose **Enable with JS Snippet installation**
   (manual mode — the snippet already ships in code; automatic injection
   on top would double-count pageviews). Copy the site token.
3. GitHub → repo Settings → Secrets → add `CLOUDFLARE_BEACON_TOKEN`
   with the token value (public id, safe to bake into `dist/`).
4. Merge to `main`; confirm the beacon ships (runtime-injected, so it
   lives in the JS bundle, not `index.html`):
   ```bash
   BUNDLE=$(curl -s https://skramz.org | grep -o '/assets/index-[^"]*\.js' | head -1)
   curl -s "https://skramz.org$BUNDLE" | grep -o static.cloudflareinsights.com
   ```
5. Verify in dashboard (allow a few minutes): pageviews on route
   changes, referrers, countries, Core Web Vitals. Preview builds share
   the same token, so workers.dev hits appear under that hostname —
   filter by hostname to split staging from production.

Accepted limits: cookieless/GDPR-friendly, no consent banner; sampled
stats (~10%), ~6 months retention; pageviews only — interaction funnels
live in the Analytics Engine dataset below, not here.

## Custom events (Analytics Engine, free tier)

- **What:** the beacon answers "how many pageviews", never "what visitors
  do". `POST /api/events` (`api/src/routes/events.ts`) records the four
  interactions the UI actually tracks — `page_view`, `play`, `graph_open`,
  `search` — into one Analytics Engine dataset. Anything outside that
  fixed action set is rejected; extra body fields are dropped.
- **Binding:** `EVENTS` (`[[analytics_engine_datasets]]`,
  dataset `skramz_events` in `api/wrangler.toml`). The route tolerates a
  missing binding and a throwing write: analytics never breaks the
  response (always `202 { ok: true }` on valid input, `400` otherwise).
- **Frontend:** `web/src/events.ts` (`trackEvent`, `sendBeacon` with
  `keepalive` fetch fallback, silent on every failure, never awaited in
  render paths). Wired to route changes (`TrackPageView` in
  `web/src/App.tsx`), successful searches (`Home`), play buttons
  (`ListenList` in `web/src/encyclopedia.tsx`), and graph mounts
  (`web/src/GraphView.tsx`). Payload is action + SPA path only — no
  band/member/media claims, so the content policy is untouched.
- **Budget:** zero D1 rows per event (no row-read/CPU impact). Free-tier
  Analytics Engine quotas apply: 100k writes/day, 10k reads/day.
- **Reads:** no dashboard yet — query the dataset with the Analytics
  Engine SQL API when a funnel question comes up. If a persistent
  dashboard is ever needed, add a cron-to-D1 rollup then, not before.

## API CORS (verified in code, not dashboard)

Allows exactly apex + `www` (`api/src/index.ts`, tested in
`api/test/cors.test.ts`); preview origins are NOT allowed (#55 follow-up).
