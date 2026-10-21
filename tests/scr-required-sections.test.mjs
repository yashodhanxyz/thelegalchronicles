import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyScrRequiredSections} from '../scripts/lib/scr-required-sections.mjs';
const record={scr_citation:'[2025] 1 S.C.R. 1',decision_date_source:'02-01-2025'};
const fixture=`<p class="Citation">[2025] 1 S.C.R. 1 : 2025 INSC 1</p><h1 class="Party-Name">Case A v. Case B</h1><p class="Date-of-Decision">2 January 2025</p><h1 class="Coram">[Judge One, J.]</h1><p class="Judgment_Heading">Judgment / Order of the Supreme Court</p><p class="Judgement_L1">1. The appeal is allowed for the following reasons.</p><p class="Result-of-the-Case">Result of the case: Appeal allowed.</p>`;
test('required source sections and decision date pass together',()=>assert.equal(verifyScrRequiredSections({documentHtml:fixture,record}).decision_date,'02-01-2025'));
test('a date disagreement is withheld',()=>assert.throws(()=>verifyScrRequiredSections({documentHtml:fixture,record:{...record,decision_date_source:'03-01-2025'}}),/Decision date differs/));
test('a missing final result is withheld',()=>assert.throws(()=>verifyScrRequiredSections({documentHtml:fixture.replace(/<p class="Result-of-the-Case">.*?<\/p>/u,''),record}),/Missing final/));
test('a missing judgment body is withheld',()=>assert.throws(()=>verifyScrRequiredSections({documentHtml:fixture.replace(/<p class="Judgement_L1">.*?<\/p>/u,''),record}),/Missing judgment reasoning/));
test('observed older SCR paragraph classes preserve visible title, date and result',()=>{
 const older=fixture.replace('class="Party-Name"','class="Apeal"').replace('class="Date-of-Decision"','class="Apeal"').replace('class="Result-of-the-Case"','class="Judgement"');assert.equal(verifyScrRequiredSections({documentHtml:older,record}).result_present,true);
});
test('a case number mislabeled as a date does not obscure the actual source date',()=>{
 const older=fixture.replace('<p class="Date-of-Decision">','<p class="Date-of-Decision">(Civil Appeal No. 1 of 2025)</p><p class="Date-of-Decision">');assert.equal(verifyScrRequiredSections({documentHtml:older,record}).decision_date,'02-01-2025');
});

test('a different SCR page sharing the same numeric prefix fails identity verification',()=>assert.throws(()=>verifyScrRequiredSections({documentHtml:fixture.replace('S.C.R. 1 :','S.C.R. 100 :'),record}),/SCR page citation differs/));
