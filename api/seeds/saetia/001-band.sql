-- Saetia display rows transcribed verbatim from the production record
-- (UUID 738425d5-4033-4df1-85bd-6a984ef0830d, created 2026-10-16); only ids
-- changed to stable slug ids. Roles and bio are unsourced display values
-- carried over as-is; confirm with later evidence batches, never by editing
-- this file.
-- Member ids are neutral person slugs (m-<name>): shared people live in
-- api/seeds/members/001-shared.sql, applied before any band file.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-saetia', 'Saetia', 'saetia', 1997, NULL,
   'New York City, US',
   'New York City screamo band formed in February 1997. Disbanded in October 1999; reunited in November 2022 for benefit shows in New York and Philadelphia and continues to perform.');

INSERT INTO members (id, name, name_norm) VALUES
  ('m-adam-marino', 'Adam Marino', 'adam marino'),
  ('m-billy-werner', 'Billy Werner', 'billy werner'),
  ('m-colin-bartoldus', 'Colin Bartoldus', 'colin bartoldus'),
  ('m-greg-drudy', 'Greg Drudy', 'greg drudy'),
  ('m-jamie-behar', 'Jamie Behar', 'jamie behar');

INSERT INTO band_members (id, band_id, member_id, role) VALUES
  ('saetia-bm-adam-marino', 'band-saetia', 'm-adam-marino', 'guitar'),
  ('saetia-bm-billy-werner', 'band-saetia', 'm-billy-werner', 'vocals'),
  ('saetia-bm-colin-bartoldus-bass', 'band-saetia', 'm-colin-bartoldus', 'bass'),
  ('saetia-bm-colin-bartoldus-guitar', 'band-saetia', 'm-colin-bartoldus', 'guitar'),
  ('saetia-bm-greg-drudy', 'band-saetia', 'm-greg-drudy', 'drums'),
  ('saetia-bm-jamie-behar', 'band-saetia', 'm-jamie-behar', 'guitar'),
  ('saetia-bm-steve-roche', 'band-saetia', 'm-steve-roche', 'bass');
