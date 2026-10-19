-- External profile links per band (MusicBrainz / Discogs / RateYourMusic).
-- Portable SQLite only; no Postgres-isms. Seed rows live in api/seeds/*.sql,
-- never here. Timestamps + parent-touch triggers follow the 0006_updated_at
-- conventions so band freshness moves on link writes.
CREATE TABLE band_links (
  id TEXT PRIMARY KEY,
  band_id TEXT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  portal TEXT NOT NULL CHECK (portal IN ('musicbrainz', 'discogs', 'rym')),
  url TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (band_id, portal, url)
);
CREATE INDEX idx_band_links_band ON band_links(band_id);

-- Link writes stamp the row and touch the parent band (unconditional touch;
-- conditional self-stamp so explicit writes win).
CREATE TRIGGER IF NOT EXISTS trg_band_links_insert AFTER INSERT ON band_links
BEGIN
  UPDATE band_links SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS NULL;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_band_links_update AFTER UPDATE ON band_links
BEGIN
  UPDATE band_links SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS OLD.updated_at;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;
