CREATE TABLE judge_profiles (
 judge_id INTEGER PRIMARY KEY REFERENCES judges(id) ON DELETE RESTRICT,
 display_name TEXT NOT NULL,
 role_at_retrieval TEXT NOT NULL,
 birth_date TEXT NOT NULL,
 appointment_date TEXT NOT NULL,
 retirement_date TEXT NOT NULL,
 biography_json TEXT NOT NULL CHECK(json_valid(biography_json)),
 biography_sha256 TEXT NOT NULL CHECK(length(biography_sha256)=64),
 source_url TEXT NOT NULL,
 directory_url TEXT NOT NULL,
 retrieved_at TEXT NOT NULL
);
