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
- Rows are grouped under subheads by entity kind (Band / Membership /
  Roles / Names / Other), sorted band-first then alphabetical by person,
  never in raw `entity_type, entity_id` order. Every non-band row names
  its subject (membership/role rows resolve the person through the
  membership rows' values, since the API strips `band_member_id` from
  the public member shape — client-side lookup only, no API change).
- The displayed (winning) value per field carries a `displayed` badge;
  losing rivals render dimmed. Winners live in the display tables and
  are matched at string level; a NULL claim value attests the display
  as-is, and a NULL/blank display means no row wins.
- `claim_sources.note` stays internal and is never rendered, per
  content-policy §7. The ledger SELECT omits the column and ledger
  rows never read it.

## Consequences

- ADR-0005 stays as history; this record supersedes only its
  "internal, never rendered" sentence for the sidecar as a whole. The
  winner-vs-rival contract and bounded-lookup budget in 0005 are
  unchanged.
- No code, migration, or seed change; reads stay inside the free-tier
  budget (single `LIMIT`-bounded indexed lookup per page).
