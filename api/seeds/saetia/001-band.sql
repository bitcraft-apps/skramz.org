-- Saetia seed: display rows transcribed verbatim from the production record
-- (UUID 738425d5-4033-4df1-85bd-6a984ef0830d, created 2026-10-16) during the
-- from-scratch prod rebuild; only ids changed (stable slug ids). Backup of the
-- exported prod dump: /tmp/skramz-prod-backup-2026-10-20.sql (operator-held).
-- Roles and bio are unsourced display values carried over as-is; confirm them
-- with later evidence batches (002+), never by editing this file.
-- Steve Roche is the shared member across Saetia and Yaphet Kotto: his member
-- row is canonical HERE (alphabetically first band); yaphet-kotto/001-band.sql
-- references this id for its edge. Manifest must apply saetia before yaphet-kotto.
-- Apply with `task bootstrap`, or singly with
-- `task evidence BAND=saetia N=001-band.sql`. Plain INSERTs on purpose: a UNIQUE
-- conflict means the record already exists, so merge by hand. Fixed ids.
-- Portable SQLite.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-saetia', 'Saetia', 'saetia', 1997, NULL,
   'New York City, US',
   'New York City screamo band formed in February 1997. Disbanded in October 1999; reunited in November 2022 for benefit shows in New York and Philadelphia and continues to perform.');

INSERT INTO members (id, name, name_norm) VALUES
  ('saetia-m-adam-marino', 'Adam Marino', 'adam marino'),
  ('saetia-m-billy-werner', 'Billy Werner', 'billy werner'),
  ('saetia-m-colin-bartoldus', 'Colin Bartoldus', 'colin bartoldus'),
  ('saetia-m-greg-drudy', 'Greg Drudy', 'greg drudy'),
  ('saetia-m-jamie-behar', 'Jamie Behar', 'jamie behar'),
  ('saetia-m-steve-roche', 'Steve Roche', 'steve roche');

INSERT INTO band_members (id, band_id, member_id, role) VALUES
  ('saetia-bm-adam-marino', 'band-saetia', 'saetia-m-adam-marino', 'guitar'),
  ('saetia-bm-billy-werner', 'band-saetia', 'saetia-m-billy-werner', 'vocals'),
  ('saetia-bm-colin-bartoldus', 'band-saetia', 'saetia-m-colin-bartoldus', 'bass, guitar'),
  ('saetia-bm-greg-drudy', 'band-saetia', 'saetia-m-greg-drudy', 'drums'),
  ('saetia-bm-jamie-behar', 'band-saetia', 'saetia-m-jamie-behar', 'guitar'),
  ('saetia-bm-steve-roche', 'band-saetia', 'saetia-m-steve-roche', 'bass');
