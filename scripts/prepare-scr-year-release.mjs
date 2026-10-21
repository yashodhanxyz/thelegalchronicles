import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractScrSourceDocument} from './lib/scr-source-document.mjs';
import {reconcileScrJudges} from './lib/scr-judge-reconciliation.mjs';
import {verifyScrRequiredSections} from './lib/scr-required-sections.mjs';
const directory='data/scr-body-corpus/2025',output=`${directory}/release-reviewed`;
const lines=b=>b.toString().trim().split('\n').filter(Boolean).map(JSON.parse);
const hash=b=>createHash('sha256').update(b).digest('hex');
const validation=JSON.parse(await readFile('audits/2026-10-21-2025-expansion/verification-2025.json','utf8'));
const bytes=await readFile(`${directory}/scr-body-captures-2025.ndjson`);
assert.equal(hash(bytes),validation.captures_sha256,'Captures changed since validation');
const metadata=lines(await readFile(`${directory}/release-staging/inventory.ndjson`));
const key=r=>[r.source_lookup.citation_year,r.source_lookup.path,r.source_lookup.neutral_key].join(':');
const byKey=new Map(metadata.map(r=>[key(r),r]));
const passed=new Map(validation.records.map(r=>[r.source_key,r]));
const normalize=s=>s.replace(/[^a-z]/giu,'').toUpperCase();
const registry=[...new Map(metadata.flatMap(r=>(r.coram_source||'').split(',').map(n=>n.replaceAll('*','').trim()).filter(Boolean)).map(n=>[normalize(n),n])).values()];
const records=[],withheld=[...validation.failures,...validation.uncaptured.map(r=>({...r,error:'No captured HTML; withheld'}))];
const hashes=new Set();
for(const cap of lines(bytes)){
 if(!passed.has(cap.source_key))continue;
 const record=byKey.get(cap.source_key),proof=passed.get(cap.source_key);
 assert.ok(record,'Missing staged listing metadata');
 assert.equal(hash(cap.network.responseText),proof.source_sha256);
 try{
  const source=extractScrSourceDocument(cap.network.responseText,cap.documentHtml,record.neutral_citation);
  const judgeReview=reconcileScrJudges({listingCoram:record.coram_source,documentHtml:source.documentHtml,benchRegistry:registry});
  const sections=verifyScrRequiredSections({documentHtml:source.documentHtml,record});
  records.push({source_key:cap.source_key,source_sha256:proof.source_sha256,render_sha256:proof.render_sha256,judge_review:judgeReview,sections,metadata:{...record,position:records.length+1,verified_judges:judgeReview.judges}});
  hashes.add(proof.source_sha256);hashes.add(proof.render_sha256);
 }catch(error){withheld.push({source_key:cap.source_key,error:error.message.split('\n')[0]});}
}
assert.equal(records.length+withheld.length,validation.inventory);
assert.equal(new Set([...records,...withheld].map(r=>r.source_key)).size,validation.inventory);
await mkdir(output,{recursive:true});
const staged=JSON.parse(await readFile(`${directory}/release-staging/manifest.json`,'utf8'));
const files=[];
for(const file of staged.files){
 const sql=(await readFile(file,'utf8')).split('\n').filter(line=>{const sha=line.match(/VALUES\('([a-f0-9]{64})'/u)?.[1];return sha&&hashes.has(sha);});
 if(!sql.length)continue;const path=`${output}/objects-${files.length}.sql`;await writeFile(path,sql.join('\n')+'\n');files.push(path);
}
const approved=new Set(records.map(r=>r.source_key));
const updates=(await readFile(staged.activation_file,'utf8')).trim().split('\n').filter(line=>{
 const path=line.match(/source_path='([^']+)'/u)?.[1],neutral=line.match(/source_neutral_key='([^']+)'/u)?.[1];return approved.has(`2025:${path}:${neutral}`);
});
assert.equal(updates.length,records.length);
const activation=`${output}/activate-validated.sql`;
await writeFile(activation,updates.join('\n')+'\n');
await writeFile(`${output}/inventory.ndjson`,records.map(r=>JSON.stringify(r.metadata)).join('\n')+'\n');
const review={year:2025,reviewed_at:new Date().toISOString(),candidates:records.length,withheld:withheld.length,publication_status:'not_published',records:records.map(({metadata,...r})=>r),exceptions:withheld};
await writeFile(`${output}/review.json`,JSON.stringify(review,null,2)+'\n');
const manifest={year:2025,records:records.length,withheld:withheld.length,files,activation_file:activation,objects:[...hashes].sort(),publication_status:'not_published',inventory_sha256:hash(await readFile(`${output}/inventory.ndjson`)),review_sha256:hash(await readFile(`${output}/review.json`))};
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const publication=records.map(record=>{
 const [,path,key]=record.source_key.split(':');
 return `UPDATE judgments SET content_status='published',updated_at=CURRENT_TIMESTAMP WHERE source_system='scr' AND source_citation_year=2025 AND source_path=${quote(path)} AND source_neutral_key=${quote(key)} AND content_status='validated' AND body_storage='d1' AND body_validation_version='scr-body-v1' AND body_source_sha256=${quote(record.source_sha256)} AND body_render_sha256=${quote(record.render_sha256)};`;
});
await writeFile(`${output}/publish-allowlist.sql.pending`,'-- Prepared for review only. Complete release checks or obtain explicit exceptions before applying.\n'+publication.join('\n')+'\n');

console.log(JSON.stringify({candidates:records.length,withheld:withheld.length,body_objects:hashes.size,files:files.length,output}));
