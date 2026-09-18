CREATE INDEX judgments_catalog_date_idx
  ON judgments (
    source_system,
    source_citation_year,
    decision_date_iso DESC,
    id DESC
  );

CREATE INDEX judgments_catalog_case_type_idx
  ON judgments (
    source_system,
    source_citation_year,
    case_type,
    decision_date_iso DESC,
    id DESC
  );

PRAGMA optimize;
