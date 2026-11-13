# 0006: Freshness writes via triggers and parent touch

- Status: proposed
- Date: 2026-10-19

## Context

List and detail pages need to show how fresh a band's data is, but only
`bands` and `claim_sources` carry `updated_at`. Child edits (member bio,
release title, new link) leave the parent band looking untouched, and
relying on each write route to remember stamping is fragile. The fix must
stay inside the free-tier budget: no extra reads per page, no new tables.

## Decision

Freshness lives in SQLite `AFTER INSERT` / `AFTER UPDATE` triggers, not in
route code:

- New nullable `updated_at` columns on `members`, `band_members`,
  `releases`, and `media_links` (`bands` and `claim_sources` already have
  the column and are not altered).
- Every trigger self-stamps its own row with
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`, guarded so explicit writes win
  and re-fire stops.
- Touch rule: a child write also stamps its parent band — member writes
  touch all bands linked through `band_members`, `band_members` and
  `releases` writes touch their band, and `media_links` writes touch the
  direct band or, for release links, the release's band. The parent touch
  is unconditional: an explicit `updated_at` write wins for the row's own
  stamp only and still moves the parent (migration 0009). Reassigning a
  `band_members` or `releases` row touches the old parent as well as the
  new one.
- Backfill honesty: `members` and `releases` backfill `updated_at` from
  their own `created_at`; `band_members` and `media_links` have no
  `created_at`, so old rows keep `updated_at` NULL (unknown) rather than a
  fabricated timestamp.

## Consequences

- Migration `0006_updated_at.sql` adds the columns, triggers, and
  backfill; no reader, UI, or seed changes.
- Band `updated_at` now moves on any descendant write, so freshness reads
  stay single-row lookups within the free-tier budget.
- `claim_sources` keeps its own timestamps and gains no triggers.
