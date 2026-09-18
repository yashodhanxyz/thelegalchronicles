import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] || "data/scr-inventory.ndjson");
const records = (await readFile(inputPath, "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

assert.ok(records.length > 0, "Inventory is empty");

const byYear = new Map();
for (const record of records) {
  const year = record.source_lookup.citation_year;
  const summary = byYear.get(year) || {
    year,
    records: 0,
    split_action_listed: 0,
    html_action_listed: 0,
    pdf_action_listed: 0,
    neutral_citation_present: 0,
  };
  summary.records += 1;
  summary.split_action_listed += Number(record.actions_listed.split_view);
  summary.html_action_listed += Number(record.actions_listed.html_view);
  summary.pdf_action_listed += Number(record.actions_listed.pdf);
  summary.neutral_citation_present += Number(Boolean(record.neutral_citation));
  byYear.set(year, summary);
}

console.log(JSON.stringify({
  records: records.length,
  position_min: Math.min(...records.map((record) => record.position)),
  position_max: Math.max(...records.map((record) => record.position)),
  years: [...byYear.values()].sort((left, right) => right.year - left.year),
}, null, 2));
