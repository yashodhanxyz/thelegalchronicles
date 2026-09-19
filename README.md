# The Legal Chronicles

Coming Soon page for [thelegalchronicles.com](https://thelegalchronicles.com/), hosted on Cloudflare.

## Structure

- `coming-soon/index.html` — page markup and styles
- `coming-soon/_headers` — Cloudflare security and caching headers
- `wrangler.jsonc` — Cloudflare Worker and static-assets configuration
- `docs/V1_PRODUCT_SPEC.md` — agreed 2026 product and fidelity boundary
- `docs/SCR_SOURCE_MAPPING.md` — pilot field map and source-access constraint
- `docs/AI_TOKEN_COST_OPTIONS.md` — deterministic-versus-AI cost comparison
- `db/migrations/0001_initial.sql` — proposed D1 metadata/filter schema
- `db/migrations/0002_source_availability.sql` — per-judgment source-asset coverage
- `db/migrations/0003_catalog_query_indexes.sql` — listing and case-filter query indexes
- `db/migrations/0004_case_enrichment.sql` — SCI case-status staging, judgment links and official documents
- `pilot/fixtures/scr-2026-metadata.json` — first ten live pilot records
- `pilot/fixtures/scr-2026-body-validation.json` — representative body checks
- `pilot/fixtures/scr-2026-inventory-summary.json` — verified 279-record V1 inventory summary
- `pilot/fixtures/scr-2026-enrichment-summary.json` — enrichment checksum, coverage and review exceptions
- `pilot/fixtures/scr-inventory-first-1000-summary.json` — opening inventory sample
- `pilot/fixtures/scr-inventory-last-598-summary.json` — retained invalid-evidence marker; do not use
- `scripts/import-browser-batch.mjs` — idempotent supervised inventory staging
- `scripts/browser-bridge-server.mjs` — token-protected loopback browser bridge
- `scripts/scr-browser-2026-collector.js` — server-draw-verified 2026 volume collector
- `scripts/stage-year-export.mjs` — normalize a filtered browser export for staging
- `scripts/build-d1-metadata-import.mjs` — deterministic idempotent D1 import builder
- `scripts/build-d1-case-enrichment-import.mjs` — validates and normalizes SCI case-status enrichment
- `scripts/validate-d1-enrichment-local.mjs` — reconciles the normalized enrichment in local D1
- `scripts/summarize-inventory.mjs` — local coverage summary
- `scripts/validate-inventory.mjs` — contiguous-position and identity validation
- `scripts/estimate-ai-cost.mjs` — measured token and Batch cost estimator
- `scripts/validate-pilot.mjs` — fixture integrity checks
- `prototypes/broadsheet/` — approved editorial homepage and judgment-page prototype; kept separate from the production Worker until its server-rendered integration is complete

## Deployment

The `main` branch is the production branch. Cloudflare Workers Builds deploys it
to the existing `the-legal-chronicles` Worker whenever a commit is pushed to
GitHub.

To validate the Cloudflare bundle locally without publishing it:

```sh
npm install
npm run check
npm run pilot:validate
npm run inventory:summary
npm run inventory:validate
```

Supervised browser batches can be merged into the ignored local staging file
with `npm run inventory:import`. Imports are keyed by the SCR year/path/key
tuple, so rerunning a page is idempotent even when SCR contains duplicate
neutral citation values. The legacy all-results browser collectors are disabled
because position-only waits can capture stale rows from SCR's server-side table.

Start the loopback-only bridge with `npm run inventory:bridge`. It generates a
new random URL token on every run, listens only on `127.0.0.1`, and passes each
submitted batch through the same importer. The validated SCR session and its
cookies remain inside the browser.

SCR uses a server-side DataTable. Collection code must wait for the completed
`draw` event after every filter or page request; displayed row numbers can change
before the server has replaced stale row content. The verified V1 path filters
2026 by SCR citation volume with `scripts/scr-browser-2026-collector.js`, then
normalizes the export with `scripts/stage-year-export.mjs`. This deterministic
collection stage does not call an AI model or consume API tokens.

The canonical local V1 metadata file is `data/scr-inventory-2026.ndjson`. It
contains 279 unique judgments across all eight SCR 2026 citation volumes. The
NDJSON is intentionally ignored by Git; the tracked summary fixture records its
validated totals without committing the full source dataset.

To rehearse the metadata import locally without accessing production Cloudflare:

```sh
npm run d1:build-import
npm run d1:local:migrate
npm run d1:local:import
npm run d1:local:verify
```

This stage writes judgment metadata, judges and judgment–judge relationships,
plus per-judgment source-action rows. Acts, sections, keywords, and categories
remain empty until they can be extracted from preserved source bodies.

## SCI case-status enrichment

Case-status enrichment is kept separate from the immutable SCR judgment record.
The raw JSONL remains outside public assets and is fingerprinted by SHA-256. D1
stores compact case identity/status fields, judgment-to-case relationships and
deduplicated official judgment/order links. Large operational sections such as
notices, defects, filings, court fees and similarity results stay in the raw
source object for later private R2 storage and explicit publication review.

Build and rehearse the enrichment import locally:

```sh
npm run enrichment:build-import -- /absolute/path/to/scr-2026-case-enrichment.jsonl
npm run d1:local:migrate
npm run enrichment:local:import
npm run enrichment:local:verify
```

The import deliberately records unmatched lookups instead of guessing. Source
placeholder dates such as `30-11--0001` normalize to `NULL`, source values remain
recoverable in the raw object, and only HTTPS URLs on approved Supreme Court of
India hosts enter the document table. The `CIVIL APPEAL No. 260/2026` citation
correction is stored as an alias from the collected `1072 INSC 2026` value to
the official `2026 INSC 59`; the original judgment identity is not silently
rewritten.

After an explicitly approved production import, reconcile the remote enrichment
tables with `npm run enrichment:remote:verify`. The raw JSONL must remain marked
`local_only` until a private R2 bucket is available and its uploaded checksum has
been verified.

The production database is bound as `DB` in `wrangler.jsonc`. Its imported
counts can be rechecked without changing data by running:

```sh
npm run d1:remote:verify
```

## Broadsheet design prototype

The selected editorial direction is preserved as a standalone Vite package in
`prototypes/broadsheet`. It is intentionally not wired into the production
Worker yet because primary legal content must remain available as server-rendered
HTML without relying on client-side JavaScript.

```sh
npm run prototype:install
npm run prototype:dev
npm run prototype:build
npm run prototype:test
```

## Judgment catalog routes

- `/judgments` — server-rendered 2026 listing with search, case-type and judge filters
- `/judgments/:slug` — source-attributed metadata record; `noindex` until its body is published
- `/api/v1/judgments` — paginated read-only judgment metadata plus case-enrichment status
- `/api/v1/judgments/:slug` — one record with judges, source assets, verified SCI case facts, official documents and citation aliases
- `/api/v1/filters` — available years, case types, judges and bench sizes
- `/api/v1/health` — catalog service health response
- `/robots.txt` and `/sitemap.xml` — crawl controls generated by the Worker

The detail API reports unmatched enrichment as `case: null` with an explicit
`not_found`/`unmatched` status. It never guesses a relationship and does not
return raw-payload hashes, R2 keys, dataset fingerprints, or unreviewed
operational sections from the source capture.

Filtered query-string result pages are `noindex, follow`. The sitemap includes
only the catalog landing page and judgments whose `content_status` is
`published`; metadata-only records are intentionally excluded.
