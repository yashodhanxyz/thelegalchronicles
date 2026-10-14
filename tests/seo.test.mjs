import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {jsonLd} from '../src/seo.js';

test('unpublished article copy and artwork are absent from the public release bundle',async()=>{
 for (const origin of ['http://localhost:8792','https://thelegalchronicles.com']) {
  const response=await worker.fetch(new Request(origin+'/articles/not-included-in-release'),{});
  assert.equal(response.status,404);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 }
});
test('JSON-LD serialization cannot break out into executable HTML',()=>{
 const original={name:'</script><script>alert("x")</script>&'};
 const serialized=jsonLd(original);
 assert.ok(!serialized.includes('<'));
 assert.deepEqual(JSON.parse(serialized),original);
});
test('homepage emits a parseable, conservative site graph with canonical metadata',async()=>{
 const env={DB:{prepare(){return {};},batch:async()=>[{results:[]},{results:[{total:0}]}]}};
 const r=await worker.fetch(new Request('https://thelegalchronicles.com/'),env);
 const html=await r.text();
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(r.status,200);
 assert.match(html,/<title>The Legal Chronicles \| Supreme Court judgments and legal journalism<\/title>/);
 assert.match(html,/<meta name="description" content="Find and verify Supreme Court judgments/);
 assert.match(html,/<link rel="canonical" href="https:\/\/thelegalchronicles\.com\/">/);
 assert.ok(graph['@graph'].some(e=>e['@type']==='Organization'&&e.name==='The Legal Chronicles'));
 assert.ok(graph['@graph'].some(e=>e['@type']==='WebSite'&&e.url==='https://thelegalchronicles.com'));
 assert.ok(graph['@graph'].some(e=>e['@type']==='WebPage'&&e.url==='https://thelegalchronicles.com/'));
 assert.ok(!graph['@graph'].some(e=>e['@type']==='Article'));
});
test('llms.txt is a curated map and does not expose unpublished drafts or claim a full-text feed',async()=>{
 const r=await worker.fetch(new Request('https://thelegalchronicles.com/llms.txt'),{});
 const text=await r.text();
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/text\/plain; charset=utf-8/);
 assert.match(text,/https:\/\/thelegalchronicles\.com\/sitemap\.xml/);
 assert.match(text,/Draft article URLs, local author review URLs, and unpublished judgment detail URLs are not enumerated here/);
 assert.match(text,/No llms-full\.txt is provided/);
 assert.doesNotMatch(text,/\/articles\//);
 assert.doesNotMatch(text,/\/authors\//);
});
test('owned HTTP and www URLs consolidate while preserving path and query',async()=>{
 for(const origin of ['http://thelegalchronicles.com','https://www.thelegalchronicles.com']){
  const r=await worker.fetch(new Request(origin+'/judgments?page=2'),{});
  assert.equal(r.status,308);
  assert.equal(r.headers.get('location'),'https://thelegalchronicles.com/judgments?page=2');
 }
});
test('local author profile is noindex and does not enumerate unpublished article URLs',async()=>{
 const r=await worker.fetch(new Request('http://localhost:8792/authors/yashodhan-deshmukh'),{});
 const html=await r.text();
 assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.ok(!html.includes('/articles/'));
 assert.ok(!html.includes('datePublished'));
});
test('sitemap omits all URLs while no judgment is published',async()=>{
 let query='';
 const env={DB:{prepare(sql){query=sql;return {all:async()=>({results:[]})};}}};
 const r=await worker.fetch(new Request('http://localhost:8792/sitemap.xml'),env);
 const xml=await r.text();
 assert.ok(query.includes("content_status = 'published'"));
 assert.match(xml,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>/);
 assert.ok(!xml.includes('<loc>'));
 assert.ok(!xml.includes('/articles'));
 assert.ok(!xml.includes('/authors/'));
});
test('author review route is explicitly withheld on public and preview hosts',async()=>{
 for(const host of ['thelegalchronicles.com','preview.example.com']) {
  const r=await worker.fetch(new Request(`https://${host}/authors/yashodhan-deshmukh`),{});
  assert.equal(r.status,404);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
 }
});
