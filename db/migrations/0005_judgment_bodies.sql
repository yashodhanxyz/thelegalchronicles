PRAGMA foreign_keys = ON;

ALTER TABLE judgments ADD COLUMN body_source_sha256 TEXT;
ALTER TABLE judgments ADD COLUMN body_render_sha256 TEXT;
ALTER TABLE judgments ADD COLUMN body_source_bytes INTEGER;
ALTER TABLE judgments ADD COLUMN body_render_bytes INTEGER;
ALTER TABLE judgments ADD COLUMN body_captured_at TEXT;
ALTER TABLE judgments ADD COLUMN body_validated_at TEXT;
ALTER TABLE judgments ADD COLUMN body_validation_version TEXT;

CREATE INDEX judgments_body_validation_idx
  ON judgments (content_status, body_validation_version, body_validated_at);

PRAGMA optimize;
