PRAGMA foreign_keys = ON;

CREATE TABLE case_enrichment_snapshots (
  id INTEGER PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'sci_case_status',
  source_scope TEXT NOT NULL,
  dataset_sha256 TEXT NOT NULL UNIQUE,
  source_file_name TEXT NOT NULL,
  raw_storage_status TEXT NOT NULL DEFAULT 'local_only'
    CHECK (raw_storage_status IN ('local_only', 'r2_stored')),
  raw_r2_key TEXT,
  records_seen INTEGER NOT NULL,
  records_found INTEGER NOT NULL,
  records_not_found INTEGER NOT NULL,
  unique_source_cases INTEGER NOT NULL,
  collected_from TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE court_cases (
  id INTEGER PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'sci_case_status',
  source_case_identifier TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL,
  matched_case_number_source TEXT,
  title_source TEXT,
  petitioner_source TEXT,
  respondent_source TEXT,
  court_source TEXT,
  bench_source TEXT,
  case_type_source TEXT,
  case_number_source TEXT,
  case_year INTEGER,
  diary_number_source TEXT,
  filing_date_source TEXT,
  filing_date_iso TEXT,
  registration_date_source TEXT,
  registration_date_iso TEXT,
  decision_date_source TEXT,
  decision_date_iso TEXT,
  disposal_date_source TEXT,
  disposal_date_iso TEXT,
  case_status_source TEXT,
  disposal_nature_source TEXT,
  category_source TEXT,
  official_neutral_citations_source TEXT,
  last_hearing_date_source TEXT,
  last_hearing_date_iso TEXT,
  next_hearing_date_source TEXT,
  next_hearing_date_iso TEXT,
  raw_payload_sha256 TEXT NOT NULL,
  raw_payload_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_system, source_case_identifier)
);

CREATE INDEX court_cases_diary_idx
  ON court_cases (diary_number_source);
CREATE INDEX court_cases_case_number_idx
  ON court_cases (case_type_source, case_number_source, case_year);
CREATE INDEX court_cases_decision_date_idx
  ON court_cases (decision_date_iso DESC);

CREATE TABLE judgment_case_enrichments (
  judgment_id INTEGER PRIMARY KEY REFERENCES judgments(id) ON DELETE CASCADE,
  court_case_id INTEGER REFERENCES court_cases(id) ON DELETE RESTRICT,
  snapshot_id INTEGER NOT NULL REFERENCES case_enrichment_snapshots(id) ON DELETE RESTRICT,
  enrichment_key TEXT NOT NULL UNIQUE,
  input_case_number TEXT NOT NULL,
  lookup_status TEXT NOT NULL
    CHECK (lookup_status IN ('found', 'not_found', 'multiple_matches', 'error', 'blocked')),
  match_basis TEXT NOT NULL
    CHECK (match_basis IN (
      'judgment_document_neutral_citation',
      'judgment_document_date',
      'official_case_neutral_citation',
      'official_citation_correction',
      'unmatched',
      'review_required'
    )),
  verification_status TEXT NOT NULL
    CHECK (verification_status IN ('verified', 'unmatched', 'review_required')),
  collection_notes TEXT,
  source_retrieved_at TEXT NOT NULL,
  raw_payload_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX judgment_case_enrichments_case_idx
  ON judgment_case_enrichments (court_case_id, judgment_id);
CREATE INDEX judgment_case_enrichments_status_idx
  ON judgment_case_enrichments (lookup_status, verification_status);

CREATE TABLE court_case_documents (
  id INTEGER PRIMARY KEY,
  court_case_id INTEGER NOT NULL REFERENCES court_cases(id) ON DELETE CASCADE,
  document_url_source TEXT NOT NULL,
  document_url_normalized TEXT NOT NULL,
  label_source TEXT,
  document_type_source TEXT,
  document_date_source TEXT,
  document_date_iso TEXT,
  neutral_citation_source TEXT,
  source_position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (court_case_id, document_url_normalized)
);

CREATE INDEX court_case_documents_date_idx
  ON court_case_documents (document_date_iso DESC, court_case_id);
CREATE INDEX court_case_documents_citation_idx
  ON court_case_documents (neutral_citation_source, court_case_id);

CREATE TABLE judgment_case_documents (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES court_case_documents(id) ON DELETE CASCADE,
  match_basis TEXT NOT NULL
    CHECK (match_basis IN ('neutral_citation', 'decision_date', 'citation_and_date')),
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (judgment_id, document_id)
);

CREATE INDEX judgment_case_documents_document_idx
  ON judgment_case_documents (document_id, judgment_id);

CREATE TABLE judgment_citation_aliases (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  source_citation TEXT NOT NULL,
  canonical_citation TEXT NOT NULL,
  authority TEXT NOT NULL,
  verification_source_url TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (judgment_id, source_citation, canonical_citation)
);

PRAGMA optimize;
