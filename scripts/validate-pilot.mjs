import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixtureUrl = new URL("../pilot/fixtures/scr-2026-metadata.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const bodyValidationUrl = new URL(
  "../pilot/fixtures/scr-2026-body-validation.json",
  import.meta.url,
);
const bodyValidation = JSON.parse(await readFile(bodyValidationUrl, "utf8"));
const inventorySummaryUrl = new URL(
  "../pilot/fixtures/scr-inventory-first-1000-summary.json",
  import.meta.url,
);
const inventorySummary = JSON.parse(await readFile(inventorySummaryUrl, "utf8"));
const verified2026SummaryUrl = new URL(
  "../pilot/fixtures/scr-2026-inventory-summary.json",
  import.meta.url,
);
const verified2026Summary = JSON.parse(
  await readFile(verified2026SummaryUrl, "utf8"),
);

assert.equal(fixture.source, "Supreme Court Reports (SCR)");
assert.equal(fixture.records.length, 10);

const neutralCitations = new Set();
const sourceKeys = new Set();

for (const [index, record] of fixture.records.entries()) {
  assert.equal(record.position, index + 1);
  assert.ok(record.title_source, `record ${index + 1} is missing title_source`);
  assert.match(record.neutral_citation, /^2026 INSC \d+$/);
  assert.match(record.scr_citation, /^\[2026\] \d+ S\.C\.R\. \d+$/);
  assert.match(record.decision_date_source, /^\d{2}-\d{2}-2026$/);
  assert.equal(record.source_lookup.citation_year, 2026);
  assert.ok(record.source_lookup.path);
  assert.ok(record.source_lookup.neutral_key);

  assert.ok(
    !neutralCitations.has(record.neutral_citation),
    `duplicate neutral citation: ${record.neutral_citation}`,
  );
  neutralCitations.add(record.neutral_citation);

  const sourceKey = [
    record.source_lookup.citation_year,
    record.source_lookup.path,
    record.source_lookup.neutral_key,
  ].join(":");
  assert.ok(!sourceKeys.has(sourceKey), `duplicate source key: ${sourceKey}`);
  sourceKeys.add(sourceKey);
}

assert.equal(bodyValidation.records.length, 5);

const bodyCitations = new Set();

for (const [index, record] of bodyValidation.records.entries()) {
  assert.equal(record.position, index + 1);
  assert.match(record.neutral_citation, /^2026 INSC \d+$/);
  assert.ok(record.source_path);
  assert.ok(record.title);
  assert.ok(record.document.characters > 0);
  assert.ok(record.document.words > 0);
  assert.ok(record.document.paragraphs > 0);
  assert.ok(record.document.footnote_links >= 0);
  assert.equal(record.document.contains_scripts_inside_document, false);
  assert.equal(record.document.inline_event_handlers_inside_document, 0);
  assert.ok(Object.values(record.sections_present).every(Boolean));
  assert.ok(
    !bodyCitations.has(record.neutral_citation),
    `duplicate body citation: ${record.neutral_citation}`,
  );
  bodyCitations.add(record.neutral_citation);
}

assert.equal(bodyValidation.summary.records_checked, bodyValidation.records.length);
assert.equal(bodyValidation.summary.all_required_sections_present, true);
assert.equal(
  bodyValidation.summary.scripts_or_inline_handlers_found_inside_documents,
  false,
);

assert.equal(inventorySummary.observed_total, 38_598);
assert.equal(inventorySummary.batch.records, 1_000);
assert.equal(inventorySummary.batch.duplicate_source_keys, 0);
assert.equal(inventorySummary.batch.duplicate_neutral_citation_values, 4);
assert.equal(
  inventorySummary.years.reduce((total, year) => total + year.records, 0),
  inventorySummary.batch.records,
);
assert.equal(inventorySummary.duplicate_neutral_citations.length, 4);
for (const duplicate of inventorySummary.duplicate_neutral_citations) {
  assert.equal(duplicate.records.length, 2);
  assert.equal(new Set(duplicate.records.map((record) => record.source_path)).size, 2);
}

assert.equal(verified2026Summary.citation_year, 2026);
assert.equal(verified2026Summary.records, 279);
assert.equal(verified2026Summary.position_min, 1);
assert.equal(verified2026Summary.position_max, 279);
assert.equal(verified2026Summary.unique_source_keys, 279);
assert.equal(verified2026Summary.duplicate_source_keys, 0);
assert.equal(verified2026Summary.duplicate_neutral_citation_values, 0);
assert.equal(verified2026Summary.canonical_file_bytes, 351_750);
assert.match(verified2026Summary.canonical_file_sha256, /^[a-f0-9]{64}$/);
assert.equal(
  Object.values(verified2026Summary.volume_counts).reduce(
    (total, count) => total + count,
    0,
  ),
  verified2026Summary.records,
);
assert.equal(Object.keys(verified2026Summary.volume_counts).length, 8);
for (const count of Object.values(verified2026Summary.actions_listed)) {
  assert.equal(count, verified2026Summary.records);
}
assert.equal(
  verified2026Summary.optional_source_fields_missing.coram_source,
  1,
);
assert.equal(
  verified2026Summary.optional_source_fields_missing.disposal_nature_source,
  18,
);

console.log(
  `Validated ${fixture.records.length} SCR 2026 pilot metadata records and ` +
    `${bodyValidation.records.length} judgment structures ` +
    `(${bodyValidation.summary.word_count_min}-${bodyValidation.summary.word_count_max} words); ` +
    `checked the first ${inventorySummary.batch.records} archive rows and the ` +
    `verified ${verified2026Summary.records}-judgment 2026 inventory.`,
);
