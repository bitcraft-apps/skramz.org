-- Pg.99 display rows transcribed verbatim from the production record
-- (UUID 1d199df8-61ad-4cf4-a2ea-38032ae9d020, created 2026-10-16); only ids
-- changed to stable slug ids. Roles and bio are unsourced display values
-- carried over as-is; confirm with later evidence batches, never by editing
-- this file.
-- Member ids are neutral person slugs (m-<name>): shared people live in
-- api/seeds/members/001-shared.sql, applied before any band file.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-pg-99', 'Pg.99', 'pg 99', 1997, 2003,
   'Sterling, Virginia, US',
   'Sterling, Virginia hardcore/screamo band active from 1997 to 2003. Reunited briefly in August 2011 for two shows and has played sporadic reunion shows since.');

INSERT INTO members (id, name, name_norm) VALUES
  ('m-blake-midgette', 'Blake Midgette', 'blake midgette'),
  ('m-brandon-evans', 'Brandon Evans', 'brandon evans'),
  ('m-chris-taylor', 'Chris Taylor', 'chris taylor'),
  ('m-george-crum', 'George Crum', 'george crum'),
  ('m-johnny-ward', 'Johnny Ward', 'johnny ward'),
  ('m-mike-taylor', 'Mike Taylor', 'mike taylor');

INSERT INTO band_members (id, band_id, member_id, role) VALUES
  ('pg-99-bm-blake-midgette', 'band-pg-99', 'm-blake-midgette', 'vocals'),
  ('pg-99-bm-brandon-evans', 'band-pg-99', 'm-brandon-evans', 'bass'),
  ('pg-99-bm-chris-taylor', 'band-pg-99', 'm-chris-taylor', 'vocals'),
  ('pg-99-bm-george-crum', 'band-pg-99', 'm-george-crum', 'guitar'),
  ('pg-99-bm-johnny-ward', 'band-pg-99', 'm-johnny-ward', 'drums'),
  ('pg-99-bm-mike-taylor', 'band-pg-99', 'm-mike-taylor', 'guitar');
