PRAGMA foreign_keys = ON;
ALTER TABLE judgments ADD COLUMN body_storage TEXT CHECK (body_storage IS NULL OR body_storage = 'd1');
CREATE TABLE judgment_body_documents (
  sha256 TEXT PRIMARY KEY CHECK(length(sha256) = 64),
  kind TEXT NOT NULL CHECK(kind IN ('source', 'render')),
  byte_count INTEGER NOT NULL CHECK(byte_count > 0),
  chunk_count INTEGER NOT NULL CHECK(chunk_count > 0)
);
CREATE TABLE judgment_body_chunks (
  document_sha256 TEXT NOT NULL REFERENCES judgment_body_documents(sha256),
  chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
  payload_base64 TEXT NOT NULL CHECK(length(payload_base64) <= 32768),
  PRIMARY KEY(document_sha256, chunk_index)
) WITHOUT ROWID;
