# Source portal access for evidence verification

Curator runbook (human + agent) for verifying evidence rows against source portals. Read-only verification only — not the serving path, which stays curated-links-only with no live portal fetching (ADR-0007). All writes still follow `docs/content-policy.md`.

## Secret handling

- The Discogs personal token lives in gitignored local `.env` / a CI secret only — the same pattern as the existing Cloudflare token. Never in the repo. `.env.example` carries the empty placeholder key, never a value.
- Before committing, `git status` must show no secrets. If a token ever lands in a file, rotate it at the portal and purge the commit.
- MusicBrainz needs no key. RateYourMusic has no token of any kind — it is manual-only (below).

## Portal map

| Source | Access method | Credential |
|---|---|---|
| Discogs entries | `api.discogs.com` JSON API (page scrapes 403 for bots — do not retry the page, use the API) | `DISCOGS_TOKEN` personal token (optional but recommended; raises courtesy limits) |
| MusicBrainz entries | `musicbrainz.org/ws/2` JSON API | None — descriptive `User-Agent` with contact, max 1 req/s |
| RateYourMusic | Manual-only: screenshots / curator notes | None — no public API, no scraping workarounds |
| Static label / press pages (Ebullition catalog, Punknews, etc.) | Plain fetch first — it already works | None |

## Discogs

Mint a free personal token at discogs.com → Settings → Developers, store it as `DISCOGS_TOKEN`, and send it on every API read:

```bash
curl -s -H "Authorization: Discogs token=$DISCOGS_TOKEN" \
  -H "User-Agent: skramz.org-evidence-check/0.1 (+https://skramz.org)" \
  "https://api.discogs.com/artists/1107526" | head -c 300
```

Without a token the API still answers but throttles sooner; `discogs.com` artist pages return 403 to scripted fetches either way, so the API is the only scripted path. Image URLs in API payloads are transitory — cite the entry URL, never hotlink (content-policy §4 forbids hotlinks).

## MusicBrainz

No key. Every request must carry a descriptive `User-Agent` with contact and stay at or under 1 request/second:

```bash
curl -s -A "skramz.org-evidence-check/0.1 ( contact@example.com )" \
  "https://musicbrainz.org/ws/2/artist/cd4f7c44-9ff3-4660-9f93-170fef83edfd?fmt=json" | head -c 300
```

The Go scrape clients (open scrape-clients issue) reuse this recipe: stdlib HTTP, 1 rps courtesy limit, descriptive `User-Agent`.

## RateYourMusic

No public API — record evidence manually: screenshot the live artist page into curator notes (canonical URL with challenge params stripped, per `api/seeds/yaphet-kotto/002-links.sql`) and never add scraping workarounds. If no reachable page attests the slug, leave the link out (per `api/seeds/saetia/002-links.sql`).

## Static label / press pages

Fetch-first: Ebullition catalog pages, Punknews, and similar static pages answer plain fetches. No token, no recipe — just fetch and cite with `source_url + accessed_at`.

## Verification runbook (fresh-session check)

To verify one Discogs-cited and one MusicBrainz-cited claim end to end (acceptance for this runbook), using the seeded Saetia rows:

1. MusicBrainz: fetch the `ws/2/artist` URL above; confirm `life-span.begin` is `1997-02` and `begin-area.name` is `New York`.
2. Discogs: fetch `https://api.discogs.com/artists/1107526` (token header as above); confirm `name` is `Saetia` and `uri` is the seeded `https://www.discogs.com/artist/1107526-Saetia` entry.
3. Record both URLs with today's date as `source_url + accessed_at` per content-policy §1.

## Out of scope

- Serving path: no live portal fetching (ADR-0007).
- Building the Go scrape clients (open scrape-clients issue).
- Prod data changes of any kind.
