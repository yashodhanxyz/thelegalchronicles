# The Legal Chronicles

The Legal Chronicles is a judgment-first legal publication. Its Cloudflare Worker serves server-rendered pages backed by D1, with original judgments kept distinct from editorial explanations.

## Release boundary

Article drafts and full judgment detail pages remain unavailable until their respective content and source reviews are complete. The public homepage and catalog show only validated SCR listing metadata (plus explicitly published records) and link validated records back to the official SCR source. Judgment detail pages and detail API responses require `published`; the sitemap lists only those detail pages. Local review routes are noindex and are only served on loopback hosts.

This public repository intentionally does not contain unpublished article copy, captured judgment bodies, portrait source files, or private editorial review material. The release Worker uses empty defaults for article drafts, judgment pilots, and judge portraits; the content itself is not bundled.

## Local checks

```sh
npm ci
npm test
npm run check
```

`npm run check` performs a Wrangler dry run. It does not deploy or apply database migrations.

## Production prerequisites

The current production database has migrations 0001–0006 applied. This Worker derives stable eight-character judgment IDs from existing slugs so it remains compatible until migration 0007 is applied. Judge biography routes return 404 until migration 0008 creates their profile table. Apply those schema migrations through the approved release process before importing judge profiles. Do not import or publish content as part of this code change. The production catalog currently contains 278 validated records and one metadata-only record; no article or judgment detail is marked published.

## Release checks

GitHub Actions runs `npm ci`, `npm test`, and the Wrangler dry run for pull requests and pushes to `main`. Cloudflare Workers Builds should use branch previews for review and keep `main` as the only production branch. Database migrations and content-status changes are separate approved operations; a Worker code deploy must never apply either implicitly.
