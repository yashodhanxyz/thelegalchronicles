import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const wranglerPath = resolve("node_modules/wrangler/bin/wrangler.js");
const remote = process.argv.includes("--remote");
const locationFlag = remote ? "--remote" : "--local";
const configPath = "wrangler.jsonc";
const query = `
SELECT
  (SELECT COUNT(*) FROM judgments) AS judgments,
  (SELECT COUNT(*) FROM judgments WHERE content_status = 'metadata_only') AS metadata_only,
  (SELECT COUNT(*) FROM case_enrichment_snapshots) AS snapshots,
  (SELECT COUNT(*) FROM court_cases) AS court_cases,
  (SELECT COUNT(DISTINCT source_case_identifier) FROM court_cases) AS unique_source_cases,
  (SELECT COUNT(*) FROM judgment_case_enrichments) AS enrichment_links,
  (SELECT COUNT(*) FROM judgment_case_enrichments WHERE lookup_status = 'found') AS found_links,
  (SELECT COUNT(*) FROM judgment_case_enrichments WHERE lookup_status = 'not_found') AS not_found_links,
  (SELECT COUNT(*) FROM judgment_case_enrichments WHERE verification_status = 'verified') AS verified_links,
  (SELECT COUNT(*) FROM judgment_case_enrichments WHERE verification_status = 'review_required') AS review_required_links,
  (SELECT COUNT(*) FROM court_case_documents) AS case_documents,
  (SELECT COUNT(*) FROM judgment_case_documents) AS judgment_documents,
  (SELECT COUNT(*) FROM judgment_citation_aliases) AS citation_aliases,
  (SELECT COUNT(*) FROM court_case_documents WHERE document_url_normalized LIKE '%/../%') AS unresolved_parent_urls,
  (SELECT COUNT(*) FROM court_case_documents WHERE document_url_normalized NOT LIKE 'https://api.sci.gov.in/%' AND document_url_normalized NOT LIKE 'https://www.sci.gov.in/%') AS unapproved_document_urls,
  (SELECT COUNT(*) FROM judgment_case_enrichments e LEFT JOIN judgments j ON j.id = e.judgment_id WHERE j.id IS NULL) AS orphan_judgments,
  (SELECT COUNT(*) FROM judgment_case_enrichments e LEFT JOIN court_cases c ON c.id = e.court_case_id WHERE e.court_case_id IS NOT NULL AND c.id IS NULL) AS orphan_cases,
  (SELECT COUNT(*) FROM court_case_documents d LEFT JOIN court_cases c ON c.id = d.court_case_id WHERE c.id IS NULL) AS orphan_documents,
  (SELECT COUNT(*) FROM judgment_case_documents jd LEFT JOIN judgments j ON j.id = jd.judgment_id LEFT JOIN court_case_documents d ON d.id = jd.document_id WHERE j.id IS NULL OR d.id IS NULL) AS orphan_judgment_documents;
`;

function runWrangler() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [
      wranglerPath,
      "d1", "execute", "DB",
      locationFlag,
      "--config", configPath,
      "--json",
      "--command", query,
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_LOG_PATH:
          process.env.WRANGLER_LOG_PATH || "/tmp/the-legal-chronicles-wrangler.log",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Wrangler exited with ${code}`));
        return;
      }
      resolvePromise(JSON.parse(stdout));
    });
  });
}

const response = await runWrangler();
assert.equal(response.length, 1);
assert.equal(response[0].success, true);
assert.equal(response[0].results.length, 1);
const result = response[0].results[0];

assert.deepEqual(result, {
  judgments: 279,
  metadata_only: 279,
  snapshots: 1,
  court_cases: 275,
  unique_source_cases: 275,
  enrichment_links: 279,
  found_links: 276,
  not_found_links: 3,
  verified_links: 276,
  review_required_links: 0,
  case_documents: 3925,
  judgment_documents: 266,
  citation_aliases: 1,
  unresolved_parent_urls: 0,
  unapproved_document_urls: 0,
  orphan_judgments: 0,
  orphan_cases: 0,
  orphan_documents: 0,
  orphan_judgment_documents: 0,
});

console.log(JSON.stringify(result, null, 2));
