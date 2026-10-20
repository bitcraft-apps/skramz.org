-- Yaphet Kotto links 002: external profile buttons for the Elsewhere strip.
-- Only URLs verified live on 2026-10-20 are included: the MusicBrainz group
-- page (API-checked: begin 1996, end 2005, begin-area Santa Cruz) and the
-- Discogs artist entry (fetched, catalogue depth confirmed). RateYourMusic
-- stays out: its artist page returned 403 to a direct fetch, so no URL can be
-- attested — add it in a later batch once reachable, per policy §1.
-- Portal allowlist + https rule per api/seeds/band_links.sql.
-- Apply with `task bootstrap`, or singly with
-- `task evidence BAND=yaphet-kotto N=002-links.sql`. Plain INSERTs on purpose:
-- a UNIQUE conflict means the link is already there.
INSERT INTO band_links (id, band_id, portal, url) VALUES
  ('yaphet-kotto-bl-musicbrainz', 'band-yaphet-kotto', 'musicbrainz', 'https://musicbrainz.org/artist/3e1051e0-140c-40b1-b77e-c058a9c6aa57'),
  ('yaphet-kotto-bl-discogs', 'band-yaphet-kotto', 'discogs', 'https://www.discogs.com/artist/445131-Yaphet-Kotto');
