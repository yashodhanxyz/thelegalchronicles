import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {authorProfile,correctionsEmail} from '../src/data/publication.js';
const paths=['/authors/yashodhan-deshmukh','/editorial-policy','/corrections'];
test('publication information is available only for local, non-indexable review',async()=>{
 for(const path of paths) {
  const response=await worker.fetch(new Request('http://localhost:8792'+path),{});
  const html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.ok(graph['@graph'].some(e=>e['@type']==='BreadcrumbList'));
  for(const host of ['thelegalchronicles.com','preview.example.com']) {const blocked=await worker.fetch(new Request('https://'+host+path),{});assert.equal(blocked.status,404);assert.equal(blocked.headers.get('x-robots-tag'),'noindex, nofollow');}
  const head=await worker.fetch(new Request('http://localhost:8792'+path,{method:'HEAD'}),{});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }
});
test('author bio and structured data reflect only the supplied biography',async()=>{
 const html=await(await worker.fetch(new Request('http://localhost:8792'+paths[0]),{})).text();assert.ok(html.includes(authorProfile.bio));
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);const person=graph['@graph'].find(e=>e['@type']==='Person');assert.equal(person.description,authorProfile.bio);assert.equal(person.jobTitle,undefined);assert.equal(person.hasCredential,undefined);
});
test('corrections contact is never invented and policy does not certify draft review',async()=>{
 const html=await(await worker.fetch(new Request('http://localhost:8792/corrections'),{})).text();if(correctionsEmail)assert.ok(html.includes('href="mailto:'+correctionsEmail+'"'));else assert.ok(!html.includes('mailto:'));
 const policy=await(await worker.fetch(new Request('http://localhost:8792/editorial-policy'),{})).text();assert.ok(policy.includes('proposed standards'));assert.ok(policy.includes('still under review'));assert.ok(!policy.includes('datePublished'));
});
