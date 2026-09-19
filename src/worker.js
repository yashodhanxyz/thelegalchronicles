const SITE_NAME = "The Legal Chronicles";
const SITE_ORIGIN = "https://thelegalchronicles.com";
const PAGE_SIZE = 20;

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

function pageShell({ title, description, canonical, robots = "index, follow", content }) {
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
    <link rel="stylesheet" href="/catalog.css">
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to results</a>
    <header class="site-header">
      <a class="wordmark" href="/">${SITE_NAME}</a>
      <nav aria-label="Primary navigation">
        <a aria-current="page" href="/judgments">Judgments</a>
      </nav>
    </header>
    ${content}
    <footer class="site-footer">
      <p>© 2026 ${SITE_NAME}</p>
      <p>Independent legal publishing</p>
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
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const caseType = (url.searchParams.get("case_type") || "").trim().slice(0, 100);
  const judge = (url.searchParams.get("judge") || "").trim().slice(0, 120);
  const page = integerParam(url.searchParams.get("page"), 1, 1, 500);
  const offset = (page - 1) * PAGE_SIZE;
  const likeQuery = `%${q}%`;

  const where = `
    j.source_system = 'scr'
    AND j.source_citation_year = 2026
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
        j.slug, j.title_source, j.scr_citation, j.neutral_citation,
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
      WHERE source_system = 'scr' AND source_citation_year = 2026 AND case_type IS NOT NULL
      GROUP BY case_type
      ORDER BY records DESC, case_type
    `),
    env.DB.prepare(`
      SELECT judge.slug, judge.name_source, COUNT(*) AS records
      FROM judges AS judge
      JOIN judgment_judges AS jj ON jj.judge_id = judge.id
      JOIN judgments AS j ON j.id = jj.judgment_id
      WHERE j.source_system = 'scr' AND j.source_citation_year = 2026
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
      `${url.origin}/judgments${queryString({ q, case_type: caseType, judge, page: pages })}`,
      302,
    );
  }
  const activeFilters = Boolean(q || caseType || judge);
  const canonical = `${SITE_ORIGIN}/judgments${safePage > 1 ? `?page=${safePage}` : ""}`;
  const robots = activeFilters ? "noindex, follow" : "index, follow";

  const cards = records.map((record) => `
    <article class="judgment-card">
      <div class="citation-line">
        <span>${escapeHtml(record.neutral_citation)}</span>
        <span>${escapeHtml(record.scr_citation)}</span>
      </div>
      <h2><a href="/judgments/${encodeURIComponent(record.slug)}">${escapeHtml(record.title_source)}</a></h2>
      <dl class="card-facts">
        <div><dt>Decision</dt><dd><time datetime="${escapeHtml(record.decision_date_iso)}">${escapeHtml(formatDate(record.decision_date_iso))}</time></dd></div>
        <div><dt>Case</dt><dd>${escapeHtml(record.case_number_source)}</dd></div>
        <div><dt>Bench</dt><dd>${escapeHtml(record.bench_size_source || "Not stated")}</dd></div>
      </dl>
      ${record.result_excerpt_source ? `<p class="excerpt">${escapeHtml(record.result_excerpt_source)}</p>` : ""}
      <a class="read-link" href="/judgments/${encodeURIComponent(record.slug)}">View judgment record <span aria-hidden="true">→</span></a>
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
    ? `<a rel="prev" href="/judgments${queryString({ ...baseParams, page: safePage - 1 })}">← Previous</a>`
    : `<span aria-disabled="true">← Previous</span>`;
  const next = safePage < pages
    ? `<a rel="next" href="/judgments${queryString({ ...baseParams, page: safePage + 1 })}">Next →</a>`
    : `<span aria-disabled="true">Next →</span>`;

  const content = `
    <main id="main" class="catalog-shell">
      <section class="catalog-intro" aria-labelledby="catalog-title">
        <h1 id="catalog-title">Judgments, made findable.</h1>
        <p>Browse the verified 2026 SCR catalog by case, judge, citation, and decision details.</p>
        <p class="source-note">Source metadata: Supreme Court Reports (SCR). The authoritative source record prevails.</p>
      </section>
      <form class="filters" action="/judgments" method="get" role="search">
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
        ${activeFilters ? `<a class="clear-link" href="/judgments">Clear</a>` : ""}
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
    title: `2026 Supreme Court Judgments | ${SITE_NAME}`,
    description: "Browse verified 2026 Supreme Court Reports judgment metadata by case, judge, citation and decision details.",
    canonical,
    robots,
    content,
  }), 200, robots);
}

async function judgmentDetail(slug, env) {
  const [recordResult, judgesResult, assetsResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        id, slug, title_source, scr_citation, neutral_citation,
        decision_date_source, decision_date_iso, decision_year,
        case_number_source, case_type, disposal_nature_source,
        bench_size_source, bench_size, coram_source, result_excerpt_source,
        source_listing_url, source_citation_year, source_path,
        content_status, source_checked_at
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
  if (!record) {
    return htmlResponse(pageShell({
      title: `Judgment not found | ${SITE_NAME}`,
      description: "The requested judgment record could not be found.",
      canonical: `${SITE_ORIGIN}/judgments/${encodeURIComponent(slug)}`,
      robots: "noindex, nofollow",
      content: `<main id="main" class="message-page"><h1>Judgment not found.</h1><p>The record may have moved or the address may be incorrect.</p><a class="read-link" href="/judgments">← Browse judgments</a></main>`,
    }), 404, "noindex, nofollow");
  }

  const judges = judgesResult.results || [];
  const assets = assetsResult.results || [];
  const isPublished = record.content_status === "published";
  const robots = isPublished ? "index, follow" : "noindex, follow";
  const canonical = `${SITE_ORIGIN}/judgments/${encodeURIComponent(record.slug)}`;
  const assetLabels = {
    split_html: "Split view",
    html_view: "HTML view",
    source_pdf: "Source PDF",
    flip_view: "Flip view",
  };
  const judgeLinks = judges.length
    ? judges.map((judge) => `${escapeHtml(judge.name_source)}${judge.is_author ? " (author)" : ""}`).join(", ")
    : "Not stated by the source";
  const assetItems = assets.map((asset) => `
    <li>
      <span>${escapeHtml(assetLabels[asset.asset_kind] || asset.asset_kind)}</span>
      <span>${asset.action_status === "listed" ? "Listed by SCR" : "Not listed"}</span>
    </li>
  `).join("");

  const content = `
    <main id="main" class="detail-shell">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/judgments">Judgments</a><span aria-hidden="true">/</span><span>2026</span>
      </nav>
      <article class="judgment-detail">
        <header class="detail-header">
          <h1>${escapeHtml(record.title_source)}</h1>
          <div class="detail-citations" aria-label="Citations">
            <span>${escapeHtml(record.scr_citation)}</span>
            <span>${escapeHtml(record.neutral_citation)}</span>
          </div>
        </header>
        <section class="detail-layout" aria-label="Judgment record">
          <div class="detail-main">
            <section aria-labelledby="source-summary-title">
              <h2 id="source-summary-title">Case summary from SCR</h2>
              <p class="source-excerpt">${escapeHtml(record.result_excerpt_source || "No listing excerpt was supplied by SCR.")}</p>
            </section>
            <section class="content-notice" aria-labelledby="text-status-title">
              <h2 id="text-status-title">Full judgment text is being verified.</h2>
              <p>This page currently contains source metadata only. The complete SCR text will appear here only after its wording, order, sections, and footnotes pass fidelity checks.</p>
            </section>
          </div>
          <aside class="record-panel" aria-labelledby="record-title">
            <h2 id="record-title">Judgment record</h2>
            <dl>
              <div><dt>Decision date</dt><dd><time datetime="${escapeHtml(record.decision_date_iso)}">${escapeHtml(formatDate(record.decision_date_iso))}</time></dd></div>
              <div><dt>Case number</dt><dd>${escapeHtml(record.case_number_source)}</dd></div>
              <div><dt>Case type</dt><dd>${escapeHtml(record.case_type || "Not stated")}</dd></div>
              <div><dt>Judges</dt><dd>${judgeLinks}</dd></div>
              <div><dt>Bench</dt><dd>${escapeHtml(record.bench_size_source || "Not stated")}</dd></div>
              <div><dt>Disposition</dt><dd>${escapeHtml(record.disposal_nature_source || "Not stated by the source")}</dd></div>
            </dl>
            <h3>Source actions</h3>
            <ul class="asset-list">${assetItems}</ul>
            <a class="source-link" href="${escapeHtml(record.source_listing_url)}" rel="external">View Supreme Court Reports source <span aria-hidden="true">↗</span></a>
          </aside>
        </section>
        <footer class="attribution">
          <p><strong>Source:</strong> Supreme Court Reports (SCR). This independent record does not alter the legal document. The authoritative source prevails.</p>
        </footer>
      </article>
    </main>
  `;

  return htmlResponse(pageShell({
    title: `${record.title_source} | ${record.neutral_citation}`,
    description: `${record.title_source}. ${record.neutral_citation}; decided ${formatDate(record.decision_date_iso)}. Source metadata from Supreme Court Reports.`,
    canonical,
    robots,
    content,
  }), 200, robots);
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
        j.slug, j.title_source, j.scr_citation, j.neutral_citation,
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
        slug, title_source, scr_citation, neutral_citation,
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
  if (!record) return jsonResponse({ error: "Judgment not found" }, 404);
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
    env.DB.prepare(`SELECT source_citation_year AS year, COUNT(*) AS records FROM judgments WHERE source_system = 'scr' GROUP BY source_citation_year ORDER BY year DESC`),
    env.DB.prepare(`SELECT case_type AS value, COUNT(*) AS records FROM judgments WHERE source_system = 'scr' AND case_type IS NOT NULL GROUP BY case_type ORDER BY records DESC, value`),
    env.DB.prepare(`
      SELECT judge.slug AS value, judge.name_source AS label, COUNT(*) AS records
      FROM judges AS judge
      JOIN judgment_judges AS jj ON jj.judge_id = judge.id
      JOIN judgments AS judgment ON judgment.id = jj.judgment_id
      WHERE judgment.source_system = 'scr'
      GROUP BY judge.id ORDER BY records DESC, judge.name_normalized
    `),
    env.DB.prepare(`SELECT bench_size AS value, bench_size_source AS label, COUNT(*) AS records FROM judgments WHERE source_system = 'scr' AND bench_size IS NOT NULL GROUP BY bench_size, bench_size_source ORDER BY bench_size`),
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
    SELECT slug, updated_at
    FROM judgments
    WHERE source_system = 'scr' AND content_status = 'published'
    ORDER BY id
  `).all();
  const judgmentUrls = (result.results || []).map((record) => `
  <url><loc>${SITE_ORIGIN}/judgments/${encodeURIComponent(record.slug)}</loc><lastmod>${escapeHtml(String(record.updated_at).slice(0, 10))}</lastmod></url>`).join("");
  return textResponse(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_ORIGIN}/judgments</loc></url>${judgmentUrls}
</urlset>`, "application/xml; charset=utf-8", "public, max-age=300, s-maxage=3600");
}

function errorPage(error) {
  console.error("Judgment catalog error", error);
  return htmlResponse(pageShell({
    title: `Catalog unavailable | ${SITE_NAME}`,
    description: "The judgment catalog is temporarily unavailable.",
    canonical: `${SITE_ORIGIN}/judgments`,
    robots: "noindex, nofollow",
    content: `<main id="main" class="message-page"><h1>The catalog is unavailable.</h1><p>Please try again shortly.</p><a class="read-link" href="/judgments">Retry <span aria-hidden="true">→</span></a></main>`,
  }), 503, "noindex, nofollow");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const readable = request.method === "GET" || request.method === "HEAD";
      let response;
      if (readable && (url.pathname === "/judgments" || url.pathname === "/judgments/")) {
        response = await listJudgments(request, env);
      } else if (readable && /^\/judgments\/[^/]+$/.test(url.pathname)) {
        response = await judgmentDetail(decodeURIComponent(url.pathname.slice("/judgments/".length)), env);
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
      } else if (readable && url.pathname === "/sitemap.xml") {
        response = await sitemap(env);
      } else {
        response = await env.ASSETS.fetch(request);
      }
      return request.method === "HEAD" ? bodyless(response) : response;
    } catch (error) {
      const response = url.pathname.startsWith("/api/")
        ? jsonResponse({ error: "Catalog temporarily unavailable" }, 503)
        : errorPage(error);
      console.error("Catalog request error", error);
      return request.method === "HEAD" ? bodyless(response) : response;
    }
  },
};
