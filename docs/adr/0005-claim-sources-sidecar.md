# 0005: Claim sources sidecar table

- Status: proposed
- Date: 2026-10-18

## Context

Display tables (`bands`, `members`, `band_members`, `releases`, `media_links`) keep one winning value per field, with NULL as an honest gap where no source clears the bar. Content policy needs per-claim provenance — which source said what, at which tier, with what status — including losing rivals that must stay on record as `disputed` rather than be silently overwritten. Stuffing that provenance into the display tables would widen every row, complicate every read, and burn the free-tier budget (100k req/day, 10ms CPU, 5M D1 row-reads/day).

## Decision

Provenance lives in a `claim_sources` sidecar, one row per (entity, field, value, source) claim. Display tables keep winning values; the sidecar holds value + status + tier + source + note and is internal, never rendered. Reads join on `(entity_type, entity_id)`, backed by the `idx_claim_sources_lookup` index — one bounded lookup per page. `entity_id` is polymorphic across the five display tables, so there is no foreign key; writers must use a real row id, and the seed check queries reject orphans. The UNIQUE constraint on `(entity_type, entity_id, field, value, source_url)` keeps losing rivals while blocking exact dupes. Seed id shape (`{band}-{kind}-{name-slug}`, full band slug) is a content-policy rule, not DDL.

## Consequences

- Migration `0005_claim_sources.sql` creates the table plus the lookup index; no backfill, no display-table changes.
- Seed verification (`api/seeds/_verify.sql`) rejects orphan evidence rows and `confirmed` rows without `source_url + accessed_at`.
- Every evidence read stays a single bounded indexed lookup, inside the free-tier budget.
- No second database or graph store; relationships still live in `band_members` with recursive CTEs.
