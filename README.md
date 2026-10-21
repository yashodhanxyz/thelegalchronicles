# The Legal Chronicles

The Legal Chronicles is a judgment-first legal publication. Its Cloudflare Worker serves server-rendered pages backed by D1, keeping original judgments distinct from editorial explanations.

## Release contents and boundaries

The public release contains 277 verified 2026 judgment records, 17 AI-assisted explainers, and 38 official-source judge biographies. Explainers have not undergone independent human legal review; each article says so and links to its source judgment. They are general information, not legal advice.

Two judgment records remain withheld: 2026 INSC 847 because the accessible capture omits a separate concurrence, and 2026 INSC 652 because the source identity is unresolved. Three explainers remain withheld because their source or currentness checks are incomplete. Published pages, APIs, judge counts, and the sitemap include only records marked `published`.

## Local checks

```sh
npm ci
npm test
npm run check
```

`npm run check` runs a Wrangler dry run. It does not deploy or change D1. One SCR capture integration test is skipped when the private source-capture manifest is absent from the checkout.

## Production release

The production Worker reads the `the-legal-chronicles` D1 database. Record a D1 Time Travel recovery bookmark before changing content status. A full remote export requires separate approval when it includes unpublished data. Do not publish a judgment unless its identity and full source body reconcile; do not publish an explainer with unresolved source fidelity or material currentness issues.

Release code through a GitHub pull request to `main`, wait for CI, then deploy the merged Worker. Verify the public homepage, an article and its judgment link, a judgment detail, withheld records, robots, sitemap, and APIs after deployment. Database status changes are a separate release step.

### Missing pages and legacy judgment addresses

Missing HTML pages return a server-rendered HTTP 404 with a labelled GET search form, a link to the 2026 Supreme Court catalog and a homepage link. The page is `noindex, follow`; it is not added to the sitemap. Missing API/file responses and upstream failures retain their existing behavior. The Worker runs before static assets so unknown page paths reach this recovery handler.

Legacy `/judgments/{stored-slug}` and `/judgments/{stored-slug}/split` addresses resolve through the exact database slug and permanent judgment ID. On public hosts, only published records redirect (308) to the canonical judgment URL. Unknown and withheld records remain 404. Historical `/courts/...` paths must have their document identity verified before an explicit alias is added; similar titles or a court mismatch are not sufficient evidence. No blanket homepage redirect is used.

Local verification evidence for this change is under `outputs/404-review/`. This is not a production release or complete WCAG certification.


## 2025 expansion (reviewed release prepared, 21 October 2026)

The initial 2025 text-transform pass contained 935 documents. Original-source
review leaves **930 publication candidates and 134 withheld records** from the
1,064-identity collected inventory. Complete annual court coverage is not
asserted. The reviewed import remains unpublished until remote byte and relationship reconciliation passes; production publication is a separate guarded step.

The withheld set contains 70 failed captures, 59 records without captured HTML,
four unresolved judge-name spelling conflicts, and one conflicting decision
date. Do not relax source checks to raise coverage or publish these exceptions.

Judge relationships and verified author markers are reconciled against the
preserved SCR Coram and explicit author headings. Raw listing metadata and raw
legal text remain unchanged. Among the original 494 flagged metadata cases,
491 authorship comparisons are resolved; three remain unresolved and withheld.
One resolved case is separately withheld for its decision-date conflict. The
930 candidates include 135 whose checked source fields identify no author;
the UI and API leave authorship unverified rather than infer it from bench order.

The archive supports `/judgments/supreme-court/2025` and 2026 with year-specific
search, filters, pagination, canonical metadata and judge links. Only published
records are exposed publicly. `/sitemap.xml` is a sitemap index; leaf maps under
`/sitemaps/` separate pages, articles, judge profiles and each published judgment
year. Crawler permissions remain unchanged. Paragraph anchors are unique when
numbering restarts in another opinion. Footnote returns resolve to the actual
rendered reference, including SCR filename-prefixed links.

Reproduce source validation and prepare private import artifacts:

```sh
node scripts/verify-scr-year.mjs 2025
node scripts/stage-scr-year.mjs 2025 /absolute/path/to/scr-inventory-complete-38598.ndjson
node scripts/prepare-scr-year-release.mjs
node scripts/build-d1-metadata-import.mjs data/scr-body-corpus/2025/release-reviewed/inventory.ndjson data/scr-body-corpus/2025/release-reviewed/metadata.sql 2025 930 2026-09-30 1064
node scripts/validate-inventory.mjs data/scr-body-corpus/2025/release-reviewed/inventory.ndjson
```

`release-reviewed/review.json` records source evidence and every exception.
The generated activation SQL sets `validated`, never `published`. The separate
`publish-allowlist.sql.pending` is review material, guarded by source identity,
validation state, storage type and exact source/render hashes. Do not apply it
until remaining release checks pass or the user explicitly approves an exception.
Source-fidelity failures are never publication candidates.

For local rehearsal, stop the local Worker, then pass its SQLite database path:

```sh
python3 scripts/import-scr-reviewed-local.py /absolute/path/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/DATABASE.sqlite
```

This helper refuses nonlocal databases, creates a private backup, reconciles
all 1,860 candidate source/render objects byte for byte, verifies judge
relationships, checks foreign keys and confirms existing 2026 rows/relationships
are unchanged. It does not publish. `verify-scr-reviewed-reader.mjs` checks all
candidate readers against a disposable publication-simulation database only;
never treat that simulation as a production release.

The approved source boundary is complete captured SCR HTML. The product spec
excludes source-PDF ingestion; no PDF completeness claim is made. Section checks
verify both citations, the visible party header, one matching decision date,
Coram, judgment/order text and final result. Existing source sections and
footnotes are preserved by text equality and source/render hash reconciliation.

Local evidence is in `audits/2026-10-21-2025-expansion/RELEASE-REVIEW.html` and
private JSON files beside it. Native 200% browser zoom and desktop/mobile screen
readers remain unverified; native VoiceOver control was denied and no mobile
tester is available. On 21 October 2026 the user explicitly approved release exceptions for those checks and the complete native filter-keyboard flow. These checks are untested, not passed. The user also approved the temporary D1-only sign-in with the refresh access required by Wrangler; the isolated credential is removed after release.
The legacy D1 validator still assumes a single-year metadata-only catalog;
its old 36-judge expectation already failed against the 38-judge database before
this expansion. It is not reported as passing. The scoped local byte, identity,
relationship, source-section and whole-reader checks provide separate evidence.
