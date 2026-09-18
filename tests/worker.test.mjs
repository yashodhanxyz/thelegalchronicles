import assert from "node:assert/strict";
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

  assert.match(text, /Disallow: \/api\//);
  assert.match(text, /Sitemap: https:\/\/thelegalchronicles\.com\/sitemap\.xml/);
});

test("unknown routes fall through to the static asset binding", async () => {
  const response = await worker.fetch(
    new Request("https://thelegalchronicles.com/about"),
    assetsResponse("static page", 202),
  );

  assert.equal(response.status, 202);
  assert.equal(await response.text(), "static page");
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
  assert.match(html, /href="\/judgments"/);
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
    new Request("https://thelegalchronicles.com/judgments"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "index, follow");
  assert.match(html, /A &amp; B &lt;Limited&gt;/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<h1 id="catalog-title">Judgments, made findable\.<\/h1>/);
  assert.doesNotMatch(html, /class="eyebrow"/);
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
    new Request("https://thelegalchronicles.com/judgments?page=9"),
    env,
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://thelegalchronicles.com/judgments?page=3");
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
    new Request("https://thelegalchronicles.com/judgments/example-case"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.match(html, /Full judgment text is being verified\./);
  assert.match(html, /Justice Example \(author\)/);
  assert.match(html, /View Supreme Court Reports source/);
});

test("read-only judgment APIs return records, relationships, filters, and pagination", async () => {
  const listEnv = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{ slug: "example-case", title_source: "Example v. State" }] },
      { results: [{ total: 1 }] },
    ]),
  };
  const listResponse = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/judgments?limit=10&page=1"),
    listEnv,
  );
  const list = await listResponse.json();
  assert.equal(list.data[0].slug, "example-case");
  assert.deepEqual(list.pagination, { page: 1, limit: 10, total: 1, pages: 1 });

  const detailEnv = {
    ...assetsResponse(),
    DB: databaseBatch([
      { results: [{ slug: "example-case", content_status: "metadata_only" }] },
      { results: [{ slug: "judge-example", name_source: "Justice Example" }] },
      { results: [{ asset_kind: "source_pdf", action_status: "listed" }] },
    ]),
  };
  const detailResponse = await worker.fetch(
    new Request("https://thelegalchronicles.com/api/v1/judgments/example-case"),
    detailEnv,
  );
  const detail = await detailResponse.json();
  assert.equal(detail.data.judges.length, 1);
  assert.equal(detail.data.source_assets.length, 1);

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

test("sitemap includes only records supplied by the published-record query", async () => {
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
