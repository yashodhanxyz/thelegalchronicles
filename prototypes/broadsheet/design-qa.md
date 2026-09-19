# Design QA: The Legal Chronicles Broadsheet Ledger

## Comparison target

- Source visual truth: `/Users/yashodhan/.codex/generated_images/01a0adda-a882-7b73-be53-ed12f8388723/exec-2336b403-fe82-491d-ba6c-a1d5f9229c6c.png`
- Final desktop implementation: `implementation-home-final.png`
- Final mobile implementation: `implementation-mobile-final.png`
- Full side-by-side comparison: `comparison-full-final.png`
- Focused header and hero comparison: `comparison-header-hero-final.png`
- Desktop viewport and captures: 1487 × 1058 CSS pixels, device scale factor 1, both source and implementation 1487 × 1058 pixels before horizontal composition.
- Mobile viewport and capture: 390 × 844 CSS pixels, device scale factor 1, implementation 390 × 844 pixels.
- State: default homepage, light theme, no active search. Judgment reading view was also inspected in the in-app browser.
- Refinement authority: the user's 18 September feedback supersedes the original mock where it removes the masthead strapline, Acts and Analysis navigation, date strip, persistent search field, row numbering, and repeated “Original judgment” links.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the system Georgia/Arial pairing reproduces the source's editorial serif and neutral interface contrast without a web-font request. The final lead headline matches the source's three-line hierarchy at the comparison viewport. Small optical differences from the generated reference are acceptable and keep the prototype fast.
- Spacing and layout rhythm: the left-aligned masthead, on-demand header search, simplified archival band, double rule, two-column lead, judgment rail, supporting stories, and quote block preserve the reference's proportions and reading order. Mobile collapses to one column with no horizontal overflow.
- Colors and visual tokens: warm paper, near-black ink, muted metadata, hairline rules, and the single rust action color match the reference. Contrast remains strong and meaning does not depend on color.
- Image quality and asset fidelity: all visible reference image roles use real raster assets. The supplied archival engraving is used directly; the three editorial photographs were generated as coherent, properly sized assets. No CSS art, placeholder rectangles, handcrafted SVG imagery, or emoji substitutes remain.
- Copy and content: visible case metadata uses the verified local 2026 fixture. The home rail is titled “Latest judgments”; month-and-day calendar tiles replace ordinal numbering; repeated source labels are removed. The prototype explicitly separates independent explanation from the preserved Supreme Court Reports record. No eyebrow headings, uppercase overlines, category pills, or badges are present.

## Full-view comparison evidence

`comparison-full-final.png` shows the source on the left and implementation on the right at equal pixel size. Major regions align: masthead and search, archival strip, three-line lead title, portrait image, latest-judgments rail, paired supporting stories, and the quote block.

## Focused comparison evidence

`comparison-header-hero-final.png` isolates the most fidelity-sensitive region. The final pass preserves the reference hierarchy while intentionally using verified case metadata and generated editorial assets rather than reproducing invented mock data.

## Interaction and responsive evidence

- In-app browser: confirmed the search input is absent by default, activated the icon-only control, verified focus moves directly into the labeled field, searched for `Carestream`, confirmed the panel closes and the result list reduces to one matching record, then cleared the search.
- Navigation check: the primary navigation contains only Judgments, Judges, and About; the removed publication date and strapline do not remain in the accessibility tree.
- Mobile: 390 px viewport reported `scrollWidth: 390` and `clientWidth: 390`; no horizontal page overflow.
- Browser console: no errors in final desktop or mobile checks.
- Primary content remains semantic HTML; keyboard focus is visible; a skip link, labeled search, heading hierarchy, landmarks, and source wording are present.

## Comparison history

1. First pass found three P2 fidelity issues: duplicate prominent search, a five-line lead headline, and over-tall article imagery caused by intrinsic image-height attributes. Fixed by retaining only the integrated masthead search, tightening the display scale, and enforcing responsive image height.
2. Second pass found one remaining P2 issue: the headline still wrapped to four lines against the source's three. Fixed by reducing the desktop display size while preserving the larger mobile override.
3. Final pass: the lead wraps to three lines, image proportions align, supporting stories enter the first viewport, no responsive overflow is present, and no actionable P0/P1/P2 findings remain.
4. User-refinement pass: simplified the masthead and navigation, converted search to a disclosure, removed the publication date strip and repetitive judgment source links, and introduced accessible calendar tiles. Desktop and 390 × 844 mobile states were visually inspected; the search remains keyboard-labeled and focused on open.

## Follow-up polish

- P3: replace the system serif only if a future brand typeface is licensed and can be self-hosted without delaying text rendering.
- P3: the engraving crop can be tuned per city when the editorial artwork library expands.

final result: passed
