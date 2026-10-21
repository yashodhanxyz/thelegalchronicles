import assert from 'node:assert/strict';
import {parse} from 'parse5';
const normalize=value=>String(value).normalize('NFKD').replace(/[^a-z]/giu,'').toUpperCase();
// Explicit forms observed in the retained SCR Coram and corresponding listing.
// These aliases affect relationships only; original text and source names stay intact.
const nameAliases={
 NKOTISWARSINGH:['NONGMEIKAPAMKOTISWARSINGH'],
 VIPULMANUBHAIPANCHOLI:['VIPULMPANCHOLI'],
 SARASAVENKATANARAYANABHATTI:['SVNBHATTI'],
 BHUSHANRAMKRISHNAGAVAI:['BRGAVAI'],
 ATULSCHANDURKAR:['ASCHANDURKAR','ATULSHARADCHANDURKAR'],
 PRASANNABHALACHANDRAVARALE:['PRASANNABVARALE'],
 KVINODCHANDRAN:['KRISHNANVINODCHANDRAN'],
};
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
export function reconcileScrJudges({listingCoram,documentHtml,benchRegistry=[]}){
 const corams=[],authors=[];
 function visit(n){const classes=(n.attrs?.find(a=>a.name==='class')?.value||'').split(/\s+/u);if(classes.includes('Coram'))corams.push(text(n).trim());if(classes.includes('Author-Name'))authors.push(text(n).trim());for(const child of n.childNodes||[])visit(child);}
 visit(parse(documentHtml));
 assert.equal(corams.length,1,'Expected one original SCR Coram');
 const listed=(listingCoram||'').split(',').filter(Boolean).map(name=>({nameSource:name.replaceAll('*','').trim(),listingAuthor:name.includes('*')}));
 assert.ok(listed.every(j=>j.nameSource),'Invalid listing bench');
 const candidates=benchRegistry.length?benchRegistry.map(name=>({nameSource:name,listingAuthor:listed.some(j=>normalize(j.nameSource)===normalize(name)&&j.listingAuthor)})):listed;
 const body=normalize(corams[0]);
 const found=candidates.flatMap(j=>{
  const canonical=normalize(j.nameSource),variants=[canonical,...(nameAliases[canonical]||[])];
  const matches=variants.map(v=>({variant:v,index:body.indexOf(v)})).filter(x=>x.index>=0);
  if(!matches.length)return [];
  assert.equal(matches.length,1,`Ambiguous Coram identity: ${j.nameSource}`);
  return [{...j,...matches[0],canonical}];
 }).sort((a,b)=>a.index-b.index);
 assert.ok(found.length,'No original SCR bench members resolved');
 let remainder=body;
 for(const j of found){assert.equal(remainder.split(j.variant).length,2,'Repeated or overlapping Coram identity');remainder=remainder.replace(j.variant,'');}
 assert.equal(remainder.replace(/CJI|JJ|CJ|AND|J/gu,''),'','Unidentified text in original Coram');
 const compactCoram=corams[0].normalize('NFKD').replace(/[^a-z*]/giu,'').toUpperCase();
 const bodyAuthor=new Set();
 for(const j of found){
  const end=compactCoram.indexOf(j.variant)+j.variant.length;
  // SCR places the star immediately after a name or after its CJI title.
  if(/^\*|^CJI\*/u.test(compactCoram.slice(end)))bodyAuthor.add(j.canonical);
 }
 const authorHeadings=new Set();
 for(const value of authors){
  const parts=value.replace(/,?\s*(?:CJI|CJ|JJ?|C\.J\.I\.)\.?\s*$/iu,'').split(/\s+(?:and|&)\s+/iu);
  for(const part of parts){
   const normalized=normalize(part);
   const matches=found.filter(j=>[j.canonical,...(nameAliases[j.canonical]||[])].some(v=>v===normalized)
     || (bodyAuthor.has(j.canonical)&&normalize(j.nameSource.split(/\s+/u).at(-1))===normalized));
   assert.equal(matches.length,1,`Unresolved author heading: ${value}`);authorHeadings.add(matches[0].canonical);
  }
 }
 if(bodyAuthor.size&&authorHeadings.size)assert.deepEqual([...bodyAuthor].sort(),[...authorHeadings].sort(),'Original Coram and author headings disagree');
 const verifiedAuthors=authorHeadings.size?authorHeadings:bodyAuthor;
 return {sourceCoram:corams[0],authorHeadings:authors,authorshipStatus:verifiedAuthors.size?'identified_in_original_scr_text':'not_stated_in_original_scr_text',judges:found.map((j,index)=>({name_source:j.nameSource,source_position:index+1,is_author:verifiedAuthors.has(j.canonical)?1:null})),listingDisagrees:found.length!==listed.length||found.some((j,index)=>normalize(listed[index]?.nameSource)!==j.canonical||j.listingAuthor!==verifiedAuthors.has(j.canonical))};
}
