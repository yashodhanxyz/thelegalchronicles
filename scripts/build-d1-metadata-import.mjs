import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputArg = "data/scr-inventory-2026.ndjson", outputArg = "data/scr-2026-import.sql"] =
  process.argv.slice(2);
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const sourceListingUrl = "https://scr.sci.gov.in/scrsearch/?p=pdf_search/home";
const sourceObservedOn = "2026-09-17";
const snapshotNote =
  "Verified citation-year 2026 volume-filtered inventory; positions are canonical local positions, not global SCR positions.";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const sql = (value) => value === null || value === undefined
  ? "NULL"
  : `'${String(value).replaceAll("'", "''")}'`;
const integer = (value) => Number.isInteger(value) ? String(value) : "NULL";
const slugify = (value) => clean(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function parseDate(source) {
  const match = clean(source).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  assert.ok(match, `Invalid source date: ${source}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseCaseType(source) {
  return clean(source)
    .replace(/\s+(?:NO|NOS)\.?\s.*$/i, "")
    .trim() || null;
}

function normalizeJudgeName(source) {
  return clean(source)
    .replace(/\*/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function parseJudges(coram) {
  if (!clean(coram)) return [];
  return coram.split(",").map((part, index) => {
    const nameSource = clean(part).replace(/\*+$/g, "").trim();
    const nameNormalized = normalizeJudgeName(part);
    assert.ok(nameSource && nameNormalized, `Invalid Coram component: ${part}`);
    return {
      nameSource,
      nameNormalized,
      slug: slugify(nameNormalized),
      sourcePosition: index + 1,
      isAuthor: /\*/.test(part) ? 1 : null,
    };
  });
}

const records = (await readFile(inputPath, "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
    }
  });

assert.equal(records.length, 279, "Expected the verified 279-record 2026 inventory");

const sourceKeys = new Set();
const slugs = new Set();
const statements = [
  "PRAGMA foreign_keys = ON;",
];

for (const [index, record] of records.entries()) {
  assert.equal(record.position, index + 1, "Inventory positions must be contiguous");
  assert.equal(record.source_lookup?.citation_year, 2026);
  assert.ok(record.source_lookup.path && record.source_lookup.neutral_key);
  assert.ok(record.title_source && record.scr_citation && record.neutral_citation);

  const sourceKey = [
    record.source_lookup.citation_year,
    record.source_lookup.path,
    record.source_lookup.neutral_key,
  ].join(":");
  assert.ok(!sourceKeys.has(sourceKey), `Duplicate source identity: ${sourceKey}`);
  sourceKeys.add(sourceKey);

  const suffix = createHash("sha256").update(sourceKey).digest("hex").slice(0, 8);
  const titleSlug = slugify(record.title_source).slice(0, 72).replace(/-+$/g, "");
  const citationSlug = slugify(record.neutral_citation);
  const slug = `${titleSlug}-${citationSlug}-${suffix}`;
  assert.ok(!slugs.has(slug), `Duplicate slug: ${slug}`);
  slugs.add(slug);

  const decisionDateIso = parseDate(record.decision_date_source);
  const caseType = parseCaseType(record.case_number_source);
  const benchSize = Number.parseInt(record.bench_size_source, 10);
  const judges = parseJudges(record.coram_source);

  statements.push(`
INSERT INTO judgments (
  source_system, source_citation_year, source_path, source_neutral_key,
  source_listing_url, slug, title_source, scr_citation, neutral_citation,
  decision_date_source, decision_date_iso, decision_year,
  case_number_source, case_type, disposal_nature_source,
  bench_size_source, bench_size, coram_source, result_excerpt_source,
  content_status, source_collected_at, source_checked_at
) VALUES (
  'scr', 2026, ${sql(record.source_lookup.path)}, ${sql(record.source_lookup.neutral_key)},
  ${sql(sourceListingUrl)}, ${sql(slug)}, ${sql(record.title_source)},
  ${sql(record.scr_citation)}, ${sql(record.neutral_citation)},
  ${sql(record.decision_date_source)}, ${sql(decisionDateIso)}, 2026,
  ${sql(record.case_number_source)}, ${sql(caseType)}, ${sql(record.disposal_nature_source || null)},
  ${sql(record.bench_size_source)}, ${integer(benchSize)}, ${sql(record.coram_source || null)},
  ${sql(record.result_excerpt_source)}, 'metadata_only', ${sql(sourceObservedOn)}, ${sql(sourceObservedOn)}
)
ON CONFLICT (source_system, source_citation_year, source_path, source_neutral_key)
DO UPDATE SET
  source_listing_url = excluded.source_listing_url,
  slug = excluded.slug,
  title_source = excluded.title_source,
  scr_citation = excluded.scr_citation,
  neutral_citation = excluded.neutral_citation,
  decision_date_source = excluded.decision_date_source,
  decision_date_iso = excluded.decision_date_iso,
  decision_year = excluded.decision_year,
  case_number_source = excluded.case_number_source,
  case_type = excluded.case_type,
  disposal_nature_source = excluded.disposal_nature_source,
  bench_size_source = excluded.bench_size_source,
  bench_size = excluded.bench_size,
  coram_source = excluded.coram_source,
  result_excerpt_source = excluded.result_excerpt_source,
  source_checked_at = excluded.source_checked_at,
  updated_at = CURRENT_TIMESTAMP;`);

  for (const [assetKind, listed] of Object.entries({
    split_html: record.actions_listed.split_view,
    html_view: record.actions_listed.html_view,
    source_pdf: record.actions_listed.pdf,
    flip_view: record.actions_listed.flip_view,
  })) {
    statements.push(`
INSERT INTO judgment_source_assets (judgment_id, asset_kind, action_status)
SELECT id, ${sql(assetKind)}, ${sql(listed ? "listed" : "not_listed")}
FROM judgments
WHERE source_system = 'scr'
  AND source_citation_year = 2026
  AND source_path = ${sql(record.source_lookup.path)}
  AND source_neutral_key = ${sql(record.source_lookup.neutral_key)}
ON CONFLICT (judgment_id, asset_kind)
DO UPDATE SET action_status = excluded.action_status, updated_at = CURRENT_TIMESTAMP;`);
  }

  statements.push(`
DELETE FROM judgment_judges
WHERE judgment_id = (
  SELECT id FROM judgments
  WHERE source_system = 'scr'
    AND source_citation_year = 2026
    AND source_path = ${sql(record.source_lookup.path)}
    AND source_neutral_key = ${sql(record.source_lookup.neutral_key)}
);`);

  for (const judge of judges) {
    statements.push(`
INSERT INTO judges (slug, name_source, name_normalized)
VALUES (${sql(judge.slug)}, ${sql(judge.nameSource)}, ${sql(judge.nameNormalized)})
ON CONFLICT (name_normalized) DO NOTHING;

INSERT INTO judgment_judges (judgment_id, judge_id, source_position, is_author)
SELECT judgment.id, judge.id, ${judge.sourcePosition}, ${integer(judge.isAuthor)}
FROM judgments AS judgment
JOIN judges AS judge ON judge.name_normalized = ${sql(judge.nameNormalized)}
WHERE judgment.source_system = 'scr'
  AND judgment.source_citation_year = 2026
  AND judgment.source_path = ${sql(record.source_lookup.path)}
  AND judgment.source_neutral_key = ${sql(record.source_lookup.neutral_key)};`);
  }
}

const datasetHash = createHash("sha256")
  .update(await readFile(inputPath))
  .digest("hex");

statements.push(`
INSERT INTO ingestion_runs (
  source_system, citation_year, status, cursor_json,
  records_seen, records_written, records_rejected, started_at, finished_at
)
SELECT
  'scr', 2026, 'completed', ${sql(JSON.stringify({ dataset_sha256: datasetHash }))},
  279, 279, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM ingestion_runs
  WHERE source_system = 'scr'
    AND citation_year = 2026
    AND cursor_json = ${sql(JSON.stringify({ dataset_sha256: datasetHash }))}
);

INSERT INTO source_inventory_snapshots (
  source_system, observed_total, captured_records,
  first_source_position, last_source_position, captured_at, notes
)
SELECT
  'scr', 38598, 279, 1, 279, ${sql(sourceObservedOn)},
  ${sql(snapshotNote)}
WHERE NOT EXISTS (
  SELECT 1 FROM source_inventory_snapshots
  WHERE source_system = 'scr'
    AND captured_at = ${sql(sourceObservedOn)}
    AND captured_records = 279
    AND notes = ${sql(snapshotNote)}
);`);

await writeFile(outputPath, `${statements.join("\n")}\n`, "utf8");

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  records: records.length,
  unique_source_keys: sourceKeys.size,
  unique_slugs: slugs.size,
  dataset_sha256: datasetHash,
  statements: statements.length,
}, null, 2));
