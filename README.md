# The Legal Chronicles

The Legal Chronicles is a judgment-first legal publication. Its Cloudflare Worker serves server-rendered pages backed by D1, with original judgments kept distinct from editorial explanations.

## Release boundary

Articles, judge profiles, and judgments remain unavailable for public release until their respective content and source reviews are complete. The Worker filters the public catalog and sitemap to records marked `published`; unpublished judgment detail routes return 404. Local review routes are noindex and are only served on loopback hosts.

This public repository intentionally does not contain unpublished article copy, captured judgment bodies, portrait source files, or private editorial review material. The release Worker uses empty defaults for article drafts, judgment pilots, and judge portraits; the content itself is not bundled.

## Local checks

```sh
npm ci
npm test
npm run check
```

`npm run check` performs a Wrangler dry run. It does not deploy or apply database migrations.

## Production prerequisites

The current production database has migrations 0001–0006 applied. This Worker derives stable eight-character judgment IDs from existing slugs so it remains compatible until migration 0007 is applied. Judge biography routes return 404 until migration 0008 creates their profile table. Apply those schema migrations through the approved release process before importing judge profiles. Do not import or publish content as part of this code change. The current production catalog has 279 records (278 validated and one metadata-only); none are marked published.
