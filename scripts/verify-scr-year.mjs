import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractScrSourceDocument} from './lib/scr-source-document.mjs';
import {transformScrDocument} from './lib/scr-body-transform.mjs';
const year=Number(process.argv[2] || 2025);
assert.ok(Number.isInteger(year)&&year>=1900&&year<=2100);
const directory=`data/scr-body-corpus/${year}`;
const inventoryBytes=await readFile(`${directory}/scr-inventory-${year}.ndjson`);
const captureBytes=await readFile(`${directory}/scr-body-captures-${year}.ndjson`);
const lines=b=>b.toString().trim().split('\n').map(JSON.parse);
const inventory=lines(inventoryBytes),captures=lines(captureBytes);
const key=r=>`${r.citationYear}:${r.sourcePath}:${r.sourceNeutralKey}`;
const byKey=new Map(inventory.map(r=>[key(r),r]));
assert.equal(byKey.size,inventory.length,'Duplicate inventory identities');
assert.ok(inventory.every(r=>r.citationYear===year));
const seen=new Set(),passed=[],failures=[];
for(const capture of captures){
 const sourceKey=capture.source_key;
 assert.ok(!seen.has(sourceKey),'Duplicate capture identity');seen.add(sourceKey);
 const record=byKey.get(sourceKey);assert.ok(record,'Capture outside inventory');
 try{
  assert.equal(capture.network.status,200);
  assert.equal(new URL(capture.network.responseUrl || capture.network.url).origin,"https://scr.sci.gov.in");
  assert.equal(capture.record.neutralCitation,record.neutralCitation);
  assert.equal(key(capture.record),sourceKey);
  assert.ok(capture.captured_at&&!Number.isNaN(Date.parse(capture.captured_at)));
  const source=extractScrSourceDocument(capture.network.responseText,capture.documentHtml,record.neutralCitation);
  const result=transformScrDocument({id:sourceKey,neutralCitation:record.neutralCitation,sourcePath:record.sourcePath,sourceNeutralKey:record.sourceNeutralKey,capturedAt:capture.captured_at,documentHtml:source.documentHtml});
  passed.push({source_key:sourceKey,source_sha256:createHash('sha256').update(capture.network.responseText).digest('hex'),render_sha256:result.renderSha256,captured_at:capture.captured_at});
 }catch(error){failures.push({source_key:sourceKey,error:error.message.split("\n")[0]});}
}
const report={year,checked_at:new Date().toISOString(),inventory:inventory.length,captured:captures.length,passed:passed.length,failed:failures.length,uncaptured:inventory.filter(r=>!seen.has(key(r))).map(r=>({source_key:key(r),html_listed:r.htmlAvailable})),inventory_sha256:createHash('sha256').update(inventoryBytes).digest('hex'),captures_sha256:createHash('sha256').update(captureBytes).digest('hex'),publication_status:'not_published',coverage:'Collected SCR inventory; complete annual court coverage has not been established.',records:passed,failures};
const output=`audits/2026-10-21-2025-expansion/verification-${year}.json`;
await mkdir('audits/2026-10-21-2025-expansion',{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,inventory:report.inventory,captured:report.captured,passed:report.passed,failed:report.failed,uncaptured:report.uncaptured.length}));
