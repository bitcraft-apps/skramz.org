-- ADR docs/adr/0005-claim-sources-sidecar.md.
CREATE TABLE claim_sources (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('band','member','band_member','release','media_link')),
  entity_id TEXT NOT NULL, field TEXT NOT NULL, value TEXT,
  status TEXT NOT NULL CHECK (status IN ('confirmed','unconfirmed','disputed')),
  tier INTEGER NOT NULL CHECK (tier IN (1,2,3)),
  source_url TEXT NOT NULL, accessed_at TEXT NOT NULL, note TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (entity_type, entity_id, field, value, source_url)
);
CREATE INDEX idx_claim_sources_lookup ON claim_sources(entity_type, entity_id);
