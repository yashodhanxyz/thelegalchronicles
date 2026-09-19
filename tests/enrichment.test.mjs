import assert from "node:assert/strict";
import test from "node:test";

import {
  extractNeutralCitation,
  normalizeOfficialUrl,
  parseEnrichmentKey,
  parseSourceDate,
} from "../scripts/build-d1-case-enrichment-import.mjs";

test("source dates normalize valid values and reject source placeholders", () => {
  assert.equal(parseSourceDate("12-08-2026"), "2026-08-12");
  assert.equal(parseSourceDate("12-08-2026 10:12 AM"), "2026-08-12");
  assert.equal(parseSourceDate("30-11--0001"), null);
  assert.equal(parseSourceDate("31-02-2026"), null);
  assert.equal(parseSourceDate(null), null);
});

test("official URLs require HTTPS and an approved SCI host", () => {
  assert.equal(
    normalizeOfficialUrl("https://api.sci.gov.in/../../officereport/2026/example.pdf"),
    "https://api.sci.gov.in/officereport/2026/example.pdf",
  );
  assert.throws(
    () => normalizeOfficialUrl("http://api.sci.gov.in/example.pdf"),
    /must use HTTPS/,
  );
  assert.throws(
    () => normalizeOfficialUrl("https://example.com/judgment.pdf"),
    /Unapproved official host/,
  );
});

test("neutral citations and enrichment keys parse deterministically", () => {
  assert.equal(extractNeutralCitation("[ 2026 INSC 839 ] [Judgement]"), "2026 INSC 839");
  assert.equal(extractNeutralCitation("No neutral citation"), null);
  assert.deepEqual(
    parseEnrichmentKey("scr:2026:2026_8_480_488:2026INSC839"),
    {
      citationYear: 2026,
      sourcePath: "2026_8_480_488",
      sourceNeutralKey: "2026INSC839",
    },
  );
});
