import test from 'node:test';
import assert from 'node:assert/strict';
import {displayCaseTitle} from '../src/display-title.js';
test('list presentation retains initials, acronyms and source punctuation',()=>{
 assert.equal(displayCaseTitle('J. SRI NISHA versus CBI & ORS.'),'J. Sri Nisha versus CBI & Ors.');
 assert.equal(displayCaseTitle('T.K.A. PADMANABHAN versus THE STATE OF ASSAM'),'T.K.A. Padmanabhan versus the State of Assam');
 assert.equal(displayCaseTitle('McDonald versus SEBI'),'McDonald versus SEBI');
});
