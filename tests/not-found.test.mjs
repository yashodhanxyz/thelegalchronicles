import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
const origin='https://thelegalchronicles.com';
const assets={ASSETS:{fetch:async()=>new Response(null,{status:404})}};
function db(record){return {...assets,DB:{prepare(){return {bind(){return this;}};},batch:async()=>[{results:record?[record]:[]},{results:[]},{results:[]}]}};}
test('missing pages return semantic server-rendered 404 recovery without JavaScript',async()=>{
 const r=await worker.fetch(new Request(origin+'/courts/old-court/judgments/unknown?x=1'),assets);const h=await r.text();
 assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
 assert.match(h,/<h1>We couldn’t find this page/);assert.match(h,/<form action="\/judgments\/supreme-court\/2026" method="get" role="search" aria-label="Find a judgment"/);
 assert.match(h,/name="q"/);assert.match(h,/for="not-found-search"/);assert.match(h,/href="\/">Go to the homepage/);assert.match(h,/Skip to main content/);
 assert.doesNotMatch(h,/canonical" href="[^"]*\?/);
});
test('HEAD missing page has the same status and no body',async()=>{const r=await worker.fetch(new Request(origin+'/missing',{method:'HEAD'}),assets);assert.equal(r.status,404);assert.equal(await r.text(),'');assert.match(r.headers.get('content-type'),/text\/html/);});
test('missing API and image URLs do not become HTML recovery pages',async()=>{for(const path of ['/api/v1/missing','/missing.png']){const r=await worker.fetch(new Request(origin+path),assets);assert.equal(r.status,404);assert.equal(await r.text(),'');}});
test('unverified old court URLs are never redirected on a title match',async()=>{const r=await worker.fetch(new Request(origin+'/courts/orissa-high-court/judgments/subramani-vs-state-of-karnataka'),assets);assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);});
test('exact legacy slug redirects only for a published database record',async()=>{const rec={slug:'case-2026-insc-1-12345678',public_id:'12345678',decision_year:2026,content_status:'published'};for(const suffix of ['', '/split']){const r=await worker.fetch(new Request(origin+'/judgments/'+rec.slug+suffix),db(rec));assert.equal(r.status,308);assert.equal(r.headers.get('location'),origin+'/judgments/supreme-court/2026/case-12345678');}for(const rec of [null,{slug:'withheld',public_id:'12345678',decision_year:2026,content_status:'validated'}]){const r=await worker.fetch(new Request(origin+'/judgments/withheld/split'),db(rec));assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);}});

test('invalid encoded judgment address recovers with 404 instead of a server error',async()=>{const r=await worker.fetch(new Request(origin+'/judgments/%ZZ'),assets);assert.equal(r.status,404);assert.match(await r.text(),/Find a judgment/);});
test('missing HTML documents recover but upstream failures are not hidden',async()=>{const r=await worker.fetch(new Request(origin+'/old.html'),assets);assert.equal(r.status,404);assert.match(await r.text(),/Find a judgment/);const fail=await worker.fetch(new Request(origin+'/unknown'),{ASSETS:{fetch:async()=>new Response('Unavailable',{status:503})}});assert.equal(fail.status,503);});
