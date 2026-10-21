import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import worker from '../src/worker.js';
const path=process.argv[2];assert.ok(path?.startsWith('/private/tmp/'),'Pass a disposable publication-simulation database in /private/tmp');
const database=new DatabaseSync(path,{readOnly:true});
const DB={prepare(sql){let bindings=[];return {bind(...values){bindings=values;return this;},async all(){return {results:database.prepare(sql).all(...bindings)};},async first(){return database.prepare(sql).get(...bindings)||null;}};},async batch(statements){return Promise.all(statements.map(s=>s.all()));}};
const env={DB,ASSETS:{fetch:async()=>new Response('Not found',{status:404})}};
const review=JSON.parse(await readFile('data/scr-body-corpus/2025/recovery-reviewed/review.json','utf8'));
const original=JSON.parse(await readFile('data/scr-body-corpus/2025/release-reviewed/review.json','utf8'));
const proofs=review.records.filter(r=>r.status==='recovered_candidate');
const rows=proofs.map(proof=>{const [,path,key]=proof.source_key.split(':');const row=database.prepare('SELECT * FROM judgments WHERE source_citation_year=2025 AND source_path=? AND source_neutral_key=?').get(path,key);assert.equal(row.content_status,'validated');assert.equal(row.body_source_sha256,proof.source_sha256);assert.equal(row.body_render_sha256,proof.render_sha256);return row;});assert.equal(rows.length,review.recovered);
const inventory=(await readFile('data/scr-body-corpus/2025/recovery-reviewed/inventory.ndjson','utf8')).trim().split('\n').map(JSON.parse);
for(const row of rows){const expected=inventory.find(r=>r.source_lookup.path===row.source_path&&r.source_lookup.neutral_key===row.source_neutral_key).verified_judges;const actual=database.prepare('SELECT d.name_source,jj.source_position,jj.is_author FROM judgment_judges jj JOIN judges d ON d.id=jj.judge_id WHERE jj.judgment_id=? ORDER BY jj.source_position').all(row.id);assert.deepEqual(actual.map(j=>[j.name_source.toUpperCase().replace(/[^A-Z0-9]+/gu,' ').trim(),j.source_position,j.is_author]),expected.map(j=>[j.name_source.toUpperCase().replace(/[^A-Z0-9]+/gu,' ').trim(),j.source_position,j.is_author]));}

const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const compact=value=>value.replace(/\s/gu,'');
const failures=[];let checked=0,links=0;
for(const row of rows){
 const name=row.slug.replace(/-[a-z0-9]{8}$/u,'').replace(/-\d{4}-insc-\d+$/u,'');
 const url=`http://localhost:8788/judgments/supreme-court/2025/${name}-${row.public_id}`;
 try{
  const response=await worker.fetch(new Request(url),env);assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),'noindex, follow');
  const html=await response.text(),tree=parse(html),ids=new Set(),references=[];let reading;
  function visit(n){
   const attrs=Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
   if(attrs.id){assert.ok(!ids.has(attrs.id),`Duplicate anchor ${attrs.id}`);ids.add(attrs.id);}
   if(n.tagName==='a'&&attrs.href?.startsWith('#')&&attrs.href.length>1)references.push(decodeURIComponent(attrs.href.slice(1)));
   if(n.tagName==='section'&&(attrs.class||'').split(' ').includes('judgment-reading'))reading=n;
   for(const child of n.childNodes||[])visit(child);
  }
  visit(tree);assert.ok(reading);for(const target of references)assert.ok(ids.has(target),`Missing anchor target ${target}`);links+=references.length;
  const chunks=database.prepare('SELECT payload_base64 FROM judgment_body_chunks WHERE document_sha256=? ORDER BY chunk_index').all(row.body_render_sha256);
  const document=JSON.parse(Buffer.concat(chunks.map(c=>Buffer.from(c.payload_base64,'base64'))).toString());
  assert.equal(compact(text(reading)),compact(document.blocks.filter(b=>b.type!=='rule').map(b=>b.text).join('')),'Rendered legal text differs');
  assert.ok(html.includes('Bench order and authorship follow the preserved SCR judgment text.'));
  assert.ok(html.includes('SCR text retrieved'));
  assert.ok(html.includes(`href="/judgments/supreme-court/2025">Back to judgments`));
  assert.ok(html.includes('Validated text · Not yet published'));
  const publicResponse=await worker.fetch(new Request(url.replace('http://localhost:8788','https://thelegalchronicles.com')),env);assert.equal(publicResponse.status,404);
  checked++;
 }catch(error){failures.push({public_id:row.public_id,error:error.message});}
}
console.log(JSON.stringify({phase:'readers',checked,failed:failures.length,examples:failures.slice(0,5)}));
for(const exception of original.exceptions){
 const id=createHash('sha256').update(exception.source_key).digest('hex').slice(0,8);
 const response=await worker.fetch(new Request(`https://thelegalchronicles.com/judgments/supreme-court/2025/withheld-${id}`),env);
 assert.equal(response.status,404,'A withheld record is publicly accessible');assert.match(response.headers.get('x-robots-tag'),/noindex/u);
}
const archive=await worker.fetch(new Request('https://thelegalchronicles.com/judgments/supreme-court/2025'),env);const archiveHtml=await archive.text();assert.equal(archive.status,200);assert.ok(archiveHtml.includes(`${930} judgments`));
const filtered=await worker.fetch(new Request('https://thelegalchronicles.com/judgments/supreme-court/2025?q=zzzznomatch'),env);assert.equal(filtered.status,200);assert.match(await filtered.text(),/No judgments found/u);assert.match(filtered.headers.get('x-robots-tag'),/noindex/u);
const api=await worker.fetch(new Request('https://thelegalchronicles.com/api/v1/judgments?year=2025'),env);assert.equal(api.status,200);assert.equal((await api.json()).pagination.total,930);
const filters=await worker.fetch(new Request('https://thelegalchronicles.com/api/v1/filters'),env);assert.equal(filters.status,200);const filterData=await filters.json();assert.equal(filterData.data.years.find(r=>r.year===2025).records,930);
const map=await worker.fetch(new Request('https://thelegalchronicles.com/sitemaps/judgments-2025.xml'),env);const xml=await map.text();assert.equal((xml.match(/<loc>https:\/\/thelegalchronicles.com\/judgments\/supreme-court\/2025\//gu)||[]).length,930);
const report={simulation_only:true,production_changed:false,candidates:review.recovered,pages_checked:checked,withheld_404_checks:original.exceptions.length,fragment_links_verified:links,failures,checks:['private noindex preview HTML and public 404','source-derived text equality','unique paragraph/footnote anchors','all fragment targets exist','year navigation','retrieval date','judge attribution provenance','archive count','empty filtered state','API and filter counts','sitemap release count']};
await writeFile('data/scr-body-corpus/2025/recovery-reviewed/reader-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,failures:report.failures.slice(0,5),failure_count:report.failures.length,checks:report.checks.length}));assert.equal(failures.length,0,'Some candidate readers failed');
