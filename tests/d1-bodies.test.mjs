import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../src/worker.js';

async function responseFor(mode='valid') {
  const blocks=mode==='filename-footnote'?[{type:'paragraph',className:'Judgement_L1',text:'Source note 1.',footnoteReferences:[{number:'1',targetId:'[2025]_1.html#footnote-001',backlinkId:'footnote-001-backlink',offset:12}]},{type:'footnotes',className:'Footnote',text:'1 Original footnote.',footnote:{number:'1',id:'[2025]_1.html#footnote-001',backlinkId:'[2025]_1.html#footnote-001-backlink'}}]:mode==='joint-paragraphs'?[{type:'paragraph',className:'Judgement_L1',paragraphMarker:'1.',text:'1. First opinion.'},{type:'paragraph',className:'Judgement_L1',paragraphMarker:'1.',text:'1. Separate opinion.'}]:mode==='empty'?[]:[{type:'paragraph',className:'Judgement_L1',text:'Original judgment — preserved.'}];
  const body=JSON.stringify({version:'scr-body-v1',neutralCitation:'2026 INSC 1',sourcePath:'2026_1_1_2',blocks,footnotes:[],...(mode==='metadata-correction'?{metadataCorrections:[{field:'neutral_citation',original_value:'bad <script>source</script>',corroborated_value:'2026 INSC 1',source_url:'javascript:alert(1)'}]}:{})});
  const bytes=Buffer.from(body), split=41;
  const rows=[bytes.subarray(0,split),bytes.subarray(split)].map((chunk,index)=>({byte_count:bytes.length,chunk_count:2,chunk_index:index,payload_base64:chunk.toString('base64')}));
  const record={slug:'d1-case',title_source:'Example v. State',neutral_citation:'2026 INSC 1',source_path:'2026_1_1_2',content_status:'validated',body_storage:'d1',body_render_sha256:createHash('sha256').update(body).digest('hex')};
  if(mode==='missing') rows.pop();
  if(mode==='altered') rows[0].payload_base64=Buffer.alloc(split,32).toString('base64');
  if(mode==='order') rows.reverse();
  if(mode==='identity') record.source_path='2026_1_3_4';
  const DB={prepare(){return {bind(){return this},all:async()=>{if(mode==='timeout')throw new Error('Storage request timed out');return {results:rows}}}},batch:async()=>[{results:[record]},{results:[]},{results:[]}]};
  return worker.fetch(new Request('http://localhost:8792/judgments/d1-case'),{DB,ASSETS:{fetch:async()=>new Response('asset')}});
}
test('D1 body chunks produce server-rendered original text with noindex',async()=>{
  const r=await responseFor();assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
  assert.match(await r.text(),/Original judgment — preserved\./);
});
for(const mode of ['missing','altered','order','identity','timeout','empty'])test(`D1 reader fails closed for ${mode} body`,async()=>{
  const r=await responseFor(mode);assert.equal(r.status,503);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.doesNotMatch(await r.text(),/Original judgment — preserved\./);
});

test('restarted paragraph numbering in separate opinions retains unique citation anchors',async()=>{
 const response=await responseFor('joint-paragraphs');const html=await response.text();
 assert.equal(response.status,200);assert.match(html,/id="karol-p-1"/);assert.match(html,/id="karol-p-1-2"/);
 assert.equal((html.match(/id="karol-p-1"/g)||[]).length,1);
});

test('SCR filename-prefixed footnotes return to the actual rendered reference',async()=>{
 const response=await responseFor('filename-footnote');const html=await response.text();assert.equal(response.status,200);
 assert.match(html,/href="#%5B2025%5D_1.html%23footnote-001"/);
 assert.match(html,/class="judgment-footnote-backlink" href="#footnote-001-backlink"/);
 assert.doesNotMatch(html,/href="#%5B2025%5D_1.html%23footnote-001-backlink"/);
});

test('metadata correction history is distinct from preserved text and cannot inject markup or active links',async()=>{
 const r=await responseFor('metadata-correction');const html=await r.text();assert.equal(r.status,200);assert.match(html,/Metadata verification/);assert.match(html,/bad &lt;script&gt;source&lt;\/script&gt;/);assert.doesNotMatch(html,/href="javascript:/);assert.match(html,/Original judgment — preserved/);
});
