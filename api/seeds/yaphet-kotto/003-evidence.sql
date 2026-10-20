-- Yaphet Kotto evidence 003: confirmation batch carried over verbatim from the
-- retired research seed (api/seeds/yaphet-kotto.sql), with two rebuild
-- adjustments: the location claim value now matches the production display
-- string (note keeps the source's actual wording), and the bio note flags that
-- the display text changed in the rebuild and needs re-verification against
-- the cited source before its sentences count as confirmed.
-- Entity ids are identical to 001-band.sql.
-- Tiers per docs/content-policy.md. accessed_at is the live-verification date.
-- Apply with `task bootstrap`, or singly with
-- `task evidence BAND=yaphet-kotto N=003-evidence.sql`. Plain INSERTs on
-- purpose: a UNIQUE conflict means the evidence is already there.
INSERT INTO claim_sources (id, entity_type, entity_id, field, value, status, tier, source_url, accessed_at, note) VALUES
  ('yaphet-kotto-cs-formed', 'band', 'band-yaphet-kotto', 'formed_year', '1996', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-disbanded', 'band', 'band-yaphet-kotto', 'disbanded_year', '2005', 'confirmed', 2,
   'https://www.discogs.com/artist/445131-Yaphet-Kotto', '2026-10-20', NULL),
  ('yaphet-kotto-cs-location', 'band', 'band-yaphet-kotto', 'location', 'Santa Cruz, California, US', 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Label catalog wording: originally hailing from Santa Cruz, now based in San Francisco.'),
  ('yaphet-kotto-cs-formed-rival', 'band', 'band-yaphet-kotto', 'formed_year', '~1997', 'disputed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Label copy on the We Bury Our Dead Alive LP says active for seven years, implying about 1997; losing rival, display stays 1996 (derived values never displace directly attested ones).'),
  ('yaphet-kotto-cs-bio', 'band', 'band-yaphet-kotto', 'bio', NULL, 'confirmed', 1,
   'http://www.ebullition.com/catalog43.html', '2026-10-20',
   'Rebuild changed the display bio to the production text; re-verify each sentence against the label catalog before treating it as confirmed.'),
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
