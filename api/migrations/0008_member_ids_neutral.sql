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
-- the '%-m-%' predicate matches nothing starting with 'm-'.
-- SUBSTR/INSTR strips any '{band}-' prefix without enumerating bands, so the
-- next band never needs a migration edit.
INSERT INTO members (id, name, name_norm, bio, created_at, updated_at)
  SELECT
    SUBSTR(id, INSTR(id, '-m-') + 1),
    name, name_norm, bio, created_at, updated_at
  FROM members
  WHERE id LIKE '%-m-%' AND id NOT LIKE 'm-%';
UPDATE band_members SET member_id =
  SUBSTR(member_id, INSTR(member_id, '-m-') + 1)
  WHERE member_id LIKE '%-m-%' AND member_id NOT LIKE 'm-%';
UPDATE claim_sources SET entity_id =
  SUBSTR(entity_id, INSTR(entity_id, '-m-') + 1)
  WHERE entity_type = 'member'
    AND entity_id LIKE '%-m-%' AND entity_id NOT LIKE 'm-%';
DELETE FROM members
  WHERE id LIKE '%-m-%' AND id NOT LIKE 'm-%';
