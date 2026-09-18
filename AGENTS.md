# The Legal Chronicles: Product and Engineering Standards

Read this file before planning, implementing, reviewing, or testing any change in this repository.

The Legal Chronicles is a free, judgment-first legal publication. It preserves original legal material and connects it to accessible explanations, journalism, people, Acts, and source-backed data. The judgment is the core record of the website.

## Non-negotiable priorities

Every public page must be:

1. **Accessible first:** exclusion is a defect, not an accepted tradeoff.
2. **AI-readable:** humans, search engines, answer engines, and agents must be able to find, understand, verify, and cite the content.
3. **Mobile first:** the complete task must work on a small screen and a slow or unreliable connection.

When these priorities conflict with decoration, animation, framework convenience, or analytics, these priorities win.

## Source and editorial integrity

- Preserve original judgments without editorial or AI alteration.
- Keep original legal material, verified metadata, plain-language explanation, analysis, and opinion visibly distinct.
- Never present a summary, generated PDF, AI output, or editorial article as an official court document.
- Every legal claim in an explainer must be traceable to the judgment or another identified authoritative source.
- State uncertainty, split opinions, unresolved questions, and source limitations directly.
- Show source URLs, retrieval dates, publication dates, update dates, authorship, and correction history where applicable.
- Do not invent citations, quotations, judge relationships, lawyer relationships, Acts, sections, categories, or outcomes.
- Long-form source text must follow the fidelity controls in `docs/V1_PRODUCT_SPEC.md` and `docs/SCR_SOURCE_MAPPING.md`.

## Information architecture

- Use one stable canonical URL for each judgment, judge, Act, article, dataset, and other durable entity.
- Treat a judgment page as the permanent hub for its original text, metadata, explanation, connected people, Acts, cited cases, articles, and data.
- Publish deeper analysis as separate URLs linked to the relevant judgment hub.
- Use crawlable HTML links for relationships. Do not make discovery depend on client-side JavaScript.
- Prefer explicit names and relationships over ambiguous phrases such as “the judge,” “the Act,” or “this case.”
- Avoid duplicate pages that compete with the canonical record.
- Filtered and faceted URLs must have deliberate canonical and indexing behaviour.

## Accessible-first implementation

Target WCAG 2.2 AA as the minimum release standard.

- Use semantic HTML before ARIA. Add ARIA only when native elements cannot express the required meaning.
- Maintain a logical heading hierarchy and meaningful document landmarks.
- Provide a working skip link and visible keyboard focus.
- All interactions must work with a keyboard and without precision pointing.
- Do not communicate meaning through colour, position, shape, hover, sound, or motion alone.
- Use descriptive labels, instructions, link text, validation messages, and error recovery.
- Preserve browser zoom, text resizing, user styles, and text-spacing overrides.
- Pages must reflow without loss of content or functionality at a 320 CSS-pixel width and at high zoom.
- Avoid justified body text. Keep long-form reading widths comfortable and line spacing generous.
- Respect `prefers-reduced-motion`. Motion must never be required to understand or operate the page.
- Decorative images use empty alternative text. Informative images receive concise, useful alternatives.
- Never place essential text only inside an image, canvas, animation, or inaccessible PDF.
- Original judgments must have an accessible HTML reading experience even when a PDF is available.
- Tables must retain proper headers and relationships. On mobile, preserve meaning rather than merely shrinking them.
- Use accessible names and states for search, filters, pagination, disclosures, dialogs, and document navigation.

Automated accessibility scores are supporting evidence, not proof. Manual testing is required.

## AI and search readability

- Render the primary content in the initial server response. Do not require JavaScript to reveal a judgment or article.
- Give every indexable page a unique title, description, H1, canonical URL, and clear source identity.
- Structure content with descriptive sections that answer real reader questions.
- Use stable paragraph or section anchors where readers and machines may need to cite a precise passage.
- Keep entity names, dates, citations, authorship, and relationships explicit and consistent.
- Add structured data only when it accurately represents visible page content. Never add speculative or misleading markup.
- Maintain segmented XML sitemaps containing only canonical, indexable URLs and accurate `lastmod` values.
- Keep `robots.txt`, meta robots directives, HTTP headers, canonicals, sitemaps, and firewall rules consistent.
- Treat search crawling and model-training permission as separate policy decisions. Do not change crawler permissions without explicit approval.
- Allowing `OAI-SearchBot` may support discovery in ChatGPT search. `GPTBot` policy must be decided separately.
- `/llms.txt` is a curated machine-readable map, not a ranking mechanism and not a substitute for HTML, internal links, or sitemaps.
- If Markdown alternatives are published, generate them deterministically from the same source as the HTML. They must not become divergent copies of legal material.
- Do not create thin pages, keyword variants, hidden text, or mass-generated summaries for supposed AI visibility.
- Optimize for attribution: identify the original source, The Legal Chronicles' role, the author, the date, and the evidence supporting each conclusion.

## Mobile and performance

- Design from the smallest supported viewport outward. Desktop-only layouts are incomplete.
- The full path from search to identification, explanation, original text, verification, and sharing must work on mobile.
- Default to server-rendered HTML and CSS. JavaScript should progressively enhance an already usable page.
- Judgment and article reading must work when JavaScript fails or is disabled.
- Avoid large client frameworks, hydration, carousels, autoplay, scroll effects, and animation unless the user benefit is demonstrated.
- Keep navigation, filters, tables of contents, footnotes, citations, and source actions touch-friendly.
- Prevent layout shifts. Reserve image dimensions and avoid font-loading strategies that hide text.
- Prefer system fonts or carefully subset and self-hosted fonts with fallbacks.
- Optimize artwork separately from legal content. Artwork must not delay or obscure the primary text.
- Use responsive images and modern formats where raster images are required. Prefer lightweight SVG for appropriate line artwork.
- Cache immutable assets aggressively and use appropriate validation for changing HTML and data.
- Test slow-network, timeout, empty, partial-data, and source-unavailable states.

## Visual system

- The text is the hero. Decoration must support hierarchy and identity without competing with the law.
- Use the restrained “ink and paper” direction: near-black ink, warm paper, quiet rules, and rare functional or archival accents.
- Reserve colour for meaning, focus, status, and carefully controlled identity. Never depend on it alone.
- Use artwork selectively on section introductions, entity pages, editorial features, and the footer. Keep judgment reading surfaces quiet.
- Avoid unnecessary cards, shadows, rounded containers, gradients, and motion.

## Security and privacy

- Sanitize preserved source HTML as a security operation without editorially changing the text.
- Do not execute source scripts, event handlers, embeds, or remote controls.
- Validate and encode all database, route, form, query-string, and rendered values.
- Keep security headers restrictive and document any exception.
- Collect the minimum analytics and personal information necessary.
- Do not expose private source captures, credentials, tokens, internal identifiers, or unpublished editorial material.

## Required review before completion

Review every affected page against all three priorities. Do not review only the feature's happy path.

### Accessibility review

- Navigate the entire changed flow using only the keyboard.
- Confirm focus order, focus visibility, accessible names, landmarks, headings, errors, and status messages.
- Test at 200% zoom and verify reflow at 320 CSS pixels or an equivalent high-zoom viewport.
- Test reduced motion, increased text spacing, and high-contrast conditions where available.
- Check at least one desktop screen reader and one mobile screen reader for material user-facing changes.
- Run an automated accessibility scan, then manually investigate the results.

### AI and search review

- Fetch the raw server response and confirm that the primary content is present without JavaScript.
- Verify title, description, H1, canonical, robots directive, structured data, internal links, and source attribution.
- Confirm that entities and relationships are stated explicitly and consistently.
- Verify sitemap inclusion or exclusion and `lastmod` accuracy.
- Confirm crawler access is not unintentionally blocked by `robots.txt`, headers, authentication, a firewall, or a JavaScript challenge.
- Check that original material, explanation, analysis, and opinion cannot be mistaken for one another.

### Mobile and performance review

- Test the complete flow at common narrow widths, including long titles, citations, names, footnotes, and empty states.
- Test with JavaScript disabled when the page's primary task should not require it.
- Test on a throttled connection and confirm that text appears before optional artwork or enhancements.
- Check for horizontal page scrolling, clipped controls, layout shifts, oversized tap targets, and inaccessible sticky elements.
- Inspect transferred JavaScript, fonts, images, and third-party requests. Remove anything that does not earn its cost.

### Legal-content fidelity review

- Compare source text and rendered text before publication.
- Verify ordering, headings, paragraph numbering, citations, footnotes, and required sections.
- Verify source identity, retrieval date, content status, and disclaimers.
- Reject publication when fidelity or required-source checks fail.

### Repository verification

Run the checks relevant to the changed area. At minimum, run:

```sh
npm run check
```

For catalog, ingestion, database, or source-fidelity changes, also run the applicable existing validation commands documented in `README.md`, including pilot, inventory, and D1 verification where relevant.

Do not claim that accessibility, AI visibility, mobile behaviour, deployment, indexing, or source fidelity is verified unless the corresponding check was actually performed. Report untested items explicitly.

## Definition of done

A change is done only when:

- its primary content and task work accessibly on mobile;
- its primary content is present in semantic server-rendered HTML;
- it preserves the boundary between original law and editorial material;
- canonical, indexing, source, and entity signals are correct;
- relevant automated and manual checks pass;
- failure and edge states are handled;
- the final report states what was verified, what was not verified, and any access still required.
