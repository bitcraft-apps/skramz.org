-- Pg.99 seed: display rows transcribed verbatim from the production record
-- (UUID 1d199df8-61ad-4cf4-a2ea-38032ae9d020, created 2026-10-16) during the
-- from-scratch prod rebuild; only ids changed (stable slug ids). Backup of the
-- exported prod dump: /tmp/skramz-prod-backup-2026-10-20.sql (operator-held).
-- Roles and bio are unsourced display values carried over as-is; confirm them
-- with later evidence batches (002+), never by editing this file.
-- Apply with `task bootstrap`, or singly with
-- `task evidence BAND=pg-99 N=001-band.sql`. Plain INSERTs on purpose:
-- a UNIQUE conflict means the record already exists, so merge by hand.
-- Fixed ids. Portable SQLite.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-pg-99', 'Pg.99', 'pg 99', 1997, 2003,
   'Sterling, Virginia, US',
   'Sterling, Virginia hardcore/screamo band active from 1997 to 2003. Reunited briefly in August 2011 for two shows and has played sporadic reunion shows since.');

INSERT INTO members (id, name, name_norm) VALUES
  ('pg-99-m-blake-midgette', 'Blake Midgette', 'blake midgette'),
  ('pg-99-m-brandon-evans', 'Brandon Evans', 'brandon evans'),
  ('pg-99-m-chris-taylor', 'Chris Taylor', 'chris taylor'),
  ('pg-99-m-george-crum', 'George Crum', 'george crum'),
  ('pg-99-m-johnny-ward', 'Johnny Ward', 'johnny ward'),
  ('pg-99-m-mike-taylor', 'Mike Taylor', 'mike taylor');

INSERT INTO band_members (id, band_id, member_id, role) VALUES
  ('pg-99-bm-blake-midgette', 'band-pg-99', 'pg-99-m-blake-midgette', 'vocals'),
  ('pg-99-bm-brandon-evans', 'band-pg-99', 'pg-99-m-brandon-evans', 'bass'),
  ('pg-99-bm-chris-taylor', 'band-pg-99', 'pg-99-m-chris-taylor', 'vocals'),
  ('pg-99-bm-george-crum', 'band-pg-99', 'pg-99-m-george-crum', 'guitar'),
  ('pg-99-bm-johnny-ward', 'band-pg-99', 'pg-99-m-johnny-ward', 'drums'),
  ('pg-99-bm-mike-taylor', 'band-pg-99', 'pg-99-m-mike-taylor', 'guitar');
