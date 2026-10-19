-- Freshness writes: updated_at on child tables plus parent-touch triggers.
-- Bands already carry created_at + updated_at; claim_sources already carries
-- both and is untouched here. Members and releases carry created_at only, so
-- their rows backfill updated_at from created_at. band_members and
-- media_links have no created_at, so their pre-existing rows keep
-- updated_at NULL (unknown, never fabricated).
-- Portable SQLite only; no Postgres-isms. ADD COLUMN takes no expression
-- default on non-empty tables, hence nullable columns plus triggers.
ALTER TABLE members ADD COLUMN updated_at TEXT;
ALTER TABLE band_members ADD COLUMN updated_at TEXT;
ALTER TABLE releases ADD COLUMN updated_at TEXT;
ALTER TABLE media_links ADD COLUMN updated_at TEXT;

-- Bands self-stamp so freshness no longer relies on route code remembering
-- to set updated_at. The WHEN guard keeps explicit writes and stops re-fire
-- (recursive_triggers is OFF by default in SQLite/D1).
CREATE TRIGGER IF NOT EXISTS trg_bands_stamp_insert AFTER INSERT ON bands
WHEN NEW.updated_at IS NULL
BEGIN
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_bands_stamp_update AFTER UPDATE ON bands
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

-- Member updates touch every band the member belongs to. Inserts only
-- self-stamp: no band_members row can reference the member yet.
CREATE TRIGGER IF NOT EXISTS trg_members_stamp_insert AFTER INSERT ON members
WHEN NEW.updated_at IS NULL
BEGIN
  UPDATE members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_members_stamp_update AFTER UPDATE ON members
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id IN (SELECT band_id FROM band_members WHERE member_id = NEW.id);
END;

-- Join-table writes stamp the row and touch the parent band.
CREATE TRIGGER IF NOT EXISTS trg_band_members_stamp_insert AFTER INSERT ON band_members
WHEN NEW.updated_at IS NULL
BEGIN
  UPDATE band_members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_band_members_stamp_update AFTER UPDATE ON band_members
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE band_members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;

-- Release writes stamp the row and touch the parent band.
CREATE TRIGGER IF NOT EXISTS trg_releases_stamp_insert AFTER INSERT ON releases
WHEN NEW.updated_at IS NULL
BEGIN
  UPDATE releases SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_releases_stamp_update AFTER UPDATE ON releases
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE releases SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;

-- Media-link writes stamp the row and touch the parent band, either directly
-- or through the linked release (exactly one parent per the table CHECK).
-- One trigger per write: the self-stamp stays conditional so explicit writes
-- win, while the parent touch is unconditional.
CREATE TRIGGER IF NOT EXISTS trg_media_links_insert AFTER INSERT ON media_links
BEGIN
  UPDATE media_links SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS NULL;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = COALESCE(NEW.band_id, (SELECT band_id FROM releases WHERE id = NEW.release_id));
END;
CREATE TRIGGER IF NOT EXISTS trg_media_links_update AFTER UPDATE ON media_links
BEGIN
  UPDATE media_links SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS OLD.updated_at;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = COALESCE(NEW.band_id, (SELECT band_id FROM releases WHERE id = NEW.release_id));
END;

-- Backfill where a trustworthy value exists; join tables keep NULL.
UPDATE members SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE releases SET updated_at = created_at WHERE updated_at IS NULL;
