-- Pg.99 links 002: external profile buttons for the Elsewhere strip.
-- MusicBrainz group page verified via API on 2026-10-20 (area Sterling).
-- Discogs entry attested via search snippet carrying the matching profile
-- text (Sterling, Virginia, 1997 to 2003, August 2011 reunion); direct fetch
-- currently 403s for bots. RateYourMusic stays out: no reachable page attests
-- the slug — same rule as yaphet-kotto/002-links.sql.
INSERT INTO band_links (id, band_id, portal, url) VALUES
  ('pg-99-bl-musicbrainz', 'band-pg-99', 'musicbrainz', 'https://musicbrainz.org/artist/7a3320fe-ec80-444b-ae06-503dbaf7293a'),
  ('pg-99-bl-discogs', 'band-pg-99', 'discogs', 'https://www.discogs.com/artist/445144-Pg99');
