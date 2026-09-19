import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputArg, outputArg, yearArg, expectedArg] = process.argv.slice(2);
assert.ok(inputArg, "Usage: node scripts/stage-year-export.mjs INPUT OUTPUT YEAR EXPECTED_COUNT");
assert.ok(outputArg, "Missing output path");

const citationYear = Number(yearArg);
const expectedCount = Number(expectedArg);
assert.ok(Number.isInteger(citationYear), "YEAR must be an integer");
assert.ok(Number.isInteger(expectedCount) && expectedCount > 0, "EXPECTED_COUNT must be positive");

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const lines = (await readFile(inputPath, "utf8")).trim().split("\n").filter(Boolean);
const records = lines.map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
  }
});

assert.equal(records.length, expectedCount, `Expected ${expectedCount} records`);

const sourceKeys = new Set();
const volumeCounts = new Map();
const requiredTextFields = [
  "title_source",
  "scr_citation",
  "neutral_citation",
  "decision_date_source",
  "case_number_source",
  "bench_size_source",
  "result_excerpt_source",
];

const normalized = records.map((record, index) => {
  assert.equal(record.source_lookup?.citation_year, citationYear);
  assert.ok(Number.isInteger(record.collection_volume), `Line ${index + 1} lacks collection_volume`);
  assert.ok(Number.isInteger(record.position) && record.position > 0);
  assert.match(record.decision_date_source, /^\d{2}-\d{2}-\d{4}$/);
  assert.equal(Number(record.decision_date_source.slice(-4)), citationYear);
  for (const field of requiredTextFields) {
    assert.ok(record[field], `Line ${index + 1} is missing ${field}`);
  }
  assert.ok(record.source_lookup.path);
  assert.ok(record.source_lookup.neutral_key);

  const sourceKey = [
    record.source_lookup.citation_year,
    record.source_lookup.path,
    record.source_lookup.neutral_key,
  ].join(":");
  assert.ok(!sourceKeys.has(sourceKey), `Duplicate source key ${sourceKey}`);
  sourceKeys.add(sourceKey);

  volumeCounts.set(
    record.collection_volume,
    (volumeCounts.get(record.collection_volume) || 0) + 1,
  );

  const { collection_volume: collectionVolume, position: filterPosition, ...sourceRecord } = record;
  return {
    ...sourceRecord,
    position: index + 1,
    collection_scope: {
      kind: "scr_citation_volume",
      citation_year: citationYear,
      citation_volume: collectionVolume,
      filter_position: filterPosition,
    },
  };
});

await writeFile(
  outputPath,
  `${normalized.map((record) => JSON.stringify(record)).join("\n")}\n`,
  "utf8",
);

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  citation_year: citationYear,
  records: normalized.length,
  unique_source_keys: sourceKeys.size,
  volume_counts: Object.fromEntries([...volumeCounts].sort(([left], [right]) => left - right)),
}, null, 2));
