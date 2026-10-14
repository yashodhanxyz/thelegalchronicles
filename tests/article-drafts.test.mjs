import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {articleDrafts} from '../src/data/article-drafts.generated.js';
import {articleImages} from '../src/data/article-images.generated.js';

const heldPaths = [
  '/articles/electrocution-compensation-what-kptcl-v-rekha-says-about-writ-petitions-and-strict-liability-417b8667',
  '/articles/motor-insurance-and-passenger-cover-the-thungala-dhana-laxmi-judgment-explained-52f43005',
  '/articles/goa-pwd-workers-win-regularisation-who-the-rupesh-gaonkar-order-covers-8c44c5bb',
];

test('only the 17 explicitly released explainers and their artwork are shipped',()=>{
 assert.equal(articleDrafts.length,17);
 assert.equal(Object.keys(articleImages).length,17);
 for(const id of ['417b8667','52f43005','8c44c5bb']){
  assert.ok(!articleDrafts.some(a=>a.id===id));
  assert.ok(!Object.hasOwn(articleImages,id));
 }
});

test('published articles render as indexable server HTML with accurate disclosure and canonical judgment links',async()=>{
 for(const a of articleDrafts){
  const response=await worker.fetch(new Request(`https://thelegalchronicles.com${a.proposed_article_path}`),{});
  const html=await response.text();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-robots-tag'),'index, follow');
  assert.match(html,/rel="canonical" href="https:\/\/thelegalchronicles\.com\/articles\//);
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.ok(html.includes(`href="${a.metadata.judgment_path}"`));
  assert.ok(html.includes('AI-assisted explanation. No independent human legal review has been performed. The identified main-case docket was checked on 14 Oct 2026'));
  assert.ok(html.includes('This article is general information, not legal advice'));
  assert.ok(html.includes(`src="${articleImages[a.id].src}"`));
  assert.ok(html.includes('Published <time datetime="2026-10-14">'));
  assert.ok(!html.includes('Editorial note'));
  assert.ok(!html.includes('Human legal review is pending'));
  assert.ok(!html.includes('Draft prepared <time'));
  assert.ok(!/<script(?! type="application\/ld\+json")/.test(html));
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const entity=graph['@graph'].find(node=>node['@type']==='Article');
  assert.equal(entity.datePublished,'2026-10-14');
  assert.equal(entity.creativeWorkStatus,undefined);
  assert.equal(entity.citation,`https://thelegalchronicles.com${a.metadata.judgment_path}`);
 }
});

test('article index exposes exactly the released set and is crawlable',async()=>{
 const response=await worker.fetch(new Request('https://thelegalchronicles.com/articles'),{});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-robots-tag'),'index, follow');
 assert.ok(html.includes('17 judgment explainers'));
 for(const article of articleDrafts)assert.ok(html.includes(article.proposed_article_path));
 for(const path of heldPaths)assert.ok(!html.includes(path));
});

test('source-incomplete and currentness-unresolved article paths fail closed',async()=>{
 for(const path of heldPaths){
  const response=await worker.fetch(new Request(`https://thelegalchronicles.com${path}`),{});
  assert.equal(response.status,404);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 }
});

test('the author-requested outcome and deadline corrections appear in the released articles',async()=>{
 const bharathamma=articleDrafts.find(a=>a.id==='3611705e');
 const html1=await (await worker.fetch(new Request(`https://thelegalchronicles.com${bharathamma.proposed_article_path}`),{})).text();
 assert.ok(html1.includes('The Court allowed the appeals and set aside the High Court’s impugned order.'));
 const sebi=articleDrafts.find(a=>a.id==='ab806c21');
 const html2=await (await worker.fetch(new Request(`https://thelegalchronicles.com${sebi.proposed_article_path}`),{})).text();
 assert.ok(html2.includes('Paragraph 20 allowed three months from receipt of the judgment to pay the reduced penalty if it had not already been paid.'));
});

test('local preview remains noindex and unpublished article paths are absent there too',async()=>{
 const a=articleDrafts[0];
 const response=await worker.fetch(new Request(`http://localhost:8792${a.proposed_article_path}`),{});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 for(const path of heldPaths)assert.equal((await worker.fetch(new Request(`http://localhost:8792${path}`),{})).status,404);
});
