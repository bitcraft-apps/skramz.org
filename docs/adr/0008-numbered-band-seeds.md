# 0008: Numbered per-band seed directories

- Status: proposed
- Date: 2026-10-20

## Context

One-shot evidence work had no path for ongoing per-band updates — the environment leaked into filenames because no tooling expressed it. A fresh database has no single bootstrap: `task seed` applies one flat file at a time with no order. Cross-file references (`claim_sources.entity_id`, shared members) fail only post-hoc via `_verify.sql`.

## Decision

Each band gets `api/seeds/{band-slug}/NNN-short-name.sql` in apply order: `001-band.sql` (display rows), `002-links.sql`, `00N-evidence.sql` (confirmation batches). Environment lives in the task invocation (`evidence` local vs `evidence:prod` remote), never in filenames. Single files apply through `api/scripts/apply-evidence.sh`, which enforces the traversal guard and `_verify.sql` on both targets.

Seeds use plain INSERTs with fixed ids per content-policy §7, never INSERT OR IGNORE / REPLACE. A UNIQUE conflict on re-apply fails loudly and names the already-applied batch. Bands are born from seeds with stable slug ids, applied identically to both environments.

## Consequences

- `api/seeds/{saetia,pg-99,yaphet-kotto}/001-band.sql` transcribe the three production records into slug ids (Yaphet Kotto unions the retired research seed); `yaphet-kotto/003-evidence.sql` carries its 20 claims over.
- No `prod` in filenames; environment lives in the task invocation, like `migrate` vs `migrate:prod`.
- Follow-ups: `manifest.txt`, `task bootstrap`, and a seeds test (manifest order on scratch SQLite, `_verify` clean).
