import { authorProfile, correctionsEmail, editorialPolicySections } from './data/publication.js';
import { jsonLd, pageGraph } from './seo.js';
import { articleImages } from './data/article-images.generated.js';
import { articleDrafts } from './data/article-drafts.generated.js';
import { displayCaseTitle } from './display-title.js';
const COURT_CATALOG = '/judgments/supreme-court/2026';
function judgmentPath(record) {
  if (!record.public_id) return `/judgments/${encodeURIComponent(record.slug)}`;
  const name = record.slug.replace(/-[a-z0-9]{8}$/, '').replace(/-\d{4}-insc-\d+$/, '');
  return `/judgments/supreme-court/${record.decision_year || record.source_citation_year}/${encodeURIComponent(name)}-${record.public_id}`;
}
async function canonicalJudgment(request, env, publicId, year) {
  const record = await env.DB.prepare('SELECT slug, public_id, decision_year, source_citation_year, content_status FROM judgments WHERE public_id = ?1 LIMIT 1').bind(publicId).first();
  if (!record || String(record.decision_year || record.source_citation_year) !== year || (record.content_status !== 'published' && !isLocalArticleReview(request))) return new Response('Judgment not found', {status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});
  const path = judgmentPath(record);
  if (new URL(request.url).pathname !== path) return Response.redirect(new URL(path, request.url).href,308);
  return judgmentDetail(record.slug,env,null,isLocalArticleReview(request));
}
import { judgePortraits } from './data/judge-portraits.generated.js';

const SITE_NAME = "The Legal Chronicles";
const SITE_ORIGIN = "https://thelegalchronicles.com";
const PAGE_SIZE = 20;
const RELEASE_DATE = "2026-10-14";
// Hold articles whose source completeness or currentness check is unresolved.
const PUBLIC_ARTICLE_IDS = new Set([
  "c52b4f45", "c81c0290", "3d50b31a", "4766179a", "bf43e767",
  "3611705e", "c936c42b", "25a347b5", "f70f6467", "065a4f9b",
  "0481ad70", "e1bdf2c2", "271f82b2", "ab806c21", "fb7b3020",
  "92c69e3b", "c672bd54",
]);
const publicArticles = Object.freeze(articleDrafts.filter((article) => PUBLIC_ARTICLE_IDS.has(article.id)));
const pilotDocumentsByCitation = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function integerParam(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function htmlResponse(body, status = 200, robots = "index, follow") {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "content-security-policy": "default-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "x-robots-tag": robots,
    },
  });
}

function jsonResponse(value, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function textResponse(value, contentType, cacheControl = "public, max-age=300") {
  return new Response(value, {
    headers: {
      "cache-control": cacheControl,
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
}

function bodyless(response) {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function searchIcon() {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.25 4.25"></path></svg>`;
}

function pageShell({ title, description, canonical, robots = "index, follow", current = "", content, article, image, person, breadcrumbs = [] }) {
  const socialImage = new URL(image?.src || '/social-card.png', canonical).href;
  const graph = pageGraph({title,description,canonical,article,image,person,breadcrumbs});
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="${escapeHtml(robots)}">
    <meta name="theme-color" content="#171713">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:type" content="${article ? 'article' : 'website'}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta property="og:image:alt" content="${escapeHtml(image?.alt || 'The Legal Chronicles — independent legal publishing')}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:image:alt" content="${escapeHtml(image?.alt || 'The Legal Chronicles — independent legal publishing')}">
    <script type="application/ld+json">${jsonLd(graph)}</script>
    <link rel="stylesheet" href="/catalog.css?v=20261013-article-review1">
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="site-header">
      <a class="wordmark" href="/">${SITE_NAME}</a>
      <nav aria-label="Primary navigation">
        <a${current === "judgments" ? ` aria-current="page"` : ""} href="${COURT_CATALOG}">Judgments</a>
        <a href="/articles">Articles</a>
        <a href="/articles">Articles</a>
        <a href="/judges/supreme-court">Judges</a>
        <a href="/#about">About</a>
      </nav>
      <details class="site-search">
        <summary aria-label="Open search">${searchIcon()}<span class="visually-hidden">Search judgments</span></summary>
        <form action="${COURT_CATALOG}" method="get" role="search">
          <label for="site-search">Search judgments</label>
          <div>
            <input id="site-search" type="search" name="q" placeholder="Case name, citation or number" autocomplete="off">
            <button type="submit">Search</button>
          </div>
        </form>
      </details>
    </header>
    ${content}
    <footer class="site-footer">
      <div class="footer-main">
        <div id="about" class="footer-identity"><a class="footer-wordmark" href="/">${SITE_NAME}</a><p>Original judgments. Clearer understanding.</p><p class="footer-description">A free, independent legal publication connecting the public record with accessible explanations.</p></div>
        <nav class="footer-navigation" aria-label="Footer navigation"><h2>Explore</h2><a href="${COURT_CATALOG}">Judgments</a><a href="/articles">Articles</a><a href="/judges/supreme-court">Judges</a><a href="/authors/${authorProfile.slug}">About the author</a><a href="/editorial-policy">Editorial policy</a><a href="/corrections">Corrections</a></nav>
        <div class="footer-source"><h2>The record comes first</h2><p>Our explanations sit alongside the law. For the Court’s reasoning and directions, always consult the original judgment.</p><a href="${COURT_CATALOG}">Explore the judgment archive <span aria-hidden="true">↗</span></a></div>
      </div>
      <div class="footer-bottom"><p>© 2026 ${SITE_NAME}</p><p>Independent legal publishing · Free to read</p></div>
    </footer>
  </body>
</html>`;
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const [year, month, day] = value.split("-");
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${year}-${month}-${day}T00:00:00Z`));
}

function dateParts(value) {
  if (!value) return { month: "—", day: "—", label: "Date unavailable" };
  const date = new Date(`${value}T00:00:00Z`);
  return {
    month: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(date),
    day: new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "UTC" }).format(date),
    label: formatDate(value),
  };
}

const judgmentSectionIds = {
  "Issues-for-Consideration_Heading": "issue",
  Headnote_Heading: "headnotes",
  Act_Heading: "acts",
  Keywords_Heading: "keywords",
  "Case-Cited_Heading": "case-law",
  "Apeal-1_Heading": "origin",
  "Advocatees-Appeared_Heading": "appearances",
  Judgment_Heading: "judgment",
};

function renderJudgmentBlocks(blocks) {
  const usedIds = new Set();
  const renderText = (block, start = 0) => {
    const references = [...(block.footnoteReferences || [])].sort((a, b) => a.offset - b.offset);
    const inlineRanges = block.inlineRanges || [];
    const applyInlineStyles = (value, activeRanges) => {
      const kinds = new Set(activeRanges.map((range) => range.kind));
      let output = escapeHtml(value);
      if (kinds.has("underline") || kinds.has("strong-underline")) {
        output = `<span class="judgment-source-underline">${output}</span>`;
      }
      if (kinds.has("emphasis") || kinds.has("strong-emphasis")) {
        output = `<em>${output}</em>`;
      }
      if (kinds.has("strong") || kinds.has("strong-emphasis") || kinds.has("strong-underline")) {
        output = `<strong>${output}</strong>`;
      }
      return output;
    };
    const renderRange = (start) => {
      const boundaries = new Set([start, block.text.length]);
      for (const range of inlineRanges) {
        if (range.end <= start) continue;
        boundaries.add(Math.max(start, range.start));
        boundaries.add(range.end);
      }
      for (const reference of references) {
        if (reference.offset < start) continue;
        boundaries.add(reference.offset);
        boundaries.add(reference.offset + reference.number.length);
      }
      const offsets = [...boundaries].sort((a, b) => a - b);
      const segments = [];
      for (let index = 0; index < offsets.length - 1; index += 1) {
        const from = offsets[index];
        const to = offsets[index + 1];
        if (to <= from) continue;
        const value = block.text.slice(from, to);
        const activeRanges = inlineRanges.filter((range) => range.start <= from && range.end >= to);
        const styledValue = applyInlineStyles(value, activeRanges);
        const reference = references.find(
          (item) => item.offset === from && item.offset + item.number.length === to,
        );
        segments.push(reference
          ? `<a class="judgment-footnote-reference" id="${escapeHtml(reference.backlinkId)}" href="#${escapeHtml(reference.targetId)}" aria-label="Footnote ${escapeHtml(reference.number)}"><sup>${styledValue}</sup></a>`
          : styledValue);
      }
      return segments.join("");
    };

    if (start === 0 && block.paragraphMarker && block.text.startsWith(block.paragraphMarker)) {
      const mainOpinionNumber = block.className === "Judgement_L1" && /^(\d+)\.$/u.exec(block.paragraphMarker)?.[1];
      const paragraphAnchor = mainOpinionNumber
        ? ` id="karol-p-${mainOpinionNumber}" tabindex="-1"`
        : "";
      return `<span${paragraphAnchor} class="judgment-paragraph-number">${escapeHtml(block.paragraphMarker)}</span> ${renderRange(block.paragraphMarker.length)}`;
    }
    return renderRange(start);
  };

  return blocks.map((block) => {
    if (block.type === "rule") return `<hr class="judgment-rule">`;
    const text = renderText(block);
    const sourceId = judgmentSectionIds[block.className];
    const resultId = block.className.startsWith("Result-of-the-Case") ? "result" : null;
    const preferredId = sourceId || resultId;
    const id = preferredId && !usedIds.has(preferredId) ? preferredId : null;
    if (id) usedIds.add(id);
    const idAttribute = id ? ` id="${id}" tabindex="-1"` : "";

    if (block.type === "heading") {
      return `<h2${idAttribute} class="judgment-section-heading">${text}</h2>`;
    }
    if (block.className === "Heading-1") {
      return `<h3 class="judgment-subheading">${text}</h3>`;
    }
    const quoteLevel = block.className.match(/^Judgement-Q([1-3])/u)?.[1];
    if (block.type === "quote" || quoteLevel) {
      return `<blockquote class="judgment-quote${quoteLevel ? ` judgment-quote-level-${quoteLevel}` : ""}">${text}</blockquote>`;
    }
    if (block.className === "Footnote" || block.type === "footnotes") {
      if (block.footnote) {
        const footnoteBody = renderText(block, block.footnote.number.length);
        return `<p class="judgment-footnote" id="${escapeHtml(block.footnote.id)}" tabindex="-1"><a class="judgment-footnote-backlink" href="#${escapeHtml(block.footnote.backlinkId)}" aria-label="Return to footnote reference ${escapeHtml(block.footnote.number)}">${escapeHtml(block.footnote.number)}</a>${footnoteBody}</p>`;
      }
      return `<p class="judgment-footnote">${text}</p>`;
    }
    if (resultId) {
      return `<p${idAttribute} class="judgment-result">${text}</p>`;
    }
    if (block.className === "Author-Name") {
      return `<p class="judgment-author">${text}</p>`;
    }
    const paragraphLevel = block.className.match(/^Judgement_L([2-3])/u)?.[1];
    const sourceClass = block.className.startsWith("Centre")
      ? " judgment-centered"
      : block.className === "Emphasis"
        ? " judgment-emphasis"
        : paragraphLevel
          ? ` judgment-paragraph-level-${paragraphLevel}`
          : "";
    return `<p class="judgment-paragraph${sourceClass}">${text}</p>`;
  }).join("");
}

const judgmentSectionLabels = {
  issue: "Issue for consideration",
  headnotes: "Headnotes",
  "case-law": "Case law cited",
  acts: "Acts",
  keywords: "Keywords",
  origin: "Case arising from",
  appearances: "Appearances",
  judgment: "Judgment",
  result: "Result",
};

function judgmentContents(blocks) {
  const sectionIds = [];
  for (const block of blocks) {
    const sectionId = judgmentSectionIds[block.className]
      || (block.className.startsWith("Result-of-the-Case") ? "result" : null);
    if (sectionId && !sectionIds.includes(sectionId)) sectionIds.push(sectionId);
  }
  if (!sectionIds.length) return "";
  return `<nav class="split-contents" aria-label="Judgment sections">
    <h2>In this judgment</h2>
    <ol>${sectionIds.map((sectionId) => `<li><a href="#${sectionId}">${escapeHtml(judgmentSectionLabels[sectionId])}</a></li>`).join("")}</ol>
  </nav>`;
}

function kptclConcurrenceSupplement() {
  const source = articleDrafts.find((article) => article.id === "417b8667")?.officialSource;
  if (!source) return "";
  return `<section id="kptcl-concurrence" class="content-notice" aria-labelledby="kptcl-concurrence-title"><h3 id="kptcl-concurrence-title">Separate concurring opinion — Justice Nongmeikapam Kotiswar Singh</h3><p>The preserved SCR HTML capture ends with Justice Sanjay Karol’s opinion. The official Supreme Court PDF contains a separate 19-page concurrence, beginning at PDF page 14. That opinion is not reproduced in this SCR text view. This source guide provides attribution and links into the official PDF; it is not a transcript of the missing opinion.</p><p><a href="${escapeHtml(source.url)}" rel="external">Open the complete official judgment PDF (32 pages)</a></p><ul>${source.paragraph_pages.map((item) => `<li><a href="${escapeHtml(source.url)}#page=${item.page}" rel="external">${escapeHtml(item.label)}</a></li>`).join("")}</ul><p>Publication remains withheld until the missing opinion is available in a complete, fidelity-checked accessible HTML reading experience.</p></section>`;
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadRenderDocument(record, env) {
  let body;
  if (record.body_storage === "d1") {
    const result = await env.DB.prepare(`
      SELECT d.byte_count, d.chunk_count, c.chunk_index, c.payload_base64
      FROM judgment_body_documents d JOIN judgment_body_chunks c ON c.document_sha256 = d.sha256
      WHERE d.sha256 = ?1 AND d.kind = 'render' ORDER BY c.chunk_index
    `).bind(record.body_render_sha256).all();
    const rows = result.results || [];
    if (!rows.length || rows.length !== rows[0].chunk_count) throw new Error("Incomplete D1 judgment body");
    const bytes = new Uint8Array(rows[0].byte_count);
    let offset = 0;
    for (const [index, row] of rows.entries()) {
      if (row.chunk_index !== index || row.byte_count !== bytes.length || row.chunk_count !== rows.length) throw new Error("Invalid D1 body chunk sequence");
      const chunk = Uint8Array.from(atob(row.payload_base64), (character) => character.charCodeAt(0));
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (offset !== bytes.length) throw new Error("D1 body byte count mismatch");
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } else {
  if (!record.body_render_r2_key || !record.body_render_sha256 || !env.JUDGMENT_BODIES) {
    throw new Error(`Validated body storage is unavailable for ${record.slug}`);
  }
  const object = await env.JUDGMENT_BODIES.get(record.body_render_r2_key);
  if (!object) throw new Error(`Validated render object is missing for ${record.slug}`);
  body = await object.text();
  }
  const hash = await sha256Text(body);
  if (hash !== record.body_render_sha256) {
    throw new Error(`Validated render hash mismatch for ${record.slug}`);
  }
  const document = JSON.parse(body);
  if (
    document.version !== "scr-body-v1"
    || document.neutralCitation !== record.neutral_citation
    || document.sourcePath !== record.source_path
    || !Array.isArray(document.blocks)
    || document.blocks.length === 0
  ) {
    throw new Error(`Validated render identity mismatch for ${record.slug}`);
  }
  return document;
}

async function judgmentSplitPilot(slug, env) {
  const result = await env.DB.prepare(`
    SELECT
      slug, public_id, decision_year, source_citation_year, title_source, scr_citation, neutral_citation,
      decision_date_iso, source_listing_url, source_path, content_status
    FROM judgments
    WHERE slug = ?1
    LIMIT 1
  `).bind(slug).all();
  const record = result.results?.[0];
  const document = record ? pilotDocumentsByCitation.get(record.neutral_citation) : null;

  if (!record || !document || record.source_path !== document.sourcePath) {
    return htmlResponse(pageShell({
      title: `Split View pilot unavailable | ${SITE_NAME}`,
      description: "This judgment is not part of the bounded Split View pilot.",
      canonical: `${SITE_ORIGIN}/judgments/${encodeURIComponent(slug)}`,
      robots: "noindex, nofollow",
      current: "judgments",
      content: `<main id="main" tabindex="-1" class="message-page"><h1>Split View pilot unavailable.</h1><p>This judgment has not yet passed the pilot capture checks.</p><a class="read-link" href="/judgments/${encodeURIComponent(slug)}">← Return to the judgment record</a></main>`,
    }), 404, "noindex, nofollow");
  }

  const content = `
    <main id="main" tabindex="-1" class="detail-shell split-pilot-shell">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="${COURT_CATALOG}">Judgments</a><span aria-hidden="true">/</span>
        <a href="${judgmentPath(record)}">${escapeHtml(record.neutral_citation)}</a><span aria-hidden="true">/</span>
        <span>Split View pilot</span>
      </nav>
      <article>
        <header class="detail-header split-pilot-header">
          <p class="pilot-status">Pilot reading view · Not yet published</p>
          <h1>${escapeHtml(record.title_source)}</h1>
          <div class="detail-citations" role="group" aria-label="Citations">
            <span>${escapeHtml(record.scr_citation)}</span>
            <span>${escapeHtml(record.neutral_citation)}</span>
            <time datetime="${escapeHtml(record.decision_date_iso)}">${escapeHtml(formatDate(record.decision_date_iso))}</time>
          </div>
        </header>
        <section class="pilot-warning" aria-labelledby="pilot-warning-title">
          <h2 id="pilot-warning-title">Source-fidelity review is still in progress</h2>
          <p>This server-rendered preview uses ordered text blocks captured from the official SCR HTML view on ${escapeHtml(document.capturedAt)}. A supervised recapture on ${escapeHtml(document.revalidatedAt)} preserved the browser-serialized source DOM and matched these text blocks by SHA-256. Allowlisted emphasis, quotation levels, paragraph markers and footnote relationships are preserved without rendering source HTML. The original network-response bytes and complete assistive-technology review remain pending. This preview is not the official court document and must not be relied on as one.</p>
        </section>
        <div class="split-reading-layout">
          <nav class="split-contents" aria-label="Judgment sections">
            <h2>In this judgment</h2>
            <ol>
              <li><a href="#issue">Issue for consideration</a></li>
              <li><a href="#headnotes">Headnotes</a></li>
              <li><a href="#case-law">Case law cited</a></li>
              <li><a href="#acts">Acts</a></li>
              <li><a href="#keywords">Keywords</a></li>
              <li><a href="#origin">Case arising from</a></li>
              <li><a href="#appearances">Appearances</a></li>
              <li><a href="#judgment">Judgment</a></li>
              <li><a href="#result">Result</a></li>
            </ol>
            <dl class="pilot-provenance">
              <div><dt>Captured</dt><dd>${escapeHtml(document.capturedAt)}</dd></div>
              <div><dt>Revalidated</dt><dd>${escapeHtml(document.revalidatedAt)}</dd></div>
              <div><dt>Words</dt><dd>${document.wordCount.toLocaleString("en-IN")}</dd></div>
              <div><dt>Block hash</dt><dd><code>${escapeHtml(document.blockSha256.slice(0, 12))}…</code></dd></div>
            </dl>
          </nav>
          <section class="judgment-reading" aria-label="Captured judgment text">
            ${renderJudgmentBlocks(document.blocks)}
          </section>
        </div>
        <footer class="attribution split-attribution">
          <p><strong>Source:</strong> Supreme Court Reports (SCR). This independent pilot does not alter or replace the legal document. The authoritative source prevails.</p>
          <p><a class="source-link" href="${escapeHtml(record.source_listing_url)}" rel="external">Open the Supreme Court Reports source <span aria-hidden="true">↗</span></a></p>
        </footer>
      </article>
    </main>`;

  return htmlResponse(pageShell({
    title: `Split View pilot: ${record.title_source} | ${SITE_NAME}`,
    description: `Non-indexed Split View pilot for ${record.title_source}, ${record.neutral_citation}.`,
    canonical: `${SITE_ORIGIN}${judgmentPath(record)}`,
    robots: "noindex, nofollow",
    current: "judgments",
    content,
  }), 200, "noindex, nofollow");
}

async function homePage(env, articleReview = false) {
  const releaseFilter = articleReview ? "" : "AND content_status = 'published'";
  const [latestResult, countResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        slug, public_id, decision_year, source_citation_year, title_source, scr_citation, neutral_citation,
        decision_date_iso, case_number_source, disposal_nature_source,
        result_excerpt_source
      FROM judgments
      WHERE source_system = 'scr' AND source_citation_year = 2026 ${releaseFilter}
      ORDER BY decision_date_iso DESC, id DESC
      LIMIT 5
    `),
    env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM judgments
      WHERE source_system = 'scr' AND source_citation_year = 2026 ${releaseFilter}
    `),
  ]);

  const latest = latestResult.results || [];
  const lead = latest[0] || null;
  const total = Number(countResult.results?.[0]?.total || 0);
  const latestItems = latest.map((record) => {
    const date = dateParts(record.decision_date_iso);
    return `
      <article class="latest-row">
        <time class="date-tile" datetime="${escapeHtml(record.decision_date_iso)}">
          <span class="visually-hidden">${escapeHtml(date.label)}</span>
          <span aria-hidden="true">${escapeHtml(date.month)}</span>
          <strong aria-hidden="true">${escapeHtml(date.day)}</strong>
        </time>
        <div>
          <h3><a href="${judgmentPath(record)}">${escapeHtml(displayCaseTitle(record.title_source))}</a></h3>
          <p>${escapeHtml(record.neutral_citation)} <span aria-hidden="true">·</span> ${escapeHtml(record.scr_citation)}</p>
        </div>
      </article>`;
  }).join("");

  const leadContent = lead ? `
    <article class="lead-record">
      <h1>${escapeHtml(lead.title_source)}</h1>
      <p class="lead-citations">
        <span>${escapeHtml(lead.neutral_citation)}</span>
        <span>${escapeHtml(lead.scr_citation)}</span>
        <time datetime="${escapeHtml(lead.decision_date_iso)}">${escapeHtml(formatDate(lead.decision_date_iso))}</time>
      </p>
      <section aria-labelledby="lead-source-title">
        <h2 id="lead-source-title">From the SCR record</h2>
        <p class="lead-excerpt">${escapeHtml(lead.result_excerpt_source || "No listing excerpt was supplied by Supreme Court Reports.")}</p>
      </section>
      <dl class="lead-facts">
        <div><dt>Case number</dt><dd>${escapeHtml(lead.case_number_source || "Not stated")}</dd></div>
        <div><dt>Result</dt><dd>${escapeHtml(lead.disposal_nature_source || "Not stated by the source")}</dd></div>
      </dl>
      <a class="read-link" href="${judgmentPath(lead)}">View judgment record <span aria-hidden="true">→</span></a>
    </article>` : `
    <section class="empty-state" aria-labelledby="empty-home-title">
      <h1 id="empty-home-title">The judgment library is being prepared.</h1>
      <p>No verified judgment records are available yet.</p>
    </section>`;

  const homeArticleSet=articleReview?articleDrafts:publicArticles;
  const featuredArticle=homeArticleSet.find(a=>a.id==='c936c42b') || homeArticleSet[0];
  const companionArticles=['c81c0290','c672bd54',...homeArticleSet.map(a=>a.id).filter(id=>id!==featuredArticle?.id&&id!=='c81c0290'&&id!=='c672bd54')].slice(0,9).map(id=>homeArticleSet.find(a=>a.id===id)).filter(Boolean);
  const homeImage=(a,featured=false)=>{const image=articleImages[a.id];return image?`<img src="${escapeHtml(featured?image.src:image.small)}" srcset="${image.variants.map(v=>`${escapeHtml(v.src)} ${v.width}w`).join(", ")}" sizes="${featured?'(min-width: 1424px) 886px, (min-width: 960px) calc((100vw - 76px) * .6667), calc(100vw - 20px)':'(max-width: 540px) 96px, 180px'}" width="1536" height="1024" alt="" ${featured?'fetchpriority="high"':'loading="lazy"'} decoding="async">`:'';};
  const editorialLead=featuredArticle?`<section class="home-editorial" aria-labelledby="featured-label"><h2 id="featured-label" class="home-section-label">Featured article</h2><article class="home-featured"><a class="home-art-link" href="${escapeHtml(featuredArticle.proposed_article_path)}" aria-label="${escapeHtml(featuredArticle.title)}">${homeImage(featuredArticle,true)}</a><h1><a href="${escapeHtml(featuredArticle.proposed_article_path)}">${escapeHtml(featuredArticle.title)}</a></h1><p>${escapeHtml(featuredArticle.description)}</p></article><div class="home-section-heading"><h2 class="home-section-label">More articles</h2></div><div class="home-companions">${companionArticles.map(a=>`<article><a class="home-art-link" href="${escapeHtml(a.proposed_article_path)}" aria-label="${escapeHtml(a.title)}">${homeImage(a)}</a><div><h3><a href="${escapeHtml(a.proposed_article_path)}">${escapeHtml(a.title)}</a></h3><p>${escapeHtml(a.description)}</p></div></article>`).join('')}</div></section>`:'';
  const content = `
    <main id="main" tabindex="-1" class="home-shell home-publication">
      <div class="home-grid">
        ${editorialLead}
        <aside class="latest-panel" aria-labelledby="latest-title">
          <div class="section-heading">
            <h2 id="latest-title">Latest judgments</h2>
            <a href="${COURT_CATALOG}">View all</a>
          </div>
          <div class="latest-list">
            ${latestItems || `<p class="empty-note">No judgments are available.</p>`}
          </div>
          ${articleReview?'':`<blockquote><p>A more open legal culture builds a more equal India.</p><cite>${SITE_NAME}</cite></blockquote>`}
        </aside>
      </div>
    </main>`;

  const robots = articleReview ? "noindex, nofollow" : total > 0 ? "index, follow" : "noindex, follow";
  return htmlResponse(pageShell({
    title: `${SITE_NAME} | Supreme Court judgments and legal journalism`,
    description: "Find and verify Supreme Court judgments, source records and accessible legal journalism from The Legal Chronicles.",
    canonical: `${SITE_ORIGIN}/`,
    robots,
    content,
  }), 200, robots);
}

function queryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== "" && value !== null && value !== undefined && value !== 1) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

async function listJudgments(request, env) {
  const url = new URL(request.url);
  const localReview = isLocalArticleReview(request);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const caseType = (url.searchParams.get("case_type") || "").trim().slice(0, 100);
  const judge = (url.searchParams.get("judge") || "").trim().slice(0, 120);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 500);
  const offset = (page - 1) * PAGE_SIZE;
  const likeQuery = `%${q}%`;

  const publicationFilter = localReview ? "" : "AND j.content_status = 'published'";
  const where = `
    j.source_system = 'scr'
    AND j.source_citation_year = 2026
    ${publicationFilter}
    AND (?1 = '' OR j.title_source LIKE ?2 OR j.neutral_citation LIKE ?2 OR j.scr_citation LIKE ?2 OR j.case_number_source LIKE ?2)
    AND (?3 = '' OR j.case_type = ?3)
    AND (?4 = '' OR EXISTS (
      SELECT 1
      FROM judgment_judges AS jj
      JOIN judges AS judge ON judge.id = jj.judge_id
      WHERE jj.judgment_id = j.id AND judge.slug = ?4
    ))
  `;
  const bindings = [q, likeQuery, caseType, judge];
  const [recordsResult, countResult, caseTypesResult, judgesResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        j.slug, j.public_id, j.decision_year, j.source_citation_year, j.title_source, j.scr_citation, j.neutral_citation,
        j.decision_date_iso, j.case_number_source, j.case_type,
        j.disposal_nature_source, j.bench_size_source, j.coram_source,
        j.result_excerpt_source, j.content_status
      FROM judgments AS j
      WHERE ${where}
      ORDER BY j.decision_date_iso DESC, j.id DESC
      LIMIT ?5 OFFSET ?6
    `).bind(...bindings, PAGE_SIZE, offset),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM judgments AS j WHERE ${where}`)
      .bind(...bindings),
    env.DB.prepare(`
      SELECT case_type, COUNT(*) AS records
      FROM judgments
      WHERE source_system = 'scr' AND source_citation_year = 2026 ${localReview ? "" : "AND content_status = 'published'"} AND case_type IS NOT NULL
      GROUP BY case_type
      ORDER BY records DESC, case_type
    `),
    env.DB.prepare(`
      SELECT judge.slug, judge.name_source, COUNT(*) AS records
      FROM judges AS judge
      JOIN judgment_judges AS jj ON jj.judge_id = judge.id
      JOIN judgments AS j ON j.id = jj.judgment_id
      WHERE j.source_system = 'scr' AND j.source_citation_year = 2026 ${localReview ? "" : "AND j.content_status = 'published'"}
      GROUP BY judge.id
      ORDER BY records DESC, judge.name_normalized
    `),
  ]);

  const records = recordsResult.results || [];
  const total = Number(countResult.results?.[0]?.total || 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  if (page > pages && total > 0) {
    return Response.redirect(
      `${url.origin}${COURT_CATALOG}${queryString({ q, case_type: caseType, judge, page: pages })}`,
      302,
    );
  }
  const activeFilters = Boolean(q || caseType || judge);
  const canonical = `${SITE_ORIGIN}${COURT_CATALOG}${safePage > 1 ? `?page=${safePage}` : ""}`;
  const robots = localReview ? "noindex, nofollow" : activeFilters || total === 0 ? "noindex, follow" : "index, follow";

  const cards = records.map((record) => `
    <article class="judgment-card">
      <div class="citation-line">
        <span>${escapeHtml(record.neutral_citation)}</span>
        <span>${escapeHtml(record.scr_citation)}</span>
      </div>
      <h2><a href="${judgmentPath(record)}">${escapeHtml(record.title_source)}</a></h2>
      <dl class="card-facts">
        <div><dt>Decision</dt><dd><time datetime="${escapeHtml(record.decision_date_iso)}">${escapeHtml(formatDate(record.decision_date_iso))}</time></dd></div>
        <div><dt>Case</dt><dd>${escapeHtml(record.case_number_source)}</dd></div>
        <div><dt>Bench</dt><dd>${escapeHtml(record.bench_size_source || "Not stated")}</dd></div>
      </dl>
      ${record.result_excerpt_source ? `<p class="excerpt">${escapeHtml(record.result_excerpt_source)}</p>` : ""}
      <a class="read-link" href="${judgmentPath(record)}">View judgment record <span aria-hidden="true">→</span></a>
    </article>
  `).join("");

  const caseTypeOptions = (caseTypesResult.results || []).map((item) => `
    <option value="${escapeHtml(item.case_type)}"${item.case_type === caseType ? " selected" : ""}>
      ${escapeHtml(item.case_type)} (${item.records})
    </option>
  `).join("");
  const judgeOptions = (judgesResult.results || []).map((item) => `
    <option value="${escapeHtml(item.slug)}"${item.slug === judge ? " selected" : ""}>
      ${escapeHtml(item.name_source)} (${item.records})
    </option>
  `).join("");

  const baseParams = { q, case_type: caseType, judge };
  const previous = safePage > 1
    ? `<a rel="prev" href="${COURT_CATALOG}${queryString({ ...baseParams, page: safePage - 1 })}">← Previous</a>`
    : `<span aria-disabled="true">← Previous</span>`;
  const next = safePage < pages
    ? `<a rel="next" href="${COURT_CATALOG}${queryString({ ...baseParams, page: safePage + 1 })}">Next →</a>`
    : `<span aria-disabled="true">Next →</span>`;

  const content = `
    <main id="main" tabindex="-1" class="catalog-shell">
      <section class="catalog-intro" aria-labelledby="catalog-title">
        <h1 id="catalog-title">Judgments, made findable.</h1>
        <p>Browse the verified 2026 SCR catalog by case, judge, citation, and decision details.</p>
        <p class="source-note">Source metadata: Supreme Court Reports (SCR). The authoritative source record prevails.</p>
      </section>
      <form class="filters" action="${COURT_CATALOG}" method="get" role="search">
        <label class="search-field">
          <span>Search judgments</span>
          <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Case name, citation or number" autocomplete="off">
        </label>
        <label>
          <span>Case type</span>
          <select name="case_type">
            <option value="">All case types</option>
            ${caseTypeOptions}
          </select>
        </label>
        <label>
          <span>Judge</span>
          <select name="judge">
            <option value="">All judges</option>
            ${judgeOptions}
          </select>
        </label>
        <button type="submit">Apply filters</button>
        ${activeFilters ? `<a class="clear-link" href="${COURT_CATALOG}">Clear</a>` : ""}
      </form>
      <section class="results" aria-labelledby="results-title">
        <div class="results-heading">
          <div>
            <h2 id="results-title">${total.toLocaleString("en-IN")} ${total === 1 ? "judgment" : "judgments"}</h2>
          </div>
          <p>Page ${safePage} of ${pages}</p>
        </div>
        <div class="judgment-list">
          ${cards || `<div class="empty-state"><h2>No judgments found</h2><p>Try removing a filter or searching with fewer words.</p></div>`}
        </div>
        ${total ? `<nav class="pagination" aria-label="Results pages">${previous}<span>${safePage} / ${pages}</span>${next}</nav>` : ""}
      </section>
    </main>
  `;

  return htmlResponse(pageShell({
    title: `2026 Supreme Court Judgments${safePage > 1 ? ` — Page ${safePage}` : ""} | ${SITE_NAME}`,
    description: `Browse verified 2026 Supreme Court Reports judgment metadata by case, judge, citation and decision details.${safePage > 1 ? ` Page ${safePage} of ${pages}.` : ""}`,
    canonical,
    robots,
    current: "judgments",
    content,
  }), 200, robots);
}

async function judgmentDetail(slug, env, legacyRequest = null, articleReview = false) {
  const [recordResult, judgesResult, assetsResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        id, slug, public_id, title_source, scr_citation, neutral_citation,
        decision_date_source, decision_date_iso, decision_year,
        case_number_source, case_type, disposal_nature_source,
        bench_size_source, bench_size, coram_source, result_excerpt_source,
        source_listing_url, source_citation_year, source_path,
        content_status, source_checked_at, body_render_r2_key, body_storage,
        body_render_sha256, body_word_count, body_captured_at,
        body_validated_at, body_validation_version
      FROM judgments
      WHERE slug = ?1
      LIMIT 1
    `).bind(slug),
    env.DB.prepare(`
      SELECT judge.slug, judge.name_source, jj.source_position, jj.is_author
      FROM judgment_judges AS jj
      JOIN judges AS judge ON judge.id = jj.judge_id
      JOIN judgments AS judgment ON judgment.id = jj.judgment_id
      WHERE judgment.slug = ?1
      ORDER BY jj.source_position
    `).bind(slug),
    env.DB.prepare(`
      SELECT asset_kind, action_status, verification_status
      FROM judgment_source_assets AS asset
      JOIN judgments AS judgment ON judgment.id = asset.judgment_id
      WHERE judgment.slug = ?1
      ORDER BY asset_kind
    `).bind(slug),
  ]);
  const record = recordResult.results?.[0];
  const localReview = articleReview || Boolean(legacyRequest && isLocalArticleReview(legacyRequest));
  if (record && record.content_status !== "published" && !localReview) {
    return new Response("Judgment not found", {status:404,headers:{"X-Robots-Tag":"noindex, nofollow"}});
  }
  if (legacyRequest && record?.public_id) return Response.redirect(new URL(judgmentPath(record),legacyRequest.url).href,308);
  if (!record) {
    return htmlResponse(pageShell({
      title: `Judgment not found | ${SITE_NAME}`,
      description: "The requested judgment record could not be found.",
      canonical: `${SITE_ORIGIN}/judgments/${encodeURIComponent(slug)}`,
      robots: "noindex, nofollow",
      content: `<main id="main" tabindex="-1" class="message-page"><h1>Judgment not found.</h1><p>The record may have moved or the address may be incorrect.</p><a class="read-link" href="${COURT_CATALOG}">← Browse judgments</a></main>`,
    }), 404, "noindex, nofollow");
  }

  const judges = judgesResult.results || [];
  const assets = assetsResult.results || [];
  const isPublished = record.content_status === "published";
  const pilotDocument = pilotDocumentsByCitation.get(record.neutral_citation);
  let bodyDocument = null;
  let bodyMode = null;
  if (record.content_status === "validated" || record.content_status === "published") {
    try {
      bodyDocument = await loadRenderDocument(record, env);
      bodyMode = record.content_status;
    } catch (error) {
      console.error("Judgment body integrity error", error);
      const canonical = `${SITE_ORIGIN}${judgmentPath(record)}`;
      return htmlResponse(pageShell({
        title: `Judgment temporarily unavailable | ${SITE_NAME}`,
        description: "The verified judgment text is temporarily unavailable.",
        canonical,
        robots: "noindex, nofollow",
        current: "judgments",
        content: `<main id="main" tabindex="-1" class="message-page"><h1>The judgment text is temporarily unavailable.</h1><p>We detected a storage or integrity problem and have withheld the text rather than show an incomplete legal document.</p><a class="read-link" href="${COURT_CATALOG}">← Browse judgments</a></main>`,
      }), 503, "noindex, nofollow");
    }
  } else if (pilotDocument && pilotDocument.sourcePath === record.source_path) {
    bodyDocument = pilotDocument;
    bodyMode = "pilot";
  }
  const robots = isPublished ? "index, follow" : "noindex, follow";
  const canonical = `${SITE_ORIGIN}${judgmentPath(record)}`;
  const assetLabels = {
    split_html: "Split view",
    html_view: "HTML view",
    source_pdf: "Source PDF",
    flip_view: "Flip view",
  };
  const judgeLinks = judges.length
    ? judges.map((judge) => `<a href="/judges/supreme-court/${encodeURIComponent(judge.slug)}">${escapeHtml(judge.name_source)}</a>${judge.is_author ? " (author)" : ""}`).join(", ")
    : "Not stated by the source";
  const assetItems = assets.map((asset) => `
    <li>
      <span>${escapeHtml(assetLabels[asset.asset_kind] || asset.asset_kind)}</span>
      <span>${asset.action_status === "listed" ? "Listed by SCR" : "Not listed"}</span>
    </li>
  `).join("");
  const bodyStatus = bodyMode === "pilot"
    ? `<section class="pilot-warning" aria-labelledby="body-status-title"><h2 id="body-status-title">Pilot text · Not yet published</h2><p>This source-attributed preview remains non-indexed while the complete 279-judgment corpus is collected and validated.</p></section>`
    : bodyMode === "validated"
      ? `<section class="pilot-warning" aria-labelledby="body-status-title"><h2 id="body-status-title">Validated text · Not yet published</h2><p>This judgment has passed automated source-fidelity checks and remains non-indexed until the complete 279-judgment release passes its final production gate.</p></section>`
      : "";
  const content = `
    <main id="main" tabindex="-1" class="detail-shell reading-desk">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${COURT_CATALOG}">Judgments</a><span aria-hidden="true">/</span><span>2026</span></nav>
      <article class="judgment-detail">
        <header class="detail-header">
          <h1>${escapeHtml(record.title_source)}</h1>
          ${bodyDocument ? '<a class="reading-action" href="#original-text">Read judgment</a>' : ''}
          <div class="detail-citations" role="group" aria-label="Citations"><span>${escapeHtml(record.scr_citation)}</span><span>${escapeHtml(record.neutral_citation)}</span><time datetime="${escapeHtml(record.decision_date_iso)}">${escapeHtml(formatDate(record.decision_date_iso))}</time></div>
          ${bodyStatus}
          ${articleReview && articleDrafts.some(a=>a.id===record.public_id) ? `<p class="article-review-link"><a href="${escapeHtml(articleDrafts.find(a=>a.id===record.public_id).proposed_article_path)}">Read the draft explainer for this judgment</a> · Editorial review pending</p>` : ""}
        </header>
        <div class="reading-desk-grid">
          <div class="desk-navigation">${bodyDocument ? judgmentContents(bodyDocument.blocks) : ''}${articleReview && record.public_id === "417b8667" ? '<a class="back-to-results" href="#kptcl-concurrence">Separate concurrence · official PDF guide</a>' : ''}<a class="back-to-results" href="${COURT_CATALOG}">Back to judgments</a></div>
          <section id="original-text" class="desk-document" aria-labelledby="judgment-text-title" tabindex="-1">
            <h2 id="judgment-text-title" class="desk-document-label">Original SCR text</h2>
            ${bodyDocument ? `<section class="judgment-reading" aria-label="Judgment text">${renderJudgmentBlocks(bodyDocument.blocks)}</section>` : `<section class="content-notice" aria-labelledby="text-status-title"><h2 id="text-status-title">Full judgment text is being verified.</h2><p>This page contains source metadata only. The original text is withheld until its source identity and fidelity are verified.</p></section>`}
            ${articleReview && record.public_id === "417b8667" ? kptclConcurrenceSupplement() : ""}
          </section>
          <aside class="record-panel" aria-labelledby="record-title">
            <h2 id="record-title">Case facts</h2>
            <dl>
              <div><dt>Decision date</dt><dd><time datetime="${escapeHtml(record.decision_date_iso)}">${escapeHtml(formatDate(record.decision_date_iso))}</time></dd></div>
              <div><dt>Case number</dt><dd>${escapeHtml(record.case_number_source)}</dd></div>
              <div><dt>Case type</dt><dd>${escapeHtml(record.case_type || "Not stated")}</dd></div>
              <div><dt>Judges</dt><dd>${judgeLinks}</dd></div>
              <div><dt>Bench</dt><dd>${escapeHtml(record.bench_size_source || "Not stated")}</dd></div>
              <div><dt>Disposition</dt><dd>${escapeHtml(record.disposal_nature_source || "Not stated by the source")}</dd></div>
            </dl>

            <a class="source-link" href="${escapeHtml(record.source_listing_url)}" rel="external">View Supreme Court Reports source <span aria-hidden="true">↗</span></a>
          </aside>
        </div>
        <footer class="attribution"><p><strong>Source:</strong> Supreme Court Reports (SCR). This independent record does not alter the legal document. The authoritative source prevails.</p></footer>
      </article>
    </main>
  `;

  return htmlResponse(pageShell({
    title: `${record.title_source} | ${record.neutral_citation}`,
    description: bodyDocument
      ? `${record.title_source}. Complete judgment text for ${record.neutral_citation}; decided ${formatDate(record.decision_date_iso)}. Source: Supreme Court Reports.`
      : `${record.title_source}. ${record.neutral_citation}; decided ${formatDate(record.decision_date_iso)}. Source metadata from Supreme Court Reports.`,
    canonical,
    robots,
    current: "judgments",
    content,
  }), 200, robots);
}

function judgePortrait(name, directory=false) {
 const portrait=judgePortraits.find(p=>p.name===name);
 if(!portrait) return '';
 const small=portrait.variants[0],large=portrait.variants[1];
 return `<figure class="judge-portrait${directory?' judge-portrait-small':''}"><img src="${escapeHtml(large.path)}" srcset="${escapeHtml(small.path)} ${small.width}w, ${escapeHtml(large.path)} ${large.width}w" sizes="${directory?'72px':'(max-width: 44rem) 140px, (max-width: 60rem) 180px, 280px'}" width="${large.width}" height="${large.height}" alt="Portrait of ${escapeHtml(name)}" decoding="async" ${directory?'loading="lazy"':'loading="eager" fetchpriority="high"'}>${directory?'':`<figcaption><a href="${escapeHtml(portrait.source_url)}" rel="external">Photo: Supreme Court of India</a></figcaption>`}</figure>`;
}
async function judgesDirectory(env) {
 const result = await env.DB.prepare(`SELECT j.slug,p.display_name,p.role_at_retrieval,COUNT(DISTINCT CASE WHEN record.content_status='published' THEN jj.judgment_id END) AS judgment_count FROM judge_profiles p JOIN judges j ON j.id=p.judge_id LEFT JOIN judgment_judges jj ON jj.judge_id=j.id LEFT JOIN judgments record ON record.id=jj.judgment_id GROUP BY j.id ORDER BY p.appointment_date,p.display_name`).all();
 return htmlResponse(pageShell({title:`Supreme Court judges | ${SITE_NAME}`,description:'Official-source biographies and judgments in our collection.',canonical:`${SITE_ORIGIN}/judges/supreme-court`,robots:'index, follow',content:`<main id="main" tabindex="-1" class="catalog-shell"><section class="catalog-intro"><h1>Supreme Court judges</h1><p>Read official-source biographies and explore judgments in our collection.</p><p class="source-note">Current judges and former judges connected to our 2026 catalog. This is not a complete historical directory. Roles reflect the official source when retrieved.</p></section><div class="judge-directory">${(result.results||[]).map(p=>`<article class="judge-directory-item">${judgePortrait(p.display_name,true)}<div><h2><a href="/judges/supreme-court/${encodeURIComponent(p.slug)}">${escapeHtml(p.display_name)}</a></h2><p>${escapeHtml(p.role_at_retrieval)} · ${Number(p.judgment_count)} published judgments in our collection</p></div></article>`).join('')}</div></main>`}),200,'index, follow');
}
async function judgeProfile(slug,request,env) {
 const result=await env.DB.prepare(`SELECT j.id,j.slug,j.name_source,p.* FROM judges j LEFT JOIN judge_profiles p ON p.judge_id=j.id WHERE j.slug=?1`).bind(slug).first();
 if(!result) return new Response('Judge not found',{status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});
 const counts=await env.DB.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(jj.is_author),0) AS authored FROM judgment_judges jj JOIN judgments j ON j.id=jj.judgment_id WHERE jj.judge_id=?1 AND j.content_status='published'`).bind(result.id).first();
 const judgments=await env.DB.prepare(`SELECT j.slug,j.public_id,j.decision_year,j.source_citation_year,j.title_source,j.neutral_citation,j.decision_date_iso,jj.is_author FROM judgments j JOIN judgment_judges jj ON jj.judgment_id=j.id WHERE jj.judge_id=?1 AND j.content_status='published' ORDER BY j.decision_date_iso DESC,j.id DESC LIMIT 20`).bind(result.id).all();
 let paragraphs=[];if(result.biography_json){paragraphs=JSON.parse(result.biography_json);if(await sha256Text(JSON.stringify(paragraphs))!==result.biography_sha256) throw Error('Judge biography integrity mismatch');}
 const name=result.display_name||result.name_source;
 const catalogHref=`${COURT_CATALOG}?judge=${encodeURIComponent(result.slug)}`;
 const dates=result.source_url?`<dl class="judge-career-dates">${[['Date of birth',result.birth_date],['Supreme Court appointment',result.appointment_date],['Retirement date listed',result.retirement_date]].map(([label,date])=>`<div><dt>${label}</dt><dd>${date?`<time datetime="${escapeHtml(date)}">${escapeHtml(formatDate(date))}</time>`:'Not recorded'}</dd></div>`).join('')}</dl>`:'';
 const sourceNote=result.source_url?`<p class="source-note judge-source"><a href="${escapeHtml(result.source_url)}" rel="external">Official biography source</a> · Retrieved <time datetime="${escapeHtml(result.retrieved_at)}">${escapeHtml(formatDate(result.retrieved_at.slice(0,10)))}</time>. Reproduced from the Supreme Court of India; roles reflect the source when retrieved.</p>`:'';
 const collectionStats=`<dl class="judge-collection-stats"><div><dt>Bench appearances</dt><dd>${Number(counts.total)}</dd></div><div><dt>Records identify this judge as author</dt><dd>${Number(counts.authored)}</dd></div></dl>`;
 const content=`<main id="main" tabindex="-1" class="detail-shell judge-profile">
 <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/judges/supreme-court">Supreme Court judges</a></nav>
 <header class="judge-identity${judgePortrait(name)?'':' judge-identity-no-photo'}">
 ${judgePortrait(name)}
 <div class="judge-identity-content"><p class="judge-court">Supreme Court of India</p><h1>${escapeHtml(name)}</h1><p class="judge-role">${escapeHtml(result.role_at_retrieval||'Biography not yet collected')}</p>${dates}
 <div class="judge-collection"><div><p class="judge-collection-label">In our 2026 collection</p>${collectionStats}</div><a class="judge-primary-link" href="#judge-judgments-title">View judgments</a></div></div>
 </header>
 <nav class="judge-section-nav" aria-label="On this profile"><a href="#biography-title">Biography</a><a href="#judge-judgments-title">Judgments</a></nav>
 <section class="judge-profile-section" aria-labelledby="biography-title"><div class="judge-section-label" aria-hidden="true">Biography</div><div class="judge-section-content"><h2 id="biography-title" tabindex="-1">Official biography</h2>${sourceNote}${paragraphs.length?paragraphs.map(p=>`<p class="judge-biography">${escapeHtml(p)}</p>`).join(''):'<p>An official biography has not yet been verified.</p>'}</div></section>
 <section class="judge-profile-section judge-judgments" aria-labelledby="judge-judgments-title"><div class="judge-section-label" aria-hidden="true">Judgments</div><div class="judge-section-content"><div class="judge-section-heading"><h2 id="judge-judgments-title" tabindex="-1">Judgments in our 2026 collection</h2>${Number(counts.total)>0?`<a class="read-link" href="${catalogHref}">View all ${Number(counts.total)} judgments</a>`:''}</div><p class="judge-collection-note">${Number(counts.total)} bench appearances · ${Number(counts.authored)} records identify this judge as author. These counts describe our collected records, not the judge’s complete career or individual agreement with every opinion.</p>${(judgments.results||[]).map(j=>`<article><h3><a href="${judgmentPath(j)}">${escapeHtml(displayCaseTitle(j.title_source))}</a></h3><p class="source-note">${escapeHtml(j.neutral_citation)} · ${escapeHtml(formatDate(j.decision_date_iso))} · ${j.is_author?'Author identified by SCR':'Bench member'}</p></article>`).join('')||'<p>No judgments connected to this judge are currently in our collection.</p>'}${counts.total>20?`<a class="read-link judge-all-link" href="${catalogHref}">View all ${Number(counts.total)} judgments in the catalog</a>`:''}</div></section></main>`;
 return htmlResponse(pageShell({title:`${name} | ${SITE_NAME}`,description:`Official-source biography of ${name} and published judgments in our collection.`,person:name,canonical:`${SITE_ORIGIN}/judges/supreme-court/${encodeURIComponent(slug)}`,robots:'index, follow',content}),200,'index, follow');
}

async function apiJudgments(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const caseType = (url.searchParams.get("case_type") || "").trim().slice(0, 100);
  const judge = (url.searchParams.get("judge") || "").trim().slice(0, 120);
  const year = integerParam(url.searchParams.get("year"), 2026, 1900, 2100);
  const limit = integerParam(url.searchParams.get("limit"), 20, 1, 100);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 10_000);
  const offset = (page - 1) * limit;
  const likeQuery = `%${q}%`;
  const where = `
    j.source_system = 'scr'
    AND j.source_citation_year = ?1
    AND j.content_status = 'published'
    AND (?2 = '' OR j.title_source LIKE ?3 OR j.neutral_citation LIKE ?3 OR j.scr_citation LIKE ?3 OR j.case_number_source LIKE ?3)
    AND (?4 = '' OR j.case_type = ?4)
    AND (?5 = '' OR EXISTS (
      SELECT 1 FROM judgment_judges AS jj
      JOIN judges AS judge ON judge.id = jj.judge_id
      WHERE jj.judgment_id = j.id AND judge.slug = ?5
    ))
  `;
  const bindings = [year, q, likeQuery, caseType, judge];
  const [recordsResult, countResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        j.slug, j.public_id, j.decision_year, j.source_citation_year, j.title_source, j.scr_citation, j.neutral_citation,
        j.decision_date_iso, j.case_number_source, j.case_type,
        j.disposal_nature_source, j.bench_size, j.bench_size_source,
        j.coram_source, j.result_excerpt_source, j.content_status,
        enrichment.lookup_status AS case_lookup_status,
        enrichment.verification_status AS case_verification_status
      FROM judgments AS j
      LEFT JOIN judgment_case_enrichments AS enrichment
        ON enrichment.judgment_id = j.id
      WHERE ${where}
      ORDER BY j.decision_date_iso DESC, j.id DESC
      LIMIT ?6 OFFSET ?7
    `).bind(...bindings, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM judgments AS j WHERE ${where}`)
      .bind(...bindings),
  ]);
  const total = Number(countResult.results?.[0]?.total || 0);
  return jsonResponse({
    data: recordsResult.results || [],
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    source: "Supreme Court Reports (SCR)",
  });
}

async function apiJudgment(slug, env) {
  const [
    recordResult,
    judgesResult,
    assetsResult,
    enrichmentResult,
    caseDocumentsResult,
    citationAliasesResult,
  ] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        slug, public_id, decision_year, source_citation_year, title_source, scr_citation, neutral_citation,
        decision_date_source, decision_date_iso, decision_year,
        case_number_source, case_type, disposal_nature_source,
        bench_size_source, bench_size, coram_source, result_excerpt_source,
        source_listing_url, source_citation_year, source_path,
        content_status, source_checked_at
      FROM judgments WHERE slug = ?1 LIMIT 1
    `).bind(slug),
    env.DB.prepare(`
      SELECT judge.slug, judge.name_source, jj.source_position, jj.is_author
      FROM judgment_judges AS jj
      JOIN judges AS judge ON judge.id = jj.judge_id
      JOIN judgments AS judgment ON judgment.id = jj.judgment_id
      WHERE judgment.slug = ?1 ORDER BY jj.source_position
    `).bind(slug),
    env.DB.prepare(`
      SELECT asset_kind, action_status, verification_status
      FROM judgment_source_assets AS asset
      JOIN judgments AS judgment ON judgment.id = asset.judgment_id
      WHERE judgment.slug = ?1 ORDER BY asset_kind
    `).bind(slug),
    env.DB.prepare(`
      SELECT
        enrichment.input_case_number,
        enrichment.lookup_status,
        enrichment.match_basis,
        enrichment.verification_status,
        enrichment.source_retrieved_at,
        court_case.source_case_identifier,
        court_case.source_url,
        court_case.matched_case_number_source,
        court_case.title_source AS case_title_source,
        court_case.petitioner_source,
        court_case.respondent_source,
        court_case.court_source,
        court_case.bench_source,
        court_case.case_type_source,
        court_case.case_number_source AS official_case_number_source,
        court_case.case_year,
        court_case.diary_number_source,
        court_case.filing_date_source,
        court_case.filing_date_iso,
        court_case.registration_date_source,
        court_case.registration_date_iso,
        court_case.decision_date_source AS official_decision_date_source,
        court_case.decision_date_iso AS official_decision_date_iso,
        court_case.disposal_date_source,
        court_case.disposal_date_iso,
        court_case.case_status_source,
        court_case.disposal_nature_source AS official_disposal_nature_source,
        court_case.category_source,
        court_case.official_neutral_citations_source,
        court_case.last_hearing_date_source,
        court_case.last_hearing_date_iso,
        court_case.next_hearing_date_source,
        court_case.next_hearing_date_iso
      FROM judgment_case_enrichments AS enrichment
      JOIN judgments AS judgment ON judgment.id = enrichment.judgment_id
      LEFT JOIN court_cases AS court_case ON court_case.id = enrichment.court_case_id
      WHERE judgment.slug = ?1
      LIMIT 1
    `).bind(slug),
    env.DB.prepare(`
      SELECT
        document.document_url_normalized AS url,
        document.label_source,
        document.document_type_source,
        document.document_date_source,
        document.document_date_iso,
        document.neutral_citation_source,
        CASE WHEN judgment_document.document_id IS NULL THEN 0 ELSE 1 END AS is_primary,
        judgment_document.match_basis
      FROM judgment_case_enrichments AS enrichment
      JOIN judgments AS judgment ON judgment.id = enrichment.judgment_id
      JOIN court_case_documents AS document ON document.court_case_id = enrichment.court_case_id
      LEFT JOIN judgment_case_documents AS judgment_document
        ON judgment_document.judgment_id = judgment.id
       AND judgment_document.document_id = document.id
      WHERE judgment.slug = ?1
      ORDER BY is_primary DESC, document.document_date_iso DESC, document.source_position
    `).bind(slug),
    env.DB.prepare(`
      SELECT
        alias.source_citation,
        alias.canonical_citation,
        alias.authority,
        alias.verification_source_url,
        alias.verified_at,
        alias.notes
      FROM judgment_citation_aliases AS alias
      JOIN judgments AS judgment ON judgment.id = alias.judgment_id
      WHERE judgment.slug = ?1
      ORDER BY alias.source_citation, alias.canonical_citation
    `).bind(slug),
  ]);
  const record = recordResult.results?.[0];
  if (!record || record.content_status !== "published") return jsonResponse({ error: "Judgment not found" }, 404);
  const enrichment = enrichmentResult.results?.[0] || null;
  const caseRecord = enrichment?.source_case_identifier ? {
    source_case_identifier: enrichment.source_case_identifier,
    source_url: enrichment.source_url,
    matched_case_number_source: enrichment.matched_case_number_source,
    title_source: enrichment.case_title_source,
    petitioner_source: enrichment.petitioner_source,
    respondent_source: enrichment.respondent_source,
    court_source: enrichment.court_source,
    bench_source: enrichment.bench_source,
    case_type_source: enrichment.case_type_source,
    case_number_source: enrichment.official_case_number_source,
    case_year: enrichment.case_year,
    diary_number_source: enrichment.diary_number_source,
    filing_date_source: enrichment.filing_date_source,
    filing_date_iso: enrichment.filing_date_iso,
    registration_date_source: enrichment.registration_date_source,
    registration_date_iso: enrichment.registration_date_iso,
    decision_date_source: enrichment.official_decision_date_source,
    decision_date_iso: enrichment.official_decision_date_iso,
    disposal_date_source: enrichment.disposal_date_source,
    disposal_date_iso: enrichment.disposal_date_iso,
    case_status_source: enrichment.case_status_source,
    disposal_nature_source: enrichment.official_disposal_nature_source,
    category_source: enrichment.category_source,
    official_neutral_citations_source: enrichment.official_neutral_citations_source,
    last_hearing_date_source: enrichment.last_hearing_date_source,
    last_hearing_date_iso: enrichment.last_hearing_date_iso,
    next_hearing_date_source: enrichment.next_hearing_date_source,
    next_hearing_date_iso: enrichment.next_hearing_date_iso,
  } : null;
  const caseEnrichment = enrichment ? {
    input_case_number: enrichment.input_case_number,
    lookup_status: enrichment.lookup_status,
    match_basis: enrichment.match_basis,
    verification_status: enrichment.verification_status,
    source_retrieved_at: enrichment.source_retrieved_at,
    source: "Supreme Court of India case status",
    case: caseRecord,
    official_documents: (caseDocumentsResult.results || []).map((document) => ({
      ...document,
      is_primary: Boolean(document.is_primary),
    })),
    citation_aliases: citationAliasesResult.results || [],
  } : null;
  return jsonResponse({
    data: {
      ...record,
      judges: judgesResult.results || [],
      source_assets: assetsResult.results || [],
      case_enrichment: caseEnrichment,
    },
    source: "Supreme Court Reports (SCR)",
    sources: [
      "Supreme Court Reports (SCR)",
      ...(caseEnrichment ? ["Supreme Court of India case status"] : []),
    ],
  });
}

async function apiFilters(env) {
  const [yearsResult, caseTypesResult, judgesResult, benchSizesResult] = await env.DB.batch([
    env.DB.prepare(`SELECT source_citation_year AS year, COUNT(*) AS records FROM judgments WHERE source_system = 'scr' AND content_status = 'published' GROUP BY source_citation_year ORDER BY year DESC`),
    env.DB.prepare(`SELECT case_type AS value, COUNT(*) AS records FROM judgments WHERE source_system = 'scr' AND content_status = 'published' AND case_type IS NOT NULL GROUP BY case_type ORDER BY records DESC, value`),
    env.DB.prepare(`
      SELECT judge.slug AS value, judge.name_source AS label, COUNT(*) AS records
      FROM judges AS judge
      JOIN judgment_judges AS jj ON jj.judge_id = judge.id
      JOIN judgments AS judgment ON judgment.id = jj.judgment_id
      WHERE judgment.source_system = 'scr' AND judgment.content_status = 'published'
      GROUP BY judge.id ORDER BY records DESC, judge.name_normalized
    `),
    env.DB.prepare(`SELECT bench_size AS value, bench_size_source AS label, COUNT(*) AS records FROM judgments WHERE source_system = 'scr' AND content_status = 'published' AND bench_size IS NOT NULL GROUP BY bench_size, bench_size_source ORDER BY bench_size`),
  ]);
  return jsonResponse({
    data: {
      years: yearsResult.results || [],
      case_types: caseTypesResult.results || [],
      judges: judgesResult.results || [],
      bench_sizes: benchSizesResult.results || [],
    },
    source: "Supreme Court Reports (SCR)",
  });
}

async function sitemap(env) {
  const result = await env.DB.prepare(`
    SELECT slug, public_id, decision_year, source_citation_year, updated_at
    FROM judgments
    WHERE source_system = 'scr' AND content_status = 'published'
    ORDER BY id
  `).all();
  const published = result.results || [];
  const judgmentUrls = published.map((record) => `
  <url><loc>${SITE_ORIGIN}${judgmentPath(record)}</loc><lastmod>${escapeHtml(String(record.updated_at).slice(0, 10))}</lastmod></url>`).join("");
  const articleUrls = publicArticles.map((article) => `<url><loc>${SITE_ORIGIN}${escapeHtml(article.proposed_article_path)}</loc><lastmod>${RELEASE_DATE}</lastmod></url>`).join("");
  const judgesResult = await env.DB.prepare(`SELECT j.slug FROM judges j JOIN judge_profiles p ON p.judge_id=j.id ORDER BY j.slug`).all();
  const judgeUrls = (judgesResult.results || []).map((judge) => `<url><loc>${SITE_ORIGIN}/judges/supreme-court/${escapeHtml(judge.slug)}</loc></url>`).join("");
  const authorUrl = `<url><loc>${SITE_ORIGIN}/authors/${authorProfile.slug}</loc></url>`;
  return textResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_ORIGIN}/</loc></url>
  <url><loc>${SITE_ORIGIN}${COURT_CATALOG}</loc></url>
  <url><loc>${SITE_ORIGIN}/articles</loc></url>
  <url><loc>${SITE_ORIGIN}/judges/supreme-court</loc></url>
  <url><loc>${SITE_ORIGIN}/editorial-policy</loc></url>
  <url><loc>${SITE_ORIGIN}/corrections</loc></url>${authorUrl}${articleUrls}${judgeUrls}${judgmentUrls}
</urlset>`, "application/xml; charset=utf-8", "public, max-age=300, s-maxage=3600");
}

function llmsTxt() {
  const articleLinks=publicArticles.map(article=>`- [${article.title}](https://thelegalchronicles.com${article.proposed_article_path}): ${article.description}`).join("\n");
  return textResponse(`# The Legal Chronicles

> A judgment-first legal publication that preserves source material and clearly separates original records from editorial explanation.

## Canonical pages

- [Homepage](https://thelegalchronicles.com/): publication overview and latest records.
- [Supreme Court judgment catalog](https://thelegalchronicles.com${COURT_CATALOG}): browse canonical records by case, citation, judge and decision details.
- [Articles](https://thelegalchronicles.com/articles): ${publicArticles.length} AI-assisted explainers with source links and explicit review limits.
- [About the author](https://thelegalchronicles.com/authors/${authorProfile.slug}): author biography and published explainers.
- [Editorial policy](https://thelegalchronicles.com/editorial-policy): source checks, AI use, scope and correction standards.
- [Corrections](https://thelegalchronicles.com/corrections): report factual or source issues.
- [XML sitemap](https://thelegalchronicles.com/sitemap.xml): canonical URLs eligible for discovery.

## Source and attribution

- Judgment records identify Supreme Court Reports (SCR) as their source and link to the source record.
- The authoritative court or SCR material prevails over this independent publication.
- Editorial explanations are separate from the original legal record. They are AI-assisted and have not undergone independent human legal review.

## Published explainers

${articleLinks}

## Content status

- Unpublished or source-incomplete records are not enumerated here.
- No llms-full.txt is provided. Use each canonical HTML page and its linked official source so the legal text remains tied to its source and publication status.
`, "text/plain; charset=utf-8", "public, max-age=300, s-maxage=3600");
}

function errorPage(error, pathname = "/judgments") {
  console.error("Judgment catalog error", error);
  const isHome = pathname === "/";
  return htmlResponse(pageShell({
    title: `${isHome ? "Site" : "Catalog"} unavailable | ${SITE_NAME}`,
    description: `The ${isHome ? "website" : "judgment catalog"} is temporarily unavailable.`,
    canonical: `${SITE_ORIGIN}${isHome ? "/" : "/judgments"}`,
    robots: "noindex, nofollow",
    content: `<main id="main" tabindex="-1" class="message-page"><h1>The ${isHome ? "site" : "catalog"} is unavailable.</h1><p>Please try again shortly.</p><a class="read-link" href="${isHome ? "/" : "/judgments"}">Retry <span aria-hidden="true">→</span></a></main>`,
  }), 503, "noindex, nofollow");
}

function isLocalArticleReview(request) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
}
function articleArtwork(id, thumbnail = false, caseName = '', eager = false) {
  const image = articleImages[id];
  if (!image) return '';
  return `<figure class="${thumbnail ? 'article-artwork-thumbnail' : 'article-artwork'}"><img src="${escapeHtml(thumbnail ? image.small : image.src)}" srcset="${image.variants.map(v=>`${escapeHtml(v.src)} ${v.width}w`).join(", ")}" sizes="${thumbnail ? '160px' : '(min-width: 1424px) 1078px, (min-width: 960px) calc(100vw - 346px), calc(100vw - 48px)'}" width="${image.width}" height="${image.height}" alt="${thumbnail ? '' : escapeHtml(image.alt)}" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} decoding="async">${thumbnail ? '' : `<figcaption><span class="article-artwork-case">${escapeHtml(caseName)}</span></figcaption>`}</figure>`;
}

function articleReviewPage(url) {
  const index = url.pathname === '/articles' || url.pathname === '/articles/';
  const visibleArticles = isLocalArticleReview(new Request(url)) ? articleDrafts : publicArticles;
  const article = visibleArticles.find(a => a.proposed_article_path === url.pathname);
  if (!index && !article) return new Response('Article draft not found', {status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});
  let content;
  if (index) {
    const listingArticles=[visibleArticles.find(a=>a.id==='c936c42b'),...visibleArticles.filter(a=>a.id!=='c936c42b')].filter(Boolean);
    content = `<main id="main" tabindex="-1" class="article-index"><header class="article-index-header"><div><p class="article-eyebrow">Ideas and explanations</p><h1>Articles</h1><p>Understand the decisions shaping the law.</p></div><p class="article-index-collection">August 2026<span>${listingArticles.length} judgment explainers</span></p></header><p class="article-index-scope">From judgments in our collection dated 3–12 August 2026. This selection does not cover every Supreme Court decision that month.</p><ol class="article-draft-list">${listingArticles.map((a,i)=>`<li${i===0?' class="article-list-featured"':''}><article><a class="article-list-image" href="${escapeHtml(a.proposed_article_path)}" aria-label="${escapeHtml(a.title)}">${articleArtwork(a.id,true,'',i===0).replace('sizes="160px"','sizes="(min-width: 960px) 640px, (min-width: 600px) 45vw, calc(100vw - 48px)"')}</a><div class="article-list-copy">${i===0?'<p class="article-list-label">Featured article</p>':''}<p class="article-list-meta"><time datetime="${escapeHtml(a.metadata.decision_date)}">${escapeHtml(formatDate(a.metadata.decision_date))}</time> · ${escapeHtml(a.metadata.citations.join(' · '))}</p><h2><a href="${escapeHtml(a.proposed_article_path)}">${escapeHtml(a.title)}</a></h2><p class="article-list-description">${escapeHtml(a.description)}</p></div></article></li>`).join('')}</ol></main>`;
  } else {
    const a=article,m=a.metadata;
    const articlePosition=visibleArticles.findIndex(item=>item.id===a.id);
    const previousArticle=visibleArticles[articlePosition-1];
    const nextArticle=visibleArticles[articlePosition+1];
    const adjacentArticles=`<nav class="article-pagination" aria-label="More articles">${previousArticle?`<a rel="prev" href="${escapeHtml(previousArticle.proposed_article_path)}"><span class="article-pagination-direction"><span aria-hidden="true">←</span> Previous article</span><strong>${escapeHtml(previousArticle.title)}</strong></a>`:'<div></div>'}${nextArticle?`<a rel="next" href="${escapeHtml(nextArticle.proposed_article_path)}"><span class="article-pagination-direction">Next article <span aria-hidden="true">→</span></span><strong>${escapeHtml(nextArticle.title)}</strong></a>`:''}</nav>`;
    const prose=text=>{
      let output=escapeHtml(text);
      if(a.officialSource?.url) output=output.replace(/\((N\. Kotiswar Singh, J\., concurring, paragraphs? [^()]+?; official judgment PDF, page (\d+)\.)\)/giu,(match,reference,page)=>`(<a class="article-paragraph-reference" href="${escapeHtml(a.officialSource.url)}#page=${page}" rel="external">${reference}</a>)`);
      if(a.id==='417b8667') output=output.replace(/\((Sanjay Karol, J\., paragraphs? (\d+)[^()]*?)\)/gu,(match,reference,paragraph)=>`(<a class="article-paragraph-reference" href="${escapeHtml(m.judgment_path)}#karol-p-${paragraph}">${reference}</a>)`);
      return output.replace(/\((?:Judgment, )?[Pp]aragraphs?[^)]*\)/g,ref=>`<a class="article-paragraph-reference" href="${escapeHtml(m.judgment_path)}#judgment">${ref}</a>`);
    };
    const sections=[['case-details','Case at a glance'],...a.sections.map(([h],i)=>[`section-${i+1}`,h]),...(a.officialFollowup?[['official-followup',a.officialFollowup.title]]:[]),...(a.officialSource?[['official-source',a.officialSource.title]]:[]),...(a.source_note?[['source-discrepancy',a.source_note.title]]:[]),['question','A question this judgment answers'],['appearances','Lawyers and appearances'],['origin','Procedural origin']];
  content=`<nav class="breadcrumbs article-breadcrumbs" aria-label="Breadcrumb"><ol><li><a class="breadcrumb-home" href="/" aria-label="Home"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg></a></li><li><a href="/articles">Articles</a></li><li><span aria-current="page">${escapeHtml(m.case_name)}</span></li></ol></nav><main id="main" tabindex="-1" class="article-reader"><article><header><h1>${escapeHtml(a.title)}</h1><div class="article-byline"><p>By <a class="article-author" href="/authors/yashodhan-deshmukh">${escapeHtml(a.human_author || "Yashodhan Deshmukh")}</a></p><p>Published <time datetime="${RELEASE_DATE}">${escapeHtml(formatDate(RELEASE_DATE))}</time></p>${a.updated_at?`<p>Updated <time datetime="${escapeHtml(a.updated_at)}">${escapeHtml(formatDate(a.updated_at))}</time></p>`:''}</div><p class="article-publication-disclosure">AI-assisted explanation. No independent human legal review has been performed. The identified main-case docket was checked on ${escapeHtml(formatDate(RELEASE_DATE))}; separate proceedings and implementation may not be reflected. The artwork is symbolic and AI-generated, not evidence or a photograph. This article is general information, not legal advice; consult the linked official source.</p><p class="article-summary">${prose(a.answer)}</p></header><div class="article-reading-layout"><div class="article-body">${articleArtwork(a.id,false,m.case_name,true)}${a.sections.map(([h,p],i)=>`<section aria-labelledby="section-${i+1}"><h2 id="section-${i+1}" tabindex="-1">${escapeHtml(h)}</h2><p>${prose(p)}</p></section>`).join('')}${a.officialFollowup?`<section aria-labelledby="official-followup"><h2 id="official-followup" tabindex="-1">${escapeHtml(a.officialFollowup.title)}</h2><p>${escapeHtml(a.officialFollowup.text)}</p><p><a href="${escapeHtml(a.officialFollowup.url)}" rel="external">${escapeHtml(a.officialFollowup.link_label)}</a></p></section>`:''}${a.officialSource?`<section aria-labelledby="official-source"><h2 id="official-source" tabindex="-1">${escapeHtml(a.officialSource.title)}</h2><p>${escapeHtml(a.officialSource.text)}</p><p><a href="${escapeHtml(a.officialSource.url)}" rel="external">${escapeHtml(a.officialSource.link_label)}</a></p><ul>${a.officialSource.paragraph_pages.map(item=>`<li><a href="${escapeHtml(a.officialSource.url)}#page=${item.page}" rel="external">${escapeHtml(item.label)}</a></li>`).join('')}</ul></section>`:''}${a.source_note?`<section aria-labelledby="source-discrepancy"><h2 id="source-discrepancy" tabindex="-1">${escapeHtml(a.source_note.title)}</h2><p>${escapeHtml(a.source_note.text)}</p><p><a href="${escapeHtml(a.source_note.url)}" rel="external">${escapeHtml(a.source_note.link_label)}</a></p></section>`:''}<section aria-labelledby="question"><h2 id="question" tabindex="-1">A question this judgment answers</h2><h3>${escapeHtml(a.question)}</h3><p>${prose(a.reply)}</p></section><section aria-labelledby="appearances"><h2 id="appearances" tabindex="-1">Lawyers and appearances recorded by SCR</h2><p>The following retains the source’s grouping and designations. It does not establish each lawyer’s role in every connected proceeding.</p><ul>${m.appearances.map(p=>`<li>${escapeHtml(p)}</li>`).join('')||'<li>No separate appearance list in this capture.</li>'}</ul></section><section aria-labelledby="origin"><h2 id="origin" tabindex="-1">Procedural origin recorded by SCR</h2>${m.origin.map(p=>`<p>${escapeHtml(p)}</p>`).join('')||'<p>Not separately recorded.</p>'}</section></div><aside class="article-sidebar" aria-label="Article navigation and case details"><nav class="article-contents" aria-label="In this article"><h2>In this article</h2><ol>${sections.map(([id,h])=>`<li><a href="#${id}">${escapeHtml(h)}</a></li>`).join('')}</ol></nav><section aria-labelledby="case-details"><h2 id="case-details" tabindex="-1">Case at a glance</h2><dl class="article-case-details">${[['Case',m.case_name],['Citations',m.citations.join(' · ')],['Court',m.court],['Judgment delivered',formatDate(m.decision_date)],['Case numbers',m.case_numbers.join('; ')],['Bench as recorded',m.bench.join('; ')],['Judgment author as recorded',m.judgment_author.join('; ')||'Not separately identified in the captured author field'],['Acts and rules listed by SCR',m.acts_listed_by_scr.join('; ')||'Not separately listed in this capture']].map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl></section></aside></div><div class="article-closing"><section class="article-next-step" aria-labelledby="read-judgment"><p class="article-eyebrow">The original decision</p><h2 id="read-judgment">Go deeper into the judgment</h2><p class="article-source-intro">Read the Court’s reasoning, operative directions and the captured SCR report in full.</p><p>${escapeHtml(m.case_name)}</p><p class="article-case-line">${escapeHtml(m.citations.join(" · "))}</p><p class="article-source-provenance"><a href="${escapeHtml(m.source_url)}" rel="external">Official SCR source</a> · Source retrieved <time datetime="${escapeHtml(m.source_retrieved_at)}">${escapeHtml(formatDate(m.source_retrieved_at.slice(0,10)))}</time></p><a class="article-source-action" href="${escapeHtml(m.judgment_path)}">Read the full judgment <span aria-hidden="true">↗</span></a></section></div>${adjacentArticles}</article></main>`;
  }
  const isLocalReview=isLocalArticleReview(new Request(url));
  const articleForSchema=index?undefined:{...article,published_at:RELEASE_DATE};
  const robots=isLocalReview?'noindex, nofollow':'index, follow';
  const response=htmlResponse(pageShell({title:`${index?'Articles — August 2026':article.title} | ${SITE_NAME}`,description:index?`Explore ${visibleArticles.length} explainers for Supreme Court judgments in our collection dated 3–12 August 2026.`:article.description,canonical:`${SITE_ORIGIN}${index?'/articles':article.proposed_article_path}`,robots,content,article:articleForSchema,image:index?undefined:articleImages[article.id],breadcrumbs:index?[]:[{name:'Home',url:SITE_ORIGIN+'/'},{name:'Articles',url:SITE_ORIGIN+'/articles'},{name:article.metadata.case_name,url:`${SITE_ORIGIN}${article.proposed_article_path}`}]}),200,robots);
  if(isLocalReview) response.headers.set('cache-control','no-store');
  return response;
}

function publicationReviewPage(url) {
  const authorPath='/authors/'+authorProfile.slug;
  const isAuthor=url.pathname===authorPath;
  const isPolicy=url.pathname==='/editorial-policy';
  if(!isAuthor && !isPolicy && url.pathname!=='/corrections') return new Response('Not found',{status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});
  const title=isAuthor?authorProfile.name:isPolicy?'Editorial policy':'Corrections';
  const description=isAuthor?authorProfile.bio:isPolicy?'How The Legal Chronicles preserves court records, labels AI-assisted explanations, and handles source checks and correction requests.':'How to report a factual error, source discrepancy or accessibility issue to The Legal Chronicles.';
  const links=`<nav class="publication-links" aria-label="Publication information">${[[authorPath,'About the author'],['/editorial-policy','Editorial policy'],['/corrections','Corrections']].map(([path,label])=>`<a href="${path}"${url.pathname===path?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
  let body;
  if(isAuthor) {
    body=`<header class="publication-header"><p class="publication-eyebrow">Author</p><h1>${escapeHtml(authorProfile.name)}</h1><p class="publication-intro">${escapeHtml(authorProfile.bio)}</p></header><div class="publication-layout"><section aria-labelledby="author-articles"><h2 id="author-articles">Articles by ${escapeHtml(authorProfile.name)}</h2><p class="publication-note">These ${publicArticles.length} explainers are published with an explicit account of their AI-assisted preparation and review limits.</p><ol class="author-article-list">${publicArticles.map(a=>`<li><h3><a href="${escapeHtml(a.proposed_article_path)}">${escapeHtml(a.title)}</a></h3><p>${escapeHtml(a.description)}</p></li>`).join('')}</ol></section><aside aria-label="Author and publication"><h2>Author details</h2><dl><dt>Affiliation</dt><dd>Founder, ${escapeHtml(authorProfile.affiliation)}</dd><dt>Writing experience</dt><dd>Three years in the legal space</dd><dt>Bio updated</dt><dd><time datetime="${authorProfile.confirmedOn}">${escapeHtml(formatDate(authorProfile.confirmedOn))}</time></dd></dl>${links}</aside></div>`;
  } else if(isPolicy) {
    body=`<header class="publication-header"><p class="publication-eyebrow">Publication standards</p><h1>Editorial policy</h1><p class="publication-intro">The judgment is the source. Our role is to preserve the record and help readers understand it.</p><p class="publication-note">Updated <time datetime="${RELEASE_DATE}">${escapeHtml(formatDate(RELEASE_DATE))}</time>.</p></header><div class="publication-layout"><div>${editorialPolicySections.map(([id,h,paragraphs])=>`<section aria-labelledby="${id}"><h2 id="${id}" tabindex="-1">${escapeHtml(h)}</h2>${paragraphs.map(p=>`<p>${escapeHtml(p)}</p>`).join('')}${id==='dates'?'<p><a href="/corrections">How to request a correction</a></p>':''}</section>`).join('')}</div><aside><nav class="publication-contents" aria-label="In this policy"><h2>In this policy</h2><ol>${editorialPolicySections.map(([id,h])=>`<li><a href="#${id}">${escapeHtml(h)}</a></li>`).join('')}</ol></nav>${links}</aside></div>`;
  } else {
    const contact=correctionsEmail?`<a class="corrections-email" href="mailto:${escapeHtml(correctionsEmail)}">${escapeHtml(correctionsEmail)}</a>`:'<p class="publication-note">The corrections email is being confirmed before this page is published. No report form or message submission is active in this local preview.</p>';
    body=`<header class="publication-header"><p class="publication-eyebrow">Accuracy and accountability</p><h1>Request a correction</h1><p class="publication-intro">Help us keep the record accurate and the explanation clear.</p></header><div class="publication-layout"><div><section aria-labelledby="corrections-contact"><h2 id="corrections-contact">Corrections contact</h2>${contact}<p>Use this contact for factual errors, citation or attribution problems, source discrepancies and accessibility issues. Please do not send confidential case files or sensitive personal information.</p></section><section aria-labelledby="report-details"><h2 id="report-details">What to include</h2><ul><li>The page URL and the passage you believe needs correction.</li><li>A short explanation of the issue and the correction you suggest.</li><li>A judgment citation, paragraph reference or authoritative source link that supports your report, where available.</li></ul></section><section aria-labelledby="corrections-process"><h2 id="corrections-process">How corrections will be handled</h2><p>Reports should be checked against the underlying source. A verified substantive correction should identify what changed and when; an unresolved material error may require the article to be withheld or withdrawn. Minor formatting fixes should not change the meaning of the record.</p><p>Reports are handled as capacity allows; we do not promise a fixed response time. Published explainers have not undergone independent human legal review.</p><p><a href="/editorial-policy#dates">Read the corrections standard</a></p></section></div><aside><h2>The source remains authoritative</h2><p>An editorial correction does not change a court judgment. A discrepancy in reproduced source material must be checked against the authoritative court source.</p>${links}</aside></div>`;
  }
  if(isAuthor) body=body.replace('These 20 judgment explainers',`These ${articleDrafts.length} judgment explainers`).replace('Three years in the legal space</dd>','Three years in the legal space, as of October 2026</dd>').replace('Bio updated</dt>','Bio confirmed</dt>');
  if(isPolicy) {
    const contents=`<nav class="publication-contents policy-jump-links" aria-label="In this policy"><h2>In this policy</h2><ol>${editorialPolicySections.map(([id,h])=>`<li><a href="#${id}">${escapeHtml(h)}</a></li>`).join('')}</ol></nav>`;
    body=body.replace('<div class="publication-layout">',contents+'<div class="publication-layout">').replace(/<nav class="publication-contents" aria-label="In this policy">.*?<\/nav>/,'<h2>Questions or corrections?</h2><p>For factual errors, attribution problems or source discrepancies, '+(correctionsEmail?`email <a href="mailto:${escapeHtml(correctionsEmail)}">${escapeHtml(correctionsEmail)}</a>.`:'visit our corrections page.')+'</p><p><a href="/corrections">What to include in your report</a></p>');
  }
  const content=`<nav class="breadcrumbs publication-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(title)}</span></nav><main id="main" tabindex="-1" class="publication-page">${body}</main>`;
  const isLocalReview=isLocalArticleReview(new Request(url));
  const robots=isLocalReview?'noindex, nofollow':'index, follow';
  const response=htmlResponse(pageShell({title:`${title} | ${SITE_NAME}`,description,canonical:SITE_ORIGIN+url.pathname,robots,content,person:isAuthor?{name:authorProfile.name,description:authorProfile.bio}:undefined,breadcrumbs:[{name:'Home',url:SITE_ORIGIN+'/'},{name:title,url:SITE_ORIGIN+url.pathname}]}),200,robots);
  if(isLocalReview) response.headers.set('cache-control','no-store');return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const readable = request.method === "GET" || request.method === "HEAD";
      let response;
      if (readable && ['thelegalchronicles.com','www.thelegalchronicles.com'].includes(url.hostname) && (url.protocol !== 'https:' || url.hostname !== 'thelegalchronicles.com')) {
        const destination = new URL(url); destination.protocol='https:'; destination.hostname='thelegalchronicles.com'; destination.port='';
        return Response.redirect(destination.href,308);
      }
      if (readable && (url.pathname.startsWith('/authors/') || ['/editorial-policy','/corrections'].includes(url.pathname))) {
        response=publicationReviewPage(url);
      } else if (readable && (url.pathname === "/articles" || url.pathname.startsWith("/articles/"))) {
        response = articleReviewPage(url);
      } else if (readable && url.pathname === "/") {
        response = await homePage(env, isLocalArticleReview(request));
      } else if (readable && url.pathname === '/judges/supreme-court') {
        response = await judgesDirectory(env);
      } else if (readable && /^\/judges\/supreme-court\/[^/]+$/.test(url.pathname)) {
        response = await judgeProfile(decodeURIComponent(url.pathname.split('/').at(-1)),request,env);
      } else if (readable && /^\/judgments\/supreme-court\/2026\/?$/.test(url.pathname)) {
        response = await listJudgments(request, env);
      } else if (readable && /^\/judgments\/supreme-court\/\d{4}\/[^/]+-[a-z0-9]{8}\/?$/.test(url.pathname)) {
        const parts = url.pathname.replace(/\/$/, '').split('/');
        response = await canonicalJudgment(request, env, parts[4].slice(-8), parts[3]);
      } else if (readable && (url.pathname === "/judgments" || url.pathname === "/judgments/")) {
        response = Response.redirect(new URL(COURT_CATALOG + url.search,request.url).href,308);
      } else if (readable && /^\/judgments\/[^/]+\/split$/.test(url.pathname)) {
        const slug = decodeURIComponent(url.pathname.slice("/judgments/".length, -"/split".length));
        response = Response.redirect(`${SITE_ORIGIN}/judgments/${encodeURIComponent(slug)}`, 308);
      } else if (readable && /^\/judgments\/[^/]+$/.test(url.pathname)) {
        response = await judgmentDetail(decodeURIComponent(url.pathname.slice('/judgments/'.length)),env,request);
      } else if (readable && url.pathname === "/api/v1/judgments") {
        response = await apiJudgments(request, env);
      } else if (readable && /^\/api\/v1\/judgments\/[^/]+$/.test(url.pathname)) {
        response = await apiJudgment(decodeURIComponent(url.pathname.slice("/api/v1/judgments/".length)), env);
      } else if (readable && url.pathname === "/api/v1/filters") {
        response = await apiFilters(env);
      } else if (readable && url.pathname === "/api/v1/health") {
        response = jsonResponse({ ok: true, service: "judgment-catalog", version: 1 });
      } else if (readable && url.pathname === "/robots.txt") {
        response = textResponse(`User-agent: *\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, "text/plain; charset=utf-8");
      } else if (readable && url.pathname === "/llms.txt") {
        response = llmsTxt();
      } else if (readable && url.pathname === "/sitemap.xml") {
        response = await sitemap(env);
      } else {
        response = await env.ASSETS.fetch(request);
      }
      if (isLocalArticleReview(request) && response.headers.get('content-type')?.includes('text/html')) {
        const html = (await response.text()).replace('About the publication</a></nav>', 'About the publication</a><a href="/editorial-policy">Editorial policy</a><a href="/corrections">Corrections</a></nav>').replaceAll('<a href="/judges/supreme-court">Judges</a>', '<a href="/articles">Articles</a><a href="/judges/supreme-court">Judges</a>');
        response = new Response(html, {status:response.status,headers:response.headers});
      }
      return request.method === "HEAD" ? bodyless(response) : response;
    } catch (error) {
      const response = url.pathname.startsWith("/api/")
        ? jsonResponse({ error: "Catalog temporarily unavailable" }, 503)
        : errorPage(error, url.pathname);
      console.error("Catalog request error", error);
      return request.method === "HEAD" ? bodyless(response) : response;
    }
  },
};
