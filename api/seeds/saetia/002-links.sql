-- Saetia links 002: external profile buttons for the Elsewhere strip.
-- MusicBrainz group page verified via API on 2026-10-20 (begin 1997-02,
-- begin-area New York). Discogs entry attested via search snippet carrying the
-- matching profile text (formed February 1997, disbanded October 1999,
-- reunited November 2022); direct fetch currently 403s for bots.
-- RateYourMusic stays out: no reachable page attests the slug — same rule as
-- yaphet-kotto/002-links.sql.
INSERT INTO band_links (id, band_id, portal, url) VALUES
  ('saetia-bl-musicbrainz', 'band-saetia', 'musicbrainz', 'https://musicbrainz.org/artist/cd4f7c44-9ff3-4660-9f93-170fef83edfd'),
  ('saetia-bl-discogs', 'band-saetia', 'discogs', 'https://www.discogs.com/artist/1107526-Saetia');
