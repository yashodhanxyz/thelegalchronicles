import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {articleDrafts} from '../src/data/article-drafts.generated.js';
import {jsonLd} from '../src/seo.js';

test('JSON-LD serialization cannot break out into executable HTML',()=>{
 const original={name:'</script><script>alert("x")</script>&'};
 const serialized=jsonLd(original);
 assert.ok(!serialized.includes('<'));
 assert.deepEqual(JSON.parse(serialized),original);
});

test('homepage emits a parseable, crawlable site graph and the launch layout',async()=>{
 const env={DB:{prepare(){return {};},batch:async()=>[
  {results:[{slug:'recent-case-a1b2c3d4',public_id:'a1b2c3d4',decision_year:2026,source_citation_year:2026,title_source:'Recent Case v. State',scr_citation:'[2026] 1 S.C.R. 1',neutral_citation:'2026 INSC 1',decision_date_iso:'2026-08-12',case_number_source:'Civil Appeal No. 1/2026',disposal_nature_source:'Appeal allowed',result_excerpt_source:'SCR excerpt.'}]},
  {results:[{total:277}]},
 ]}};
 const response=await worker.fetch(new Request('https://thelegalchronicles.com/'),env);
 const html=await response.text();
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-robots-tag'),'index, follow');
 assert.match(html,/<link rel="canonical" href="https:\/\/thelegalchronicles\.com\/">/);
 assert.ok(html.includes('Featured article'));
 assert.ok(html.includes('More articles'));
 assert.ok(html.includes('Latest judgments'));
 const primaryNav=html.match(/<nav aria-label="Primary navigation">([\s\S]*?)<\/nav>/)?.[1]||'';
 assert.equal((primaryNav.match(/href="\/articles">Articles<\/a>/g)||[]).length,1);
 assert.equal((html.match(/class="home-companions"/g)||[]).length,1);
 assert.ok(!html.includes('Law in the public record, for a more informed India.'));
 assert.ok(graph['@graph'].some(e=>e['@type']==='Organization'&&e.name==='The Legal Chronicles'));
 assert.ok(graph['@graph'].some(e=>e['@type']==='WebSite'&&e.url==='https://thelegalchronicles.com'));
 assert.ok(graph['@graph'].some(e=>e['@type']==='WebPage'&&e.url==='https://thelegalchronicles.com/'));
});

test('public author, policy, and corrections pages are indexable and describe the actual process',async()=>{
 for(const path of ['/authors/yashodhan-deshmukh','/editorial-policy','/corrections']){
  const response=await worker.fetch(new Request(`https://thelegalchronicles.com${path}`),{});
  assert.equal(response.status,200,path);
  assert.equal(response.headers.get('x-robots-tag'),'index, follow',path);
  const html=await response.text();
  assert.ok(html.includes('<h1>'),path);
  assert.ok(html.includes('rel="canonical"'),path);
  if(path.includes('authors')){
   assert.ok(html.includes('Yashodhan Deshmukh is the founder of Order.law'));
   assert.ok(html.includes('17 explainers are published'));
   for(const article of articleDrafts)assert.ok(html.includes(article.proposed_article_path));
  }
  if(path==='/editorial-policy'){
   assert.ok(html.includes('have not undergone independent human legal review'));
   assert.ok(html.includes('Separate review or curative proceedings'));
   assert.ok(!html.includes('Draft for review'));
  }
  if(path==='/corrections'){
   assert.ok(html.includes('yash@order.law'));
   assert.ok(html.includes('do not promise a fixed response time'));
  }
 }
});

test('segmented sitemap contains only canonical public pages and published judgment details',async()=>{
 const queries=[];
 const env={DB:{prepare(sql){queries.push(sql);return {bind(){return this;},all:async()=>({results:[{slug:'recent-case-a1b2c3d4',public_id:'a1b2c3d4',decision_year:2026,source_citation_year:2026,updated_at:'2026-10-14'}]})};}}};
 const index=await worker.fetch(new Request('https://thelegalchronicles.com/sitemap.xml'),env);
 assert.match(await index.text(),/<sitemapindex/);
 const sections=['pages','articles','judges','judgments-2026'];
 let xml='';for(const section of sections){const r=await worker.fetch(new Request(`https://thelegalchronicles.com/sitemaps/${section}.xml`),env);assert.equal(r.headers.get('content-type'),'application/xml; charset=utf-8');xml+=await r.text();}
 assert.ok(queries.some(query=>query.includes("content_status = 'published'")));
 for(const path of ['/','/articles','/editorial-policy','/corrections','/authors/yashodhan-deshmukh','/judges/supreme-court','/judgments/supreme-court/2026/recent-case-a1b2c3d4'])assert.ok(xml.includes(`<loc>https://thelegalchronicles.com${path}</loc>`));
 for(const article of articleDrafts)assert.ok(xml.includes(`<loc>https://thelegalchronicles.com${article.proposed_article_path}</loc>`));
 assert.ok(xml.includes('<lastmod>2026-10-14</lastmod>'));
 assert.ok(!xml.includes('417b8667'));
});

test('robots and llms.txt expose discovery routes while keeping APIs and withheld sources out',async()=>{
 const robots=await worker.fetch(new Request('https://thelegalchronicles.com/robots.txt'),{});
 const robotsText=await robots.text();
 assert.ok(robotsText.includes('Sitemap: https://thelegalchronicles.com/sitemap.xml'));
 assert.ok(robotsText.includes('Disallow: /api/'));
 const llms=await worker.fetch(new Request('https://thelegalchronicles.com/llms.txt'),{});
 const text=await llms.text();
 assert.equal(llms.status,200);
 assert.ok(text.includes('17 AI-assisted explainers'));
 assert.ok(text.includes('have not undergone independent human legal review'));
 for(const article of articleDrafts)assert.ok(text.includes(`https://thelegalchronicles.com${article.proposed_article_path}`));
 assert.ok(!text.includes('417b8667'));
 assert.ok(text.includes('No llms-full.txt is provided'));
});
