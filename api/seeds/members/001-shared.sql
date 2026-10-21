-- Shared members seed: person-level rows for people who play in more than
-- one band. Apply before any per-band 001-band.sql so no band file depends
-- on a sibling. Member ids are neutral person slugs (m-<name>), never
-- band-prefixed; each band's edges stay band-scoped in its own 001.
INSERT INTO members (id, name, name_norm) VALUES
  ('m-steve-roche', 'Steve Roche', 'steve roche');
