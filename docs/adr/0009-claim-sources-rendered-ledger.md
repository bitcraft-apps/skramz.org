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
  Roles / Names / Releases / Listen / Other) with per-section counts,
  sorted band-first then alphabetical by subject, never in raw
  `entity_type, entity_id` order. Every non-band row names its subject
  (membership/role rows resolve the person through the membership rows'
  values, since the API strips `band_member_id` from the public member
  shape; release rows use the release title, media-link rows the
  provider — client-side lookups only, no API change). Band-member
  rows with no matching membership share a labeled `Unknown` subject
  bucket (subject prefix plus grouped sort) instead of rendering
  subject-less. Membership
  collapses behind a native disclosure by default; the outer section
  keeps its auto-open-on-disputed behavior.
- Raw field tokens never reach the UI: one lookup map renders human
  labels (Formed, Disbanded, Member, Role, Name, Bio, Location, Title,
  Type, Year, Cover, Band, Release, Stream, Link, Embed) with a raw-token
  fallback. Subject === value
  names the subject once; name/title rivals read `subject — claimed
  "value"` so typo rows are unambiguous.
- Three row states replace the binary dim. `on page` (winner: value
  matches display, badge right after the value, full weight). `rival`
  (display non-blank and value differs: indented, dimmed — the only
  dimmed state — plus a text marker, never dimming alone). `lead`
  (sole claim against a blank/NULL display: full weight, no badge, no
  dim, marked `lead`). Winners live in the display tables and are
  matched at string level. Within each field group the winner leads,
  rivals follow alphabetical, NULL attestations last; the Band section
  follows page order (name/bio/location/formed/disbanded, alpha
  fallback). A winner in a rival-carrying group adds "currently shown
  but disputed" instead of a second badge. Every row carries an
  `aria-label` restating its state; no `title`-only communication.
- A NULL claim value attests the display as-is and renders "attests
  current text" with the badge, never a badged em-dash. Against a
  blank display there is nothing to attest, so the row reads as an
  unbadged lead ("no text on page") — reconciling the NULL-attestation
  follow-up (#115) by refusing to crown a blank.
- `claim_sources.note` renders verbatim under its ledger row, per
  content-policy §7: every row carrying a non-blank note shows it
  (disputed, unconfirmed, and confirmed alike, so NULL attestations
  read as summaries). Notes explain only — display values, winner
  logic, and sorting never read them. The ledger SELECT includes the
  column; the read stays a single `LIMIT`-bounded indexed lookup.

## Consequences

- ADR-0005 stays as history; this record supersedes only its
  "internal, never rendered" sentence for the sidecar as a whole. The
  winner-vs-rival contract and bounded-lookup budget in 0005 are
  unchanged.
- No migration or seed change (the column already exists); reads stay
  inside the free-tier budget (single `LIMIT`-bounded indexed lookup
  per page, one added column).
