import test from 'node:test';
import assert from 'node:assert/strict';
import {listingMetadata} from '../scripts/lib/scr-listing-metadata.mjs';
const fixture=coram=>`<button><strong>CASE A versus CASE B</strong><span class="escrText">[2025] 1 S.C.R. 1</span><span class="ncDisplay">2025 INSC 1</span></button><br>${coram}<br> Source preview &amp; preserved words.<br><strong class="caseDetailsTD"><span>Decision Date :</span><font>02-01-2025</font><span> | Case No :</span><font>CIVIL APPEAL No. 1/2025</font><span> | Bench :</span><font>2 Judges</font></strong>`;
test('listing metadata preserves actual judge order and explicit author marker',()=>{
 const r=listingMetadata(fixture('<strong>Coram : JUDGE B, JUDGE A<sup data-tooltip="Author">*</sup></strong>'));
 assert.equal(r.coram_source,'JUDGE B, JUDGE A*');
 assert.equal(r.result_excerpt_source,'Source preview & preserved words.');
 assert.equal(r.decision_date_source,'02-01-2025');
 assert.equal(r.case_number_source,'CIVIL APPEAL No. 1/2025');
 assert.equal(r.disposal_nature_source,null);
});
test('missing coram remains unknown without consuming the preview',()=>{
 const r=listingMetadata(fixture(''));
 assert.equal(r.coram_source,null);
 assert.equal(r.result_excerpt_source,'Source preview & preserved words.');
});
test('incomplete source markup is rejected',()=>assert.throws(()=>listingMetadata('<p>session expired</p>')));

test('translation modal controls cannot be mistaken for the judgment button',()=>{
 const r=listingMetadata('<div class="modal"><button aria-label="Close"></button></div>'+fixture('<strong>Coram : JUDGE A</strong>'));
 assert.equal(r.title_source,'CASE A versus CASE B');
 assert.equal(r.coram_source,'JUDGE A');
});
