# The Legal Chronicles

The Legal Chronicles is a judgment-first legal publication. Its Cloudflare Worker serves server-rendered pages backed by D1, keeping original judgments distinct from editorial explanations.

## Release contents and boundaries

The public release contains 930 verified 2025 judgment records and 277 verified 2026 judgment records, 17 AI-assisted explainers, and 38 official-source judge biographies. Explainers have not undergone independent human legal review; each article says so and links to its source judgment. They are general information, not legal advice.

A further 134 collected 2025 identities remain withheld: 70 failed captures, 59 without captured HTML, four unresolved judge-name conflicts and one decision-date conflict. Two 2026 judgment records remain withheld: 2026 INSC 847 because the accessible capture omits a separate concurrence, and 2026 INSC 652 because the source identity is unresolved. Three explainers remain withheld because their source or currentness checks are incomplete. Published pages, APIs, judge counts, and the sitemap include only records marked `published`.

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


## 2025 expansion (published and verified, 21 October 2026)

The initial 2025 text-transform pass contained 935 documents. Original-source
review leaves **930 publication candidates and 134 withheld records** from the
1,064-identity collected inventory. Complete annual court coverage is not
asserted. All 930 accepted records are now published. Remote reconciliation verified all 1,860 source/render objects byte for byte, exact per-record hashes and reviewed judge relationships; existing 2026 records and relationships remained unchanged. Live checks verified all 930 readers against source-derived text, all 25,288 fragment links, all 134 withheld 404s, and exact API/sitemap counts. One initial network fetch failure passed a targeted recheck.

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
tester is available. On 21 October 2026 the user explicitly approved release exceptions for those checks and the complete native filter-keyboard flow. These checks are untested, not passed. The user also approved the temporary D1-only sign-in with the refresh access required by Wrangler; the isolated credential was revoked and removed after release.
The legacy D1 validator still assumes a single-year metadata-only catalog;
its old 36-judge expectation already failed against the 38-judge database before
this expansion. It is not reported as passing. The scoped local byte, identity,
relationship, source-section and whole-reader checks provide separate evidence.

## Withheld 2025 recovery (private review, 21 October 2026)

All 134 withheld records were reviewed. **71 unpublished candidates** now pass
local source, required-section, judge-relationship and reader checks: 64 footnote
navigation recoveries, four documented judge-spelling reconciliations, two
neutral-citation corrections and one decision-date correction. Original legal
text and raw listing captures are unchanged. Four corrections are corroborated
by retained official PDFs; their previews identify the original and verified
metadata separately and link to the evidence.

**63 remain blocked:** 59 without English HTML in the current SCR listing,
three unresolved citation mismatches and one source that comments out a
referenced footnote. Never supply the missing footnote or replace the legal text
with an inferred value. The current 2025 listing was checked after a human
completed its CAPTCHA. Later within-results searching returned an upstream
server error; no access control was bypassed.

The recovery is isolated under `data/scr-body-corpus/2025/recovery-reviewed/`.
It generates no publication allowlist and performs no production import.
`review-withheld-2025.mjs` accepts only explicitly reviewed PDF evidence whose
bytes match the recorded hash. Without the private correction-evidence file,
those four cases remain withheld. The default parser and all 930 released
render hashes remain unchanged.

```sh
node scripts/review-withheld-2025.mjs /absolute/path/to/scr-inventory-complete-38598.ndjson
node scripts/build-d1-metadata-import.mjs data/scr-body-corpus/2025/recovery-reviewed/inventory.ndjson data/scr-body-corpus/2025/recovery-reviewed/metadata.sql 2025 71 2026-09-30 1064
python3 scripts/prepare-scr-recovery-local.py /private/tmp/previous-release-simulation.sqlite /private/tmp/new-recovery-fixture.sqlite
node scripts/verify-scr-recovery.mjs /private/tmp/new-recovery-fixture.sqlite
```

The fixture builder opens its source database read-only and refuses an existing
output or an output outside `/private/tmp/`. The prior release simulation must
contain the 930 published baseline records; the new 71 stay `validated` in the
disposable fixture and return public 404s. At the earlier private-review checkpoint, production contained
930 published 2025 records and all 134 withheld identities returned public 404s.
Remote byte verification and full release review are still required before
publication. At that checkpoint, native screen-reader and actual browser-zoom checks had
not been performed. Evidence URLs must be rechecked before release;
one retained SCR PDF was served through a temporary official download URL.


### Recovered judgments published (21 October 2026)

The 71 private recovery candidates were rechecked for release. **70 pass the
source/evidence gate; 64 remain withheld overall.** The original 63 holds remain.
Pride Foramer is additionally withheld because its temporary official SCR
verification-PDF URL now returns HTTP 404; a durable official replacement is
required before publishing that date correction. The other three official
verification PDFs were downloaded again with certificate validation enabled
and match their recorded SHA-256 hashes.

The private `recovery-reviewed/release-70/` package contains a contiguous
70-record metadata inventory, five body SQL batches, 140 source/render objects,
and a publication allowlist guarded by exact source/render hashes and validated
status. Its disposable SQLite rehearsal reached 1,000 published 2025 records,
with all other existing judgment rows unchanged and foreign keys valid.
Production reconciliation verified all 140 object bytes, metadata and judge
relationships with foreign keys valid; all pre-existing rows and relationships
are unchanged. A fresh D1 Time Travel bookmark was recorded. The reader change was merged in PR #10 and deployed successfully. All 70
were then published through the exact-hash allowlist. Live checks verify
**1,000 published 2025 judgments**, all 70 reader texts, 2,653 fragment targets,
API/sitemap counts and all 64 withheld public 404s. The 277 published 2026
judgments remain unchanged. All 70 live readers pass 320px reflow without
JavaScript; the three live correction readers have zero axe violations. Never execute the earlier
930-record release scripts for this recovery batch.

Native Chrome keyboard search, both filter selections, result navigation,
reading jump, and footnote return passed. Actual Chrome 200% zoom was checked
on the archive and judgment reader, alongside the prior all-71 320px reflow,
JavaScript-disabled, automated accessibility, text-spacing, contrast,
reduced-motion and slow-network checks. VoiceOver access timed out twice and
no mobile tester is available. The user explicitly approved desktop and mobile
screen-reader exceptions for this recovery release; these checks remain
**untested**, not passed. The existing skipped private-fixture test is unchanged
(94 tests passed, one skipped); `npm run check`, pilot and inventory validation
passed. Temporary D1 access was revoked and its isolated credential directory removed.
Aggregate evidence is in `audits/2026-10-21-2025-expansion/recovery-release.json`.
The optional Cloudflare analytics beacon remains blocked by the unchanged CSP;
this pre-existing console error does not prevent judgment reading.
