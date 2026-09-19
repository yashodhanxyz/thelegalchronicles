PRAGMA foreign_keys = ON;

CREATE TABLE judgments (
  id INTEGER PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'scr',
  source_citation_year INTEGER NOT NULL,
  source_path TEXT NOT NULL,
  source_neutral_key TEXT NOT NULL,
  source_listing_url TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title_source TEXT NOT NULL,
  scr_citation TEXT,
  neutral_citation TEXT,
  decision_date_source TEXT,
  decision_date_iso TEXT,
  decision_year INTEGER,
  case_number_source TEXT,
  case_type TEXT,
  disposal_nature_source TEXT,
  bench_size_source TEXT,
  bench_size INTEGER,
  coram_source TEXT,
  result_excerpt_source TEXT,
  body_source_r2_key TEXT,
  body_render_r2_key TEXT,
  body_sha256 TEXT,
  body_word_count INTEGER,
  content_status TEXT NOT NULL DEFAULT 'metadata_only'
    CHECK (content_status IN (
      'metadata_only',
      'captured',
      'validated',
      'published',
      'rejected'
    )),
  source_collected_at TEXT NOT NULL,
  source_checked_at TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_system, source_citation_year, source_path, source_neutral_key)
);

CREATE INDEX judgments_decision_year_idx
  ON judgments (decision_year, decision_date_iso DESC);
CREATE INDEX judgments_case_type_idx
  ON judgments (case_type);
CREATE INDEX judgments_disposal_nature_idx
  ON judgments (disposal_nature_source);
CREATE INDEX judgments_bench_size_idx
  ON judgments (bench_size);
CREATE INDEX judgments_content_status_idx
  ON judgments (content_status);
CREATE INDEX judgments_neutral_citation_idx
  ON judgments (source_system, neutral_citation);

CREATE TABLE judges (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_source TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE judgment_judges (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE RESTRICT,
  source_position INTEGER NOT NULL,
  is_author INTEGER CHECK (is_author IN (0, 1)),
  PRIMARY KEY (judgment_id, judge_id)
);

CREATE INDEX judgment_judges_judge_idx
  ON judgment_judges (judge_id, judgment_id);

CREATE TABLE acts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_source TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  act_year INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (title_normalized, act_year)
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  act_id INTEGER REFERENCES acts(id) ON DELETE RESTRICT,
  label_source TEXT NOT NULL,
  label_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (act_id, label_normalized)
);

CREATE TABLE judgment_sections (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  source_position INTEGER,
  PRIMARY KEY (judgment_id, section_id)
);

CREATE INDEX judgment_sections_section_idx
  ON judgment_sections (section_id, judgment_id);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label_source TEXT NOT NULL,
  label_normalized TEXT NOT NULL UNIQUE,
  provenance TEXT NOT NULL DEFAULT 'scr'
    CHECK (provenance IN ('scr', 'editorial', 'ai')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE judgment_categories (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  source_position INTEGER,
  PRIMARY KEY (judgment_id, category_id)
);

CREATE INDEX judgment_categories_category_idx
  ON judgment_categories (category_id, judgment_id);

CREATE TABLE keywords (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label_source TEXT NOT NULL,
  label_normalized TEXT NOT NULL UNIQUE,
  provenance TEXT NOT NULL DEFAULT 'scr'
    CHECK (provenance IN ('scr', 'editorial', 'ai')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE judgment_keywords (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE RESTRICT,
  source_position INTEGER,
  PRIMARY KEY (judgment_id, keyword_id)
);

CREATE INDEX judgment_keywords_keyword_idx
  ON judgment_keywords (keyword_id, judgment_id);

CREATE TABLE case_references (
  id INTEGER PRIMARY KEY,
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  source_position INTEGER NOT NULL,
  title_source TEXT,
  citation_source TEXT NOT NULL,
  referenced_judgment_id INTEGER REFERENCES judgments(id) ON DELETE SET NULL,
  UNIQUE (judgment_id, source_position)
);

CREATE INDEX case_references_citation_idx
  ON case_references (citation_source);

CREATE TABLE ingestion_runs (
  id INTEGER PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'scr',
  citation_year INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('started', 'completed', 'partial', 'blocked', 'failed')),
  cursor_json TEXT,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_written INTEGER NOT NULL DEFAULT 0,
  records_rejected INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_summary TEXT
);

CREATE INDEX ingestion_runs_year_status_idx
  ON ingestion_runs (citation_year, status, started_at DESC);
