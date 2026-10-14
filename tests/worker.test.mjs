import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import worker from "../src/worker.js";

function assetsResponse(body = "asset response", status = 200) {
  return {
    ASSETS: {
      fetch: async () => new Response(body, { status }),
    },
  };
}

function databaseBatch(results) {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
      };
    },
    batch: async () => results,
  };
}

test("health endpoint returns a cacheable service response", async () => {
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/health"),
    assetsResponse(),
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /s-maxage=300/);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "judgment-catalog",
    version: 1,
  });
});

test("HEAD responses retain headers and omit the body", async () => {
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/robots.txt", { method: "HEAD" }),
    assetsResponse(),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(await response.text(), "");
});

test("robots policy points crawlers at the canonical sitemap", async () => {
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/robots.txt"),
    assetsResponse(),
  );
  const text = await response.text();

  assert.match(text, /^User-agent: \*/m);
  assert.match(text, /Disallow: \/api\//);
  assert.match(text, /Sitemap: https:\/\/thelegalchronicles\.com\/sitemap\.xml/);
  assert.doesNotMatch(text, /OAI-SearchBot|GPTBot/);
});

test("unknown routes fall through to the static asset binding", async () => {
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/about"),
    assetsResponse("static page", 202),
  );

  assert.equal(response.status, 202);
  assert.equal(await response.text(), "static page");
});

test("homepage renders the latest catalog records from D1 without client JavaScript", async () => {
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      {
        results: [{
          slug: "example-case",
          title_source: "A & B <Limited>",
          content_status: "published",
          neutral_citation: "2026 INSC 1",
          scr_citation: "[2026] 1 S.C.R. 1",
          decision_date_iso: "2026-01-02",
          case_number_source: "Civil Appeal No. 1/2026",
          disposal_nature_source: "Appeal allowed",
          result_excerpt_source: "Issue for consideration from SCR.",
        }],
      },
      { results: [{ total: 279 }] },
    ]),
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "index, follow");
  assert.match(html, /A &amp; B &lt;Limited&gt;/);
  assert.match(html, /279 2026 judgment records/);
  assert.match(html, /<h2 id="latest-title">Latest judgments<\/h2>/);
  assert.match(html, /From the SCR record/);
  assert.match(html, /action="\/judgments\/supreme-court\/2026" method="get" role="search"/);
  assert.doesNotMatch(html, /<script(?! type="application\/ld\+json")/);
  assert.doesNotMatch(html, /class="eyebrow"/);
});

test("homepage database failures return a bounded noindex page with the home canonical", async () => {
  const env = {
    ...assetsResponse(),
    DB: {
      batch: async () => {
        throw new Error("database unavailable");
      },
      prepare() {
        return this;
      },
    },
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(html, /<link rel="canonical" href="https:\/\/thelegalchronicles\.com\/">/);
  assert.match(html, /<h1>The site is unavailable\.<\/h1>/);
  assert.match(html, /href="\/">Retry/);
});

test("public homepage hides unpublished records and stays noindex until the first release", async () => {
  const statements = [];
  const env = {
    ...assetsResponse(),
    DB: {
      prepare(sql) { statements.push(sql); return {}; },
      batch: async () => [{ results: [] }, { results: [{ total: 0 }] }],
    },
  };
  const response = await worker.fetch(new Request("https://thelegalchronicles.com/"), env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.ok(statements.every((sql) => sql.includes("content_status = 'published'")));
  assert.match(html, /The judgment library is being prepared/);
});

test("a missing judgment returns an accessible noindex page", async () => {
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
        { results: [] },
        { results: [] },
        { results: [] },
      ]),
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/judgments/missing-case"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(html, /<h1>Judgment not found\.<\/h1>/);
  assert.match(html, /href="\/judgments\/supreme-court\/2026"/);
  assert.doesNotMatch(html, /class="eyebrow"/);
});

test("the judgment list renders source data as escaped server HTML", async () => {
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
        {
          results: [{
            slug: "example-case",
            title_source: "A & B <Limited>",
            neutral_citation: "2026 INSC 1",
            scr_citation: "[2026] 1 S.C.R. 1",
            decision_date_iso: "2026-01-02",
            case_number_source: "Civil Appeal No. 1/2026",
            case_type: "Civil Appeal",
            bench_size_source: "2",
            result_excerpt_source: "Appeal allowed.",
            content_status: "metadata_only",
          }],
        },
        { results: [{ total: 1 }] },
        { results: [] },
        { results: [] },
      ]),
  };
  const response = await worker.fetch(
    new Request("http://localhost:8792/judgments/supreme-court/2026"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(html, /A &amp; B &lt;Limited&gt;/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<h1 id="catalog-title">Judgments, made findable\.<\/h1>/);
  assert.doesNotMatch(html, /class="eyebrow"/);
});

test("public catalog queries expose only published records and facets", async () => {
  const statements = [];
  const env = {
    ...assetsResponse(),
    DB: {
      prepare(sql) { statements.push(sql); return { bind() { return this; } }; },
      batch: async () => [{ results: [] }, { results: [{ total: 0 }] }, { results: [] }, { results: [] }],
    },
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/judgments/supreme-court/2026"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(statements.length, 4);
  assert.ok(statements.every((sql) => sql.includes("content_status = 'published'")));
  assert.match(html, /No judgments found/);
});

test("out-of-range listing pages redirect to the last available page", async () => {
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [] },
      { results: [{ total: 41 }] },
      { results: [] },
      { results: [] },
    ]),
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/judgments/supreme-court/2026?page=9"),
    env,
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://thelegalchronicles.com/judgments/supreme-court/2026?page=3");
});

test("published and metadata-only judgment details expose the correct indexing boundary", async () => {
  const record = {
    id: 1,
    slug: "example-case",
    title_source: "Example v. State",
    scr_citation: "[2026] 1 S.C.R. 1",
    neutral_citation: "2026 INSC 1",
    decision_date_iso: "2026-01-02",
    case_number_source: "Civil Appeal No. 1/2026",
    source_listing_url: "https://scr.sci.gov.in/scrsearch/",
    content_status: "metadata_only",
  };
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [record] },
      { results: [{ slug: "judge-example", name_source: "Justice Example", source_position: 1, is_author: 1 }] },
      { results: [{ asset_kind: "source_pdf", action_status: "listed", verification_status: "not_checked" }] },
    ]),
  };
  const response = await worker.fetch(
    new Request("http://localhost:8792/judgments/example-case"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.match(html, /Full judgment text is being verified\./);
  assert.match(html, /Justice Example<\/a> \(author\)/);
  assert.match(html, /View Supreme Court Reports source/);
});

test("unpublished judgment details return 404 on public hosts", async () => {
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{ slug: "held-case", content_status: "validated" }] },
      { results: [] },
      { results: [] },
    ]),
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/judgments/held-case"),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("permanent judgment URLs derive IDs from existing slugs before migration 0007", async () => {
  let sql = "";
  let boundId = "";
  const env = {
    DB: {
      prepare(query) {
        sql = query;
        return {
          bind(value) { boundId = value; return this; },
          first: async () => ({
            slug: "example-case-a1b2c3d4",
            public_id: "a1b2c3d4",
            decision_year: 2026,
            source_citation_year: 2026,
            content_status: "validated",
          }),
        };
      },
    },
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/judgments/supreme-court/2026/example-case-a1b2c3d4"),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(boundId, "a1b2c3d4");
  assert.match(sql, /lower\(substr\(slug, -8\)\)/);
  assert.doesNotMatch(sql, /WHERE\s+public_id\s*=/);
});

test("judge-profile routes fail closed until their D1 table is migrated", async () => {
  const env = { DB: { prepare() { throw new Error("no such table: judge_profiles"); } } };
  for (const path of ["/judges/supreme-court", "/judges/supreme-court/example-judge"]) {
    const response = await worker.fetch(new Request(`https://thelegalchronicles.com${path}`), env);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  }
});

test("legacy Split View URLs redirect to the canonical judgment", async () => {
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/judgments/mageba-pilot/split"),
    assetsResponse(),
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://thelegalchronicles.com/judgments/mageba-pilot",
  );
});

test("validated R2 judgment text is server rendered and remains noindex before publication", async () => {
  const renderDocument = {
    version: "scr-body-v1",
    id: "example",
    neutralCitation: "2026 INSC 1",
    sourcePath: "2026_1_1_2",
    sourceNeutralKey: "2026INSC1",
    capturedAt: "2026-09-23T00:00:00.000Z",
    blocks: [
      { type: "heading", className: "Judgment_Heading", text: "Judgment" },
      { type: "paragraph", className: "Judgement_L1", text: "Complete source judgment text." },
    ],
  };
  const body = `${JSON.stringify(renderDocument)}\n`;
  const hash = createHash("sha256").update(body).digest("hex");
  const record = {
    id: 1,
    slug: "validated-case",
    title_source: "Example v. State",
    scr_citation: "[2026] 1 S.C.R. 1",
    neutral_citation: "2026 INSC 1",
    decision_date_iso: "2026-01-02",
    case_number_source: "Civil Appeal No. 1/2026",
    source_listing_url: "https://scr.sci.gov.in/scrsearch/",
    source_path: "2026_1_1_2",
    content_status: "validated",
    body_render_r2_key: "scr/2026/render/example.json",
    body_render_sha256: hash,
  };
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [record] },
      { results: [] },
      { results: [] },
    ]),
    JUDGMENT_BODIES: {
      get: async (key) => key === record.body_render_r2_key ? { text: async () => body } : null,
    },
  };
  const response = await worker.fetch(
    new Request("http://localhost:8792/judgments/validated-case"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.match(html, /Validated text · Not yet published/);
  assert.match(html, /Complete source judgment text\./);
  assert.match(html, /id="judgment" tabindex="-1"/);
  assert.doesNotMatch(html, /<script(?! type="application\/ld\+json")/);
});

test("a validated judgment fails closed when its R2 hash does not match", async () => {
  const record = {
    slug: "corrupt-case",
    title_source: "Corrupt v. State",
    neutral_citation: "2026 INSC 2",
    source_path: "2026_1_3_4",
    content_status: "validated",
    body_render_r2_key: "scr/2026/render/corrupt.json",
    body_render_sha256: "0".repeat(64),
  };
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [record] },
      { results: [] },
      { results: [] },
    ]),
    JUDGMENT_BODIES: { get: async () => ({ text: async () => "{}\n" }) },
  };
  const response = await worker.fetch(
    new Request("http://localhost:8792/judgments/corrupt-case"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(html, /withheld the text rather than show an incomplete legal document/);
});

test("read-only judgment APIs return records, relationships, filters, and pagination", async () => {
  const listEnv = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{
        slug: "example-case",
        title_source: "Example v. State",
        case_lookup_status: "found",
        case_verification_status: "verified",
      }] },
      { results: [{ total: 1 }] },
    ]),
  };
  const listResponse = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/judgments?limit=10&page=1"),
    listEnv,
  );
  const list = await listResponse.json();
  assert.equal(list.data[0].slug, "example-case");
  assert.equal(list.data[0].case_verification_status, "verified");
  assert.deepEqual(list.pagination, { page: 1, limit: 10, total: 1, pages: 1 });

  const detailEnv = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{ slug: "example-case", content_status: "metadata_only" }] },
      { results: [{ slug: "judge-example", name_source: "Justice Example" }] },
      { results: [{ asset_kind: "source_pdf", action_status: "listed" }] },
      { results: [{
        input_case_number: "Civil Appeal No. 1/2026",
        lookup_status: "found",
        match_basis: "judgment_document_neutral_citation",
        verification_status: "verified",
        source_retrieved_at: "2026-09-19T10:00:00.000Z",
        source_case_identifier: "diary:1:2026",
        source_url: "https://www.sci.gov.in/case-status/",
        case_title_source: "Example v. State",
        official_case_number_source: "1",
        case_year: 2026,
        case_status_source: "DISPOSED",
      }] },
      { results: [{
        url: "https://api.sci.gov.in/jonew/judis/1.pdf",
        label_source: "Judgment 2026 INSC 1",
        document_type_source: "Judgment",
        document_date_source: "02-01-2026",
        document_date_iso: "2026-01-02",
        neutral_citation_source: "2026 INSC 1",
        is_primary: 1,
        match_basis: "citation_and_date",
      }] },
      { results: [] },
    ]),
  };
  const detailResponse = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/judgments/example-case"),
    detailEnv,
  );
  const detail = await detailResponse.json();
  assert.equal(detail.data.judges.length, 1);
  assert.equal(detail.data.source_assets.length, 1);
  assert.equal(detail.data.case_enrichment.verification_status, "verified");
  assert.equal(detail.data.case_enrichment.case.case_status_source, "DISPOSED");
  assert.equal(detail.data.case_enrichment.official_documents[0].is_primary, true);
  assert.deepEqual(detail.sources, [
    "Supreme Court Reports (SCR)",
    "Supreme Court of India case status",
  ]);

  const filterEnv = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{ year: 2026, records: 279 }] },
      { results: [{ value: "Civil Appeal", records: 40 }] },
      { results: [{ value: "judge-example", label: "Justice Example", records: 12 }] },
      { results: [{ value: 2, label: "2", records: 120 }] },
    ]),
  };
  const filterResponse = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/filters"),
    filterEnv,
  );
  const filters = await filterResponse.json();
  assert.equal(filters.data.years[0].records, 279);
  assert.equal(filters.data.judges[0].label, "Justice Example");
});

test("judgment API keeps unmatched case enrichment explicit without inventing a case", async () => {
  const env = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{ slug: "unmatched-case", content_status: "metadata_only" }] },
      { results: [] },
      { results: [] },
      { results: [{
        input_case_number: "Civil Appeal No. 8735/2026",
        lookup_status: "not_found",
        match_basis: "unmatched",
        verification_status: "unmatched",
        source_retrieved_at: "2026-09-19T10:00:00.000Z",
        source_case_identifier: null,
      }] },
      { results: [] },
      { results: [] },
    ]),
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/judgments/unmatched-case"),
    env,
  );
  const detail = await response.json();

  assert.equal(response.status, 200);
  assert.equal(detail.data.case_enrichment.lookup_status, "not_found");
  assert.equal(detail.data.case_enrichment.verification_status, "unmatched");
  assert.equal(detail.data.case_enrichment.case, null);
  assert.deepEqual(detail.data.case_enrichment.official_documents, []);
  assert.doesNotMatch(JSON.stringify(detail), /raw_payload|r2_key|dataset_sha256/);
});

test("sitemap includes the canonical indexable set only after a judgment is published", async () => {
  const env = {
    ...assetsResponse(),
    DB: {
      prepare() {
        return {
          all: async () => ({
            results: [{ slug: "published-case", updated_at: "2026-09-18 10:00:00" }],
          }),
        };
      },
    },
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/sitemap.xml"),
    env,
  );
  const xml = await response.text();

  assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.match(xml, /<loc>https:\/\/thelegalchronicles\.com\/\<\/loc>/);
  assert.match(xml, /<loc>https:\/\/thelegalchronicles\.com\/judgments\/supreme-court\/2026<\/loc>/);
  assert.match(xml, /https:\/\/thelegalchronicles\.com\/judgments\/published-case/);
  assert.match(xml, /<lastmod>2026-09-18<\/lastmod>/);
});

test("database failures return a bounded JSON error for API callers", async () => {
  const env = {
    ...assetsResponse(),
    DB: {
      prepare() {
        return { bind() { return this; } };
      },
      batch: async () => {
        throw new Error("database unavailable");
      },
    },
  };
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/judgments"),
    env,
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Catalog temporarily unavailable",
  });
});
