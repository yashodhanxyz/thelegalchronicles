import assert from 'node:assert/strict';
import {parse} from 'parse5';
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const compact=s=>s.replace(/\s/gu,'');
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const datePattern=/^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/u;
export function verifyScrRequiredSections({documentHtml,record}){
 const nodes=[];
 function walk(n){if(['p','h1','h2','h3','h4','h5','h6'].includes(n.tagName))nodes.push({classes:(n.attrs?.find(a=>a.name==='class')?.value||'').split(/\s/u),text:text(n).trim()});for(const child of n.childNodes||[])walk(child);}
 walk(parse(documentHtml));
 const coram=nodes.findIndex(n=>n.classes.includes('Coram'));
 for(const name of ['Coram','Judgment_Heading'])assert.ok(nodes.some(n=>n.classes.includes(name)&&n.text),`Missing ${name}`);
 const header=nodes.slice(0,coram);
 // Older SCR documents sometimes put a party title/date under Apeal, or the
 // final explicit result under Judgement. Read the visible source content;
 // never alter that markup or invent a missing section.
 assert.ok(header.some(n=>n.classes.includes('Party-Name')||/\s+v\.\s+/u.test(n.text)),'Missing party title');
 const citation=nodes.find(n=>n.classes.some(c=>['Citation','DSCR-Citation'].includes(c)));
 assert.ok(citation&&(compact(citation.text)===compact(record.scr_citation)||compact(citation.text).startsWith(compact(record.scr_citation)+':')),'SCR page citation differs');
 const heading=nodes.findIndex(n=>n.classes.includes('Judgment_Heading'));
 const result=nodes.findIndex((n,i)=>i>heading&&(n.classes.some(c=>c.startsWith('Result-of-the-Case'))||/^Result of the case\s*:/iu.test(n.text)));
 assert.ok(result>heading,'Missing final result section');
 assert.ok(nodes.slice(heading+1,result).some(n=>n.classes.some(c=>c.startsWith('Judgement'))&&n.text),'Missing judgment reasoning/order text');
 const dates=header.filter(n=>datePattern.test(n.text));
 assert.equal(dates.length,1,'Expected one explicit decision date in original SCR header');
 const date=dates[0].text.match(datePattern);
 const parsed=`${date[1].padStart(2,'0')}-${String(months.indexOf(date[2])+1).padStart(2,'0')}-${date[3]}`;
 assert.equal(parsed,record.decision_date_source,'Decision date differs between listing and original SCR text');
 return {decision_date:parsed,sections:nodes.filter(n=>n.classes.some(c=>/Heading$/u.test(c))).map(n=>n.text),result_present:true,judgment_present:true};
}
