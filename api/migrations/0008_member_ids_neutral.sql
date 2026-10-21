-- Remap band-prefixed member ids to neutral person slugs (m-<name>).
-- Seeds used to derive member ids as {band}-m-{name} (saetia-m-steve-roche),
-- which falsely claims single-band ownership; shared people now live in
-- api/seeds/members/001-shared.sql with band-neutral ids. Portable SQLite;
-- no Postgres-isms.
--
-- INSERT-new + repoint + DELETE-old (never UPDATE the parent key): the FKs
-- are ON DELETE CASCADE with no ON UPDATE, so updating members.id in place
-- would violate band_members.member_id. Inserting the new rows first keeps
-- every child pointing at an existing parent throughout. claim_sources has
-- no FK, only the _verify.sql orphan check.
-- Repointing band_members re-stamps the touched bands' updated_at via
-- trg_band_members_stamp_update; accepted (freshness floor, not evidence).
-- No-op on databases already on neutral ids (fresh reseeds, scratch DBs):
-- the old-prefix predicates match nothing.
INSERT INTO members (id, name, name_norm, bio, created_at, updated_at)
  SELECT
    REPLACE(REPLACE(REPLACE(id, 'saetia-', ''), 'yaphet-kotto-', ''), 'pg-99-', ''),
    name, name_norm, bio, created_at, updated_at
  FROM members
  WHERE id LIKE 'saetia-m-%' OR id LIKE 'yaphet-kotto-m-%' OR id LIKE 'pg-99-m-%';
UPDATE band_members SET member_id =
  REPLACE(REPLACE(REPLACE(member_id, 'saetia-', ''), 'yaphet-kotto-', ''), 'pg-99-', '')
  WHERE member_id LIKE 'saetia-m-%' OR member_id LIKE 'yaphet-kotto-m-%' OR member_id LIKE 'pg-99-m-%';
UPDATE claim_sources SET entity_id =
  REPLACE(REPLACE(REPLACE(entity_id, 'saetia-', ''), 'yaphet-kotto-', ''), 'pg-99-', '')
  WHERE entity_type = 'member'
    AND (entity_id LIKE 'saetia-m-%' OR entity_id LIKE 'yaphet-kotto-m-%' OR entity_id LIKE 'pg-99-m-%');
DELETE FROM members
  WHERE id LIKE 'saetia-m-%' OR id LIKE 'yaphet-kotto-m-%' OR id LIKE 'pg-99-m-%';
