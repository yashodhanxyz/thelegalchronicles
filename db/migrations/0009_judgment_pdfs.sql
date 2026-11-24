CREATE TABLE judgment_pdf_chunks (
  judgment_id INTEGER NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  payload_base64 TEXT NOT NULL CHECK (length(payload_base64) <= 32768),
  PRIMARY KEY (judgment_id, chunk_index)
) WITHOUT ROWID;
