# Content policy — skramz.org

Binding for all band / member / release / media writes. If in doubt, leave it unconfirmed or out. Legality outranks completeness.

## 1. Sources

Every factual claim needs a legal source stored with `source_url + accessed_at`. No source = `unconfirmed`: show a visible badge and hedge ("reportedly", "unconfirmed"). No pirated text, images, or audio.

- **Tier 1 — authoritative:** band / label official sites and accounts, direct artist statement.
- **Tier 2 — reputable:** established press, books, venues, festivals, MusicBrainz / Discogs entries with history.
- **Tier 3 — community:** small press, zines, fan wikis, forums, user tips. Never overrides T1/T2.

### Tier assignment rubric

- **"Entry with history" (T2)** means a Discogs / MusicBrainz entry with visible submission history plus real catalogue depth (releases with multiple versions, reviews, or lists). A bare stub with no history is T3.
- **Press (T2)** means an established outlet with editorial history. Small zines, blogs, and fan wikis are T3 even when long-running.
- **Bare tips (T3, lead only):** a single forum/social comment, an uncorroborated user tip, a one-line wiki addition with no source.
- **Derived values are evidence, never display candidates:** arithmetic or inference from a source (e.g. "~1997" computed from label copy saying "active seven years") keeps its tier as a source row but cannot displace a directly attested display value. The display keeps the directly attested value; the derivation stays as a linked disagreeing row.

### Source classes

- **Primary (T1):** liner notes and physical release credits, official band/label sites and accounts, direct artist statements, Bandcamp artist pages for the artist's own claims.
- **Curated databases (T2 with history, T3 without):** Discogs, MusicBrainz, RateYourMusic. Genre-scoped databases with strict moderation qualify too — argue per band in the PR body. The "entry with history" test from the rubric decides each entry — release-level evidence, submission history, reviews, lists. A bare stub is T3 no matter the domain.
- **Press (T2 established, T3 small):** books, major outlets, venues, festivals vs zines, blogs, fan wikis.
- **Tertiary (inherits, never above):** Wikipedia/Wikidata take the tier of the references behind the claim, capped at T2; an unreferenced line is T3.
- **Archives take their artifact's tier:** an Internet Archive scan of liner notes is primary; a forum scrape is a tip.

### Within-tier precedence

- T1 internal: direct artist statement outranks official discography data, which outranks label marketing prose (prose goes interpretive fast; the derived-values rule applies).
- T2 conflict: most independent sources wins; tie → newest; the loser is noted, never deleted. Neither Discogs nor MusicBrainz outranks the other alone — that is what "do we need both" means: both help.
- A lone T2 confirms when unopposed. Corroboration only breaks ties.

### Agreed starting points (first consumers)

- Yaphet Kotto: `ebullition.com` catalog (T1), `discogs.com` artist and member pages with history (T2).
- Orchid: `discogs.com` band page (T2: five members, 1997–2002), `musicbrainz.org` label entry (T2), `loudersound.com` (T2 press).

## 2. Statuses

`confirmed` (has source) | `unconfirmed` (no source) | `disputed` (sources disagree).

Never write or upgrade to `confirmed` without `source_url + accessed_at`. Never present `unconfirmed` / `disputed` as fact. Highest tier wins the displayed value; the loser stays as `disputed` with its source link, never silently overwritten or deleted. Same-tier conflict: most independent sources wins; tie → newest; note the rival.

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
`task seed` — never via migrations. Seed-file header comments say what
the seed owns, how to apply it, and what a conflict means — nothing
more. Each rule below exists so the seed for band #200 is as safe as
the first: human-readable SQL that a machine re-checks.

- One file per band, with ids derived as `{band}-{kind}-{name-slug}` using the full band slug (`orchid-m-jeff-salane`, `cs-orchid-formed`) — never invented opaque ids or cryptic abbreviations. A readable, derivable id means a UNIQUE conflict names the actual duplicate (same band, same claim), not a typo to hunt down. There is no id length limit; clarity beats brevity.
- Plain INSERTs only, so a conflict fails loudly. Never INSERT OR IGNORE (or REPLACE) under foreign keys: a skipped parent row with inserted children is silent corruption, and at scale nobody will notice it by reading.
- NULL is an honest gap: blanks allowed wherever no source clears the bar.
- Every display value needs a source row or it stays `unconfirmed`. Corrections follow §5.
- Seeds must verify clean: no orphan edges, no orphan evidence. The check queries ship with the first seed (Phase 5) — any row returned rejects the seed: fix the file, re-apply from a fresh database, never patch around it.
- `claim_sources.note` is an internal working note for future curators, never rendered. Note style rules arrive with Phase 5, when seeds actually carry notes.
