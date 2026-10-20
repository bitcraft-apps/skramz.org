# 0009: Claim sources rendered as evidence ledger

- Status: proposed
- Date: 2026-10-20
- Supersedes: 0005 (Decision sentence "sidecar holds value + status + tier + source + note and is internal, never rendered")

## Context

ADR-0005 recorded the `claim_sources` sidecar as internal and never
rendered. Shipped behavior differs: the band page renders sidecar rows
as a SOURCES ledger (`EvidenceLedger` in `web/src/encyclopedia.tsx`,
fed by `GET /api/bands/:id` embedding `{sources}` via
`fetchClaimSources` in `api/src/lib/http.ts`). The ADR must match the
shipped behavior, keeping the part of 0005 that is still true.

## Decision

- Sidecar rows ARE rendered as the SOURCES ledger section
  (`aria-label="sources"`): one row per claim showing field, value,
  status, tier label, source link (hostname), and `accessed_at`; empty
  state reads "No sources recorded — all fields unconfirmed.". The
  section auto-opens on `disputed`.
- `claim_sources.note` stays internal and is never rendered, per
  content-policy §7. The ledger SELECT omits the column and ledger
  rows never read it.
- One bounded lookup per band page: `GET /api/bands/:id` fans band,
  member, `band_member`, release, and `media_link` refs into a single
  `fetchClaimSources` call — one query over `idx_claim_sources_lookup`
  with `LIMIT 200`. Sibling detail routes (`releases`, `members`,
  `media-links`) reuse the same helper.
- Winner-vs-rival contract: display tables keep the highest-tier
  winning value with NULL as an honest gap; the sidecar keeps losing
  rivals as `disputed` rows, never deleted. The client resolves a
  per-field `confirmed` / `disputed` / `unconfirmed` marker and keeps
  rivals visible in the ledger.

## Consequences

- ADR-0005 stays as history; this record supersedes only its
  "internal, never rendered" sentence for the sidecar as a whole.
- No other ADR contradicts the ledger: 0006 leaves `claim_sources`
  timestamps trigger-free, and 0008 routes evidence writes through
  per-band `00N-evidence.sql` batches verified by `_verify.sql`.
- No code, migration, or seed change; reads stay inside the free-tier
  budget (single `LIMIT`-bounded indexed lookup per page).
