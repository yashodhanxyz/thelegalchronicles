import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] || "data/scr-inventory.ndjson");
const text = await readFile(inputPath, "utf8");
const records = text.trim().split("\n").filter(Boolean).map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
  }
});

assert.ok(records.length, "Inventory is empty");

const requiredTextFields = [
  "title_source",
  "scr_citation",
  "neutral_citation",
  "decision_date_source",
  "case_number_source",
  "bench_size_source",
  "result_excerpt_source",
];
const sourceKeys = new Set();
const positions = new Set();

for (const record of records) {
  assert.ok(Number.isInteger(record.position) && record.position > 0);
  assert.ok(!positions.has(record.position), `Duplicate position ${record.position}`);
  positions.add(record.position);

  for (const field of requiredTextFields) {
    assert.ok(record[field], `Position ${record.position} is missing ${field}`);
  }

  assert.match(record.decision_date_source, /^\d{2}-\d{2}-\d{4}$/);
  assert.ok(Number.isInteger(record.source_lookup?.citation_year));
  assert.ok(record.source_lookup.path);
  assert.ok(record.source_lookup.neutral_key);

  const sourceKey = [
    record.source_lookup.citation_year,
    record.source_lookup.path,
    record.source_lookup.neutral_key,
  ].join(":");
  assert.ok(!sourceKeys.has(sourceKey), `Duplicate source key ${sourceKey}`);
  sourceKeys.add(sourceKey);

  for (const action of ["split_view", "html_view", "flip_view", "pdf"]) {
    assert.equal(typeof record.actions_listed?.[action], "boolean");
  }
  assert.ok(Array.isArray(record.languages));
}

const minimum = Math.min(...positions);
const maximum = Math.max(...positions);
const missingPositions = [];
for (let position = minimum; position <= maximum; position += 1) {
  if (!positions.has(position)) missingPositions.push(position);
}
assert.deepEqual(missingPositions, [], "Inventory has missing positions");

const duplicateNeutralValues = Object.values(
  records.reduce((groups, record) => {
    (groups[record.neutral_citation] ??= []).push(record);
    return groups;
  }, {}),
).filter((group) => group.length > 1);

console.log(JSON.stringify({
  records: records.length,
  position_min: minimum,
  position_max: maximum,
  unique_source_keys: sourceKeys.size,
  duplicate_neutral_citation_values: duplicateNeutralValues.length,
  source_optional_missing: {
    coram_source: records.filter((record) => !record.coram_source).length,
    disposal_nature_source: records.filter((record) => !record.disposal_nature_source).length,
  },
}, null, 2));
