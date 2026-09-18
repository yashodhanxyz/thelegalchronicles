PRAGMA foreign_keys = ON;

CREATE TABLE judgment_source_assets (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  asset_kind TEXT NOT NULL
    CHECK (asset_kind IN ('split_html', 'html_view', 'source_pdf', 'flip_view')),
  action_status TEXT NOT NULL DEFAULT 'not_listed'
    CHECK (action_status IN ('not_listed', 'listed')),
  verification_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (verification_status IN (
      'not_checked',
      'available',
      'unavailable',
      'session_expired',
      'error'
    )),
  checked_at TEXT,
  http_status INTEGER,
  error_code TEXT,
  error_detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (judgment_id, asset_kind)
);
CREATE INDEX judgment_source_assets_coverage_idx
  ON judgment_source_assets (asset_kind, verification_status, action_status);

CREATE TABLE source_inventory_snapshots (
  id INTEGER PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'scr',
  observed_total INTEGER NOT NULL,
  captured_records INTEGER NOT NULL,
  first_source_position INTEGER,
  last_source_position INTEGER,
  source_session_started_at TEXT,
  captured_at TEXT NOT NULL,
  notes TEXT
);
