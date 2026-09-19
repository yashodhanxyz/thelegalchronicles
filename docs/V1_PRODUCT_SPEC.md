# The Legal Chronicles — Version 1 Product Specification

Status: agreed product boundary, pending source-access validation

## Goal

Build a mobile-first, search-friendly library of Supreme Court Reports (SCR)
judgments. Version 1 contains 2026 judgments. Later releases import older years
until the complete SCR collection is represented.

## Version 1 scope

- Supreme Court Reports judgments with citation year 2026.
- Source metadata and source-provided classifications.
- One canonical detail page per judgment.
- The complete English Split/HTML View content, preserved without editorial or
  AI changes.
- Search and filters for judgment metadata and source-provided tags.
- An on-demand PDF generated from the displayed HTML judgment.
- Prominent attribution to Supreme Court Reports (SCR) and a link to the
  authoritative source.

## Long-term scope

Import older citation years in reverse chronological order until the complete
SCR collection, currently shown by the source as approximately 38,598 records,
is represented.

## Explicit exclusions

- Flip View.
- Downloading, storing, proxying, or republishing the source PDF.
- Rewriting, correcting, summarising, translating, or otherwise editing the
  source legal document.
- AI-derived tags in version 1.
- A second indexable page containing the same HTML judgment.

## Judgment page

Each judgment has one stable canonical URL. The page preserves the source
content and ordering, including when present:

1. SCR and neutral citations
2. Case title, number, decision date, and Coram
3. Issue for Consideration
4. Headnotes
5. Case Law Cited
6. Acts
7. Keywords
8. Case Arising From
9. Appearances for Parties
10. Judgment / Order
11. Result of the Case
12. Footnotes

The mobile interface may add navigation around the document, but it must not
change the source wording or source order.

## PDF behaviour

The download action generates a PDF from the same preserved HTML used by the
judgment page. The PDF must include:

- `Source: Supreme Court Reports (SCR)`
- the source URL
- the source retrieval date
- the PDF generation date
- `Unofficial website-generated copy; verify against the authoritative source.`

Content fidelity can be guaranteed. Pixel-for-pixel equivalence with the
official source PDF cannot be claimed without using that PDF.

## Data boundary

- D1 stores identifiers, routes, metadata, filter relationships, collection
  state, content hashes, and R2 object keys.
- R2 stores the immutable source HTML capture and the safe renderable document.
- The source PDF is neither read by the ingestion pipeline nor stored.
- The website renders complete server HTML; judgment content must not depend on
  client-side JavaScript to become crawlable.

## Source fidelity controls

- Retain an immutable source capture for every successful collection.
- Compute a SHA-256 hash for each captured body.
- Record source lookup identifiers and collection timestamps.
- Treat sanitising scripts, event handlers, and remote controls as a security
  operation, not an editorial operation.
- Compare source text and rendered text before publication.
- Reject publication when required sections are missing or the text comparison
  fails.

## Mobile, search, and AI-readiness principles

- Complete initial HTML with a unique title, description, H1, and canonical.
- Clear semantic sections and an accessible mobile table of contents.
- Readable long-form typography and touch-friendly filters.
- Internal entity pages for judges, Acts, sections, years, and categories.
- Breadcrumbs, conservative structured data, and segmented sitemap indexes.
- Accurate `lastmod` values and genuine 404 responses.
- Source material and future editorial or AI material must always be visibly
  separated and independently attributable.

## Release gate

Before the full 2026 import, validate 5–10 representative judgments for:

- complete metadata capture;
- section and footnote fidelity;
- source-versus-rendered text equality;
- deterministic slugs and deduplication;
- usable mobile reading and navigation;
- generated PDF content fidelity; and
- a permitted, reliable source-access method.
