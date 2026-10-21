import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseFragment} from 'parse5';
import {listingMetadata} from './lib/scr-listing-metadata.mjs';
import {extractScrSourceDocument} from './lib/scr-source-document.mjs';
import {transformScrDocument,BODY_VALIDATION_VERSION} from './lib/scr-body-transform.mjs';
const year=Number(process.argv[2]||2025);
assert.equal(year,2025,'This staging entrypoint is scoped to the reviewed 2025 collection');
const report=JSON.parse(await readFile(`audits/2026-10-21-2025-expansion/verification-${year}.json`,'utf8'));
const directory=`data/scr-body-corpus/${year}`;
const bytes=await readFile(`${directory}/scr-body-captures-${year}.ndjson`);
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes),report.captures_sha256,'Captures changed; rerun verification');
const metadataPath=process.argv[3];
assert.ok(metadataPath,'Pass the original archive metadata NDJSON as the second argument');
const metadata= (await readFile(metadataPath,'utf8')).trim().split('\n').map(JSON.parse);
const key=r=>[r.source_lookup.citation_year,r.source_lookup.path,r.source_lookup.neutral_key].join(':');
const byKey=new Map(metadata.map(r=>[key(r),r]));
const passed=new Map(report.records.map(r=>[r.source_key,r]));
const output=`${directory}/release-staging`;
await mkdir(output,{recursive:true});
const quote=v=>v===null?'NULL':`'${String(v).replaceAll("'","''")}'`;
const files=[],updates=[],normalized=[],metadataDifferences=[];let statements=[],size=0;
async function flush(){if(!statements.length)return;const path=`${output}/objects-${files.length}.sql`;await writeFile(path,statements.join('\n')+'\n');files.push(path);statements=[];size=0;}
function text(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');}
const compact=s=>String(s).replace(/\s+/gu,'').toUpperCase();
for(const capture of bytes.toString().trim().split('\n').map(JSON.parse)){
 if(!passed.has(capture.source_key))continue;
 const prior=byKey.get(capture.source_key);assert.ok(prior,'Missing metadata');
 const r={...prior,...listingMetadata(capture.record.listingHtml)};
 const listing=compact(text(parseFragment(capture.record.listingHtml)));
 for(const field of ['title_source','neutral_citation','scr_citation','decision_date_source','case_number_source','bench_size_source'])assert.ok(listing.includes(compact(r[field])),`Listing metadata mismatch ${capture.source_key}: ${field}`);
 assert.equal(compact(r.title_source),compact(capture.record.title));
 if(Object.keys(r).some(field=>typeof r[field]==='string'&&typeof prior[field]==='string'&&compact(r[field])!==compact(prior[field])))metadataDifferences.push({source_key:capture.source_key,fields:Object.keys(r).filter(field=>typeof r[field]==='string'&&typeof prior[field]==='string'&&compact(r[field])!==compact(prior[field]))});
 const source=extractScrSourceDocument(capture.network.responseText,capture.documentHtml,r.neutral_citation);
 const transformed=transformScrDocument({id:capture.source_key,neutralCitation:r.neutral_citation,sourcePath:r.source_lookup.path,sourceNeutralKey:r.source_lookup.neutral_key,capturedAt:capture.captured_at,documentHtml:source.documentHtml});
 // Render ids are kept consistent with the existing reader's immutable source tuple.
 const sourceHash=hash(capture.network.responseText),renderHash=transformed.renderSha256;
 assert.equal(renderHash,passed.get(capture.source_key).render_sha256);
 assert.equal(sourceHash,passed.get(capture.source_key).source_sha256);
 for(const [kind,content] of [['source',capture.network.responseText],['render',transformed.renderJson]]){
  const b=Buffer.from(content),sha=hash(b),count=Math.ceil(b.length/24000);
  const sql=[`INSERT OR IGNORE INTO judgment_body_documents(sha256,kind,byte_count,chunk_count) VALUES(${quote(sha)},${quote(kind)},${b.length},${count});`];
  for(let i=0;i<count;i++)sql.push(`INSERT OR IGNORE INTO judgment_body_chunks(document_sha256,chunk_index,payload_base64) VALUES(${quote(sha)},${i},${quote(b.subarray(i*24000,(i+1)*24000).toString('base64'))});`);
  const length=sql.reduce((n,s)=>n+Buffer.byteLength(s),0);if(size+length>4000000)await flush();statements.push(...sql);size+=length;
 }
 normalized.push({...r,position:normalized.length+1});
 updates.push(`UPDATE judgments SET body_storage='d1',body_source_sha256=${quote(sourceHash)},body_render_sha256=${quote(renderHash)},body_source_bytes=${Buffer.byteLength(capture.network.responseText)},body_render_bytes=${transformed.renderBytes},body_word_count=${transformed.renderDocument.wordCount},body_captured_at=${quote(capture.captured_at)},body_validated_at=CURRENT_TIMESTAMP,body_validation_version=${quote(BODY_VALIDATION_VERSION)},content_status='validated',updated_at=CURRENT_TIMESTAMP WHERE source_system='scr' AND source_citation_year=${year} AND source_path=${quote(r.source_lookup.path)} AND source_neutral_key=${quote(r.source_lookup.neutral_key)} AND content_status IN ('metadata_only','captured','validated');`);
}
await flush();assert.equal(normalized.length,report.passed);
await writeFile(`${output}/metadata-differences.json`,JSON.stringify(metadataDifferences,null,2)+'\n');
await writeFile(`${output}/inventory.ndjson`,normalized.map(r=>JSON.stringify(r)).join('\n')+'\n');
await writeFile(`${output}/activate-validated.sql`,updates.join('\n')+'\n');
await writeFile(`${output}/manifest.json`,JSON.stringify({year,records:normalized.length,files,activation_file:`${output}/activate-validated.sql`,publication_status:'not_published',captured_at_range:report.records.map(r=>r.captured_at).sort().filter((_,i,a)=>i===0||i===a.length-1)},null,2)+'\n');
console.log(JSON.stringify({records:normalized.length,files:files.length,output,publication_status:'not_published'}));
