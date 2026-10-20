-- Yaphet Kotto display rows: union of the production record (UUID
-- 489c3264-bab9-48ed-994c-ff4a51df2427, created 2026-10-16) and the retired
-- Phase 5 research seed: 11 members, 11 edges. Production text verbatim; stable
-- slug ids identical to the retired seed so its evidence rows apply unchanged
-- as 003-evidence.sql. Steve Roche edge points at `saetia-m-steve-roche`
-- (canonical row in saetia/001-band.sql); apply saetia first. Scott Batiste
-- keeps `drums` (T1-attested, see 003); other roles and years are NULL gaps.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-yaphet-kotto', 'Yaphet Kotto', 'yaphet kotto', 1996, 2005,
   'Santa Cruz, California, US',
   'Santa Cruz hardcore punk band formed in 1996 and disbanded in 2005. Known for politically and socially engaged lyrics; released three full-lengths on Ebullition Records among other labels.');

INSERT INTO members (id, name, name_norm) VALUES
  ('yaphet-kotto-m-austin-barber', 'Austin Barber', 'austin barber'),
  ('yaphet-kotto-m-casey-watson', 'Casey Watson', 'casey watson'),
  ('yaphet-kotto-m-chris-story', 'Chris Story', 'chris story'),
  ('yaphet-kotto-m-jose-palafox', 'Jose Palafox', 'jose palafox'),
  ('yaphet-kotto-m-keith-miller', 'Keith Miller', 'keith miller'),
  ('yaphet-kotto-m-luke-clements', 'Luke Clements', 'luke clements'),
  ('yaphet-kotto-m-mag-delana', 'Mag Delana', 'mag delana'),
  ('yaphet-kotto-m-pat-crowley', 'Pat Crowley', 'pat crowley'),
  ('yaphet-kotto-m-paul-cameron', 'Paul Cameron', 'paul cameron'),
  ('yaphet-kotto-m-scott-batiste', 'Scott Batiste', 'scott batiste');

INSERT INTO band_members (id, band_id, member_id, role) VALUES
  ('yaphet-kotto-bm-austin-barber', 'band-yaphet-kotto', 'yaphet-kotto-m-austin-barber', NULL),
  ('yaphet-kotto-bm-casey-watson', 'band-yaphet-kotto', 'yaphet-kotto-m-casey-watson', NULL),
  ('yaphet-kotto-bm-chris-story', 'band-yaphet-kotto', 'yaphet-kotto-m-chris-story', NULL),
  ('yaphet-kotto-bm-jose-palafox', 'band-yaphet-kotto', 'yaphet-kotto-m-jose-palafox', NULL),
  ('yaphet-kotto-bm-keith-miller', 'band-yaphet-kotto', 'yaphet-kotto-m-keith-miller', NULL),
  ('yaphet-kotto-bm-luke-clements', 'band-yaphet-kotto', 'yaphet-kotto-m-luke-clements', NULL),
  ('yaphet-kotto-bm-mag-delana', 'band-yaphet-kotto', 'yaphet-kotto-m-mag-delana', NULL),
  ('yaphet-kotto-bm-pat-crowley', 'band-yaphet-kotto', 'yaphet-kotto-m-pat-crowley', NULL),
  ('yaphet-kotto-bm-paul-cameron', 'band-yaphet-kotto', 'yaphet-kotto-m-paul-cameron', NULL),
  ('yaphet-kotto-bm-scott-batiste', 'band-yaphet-kotto', 'yaphet-kotto-m-scott-batiste', 'drums'),
  ('yaphet-kotto-bm-steve-roche', 'band-yaphet-kotto', 'saetia-m-steve-roche', 'bass');
