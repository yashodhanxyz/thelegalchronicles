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

The production Worker reads the `the-legal-chronicles` D1 database. Take a remote D1 export before changing content status. Do not publish a judgment unless its identity and full source body reconcile; do not publish an explainer with unresolved source fidelity or material currentness issues.

Release code through a GitHub pull request to `main`, wait for CI, then deploy the merged Worker. Verify the public homepage, an article and its judgment link, a judgment detail, withheld records, robots, sitemap, and APIs after deployment. Database status changes are a separate release step.

### Missing pages and legacy judgment addresses

Missing HTML pages return a server-rendered HTTP 404 with a labelled GET search form, a link to the 2026 Supreme Court catalog and a homepage link. The page is `noindex, follow`; it is not added to the sitemap. Missing API/file responses and upstream failures retain their existing behavior. The Worker runs before static assets so unknown page paths reach this recovery handler.

Legacy `/judgments/{stored-slug}` and `/judgments/{stored-slug}/split` addresses resolve through the exact database slug and permanent judgment ID. On public hosts, only published records redirect (308) to the canonical judgment URL. Unknown and withheld records remain 404. Historical `/courts/...` paths must have their document identity verified before an explicit alias is added; similar titles or a court mismatch are not sufficient evidence. No blanket homepage redirect is used.

Local verification evidence for this change is under `outputs/404-review/`. This is not a production release or complete WCAG certification.
