import assert from 'node:assert/strict';
import {parseFragment} from 'parse5';
function text(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');}
function findNode(node,predicate){if(predicate(node))return node;for(const child of node.childNodes||[]){const found=findNode(child,predicate);if(found)return found;}}
const classes=n=>(n.attrs?.find(a=>a.name==='class')?.value||'').split(/\s+/u);
export function listingMetadata(html){
 const tree=parseFragment(html);
 const details=findNode(tree,n=>classes(n).includes('caseDetailsTD'));
 const coram=findNode(tree,n=>n.tagName==='strong'&&/^\s*Coram\s*:/u.test(text(n)));
 const button=findNode(tree,n=>n.tagName==='button'&&findNode(n,child=>classes(child).includes('escrText')));
 assert.ok(details&&button,'Missing SCR listing fields');
 const title=findNode(button,n=>n.tagName==='strong');
 const scr=findNode(button,n=>classes(n).includes('escrText'));
 const neutral=findNode(button,n=>classes(n).includes('ncDisplay'));
 const facts={};
 let label;
 for(const n of details.childNodes||[]){
  if(n.tagName==='span')label=text(n).replace(/[|:]/gu,'').trim();
  else if(n.tagName==='font'&&label){facts[label]=text(n).trim();label=undefined;}
 }
 const siblings=details.parentNode.childNodes;
 const begin=siblings.indexOf(coram||button),end=siblings.indexOf(details);
 assert.ok(begin>=0&&end>begin);
 const excerpt=siblings.slice(begin+1,end).map(text).join('').trim();
 return {title_source:text(title).trim(),scr_citation:text(scr).trim(),neutral_citation:text(neutral).trim(),coram_source:coram?text(coram).replace(/^\s*Coram\s*:\s*/u,'').trim():null,result_excerpt_source:excerpt,decision_date_source:facts['Decision Date'],case_number_source:facts['Case No'],disposal_nature_source:facts['Disposal Nature']||null,bench_size_source:facts['Bench']};
}
