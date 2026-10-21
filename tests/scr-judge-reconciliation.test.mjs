import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileScrJudges} from '../scripts/lib/scr-judge-reconciliation.mjs';
const source=(coram,author='')=>`<h1 class="Coram">${coram}</h1>${author?`<p class="Author-Name">${author}</p>`:''}`;
test('original author markers resolve conflicting listing order and authorship',()=>{
 const r=reconcileScrJudges({listingCoram:'MANOJ MISRA, SANJAY KAROL*',documentHtml:source('[Sanjay Karol and Manoj Misra,* JJ.]','Manoj Misra, J.')});
 assert.deepEqual(r.judges.map(j=>[j.name_source,j.is_author]),[['SANJAY KAROL',null],['MANOJ MISRA',1]]);assert.equal(r.listingDisagrees,true);
});
test('no marker in original means authorship not stated, even if listing guessed it',()=>{
 const r=reconcileScrJudges({listingCoram:'JUDGE ONE*, JUDGE TWO',documentHtml:source('[Judge One and Judge Two, JJ.]')});assert.ok(r.judges.every(j=>j.is_author===null));assert.equal(r.authorshipStatus,'not_stated_in_original_scr_text');
});
test('explicit joint author headings and markers preserve both authors',()=>{
 const r=reconcileScrJudges({listingCoram:'SANJAY KAROL*, N KOTISWAR SINGH*',documentHtml:source('[Sanjay Karol* and Nongmeikapam Kotiswar Singh,* JJ.]','Sanjay Karol and Nongmeikapam Kotiswar Singh, JJ.')});assert.ok(r.judges.every(j=>j.is_author===1));
});
test('surname heading is corroborated by an explicit Coram author marker',()=>{
 const r=reconcileScrJudges({listingCoram:'VIKRAM NATH, SANDEEP MEHTA*',documentHtml:source('[Vikram Nath and Sandeep Mehta,* JJ.]','Mehta, J.')});assert.equal(r.judges[1].is_author,1);
});
test('surname without a corroborating author marker is withheld',()=>assert.throws(()=>reconcileScrJudges({listingCoram:'VIKRAM NATH, SANDEEP MEHTA',documentHtml:source('[Vikram Nath and Sandeep Mehta, JJ.]','Mehta, J.')}),/Unresolved author/));
test('a bench member explicitly present in the original is recovered from the known registry',()=>{
 const r=reconcileScrJudges({listingCoram:'VIKRAM NATH, SANDEEP MEHTA*',benchRegistry:['VIKRAM NATH','SANJAY KAROL','SANDEEP MEHTA'],documentHtml:source('[Vikram Nath, Sanjay Karol and Sandeep Mehta,* JJ.]')});assert.equal(r.judges.length,3);assert.equal(r.judges[1].name_source,'SANJAY KAROL');
});
test('conflicting original author evidence fails closed',()=>assert.throws(()=>reconcileScrJudges({listingCoram:'MANOJ MISRA, SANJAY KAROL',documentHtml:source('[Sanjay Karol* and Manoj Misra, JJ.]','Manoj Misra, J.')}),/disagree/));
test('unapproved spelling variants do not fabricate a judge relationship',()=>assert.throws(()=>reconcileScrJudges({listingCoram:'DIPANKAR DATTA, MANMOHAN',documentHtml:source('[Dipankar Dutta* and Manmohan, JJ.]')}),/Unidentified/));
test('CJI-positioned source author marker is recognized',()=>{
 const r=reconcileScrJudges({listingCoram:'BHUSHAN RAMKRISHNA GAVAI, SANJAY KUMAR',documentHtml:source('[B.R. Gavai, CJI* and Sanjay Kumar, J.]')});assert.equal(r.judges[0].is_author,1);
});
