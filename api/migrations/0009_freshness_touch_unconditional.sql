-- Freshness touch-up: parent band touch becomes unconditional.
-- Migration 0006 gated the whole trigger body behind WHEN NEW.updated_at IS
-- OLD.updated_at (updates) / IS NULL (inserts), so an explicit updated_at
-- write self-stamped the row but silently skipped the parent band touch,
-- contradicting the ADR 0006 touch rule that any child write moves band
-- freshness. This rework follows the media_links / band_links pattern: the
-- self-stamp stays conditional so explicit writes win, while the parent touch
-- runs on every write. Reassigning a row to another band now touches the old
-- parent too, otherwise the old band would keep looking fresh after losing
-- a member link or release. Portable SQLite only; no Postgres-isms.
DROP TRIGGER IF EXISTS trg_members_stamp_update;
CREATE TRIGGER trg_members_stamp_update AFTER UPDATE ON members
BEGIN
  UPDATE members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS OLD.updated_at;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id IN (SELECT band_id FROM band_members WHERE member_id = NEW.id);
END;
DROP TRIGGER IF EXISTS trg_band_members_stamp_insert;
CREATE TRIGGER trg_band_members_stamp_insert AFTER INSERT ON band_members
BEGIN
  UPDATE band_members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS NULL;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;
DROP TRIGGER IF EXISTS trg_band_members_stamp_update;
CREATE TRIGGER trg_band_members_stamp_update AFTER UPDATE ON band_members
BEGIN
  UPDATE band_members SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS OLD.updated_at;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id OR id = OLD.band_id;
END;
DROP TRIGGER IF EXISTS trg_releases_stamp_insert;
CREATE TRIGGER trg_releases_stamp_insert AFTER INSERT ON releases
BEGIN
  UPDATE releases SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS NULL;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id;
END;
DROP TRIGGER IF EXISTS trg_releases_stamp_update;
CREATE TRIGGER trg_releases_stamp_update AFTER UPDATE ON releases
BEGIN
  UPDATE releases SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id AND NEW.updated_at IS OLD.updated_at;
  UPDATE bands SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.band_id OR id = OLD.band_id;
END;
