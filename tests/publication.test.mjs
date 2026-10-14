import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {authorProfile,correctionsEmail} from '../src/data/publication.js';
import {articleDrafts} from '../src/data/article-drafts.generated.js';
const paths=['/authors/yashodhan-deshmukh','/editorial-policy','/corrections'];
test('publication information is public, indexable, and server rendered',async()=>{
 for(const path of paths){
  const response=await worker.fetch(new Request('https://thelegalchronicles.com'+path),{});
  const html=await response.text();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-robots-tag'),'index, follow');
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(graph['@graph'].some(e=>e['@type']==='BreadcrumbList'));
  const head=await worker.fetch(new Request('https://thelegalchronicles.com'+path,{method:'HEAD'}),{});
  assert.equal(head.status,200);assert.equal(await head.text(),'');
 }
});
test('author bio and structured data reflect only the supplied biography and released articles',async()=>{
 const html=await(await worker.fetch(new Request('https://thelegalchronicles.com'+paths[0]),{})).text();
 assert.ok(html.includes(authorProfile.bio));assert.ok(html.includes('17 explainers are published'));
 for(const article of articleDrafts)assert.ok(html.includes(article.proposed_article_path));
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 const person=graph['@graph'].find(e=>e['@type']==='Person');
 assert.equal(person.description,authorProfile.bio);assert.equal(person.jobTitle,undefined);assert.equal(person.hasCredential,undefined);
});
test('corrections contact and public policy match the work actually being done',async()=>{
 const html=await(await worker.fetch(new Request('https://thelegalchronicles.com/corrections'),{})).text();
 if(correctionsEmail)assert.ok(html.includes('href="mailto:'+correctionsEmail+'"'));else assert.ok(!html.includes('mailto:'));
 const policy=await(await worker.fetch(new Request('https://thelegalchronicles.com/editorial-policy'),{})).text();
 assert.ok(policy.includes('have not undergone independent human legal review'));
 assert.ok(policy.includes('Separate review or curative proceedings'));
 assert.ok(!policy.includes('proposed standards'));
});
