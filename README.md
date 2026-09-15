# The Legal Chronicles

Coming Soon page for [thelegalchronicles.com](https://thelegalchronicles.com/), hosted on Cloudflare.

## Structure

- `coming-soon/index.html` — page markup and styles
- `coming-soon/_headers` — Cloudflare security and caching headers
- `wrangler.jsonc` — Cloudflare Worker and static-assets configuration

## Deployment

The `main` branch is the production branch. Cloudflare Workers Builds deploys it
to the existing `the-legal-chronicles` Worker whenever a commit is pushed to
GitHub.

To validate the Cloudflare bundle locally without publishing it:

```sh
npm install
npm run check
```
