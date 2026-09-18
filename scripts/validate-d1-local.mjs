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
  (SELECT COUNT(DISTINCT slug) FROM judgments) AS unique_slugs,
  (SELECT COUNT(*) FROM judgments WHERE source_citation_year = 2026) AS judgments_2026,
  (SELECT COUNT(*) FROM judgments WHERE content_status = 'metadata_only') AS metadata_only,
  (SELECT COUNT(*) FROM judgments WHERE coram_source IS NULL) AS missing_coram,
  (SELECT COUNT(*) FROM judgments WHERE disposal_nature_source IS NULL) AS missing_disposal,
  (SELECT COUNT(*) FROM judgments WHERE decision_year != 2026 OR substr(decision_date_iso, 1, 5) != '2026-') AS invalid_dates,
  (SELECT COUNT(*) FROM judges) AS judges,
  (SELECT COUNT(*) FROM judgment_judges) AS judgment_judges,
  (SELECT COUNT(*) FROM judgment_source_assets) AS assets,
  (SELECT COUNT(*) FROM judgment_source_assets WHERE action_status = 'listed') AS assets_listed,
  (SELECT COUNT(*) FROM judgment_source_assets WHERE verification_status = 'not_checked') AS assets_not_checked,
  (SELECT COUNT(*) FROM judgment_judges jj LEFT JOIN judgments j ON j.id = jj.judgment_id LEFT JOIN judges d ON d.id = jj.judge_id WHERE j.id IS NULL OR d.id IS NULL) AS orphan_judge_links,
  (SELECT COUNT(*) FROM judgment_source_assets a LEFT JOIN judgments j ON j.id = a.judgment_id WHERE j.id IS NULL) AS orphan_assets,
  (SELECT COUNT(*) FROM ingestion_runs) AS ingestion_runs,
  (SELECT COUNT(*) FROM source_inventory_snapshots) AS snapshots,
  (SELECT COUNT(*) FROM acts) AS acts,
  (SELECT COUNT(*) FROM sections) AS sections,
  (SELECT COUNT(*) FROM categories) AS categories,
  (SELECT COUNT(*) FROM keywords) AS keywords;
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
  unique_slugs: 279,
  judgments_2026: 279,
  metadata_only: 279,
  missing_coram: 1,
  missing_disposal: 18,
  invalid_dates: 0,
  judges: 36,
  judgment_judges: 560,
  assets: 1_116,
  assets_listed: 1_116,
  assets_not_checked: 1_116,
  orphan_judge_links: 0,
  orphan_assets: 0,
  ingestion_runs: 1,
  snapshots: 1,
  acts: 0,
  sections: 0,
  categories: 0,
  keywords: 0,
});

console.log(JSON.stringify(result, null, 2));
