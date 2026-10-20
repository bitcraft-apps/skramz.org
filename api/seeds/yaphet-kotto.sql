-- Yaphet Kotto seed: deepest-correct-record lineup.
-- Display tables keep winning values only (NULL = visible gap, shown with an
-- unconfirmed badge); every claim below has its evidence in claim_sources.
-- Bio is own words, derived from the cited label/discography sources.
-- Provenance (verified 2026-10-20): T1 Ebullition catalog43 (location, Scott
-- on drums); T2 Discogs artist 445131 (formed 1996/disbanded 2005, 10 member
-- links, catalogue depth); Wikipedia (years/names/LP spine; tertiary, capped
-- T2, unreferenced lines T3); T3 diymusicwiki (role leads only, never confirms).
-- Losing rivals stay disputed (formed ~1997 T1 math; Keith Milller T2 spelling
-- vs Keith Miller T3); roles/years without T1/T2 stay NULL + unconfirmed.
-- Apply once per database with `task seed SEED=yaphet-kotto.sql`. Plain
-- INSERTs on purpose: a UNIQUE conflict means the record already exists, and
-- failing loudly beats INSERT OR IGNORE, which would skip the parent while
-- inserting orphan edges under foreign keys. Merge by hand on conflict.
-- Fixed ids. Portable SQLite.
INSERT INTO bands (id, name, name_norm, formed_year, disbanded_year, location, bio) VALUES
  ('band-yaphet-kotto', 'Yaphet Kotto', 'yaphet kotto', 1996, 2005,
   'Santa Cruz / San Francisco, California',
   'Emotive hardcore band from Santa Cruz, later based in San Francisco. Active 1996-2005. Three LPs on Ebullition plus splits and EPs.');

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

-- Only Scott Batiste clears the T1/T2 bar for a role (label catalog names him
-- on drums). All other roles and every join/leave year are NULL gaps.
INSERT INTO band_members (id, band_id, member_id, role, joined_year, left_year) VALUES
  ('yaphet-kotto-bm-austin-barber', 'band-yaphet-kotto', 'yaphet-kotto-m-austin-barber', NULL, NULL, NULL),
  ('yaphet-kotto-bm-casey-watson', 'band-yaphet-kotto', 'yaphet-kotto-m-casey-watson', NULL, NULL, NULL),
  ('yaphet-kotto-bm-chris-story', 'band-yaphet-kotto', 'yaphet-kotto-m-chris-story', NULL, NULL, NULL),
  ('yaphet-kotto-bm-jose-palafox', 'band-yaphet-kotto', 'yaphet-kotto-m-jose-palafox', NULL, NULL, NULL),
  ('yaphet-kotto-bm-keith-miller', 'band-yaphet-kotto', 'yaphet-kotto-m-keith-miller', NULL, NULL, NULL),
  ('yaphet-kotto-bm-luke-clements', 'band-yaphet-kotto', 'yaphet-kotto-m-luke-clements', NULL, NULL, NULL),
  ('yaphet-kotto-bm-mag-delana', 'band-yaphet-kotto', 'yaphet-kotto-m-mag-delana', NULL, NULL, NULL),
  ('yaphet-kotto-bm-pat-crowley', 'band-yaphet-kotto', 'yaphet-kotto-m-pat-crowley', NULL, NULL, NULL),
  ('yaphet-kotto-bm-paul-cameron', 'band-yaphet-kotto', 'yaphet-kotto-m-paul-cameron', NULL, NULL, NULL),
  ('yaphet-kotto-bm-scott-batiste', 'band-yaphet-kotto', 'yaphet-kotto-m-scott-batiste', 'drums', NULL, NULL);

-- Evidence sidecar. Tiers: 1 label/official, 2 reputable with history,
-- 3 community (lead only, never confirms).
INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at, note) VALUES
  ('yaphet-kotto-cs-formed', 'band', 'band-yaphet-kotto', 'formed_year', '1996', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-disbanded', 'band', 'band-yaphet-kotto', 'disbanded_year', '2005', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-location', 'band', 'band-yaphet-kotto', 'location', 'Santa Cruz / San Francisco, California', 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Label catalog wording: originally hailing from Santa Cruz, now based in San Francisco.'),
  ('yaphet-kotto-cs-formed-rival', 'band', 'band-yaphet-kotto', 'formed_year', '~1997', 'disputed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Label copy on the 2004 LP says active for seven years, implying about 1997; kept as the losing rival.'),
  ('yaphet-kotto-cs-bio', 'band', 'band-yaphet-kotto', 'bio', NULL, 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Own-words summary of the label catalog discography spine.'),
  ('yaphet-kotto-cs-years', 'band', 'band-yaphet-kotto', 'lineup_years', NULL, 'unconfirmed', 3,
   'https://en.wikipedia.org/wiki/Yaphet_Kotto_(band)', '2026-10-20',
   'No T1/T2 source gives join/leave years; community lists give names only.'),
  ('yaphet-kotto-cs-mb-austin-barber', 'band_member', 'yaphet-kotto-bm-austin-barber', 'membership', 'Austin Barber', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-casey-watson', 'band_member', 'yaphet-kotto-bm-casey-watson', 'membership', 'Casey Watson', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-chris-story', 'band_member', 'yaphet-kotto-bm-chris-story', 'membership', 'Chris Story', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-jose-palafox', 'band_member', 'yaphet-kotto-bm-jose-palafox', 'membership', 'Jose Palafox', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-keith-miller', 'band_member', 'yaphet-kotto-bm-keith-miller', 'membership', 'Keith Miller', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-luke-clements', 'band_member', 'yaphet-kotto-bm-luke-clements', 'membership', 'Luke Clements', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-mag-delana', 'band_member', 'yaphet-kotto-bm-mag-delana', 'membership', 'Mag Delana', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-pat-crowley', 'band_member', 'yaphet-kotto-bm-pat-crowley', 'membership', 'Pat Crowley', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-paul-cameron', 'band_member', 'yaphet-kotto-bm-paul-cameron', 'membership', 'Paul Cameron', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-mb-scott-batiste', 'band_member', 'yaphet-kotto-bm-scott-batiste', 'membership', 'Scott Batiste', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-role-scott', 'band_member', 'yaphet-kotto-bm-scott-batiste', 'role', 'drums', 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Label catalog names Scott on drums.'),
  ('yaphet-kotto-cs-role-mag', 'band_member', 'yaphet-kotto-bm-mag-delana', 'role', 'guitar/vocals', 'unconfirmed', 3,
   'http://www.diymusicwiki.com/yaphet-kotto', '2026-10-20',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('yaphet-kotto-cs-role-chris', 'band_member', 'yaphet-kotto-bm-chris-story', 'role', 'bass', 'unconfirmed', 3,
   'http://www.diymusicwiki.com/yaphet-kotto', '2026-10-20',
   'Community lead only; display stays NULL until a T1/T2 source confirms.'),
  ('yaphet-kotto-cs-name-keith-a', 'member', 'yaphet-kotto-m-keith-miller', 'name', 'Keith Milller', 'disputed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20',
   'Discogs spelling with three l-letters; kept as the losing rival.'),
  ('yaphet-kotto-cs-name-keith-b', 'member', 'yaphet-kotto-m-keith-miller', 'name', 'Keith Miller', 'disputed', 3,
   'https://en.wikipedia.org/wiki/Yaphet_Kotto_(band)', '2026-10-20',
   'Displayed spelling; community source, so the row stays disputed, not confirmed.');

-- Timestamps need no explicit writes: bands/claim_sources default to now(),
-- members/band_members self-stamp via the migration 0006 triggers.
