# 0008: Numbered per-band seed directories

- Status: proposed
- Date: 2026-10-20

## Context

Seeding grew two problems at once. One-shot evidence work (the Yaphet Kotto production batch) showed there was no established path for ongoing per-band updates — the environment leaked into the filename (`yaphet-kotto-prod-evidence.sql`) because no tooling expressed it. Separately, a fresh database has no single bootstrap: `task seed` applies one flat file at a time with no manifest, no order, and the `band_links.sql` template seeds nothing. And cross-file references (`claim_sources.entity_id`, shared members across bands) fail only post-hoc via `_verify.sql`. Seeding covers all data — bands, members, edges, links, evidence — so the system must too.

## Decision

Each band gets a directory, `api/seeds/{band-slug}/NNN-short-name.sql`, holding all of its seed data in apply order: `001-band.sql` (display rows), `002-links.sql` (reserved), `00N-evidence.sql` (confirmation batches). A `manifest.txt` will list every file across bands in dependency order, and `task bootstrap` will run migrate plus the manifest plus verify — one command from empty DB to full data. Single files keep applying through `task evidence BAND=<slug> N=<file>` (local) / `task evidence:prod` (explicit-only remote, verify enforced both sides).

Idempotency keeps the content-policy §7 rule: plain INSERTs with fixed ids, never INSERT OR IGNORE / REPLACE. A UNIQUE conflict on re-apply fails loudly and names the already-applied batch. Silent upserts (`ON CONFLICT DO UPDATE`) are rejected for seeds: overwriting a row would destroy provenance, and the losing-rival rule (§2) requires conflicts to stay visible as `disputed` rows, not merge away.

Bands are born from seeds: display rows originate in seed files with stable slug ids, applied identically to both environments, so one evidence file works everywhere. API-created rows (random UUIDs, e.g. the three pre-rebuild production bands) are the legacy exception: their evidence files note the target id in the header.

## Consequences

- `api/seeds/{saetia,pg-99,yaphet-kotto}/001-band.sql` transcribe the three production records into slug ids (Yaphet Kotto unions the retired research seed, so no curated member is lost); `yaphet-kotto/003-evidence.sql` carries its 20 claims over.
- No `prod` in filenames going forward; environment lives in the task invocation (`evidence` vs `evidence:prod`), like `migrate` vs `migrate:prod`.
- Flat `api/seeds/*.sql` starter seeds are retired as bands migrate into directories; `band_links.sql` stays as the portal-allowlist template until real link rows exist.
- No API write endpoint for `claim_sources` is added: direct D1 writes stay behind the CLI `[Y/n]` human gate per AGENTS.md, with the SQL file as the reviewable preview artifact.
- Still to land: `manifest.txt`, `task bootstrap`, and a seeds test (manifest order on scratch SQLite, `_verify` clean) following the `migrations.test.ts` pattern.
