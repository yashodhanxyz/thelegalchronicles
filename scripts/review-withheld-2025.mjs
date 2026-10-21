import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {extractScrSourceDocument} from './lib/scr-source-document.mjs';
import {transformScrDocument} from './lib/scr-body-transform.mjs';
import {listingMetadata} from './lib/scr-listing-metadata.mjs';
import {reconcileScrJudges} from './lib/scr-judge-reconciliation.mjs';
import {verifyScrRequiredSections} from './lib/scr-required-sections.mjs';
const dir='data/scr-body-corpus/2025',out=`${dir}/recovery-reviewed`;
const hash=b=>createHash('sha256').update(b).digest('hex');
const lines=b=>b.toString().trim().split('\n').map(JSON.parse);
const bytes=await readFile(`${dir}/scr-body-captures-2025.ndjson`);
const baseline=JSON.parse(await readFile('audits/2026-10-21-2025-expansion/verification-2025.json','utf8'));
assert.equal(hash(bytes),baseline.captures_sha256,'Original captures changed');
const releaseBytes=await readFile(`${dir}/release-reviewed/review.json`);
const released=JSON.parse(releaseBytes);
assert.equal(released.exceptions.length,134);
const caps=lines(bytes),byKey=new Map(caps.map(c=>[c.source_key,c]));
const original=lines(await readFile(process.argv[2]||'/Users/yashodhan/Downloads/scr-inventory-complete-38598.ndjson'));
const key=r=>[r.source_lookup.citation_year,r.source_lookup.path,r.source_lookup.neutral_key].join(':');
const prior=new Map(original.filter(r=>r.source_lookup.citation_year===2025).map(r=>[key(r),r]));
const registry=[...new Set(caps.flatMap(c=>(listingMetadata(c.record.listingHtml).coram_source||'').split(',').map(n=>n.replaceAll('*','').trim()).filter(Boolean)))];
const text=n=>['script','style','template','title'].includes(n.tagName)?'':n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const compact=s=>s.replace(/\s/gu,'');
await mkdir(out,{recursive:true});await mkdir(`${out}/render`,{recursive:true});
let correctionEvidence=[];
try{correctionEvidence=JSON.parse(await readFile(`${out}/metadata-correction-evidence.json`,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const correction of correctionEvidence){
 assert.equal(correction.header_reviewed,true);
 assert.ok(['neutral_citation','decision_date','judge_spelling'].includes(correction.field));
 assert.ok(/^evidence\/[a-z0-9-]+\.pdf$/u.test(correction.pdf_file));
 assert.equal(hash(await readFile(`${out}/${correction.pdf_file}`)),correction.pdf_sha256,'Corroborating PDF bytes changed');
 assert.ok(['https://api.sci.gov.in','https://scr.sci.gov.in'].includes(new URL(correction.source_url).origin));
}
const candidates=[],results=[];
for(const exception of released.exceptions){
 const cap=byKey.get(exception.source_key);
 if(!cap){results.push({...exception,status:'source_required',current_error:'No original English HTML capture; historic recheck returned outputfile:false'});continue;}
 try{
  assert.equal(cap.network.status,200);assert.equal(new URL(cap.network.responseUrl||cap.network.url).origin,'https://scr.sci.gov.in');
  assert.equal(`${cap.record.citationYear}:${cap.record.sourcePath}:${cap.record.sourceNeutralKey}`,cap.source_key);
  assert.ok(!Number.isNaN(Date.parse(cap.captured_at)));
  const old=prior.get(cap.source_key);assert.ok(old,'Missing retained inventory metadata');
  const metadata={...old,...listingMetadata(cap.record.listingHtml)};
  const corrections=correctionEvidence.filter(e=>e.source_key===cap.source_key);
  for(const correction of corrections){
   if(correction.field==='judge_spelling')continue;
   const field=correction.field==='decision_date'?'decision_date_source':'neutral_citation';
   assert.equal(metadata[field],correction.original_value);
   metadata[field]=correction.corroborated_value;
  }
  assert.equal(compact(metadata.title_source),compact(cap.record.title));
  const source=extractScrSourceDocument(cap.network.responseText,cap.documentHtml,metadata.neutral_citation);
  const transformed=transformScrDocument({id:cap.source_key,neutralCitation:metadata.neutral_citation,sourcePath:cap.record.sourcePath,sourceNeutralKey:cap.record.sourceNeutralKey,capturedAt:cap.captured_at,documentHtml:source.documentHtml,recoverLegacyFootnotes:true});
  assert.equal(compact(text(parse(source.documentHtml))),compact(transformed.renderDocument.blocks.filter(b=>b.type!=='rule').map(b=>b.text).join('')),'Independent DOM/source text differs');
  const sections=verifyScrRequiredSections({documentHtml:source.documentHtml,record:metadata});
  const judges=reconcileScrJudges({listingCoram:metadata.coram_source,documentHtml:source.documentHtml,benchRegistry:registry,recoverDocumentedDattaSpelling:true,externalDattaEvidence:corrections.find(e=>e.field==='judge_spelling')?{...corrections.find(e=>e.field==='judge_spelling'),document_sha256:hash(source.documentHtml)}:null});
  const publicId=hash(cap.source_key).slice(0,8);
  const renderJson=corrections.length?JSON.stringify({...transformed.renderDocument,metadataCorrections:corrections})+'\n':transformed.renderJson;
  await writeFile(`${out}/render/${publicId}.json`,renderJson);
  candidates.push({...metadata,position:candidates.length+1,verified_judges:judges.judges});
  results.push({...exception,status:'recovered_candidate',source_sha256:hash(cap.network.responseText),render_sha256:hash(renderJson),metadata_corrections:corrections,captured_at:cap.captured_at,public_id:publicId,footnotes:transformed.footnoteCount,judge_review:judges,sections,publication_status:'unpublished'});
 }catch(error){results.push({...exception,status:'still_withheld',current_error:error.message.split('\n')[0]});}
}
// The default parser and all released artifacts must remain byte-identical.
for(const proof of released.records){const cap=byKey.get(proof.source_key);const source=extractScrSourceDocument(cap.network.responseText,cap.documentHtml,cap.record.neutralCitation);const result=transformScrDocument({id:cap.source_key,neutralCitation:cap.record.neutralCitation,sourcePath:cap.record.sourcePath,sourceNeutralKey:cap.record.sourceNeutralKey,capturedAt:cap.captured_at,documentHtml:source.documentHtml});assert.equal(result.renderSha256,proof.render_sha256);assert.equal(hash(cap.network.responseText),proof.source_sha256);}
assert.equal(results.length,134);assert.equal(new Set(results.map(r=>r.source_key)).size,134);
const report={reviewed_at:new Date().toISOString(),publication_status:'unpublished',production_changed:false,reviewed:134,recovered:candidates.length,remaining:134-candidates.length,published_930_render_hashes_unchanged:true,captures_sha256:hash(bytes),released_review_sha256:hash(releaseBytes),records:results};
await writeFile(`${out}/inventory.ndjson`,candidates.map(r=>JSON.stringify(r)).join('\n')+'\n');
await writeFile(`${out}/review.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,records:results.filter(r=>r.status==='still_withheld').map(r=>({source_key:r.source_key,error:r.current_error}))},null,2));
