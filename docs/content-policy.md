# Content policy — skramz.org

Binding for all band / member / release / media writes. If in doubt, leave it unconfirmed or out. Legality outranks completeness.

## 1. Sources

Every factual claim needs a legal source stored with `source_url + accessed_at`. No source = `unconfirmed`: show a visible badge and hedge ("reportedly", "unconfirmed"). No pirated text, images, or audio.

- **Tier 1 — authoritative:** band / label official sites and accounts, direct artist statement.
- **Tier 2 — reputable:** established press, books, venues, festivals, MusicBrainz / Discogs entries with history.
- **Tier 3 — community:** small press, zines, fan wikis, forums, user tips. Never overrides T1/T2.

### Tier assignment rubric

- **"Entry with history" (T2)** means a Discogs / MusicBrainz entry with visible submission history plus real catalogue depth (releases with multiple versions, reviews, or lists). A bare stub with no history is T3.
- **Bare tips (T3, lead only):** a single forum/social comment, an uncorroborated user tip, a one-line wiki addition with no source.
- **Derived values are evidence, never display candidates:** arithmetic or inference from a source keeps its tier as a source row but cannot displace a directly attested display value.

### Source classes

- **Primary (T1):** liner notes and physical release credits, official band/label sites and accounts, direct artist statements, Bandcamp artist pages for the artist's own claims.
- **Curated databases:** Discogs, MusicBrainz, RateYourMusic. The "entry with history" test decides each entry — T2 with history, T3 without. Genre-scoped databases with strict moderation qualify too — argue per band in the PR body.
- **Press:** established outlets with editorial history are T2; zines, blogs, and fan wikis are T3.
- **Tertiary (inherits, never above):** Wikipedia/Wikidata take the tier of the references behind the claim, capped at T2; an unreferenced line is T3.
- **Archives take their artifact's tier:** an Internet Archive scan of liner notes is primary; a forum scrape is a tip.

### Within-tier precedence

- T1: direct artist statement outranks discography data, which outranks label marketing prose.
- T2 conflict: most independent sources wins; tie → newest; the loser stays as `disputed`, never deleted.

## 2. Statuses

`confirmed` (has source) | `unconfirmed` (no source) | `disputed` (sources disagree).

Never write or upgrade to `confirmed` without `source_url + accessed_at`. Never present `unconfirmed` / `disputed` as fact. Highest tier wins the displayed value; the loser stays as `disputed` with its source link, never silently overwritten or deleted. Same-tier conflict: see §1.

## 3. Text

Own words only — never paste bios, articles, reviews, or lyrics. Short quotes (a sentence or two) with author + source link. No invented facts, lineup guesses, or genre padding; leave blank + `unconfirmed` instead.

## 4. Media (images, photos, audio)

Record `license + author + source_url` per file and render the attribution wherever the file is shown. Unknown license or author = do not publish.

- **Allowed:** own work / explicit permission, public domain, CC-BY / CC-BY-SA, licensed stock with receipt, platform embeds (YouTube, Bandcamp, Spotify).
- **Forbidden:** hotlinks, image-search scrapes, unknown-origin re-uploads, ripped tracks / full copyrighted audio uploads.
- Photos of living people need consent or a clearly licensed source; remove on request.
- No `cover_r2_key` / `photo_r2_key` write without license + author on record; `media_links` stays embed-only (provider + url).

## 5. Corrections

Anyone can report a wrong claim or infringing file with a source or rights note. Valid report: flip the field to `disputed` / unpublish the file, keep the old source link. Rights-holder takedowns remove first, discuss after.

## 6. Agent checklist (before any content write)

1. Source? If no → `unconfirmed`, no public claim of fact.
2. Legal? If no → drop it.
3. Media licensed + attributed? If no → do not upload.
4. Higher-tier source disagrees? Keep the loser as `disputed`.

## 7. Seeds

Seeds are per-environment starter records, applied explicitly with
`task seed` (flat files at `api/seeds/`) or `task evidence` /
`task evidence:prod` (per-band files at `api/seeds/{band}/NNN-name.sql`
via `api/scripts/apply-evidence.sh`) — never via migrations.

- One directory per band (`api/seeds/{band}/` in apply order: `001-band.sql` display rows, `002-links.sql`, `00N-evidence.sql` confirmation batches), plus `api/seeds/members/001-shared.sql` for people who play in more than one band (applied before any band file). Member ids are neutral person slugs (`m-jeff-salane`), never band-prefixed, so one person keeps one row no matter how many bands they join; band edges and claims stay band-scoped (`orchid-bm-jeff-salane`, `orchid-cs-formed`). A UNIQUE conflict then names the actual duplicate.
- Plain INSERTs only, so a conflict fails loudly. Never INSERT OR IGNORE (or REPLACE) under foreign keys.
- NULL is an honest gap: blanks allowed wherever no source clears the bar.
- Every display value needs a source row or it stays `unconfirmed`. Corrections follow §5.
- Seeds must verify clean: no orphan edges, no orphan evidence. The check queries (`api/seeds/_verify.sql`), the `task seed` / `task evidence` entrypoints, and the `claim_sources` table land in Phase 1 (migration 0005); the first seed data lands in Phase 5 — any row returned rejects the seed.
- `claim_sources.note` is an internal working note for future curators, never rendered.
- Copy-paste templates live in `api/seeds/templates/` — copy them out, do not apply them in place.
