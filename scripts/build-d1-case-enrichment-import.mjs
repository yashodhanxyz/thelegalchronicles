import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_INPUT = "data/scr-2026-case-enrichment.jsonl";
const DEFAULT_INVENTORY = "data/scr-inventory-2026.ndjson";
const DEFAULT_SQL_OUTPUT = "data/scr-2026-enrichment-import.sql";
const DEFAULT_REPORT_OUTPUT = "data/scr-2026-enrichment-validation.json";

const APPROVED_SOURCE_HOSTS = new Set(["www.sci.gov.in"]);
const APPROVED_DOCUMENT_HOSTS = new Set(["api.sci.gov.in", "www.sci.gov.in"]);
const LOOKUP_STATUSES = new Set([
  "found",
  "not_found",
  "multiple_matches",
  "error",
  "blocked",
]);

const CITATION_CORRECTIONS = new Map([
  [
    "scr:2026:2026_1_1072_1105:1072INSC2026",
    {
      sourceCitation: "1072 INSC 2026",
      canonicalCitation: "2026 INSC 59",
      authority: "Supreme Court of India case-status record and judgment link",
      notes:
        "The collected SCR neutral-citation value is transposed. The official SCI case record and judgment link identify 2026 INSC 59.",
    },
  ],
]);

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeCitation = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const sql = (value) => value === null || value === undefined
  ? "NULL"
  : `'${String(value).replaceAll("'", "''")}'`;
const integer = (value) => Number.isInteger(value) ? String(value) : "NULL";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function parseSourceDate(value) {
  const source = clean(value);
  if (!source || source === "-" || /-0001(?:\D|$)/.test(source)) return null;
  const match = source.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s|$)/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) return null;
  return iso;
}

export function normalizeOfficialUrl(value, allowedHosts = APPROVED_DOCUMENT_HOSTS) {
  const source = clean(value);
  assert.ok(source, "Official URL is required");
  const url = new URL(source);
  assert.equal(url.protocol, "https:", `Official URL must use HTTPS: ${source}`);
  assert.ok(allowedHosts.has(url.hostname), `Unapproved official host: ${url.hostname}`);
  url.hash = "";
  return url.toString();
}

export function extractNeutralCitation(value) {
  const match = clean(value).match(/\b(\d{4})\s+INSC\s+(\d+)\b/i);
  return match ? `${match[1]} INSC ${match[2]}` : null;
}

export function parseEnrichmentKey(value) {
  const match = clean(value).match(/^scr:(\d{4}):([^:]+):([^:]+)$/);
  assert.ok(match, `Invalid enrichment key: ${value}`);
  return {
    citationYear: Number(match[1]),
    sourcePath: match[2],
    sourceNeutralKey: match[3],
  };
}

function readJsonLines(text, label) {
  return text.split("\n").filter(Boolean).map((line, index) => {
    try {
      return { value: JSON.parse(line), raw: line, line: index + 1 };
    } catch (error) {
      throw new Error(`${label}: invalid JSON on line ${index + 1}: ${error.message}`);
    }
  });
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringOrNull(value) {
  const result = clean(value);
  return result || null;
}

function parseCaseYear(value) {
  const year = Number.parseInt(clean(value), 10);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

function strongerDocumentType(current, incoming) {
  if (/judg/i.test(incoming || "")) return incoming;
  return current || incoming || null;
}

function mergeCaseDocument(map, item, index) {
  const normalizedUrl = normalizeOfficialUrl(item.url);
  const current = map.get(normalizedUrl) || {
    documentUrlSource: clean(item.url),
    documentUrlNormalized: normalizedUrl,
    labelSource: null,
    documentTypeSource: null,
    documentDateSource: null,
    documentDateIso: null,
    neutralCitationSource: null,
    sourcePosition: index + 1,
  };
  const label = stringOrNull(item.label);
  const citation = extractNeutralCitation(label);
  const dateSource = stringOrNull(item.date) || clean(label).match(/\b\d{2}-\d{2}-\d{4}\b/)?.[0] || null;
  current.labelSource ||= label;
  current.documentTypeSource = strongerDocumentType(
    current.documentTypeSource,
    stringOrNull(item.document_type),
  );
  current.documentDateSource ||= dateSource;
  current.documentDateIso ||= parseSourceDate(dateSource);
  current.neutralCitationSource ||= citation;
  current.sourcePosition = Math.min(current.sourcePosition, index + 1);
  map.set(normalizedUrl, current);
}

function expectedJudgmentWhere(key, alias = null) {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}source_system = 'scr'
    AND ${prefix}source_citation_year = ${key.citationYear}
    AND ${prefix}source_path = ${sql(key.sourcePath)}
    AND ${prefix}source_neutral_key = ${sql(key.sourceNeutralKey)}`;
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function recordContains(value, marker) {
  return JSON.stringify(value).includes(marker);
}

export async function buildEnrichmentImport({
  inputPath,
  inventoryPath,
  sqlOutputPath,
  reportOutputPath,
}) {
  const inputBuffer = await readFile(inputPath);
  const enrichmentLines = readJsonLines(inputBuffer.toString("utf8"), "Enrichment dataset");
  const inventoryLines = readJsonLines(await readFile(inventoryPath, "utf8"), "SCR inventory");
  const datasetHash = sha256(inputBuffer);

  assert.equal(enrichmentLines.length, 279, "Expected 279 enrichment records");
  assert.equal(inventoryLines.length, 279, "Expected 279 SCR inventory records");

  const inventoryByKey = new Map();
  for (const { value: record } of inventoryLines) {
    const key = `scr:${record.source_lookup.citation_year}:${record.source_lookup.path}:${record.source_lookup.neutral_key}`;
    assert.ok(!inventoryByKey.has(key), `Duplicate SCR inventory key: ${key}`);
    inventoryByKey.set(key, record);
  }

  const seenEnrichmentKeys = new Set();
  const cases = new Map();
  const normalizedRecords = [];
  let rawDocumentLinks = 0;

  for (const { value: record, raw, line } of enrichmentLines) {
    const enrichmentKey = clean(record.enrichment_key);
    assert.ok(!seenEnrichmentKeys.has(enrichmentKey), `Duplicate enrichment key: ${enrichmentKey}`);
    seenEnrichmentKeys.add(enrichmentKey);
    assert.ok(LOOKUP_STATUSES.has(record.lookup_status), `Invalid lookup status on line ${line}`);

    const key = parseEnrichmentKey(enrichmentKey);
    const inventory = inventoryByKey.get(enrichmentKey);
    assert.ok(inventory, `Enrichment key is absent from SCR inventory: ${enrichmentKey}`);
    assert.equal(clean(record.input_case_number), clean(inventory.case_number_source));
    assert.equal(key.citationYear, 2026);

    const correction = CITATION_CORRECTIONS.get(enrichmentKey) || null;
    const targetCitation = correction?.canonicalCitation || inventory.neutral_citation;
    const targetDecisionDate = parseSourceDate(inventory.decision_date_source);
    const recordHash = sha256(raw);
    const sourceFields = objectValue(record.source_fields);
    const officialNeutralCitations = stringOrNull(sourceFields["Neutral Citation"]);
    const recordDocuments = new Map();
    const rawLinks = Array.isArray(record.orders_judgments_links)
      ? record.orders_judgments_links
      : [];
    rawDocumentLinks += rawLinks.length;
    rawLinks.forEach((item, index) => mergeCaseDocument(recordDocuments, item, index));

    let caseRecord = null;
    let directDocument = null;
    let matchBasis = "unmatched";
    let verificationStatus = "unmatched";

    if (record.lookup_status === "found") {
      const sourceUrl = normalizeOfficialUrl(record.source_url, APPROVED_SOURCE_HOSTS);
      const sourceCaseIdentifier = clean(record.source_case_identifier);
      assert.ok(sourceCaseIdentifier, `Missing source case identifier: ${enrichmentKey}`);
      assert.ok(record.title_raw, `Missing title for found record: ${enrichmentKey}`);
      assert.ok(record.source_retrieved_at, `Missing retrieval time: ${enrichmentKey}`);
      assert.ok(!Number.isNaN(Date.parse(record.source_retrieved_at)), `Invalid retrieval time: ${enrichmentKey}`);

      const targetCitationNormalized = normalizeCitation(targetCitation);
      const citationDocuments = [...recordDocuments.values()].filter((document) =>
        /judg/i.test(document.documentTypeSource || document.labelSource || "") &&
        normalizeCitation(document.neutralCitationSource) === targetCitationNormalized
      );
      const dateDocuments = [...recordDocuments.values()].filter((document) =>
        /judg/i.test(document.documentTypeSource || document.labelSource || "") &&
        document.documentDateIso === targetDecisionDate
      );
      const candidates = citationDocuments.length ? citationDocuments : dateDocuments;
      assert.ok(candidates.length <= 1, `Ambiguous judgment document match: ${enrichmentKey}`);
      directDocument = candidates[0] || null;

      if (correction) {
        assert.ok(
          normalizeCitation(officialNeutralCitations).includes(normalizeCitation(correction.canonicalCitation)) ||
          normalizeCitation(directDocument?.neutralCitationSource) === normalizeCitation(correction.canonicalCitation),
          `Citation correction lacks official support: ${enrichmentKey}`,
        );
        matchBasis = "official_citation_correction";
        verificationStatus = "verified";
      } else if (citationDocuments.length === 1) {
        matchBasis = "judgment_document_neutral_citation";
        verificationStatus = "verified";
      } else if (dateDocuments.length === 1) {
        matchBasis = "judgment_document_date";
        verificationStatus = "verified";
      } else if (
        normalizeCitation(officialNeutralCitations).includes(normalizeCitation(targetCitation))
      ) {
        matchBasis = "official_case_neutral_citation";
        verificationStatus = "verified";
      } else {
        matchBasis = "review_required";
        verificationStatus = "review_required";
      }

      caseRecord = {
        sourceCaseIdentifier,
        sourceUrl,
        sourceRetrievedAt: record.source_retrieved_at,
        matchedCaseNumberSource: stringOrNull(record.matched_case_number_raw),
        titleSource: stringOrNull(record.title_raw),
        petitionerSource: stringOrNull(record.petitioner_appellant_raw),
        respondentSource: stringOrNull(record.respondent_raw),
        courtSource: stringOrNull(record.court_raw),
        benchSource: stringOrNull(record.bench_raw),
        caseTypeSource: stringOrNull(record.case_type_raw),
        caseNumberSource: stringOrNull(record.case_number_raw),
        caseYear: parseCaseYear(record.case_year_raw),
        diaryNumberSource: stringOrNull(record.diary_number_raw),
        filingDateSource: stringOrNull(record.filing_date_raw),
        filingDateIso: parseSourceDate(record.filing_date_raw),
        registrationDateSource: stringOrNull(record.registration_date_raw),
        registrationDateIso: parseSourceDate(record.registration_date_raw),
        decisionDateSource: stringOrNull(record.decision_date_raw),
        decisionDateIso: parseSourceDate(record.decision_date_raw),
        disposalDateSource: stringOrNull(record.disposal_date_raw),
        disposalDateIso: parseSourceDate(record.disposal_date_raw),
        caseStatusSource: stringOrNull(record.case_status_raw),
        disposalNatureSource: stringOrNull(record.disposal_nature_raw),
        categorySource: stringOrNull(sourceFields.Category),
        officialNeutralCitationsSource: officialNeutralCitations,
        lastHearingDateSource: stringOrNull(record.last_hearing_date_raw),
        lastHearingDateIso: parseSourceDate(record.last_hearing_date_raw),
        nextHearingDateSource: stringOrNull(record.next_hearing_date_raw),
        nextHearingDateIso: parseSourceDate(record.next_hearing_date_raw),
        rawPayloadSha256: recordHash,
        documents: recordDocuments,
      };

      const existing = cases.get(sourceCaseIdentifier);
      if (existing) {
        assert.equal(existing.sourceUrl, caseRecord.sourceUrl, `Conflicting source URL: ${sourceCaseIdentifier}`);
        assert.equal(existing.titleSource, caseRecord.titleSource, `Conflicting case title: ${sourceCaseIdentifier}`);
        for (const [url, document] of caseRecord.documents) {
          if (!existing.documents.has(url)) existing.documents.set(url, document);
        }
        if (Date.parse(caseRecord.sourceRetrievedAt) > Date.parse(existing.sourceRetrievedAt)) {
          const documents = existing.documents;
          Object.assign(existing, caseRecord, { documents });
        }
        caseRecord = existing;
      } else {
        cases.set(sourceCaseIdentifier, caseRecord);
      }
    }

    normalizedRecords.push({
      enrichmentKey,
      key,
      inventory,
      correction,
      targetCitation,
      targetDecisionDate,
      record,
      recordHash,
      caseRecord,
      directDocument,
      matchBasis,
      verificationStatus,
    });
  }

  assert.deepEqual(
    [...seenEnrichmentKeys].sort(),
    [...inventoryByKey.keys()].sort(),
    "Enrichment keys must exactly cover the SCR inventory",
  );

  const foundRecords = normalizedRecords.filter((item) => item.record.lookup_status === "found");
  const notFoundRecords = normalizedRecords.filter((item) => item.record.lookup_status === "not_found");
  assert.equal(foundRecords.length, 276);
  assert.equal(notFoundRecords.length, 3);
  assert.equal(cases.size, 275);
  assert.equal(normalizedRecords.filter((item) => item.verificationStatus === "review_required").length, 0);

  const statements = [
    "PRAGMA foreign_keys = ON;",
    `INSERT INTO case_enrichment_snapshots (
  source_system, source_scope, dataset_sha256, source_file_name,
  raw_storage_status, raw_r2_key, records_seen, records_found,
  records_not_found, unique_source_cases, collected_from
) VALUES (
  'sci_case_status', 'SCR citation year 2026', ${sql(datasetHash)}, ${sql(basename(inputPath))},
  'local_only', NULL, 279, 276, 3, 275, 'https://www.sci.gov.in/'
)
ON CONFLICT (dataset_sha256) DO UPDATE SET
  source_file_name = excluded.source_file_name,
  records_seen = excluded.records_seen,
  records_found = excluded.records_found,
  records_not_found = excluded.records_not_found,
  unique_source_cases = excluded.unique_source_cases;`,
  ];

  for (const caseRecord of cases.values()) {
    statements.push(`INSERT INTO court_cases (
  source_system, source_case_identifier, source_url, source_retrieved_at,
  matched_case_number_source, title_source, petitioner_source, respondent_source,
  court_source, bench_source, case_type_source, case_number_source, case_year,
  diary_number_source, filing_date_source, filing_date_iso,
  registration_date_source, registration_date_iso,
  decision_date_source, decision_date_iso, disposal_date_source, disposal_date_iso,
  case_status_source, disposal_nature_source, category_source,
  official_neutral_citations_source, last_hearing_date_source, last_hearing_date_iso,
  next_hearing_date_source, next_hearing_date_iso, raw_payload_sha256, raw_payload_r2_key
) VALUES (
  'sci_case_status', ${sql(caseRecord.sourceCaseIdentifier)}, ${sql(caseRecord.sourceUrl)},
  ${sql(caseRecord.sourceRetrievedAt)}, ${sql(caseRecord.matchedCaseNumberSource)},
  ${sql(caseRecord.titleSource)}, ${sql(caseRecord.petitionerSource)}, ${sql(caseRecord.respondentSource)},
  ${sql(caseRecord.courtSource)}, ${sql(caseRecord.benchSource)}, ${sql(caseRecord.caseTypeSource)},
  ${sql(caseRecord.caseNumberSource)}, ${integer(caseRecord.caseYear)}, ${sql(caseRecord.diaryNumberSource)},
  ${sql(caseRecord.filingDateSource)}, ${sql(caseRecord.filingDateIso)},
  ${sql(caseRecord.registrationDateSource)}, ${sql(caseRecord.registrationDateIso)},
  ${sql(caseRecord.decisionDateSource)}, ${sql(caseRecord.decisionDateIso)},
  ${sql(caseRecord.disposalDateSource)}, ${sql(caseRecord.disposalDateIso)},
  ${sql(caseRecord.caseStatusSource)}, ${sql(caseRecord.disposalNatureSource)},
  ${sql(caseRecord.categorySource)}, ${sql(caseRecord.officialNeutralCitationsSource)},
  ${sql(caseRecord.lastHearingDateSource)}, ${sql(caseRecord.lastHearingDateIso)},
  ${sql(caseRecord.nextHearingDateSource)}, ${sql(caseRecord.nextHearingDateIso)},
  ${sql(caseRecord.rawPayloadSha256)}, NULL
)
ON CONFLICT (source_system, source_case_identifier) DO UPDATE SET
  source_url = excluded.source_url,
  source_retrieved_at = excluded.source_retrieved_at,
  matched_case_number_source = excluded.matched_case_number_source,
  title_source = excluded.title_source,
  petitioner_source = excluded.petitioner_source,
  respondent_source = excluded.respondent_source,
  court_source = excluded.court_source,
  bench_source = excluded.bench_source,
  case_type_source = excluded.case_type_source,
  case_number_source = excluded.case_number_source,
  case_year = excluded.case_year,
  diary_number_source = excluded.diary_number_source,
  filing_date_source = excluded.filing_date_source,
  filing_date_iso = excluded.filing_date_iso,
  registration_date_source = excluded.registration_date_source,
  registration_date_iso = excluded.registration_date_iso,
  decision_date_source = excluded.decision_date_source,
  decision_date_iso = excluded.decision_date_iso,
  disposal_date_source = excluded.disposal_date_source,
  disposal_date_iso = excluded.disposal_date_iso,
  case_status_source = excluded.case_status_source,
  disposal_nature_source = excluded.disposal_nature_source,
  category_source = excluded.category_source,
  official_neutral_citations_source = excluded.official_neutral_citations_source,
  last_hearing_date_source = excluded.last_hearing_date_source,
  last_hearing_date_iso = excluded.last_hearing_date_iso,
  next_hearing_date_source = excluded.next_hearing_date_source,
  next_hearing_date_iso = excluded.next_hearing_date_iso,
  raw_payload_sha256 = excluded.raw_payload_sha256,
  updated_at = CURRENT_TIMESTAMP;`);
  }

  for (const caseRecord of cases.values()) {
    statements.push(`DELETE FROM court_case_documents
WHERE court_case_id = (
  SELECT id FROM court_cases
  WHERE source_system = 'sci_case_status'
    AND source_case_identifier = ${sql(caseRecord.sourceCaseIdentifier)}
);`);
    for (const document of caseRecord.documents.values()) {
      statements.push(`INSERT INTO court_case_documents (
  court_case_id, document_url_source, document_url_normalized, label_source,
  document_type_source, document_date_source, document_date_iso,
  neutral_citation_source, source_position
)
SELECT
  id, ${sql(document.documentUrlSource)}, ${sql(document.documentUrlNormalized)},
  ${sql(document.labelSource)}, ${sql(document.documentTypeSource)},
  ${sql(document.documentDateSource)}, ${sql(document.documentDateIso)},
  ${sql(document.neutralCitationSource)}, ${document.sourcePosition}
FROM court_cases
WHERE source_system = 'sci_case_status'
  AND source_case_identifier = ${sql(caseRecord.sourceCaseIdentifier)};`);
    }
  }

  for (const item of normalizedRecords) {
    const judgmentWhere = expectedJudgmentWhere(item.key);
    const judgmentAliasWhere = expectedJudgmentWhere(item.key, "judgment");
    statements.push(`DELETE FROM judgment_case_documents
WHERE judgment_id = (SELECT id FROM judgments WHERE ${judgmentWhere});`);
    statements.push(`INSERT INTO judgment_case_enrichments (
  judgment_id, court_case_id, snapshot_id, enrichment_key, input_case_number,
  lookup_status, match_basis, verification_status, collection_notes,
  source_retrieved_at, raw_payload_sha256
)
SELECT
  judgment.id,
  ${item.caseRecord ? "court_case.id" : "NULL"},
  snapshot.id,
  ${sql(item.enrichmentKey)}, ${sql(item.record.input_case_number)},
  ${sql(item.record.lookup_status)}, ${sql(item.matchBasis)}, ${sql(item.verificationStatus)},
  ${sql(stringOrNull(item.record.collection_notes))}, ${sql(item.record.source_retrieved_at)},
  ${sql(item.recordHash)}
FROM judgments AS judgment
JOIN case_enrichment_snapshots AS snapshot
  ON snapshot.dataset_sha256 = ${sql(datasetHash)}
${item.caseRecord ? `JOIN court_cases AS court_case
  ON court_case.source_system = 'sci_case_status'
 AND court_case.source_case_identifier = ${sql(item.caseRecord.sourceCaseIdentifier)}` : ""}
WHERE ${judgmentAliasWhere}
ON CONFLICT (judgment_id) DO UPDATE SET
  court_case_id = excluded.court_case_id,
  snapshot_id = excluded.snapshot_id,
  enrichment_key = excluded.enrichment_key,
  input_case_number = excluded.input_case_number,
  lookup_status = excluded.lookup_status,
  match_basis = excluded.match_basis,
  verification_status = excluded.verification_status,
  collection_notes = excluded.collection_notes,
  source_retrieved_at = excluded.source_retrieved_at,
  raw_payload_sha256 = excluded.raw_payload_sha256,
  updated_at = CURRENT_TIMESTAMP;`);

    if (item.directDocument && item.caseRecord) {
      const citationMatch = normalizeCitation(item.directDocument.neutralCitationSource) ===
        normalizeCitation(item.targetCitation);
      const dateMatch = item.directDocument.documentDateIso === item.targetDecisionDate;
      const documentMatchBasis = citationMatch && dateMatch
        ? "citation_and_date"
        : citationMatch ? "neutral_citation" : "decision_date";
      statements.push(`INSERT INTO judgment_case_documents (
  judgment_id, document_id, match_basis, is_primary
)
SELECT judgment.id, document.id, ${sql(documentMatchBasis)}, 1
FROM judgments AS judgment
JOIN court_cases AS court_case
  ON court_case.source_system = 'sci_case_status'
 AND court_case.source_case_identifier = ${sql(item.caseRecord.sourceCaseIdentifier)}
JOIN court_case_documents AS document
  ON document.court_case_id = court_case.id
 AND document.document_url_normalized = ${sql(item.directDocument.documentUrlNormalized)}
WHERE ${judgmentAliasWhere};`);
    }

    if (item.correction && item.caseRecord) {
      statements.push(`INSERT INTO judgment_citation_aliases (
  judgment_id, source_citation, canonical_citation, authority,
  verification_source_url, verified_at, notes
)
SELECT
  id, ${sql(item.correction.sourceCitation)}, ${sql(item.correction.canonicalCitation)},
  ${sql(item.correction.authority)}, ${sql(item.caseRecord.sourceUrl)},
  ${sql(item.record.source_retrieved_at)}, ${sql(item.correction.notes)}
FROM judgments
WHERE ${judgmentWhere}
ON CONFLICT (judgment_id, source_citation, canonical_citation) DO UPDATE SET
  authority = excluded.authority,
  verification_source_url = excluded.verification_source_url,
  verified_at = excluded.verified_at,
  notes = excluded.notes;`);
    }
  }

  const uniqueDocuments = [...cases.values()].reduce(
    (total, caseRecord) => total + caseRecord.documents.size,
    0,
  );
  const judgmentDocumentLinks = normalizedRecords.filter((item) => item.directDocument).length;
  const report = {
    source_file_name: basename(inputPath),
    dataset_sha256: datasetHash,
    raw_storage_status: "local_only",
    raw_r2_key: null,
    records: normalizedRecords.length,
    found: foundRecords.length,
    not_found: notFoundRecords.length,
    unique_enrichment_keys: seenEnrichmentKeys.size,
    unique_source_cases: cases.size,
    raw_document_links: rawDocumentLinks,
    unique_case_documents: uniqueDocuments,
    judgment_document_links: judgmentDocumentLinks,
    verified_judgment_case_links: normalizedRecords.filter(
      (item) => item.verificationStatus === "verified",
    ).length,
    unmatched_judgments: notFoundRecords.map((item) => ({
      enrichment_key: item.enrichmentKey,
      input_case_number: item.record.input_case_number,
    })),
    match_basis: countBy(normalizedRecords, (item) => item.matchBasis),
    citation_corrections: normalizedRecords.filter((item) => item.correction).map((item) => ({
      enrichment_key: item.enrichmentKey,
      source_citation: item.correction.sourceCitation,
      canonical_citation: item.correction.canonicalCitation,
      verification_source_url: item.caseRecord.sourceUrl,
    })),
    raw_source_warnings: {
      records_with_placeholder_date_30_11_0001: enrichmentLines.filter(({ value }) =>
        recordContains(value, "30-11--0001")
      ).length,
      records_with_parent_relative_urls: enrichmentLines.filter(({ value }) =>
        recordContains(value, "/../../")
      ).length,
    },
    approved_source_hosts: [...APPROVED_SOURCE_HOSTS],
    approved_document_hosts: [...APPROVED_DOCUMENT_HOSTS],
    generated_sql_statements: statements.length,
  };

  await writeFile(sqlOutputPath, `${statements.join("\n\n")}\n`, "utf8");
  await writeFile(reportOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

async function main() {
  const [
    inputArg = process.env.SCR_ENRICHMENT_FILE || DEFAULT_INPUT,
    sqlOutputArg = DEFAULT_SQL_OUTPUT,
    reportOutputArg = DEFAULT_REPORT_OUTPUT,
    inventoryArg = DEFAULT_INVENTORY,
  ] = process.argv.slice(2);
  const report = await buildEnrichmentImport({
    inputPath: resolve(inputArg),
    inventoryPath: resolve(inventoryArg),
    sqlOutputPath: resolve(sqlOutputArg),
    reportOutputPath: resolve(reportOutputArg),
  });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
