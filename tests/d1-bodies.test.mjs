import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../src/worker.js';

async function responseFor(mode='valid') {
  const body=JSON.stringify({version:'scr-body-v1',neutralCitation:'2026 INSC 1',sourcePath:'2026_1_1_2',blocks:[{type:'paragraph',className:'Judgement_L1',text:'Original judgment — preserved.'}],footnotes:[]});
  const bytes=Buffer.from(body), split=41;
  const rows=[bytes.subarray(0,split),bytes.subarray(split)].map((chunk,index)=>({byte_count:bytes.length,chunk_count:2,chunk_index:index,payload_base64:chunk.toString('base64')}));
  const record={slug:'d1-case',title_source:'Example v. State',neutral_citation:'2026 INSC 1',source_path:'2026_1_1_2',content_status:'validated',body_storage:'d1',body_render_sha256:createHash('sha256').update(body).digest('hex')};
  if(mode==='missing') rows.pop();
  if(mode==='altered') rows[0].payload_base64=Buffer.alloc(split,32).toString('base64');
  if(mode==='order') rows.reverse();
  if(mode==='identity') record.source_path='2026_1_3_4';
  const DB={prepare(){return {bind(){return this},all:async()=>({results:rows})}},batch:async()=>[{results:[record]},{results:[]},{results:[]}]};
  return worker.fetch(new Request('http://localhost:8792/judgments/d1-case'),{DB,ASSETS:{fetch:async()=>new Response('asset')}});
}
test('D1 body chunks produce server-rendered original text with noindex',async()=>{
  const r=await responseFor();assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
  assert.match(await r.text(),/Original judgment — preserved\./);
});
for(const mode of ['missing','altered','order','identity'])test(`D1 reader fails closed for ${mode} body`,async()=>{
  const r=await responseFor(mode);assert.equal(r.status,503);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.doesNotMatch(await r.text(),/Original judgment — preserved\./);
});
