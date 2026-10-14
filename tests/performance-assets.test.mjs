import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {articleImages} from '../src/data/article-images.generated.js';

test('immutable artwork URLs match file contents and support mobile reading widths',async()=>{
 for(const image of Object.values(articleImages)) {
  assert.ok(image.variants.some(v=>v.width===640),'A mobile reading image must not jump straight from 480 to 960 pixels');
  assert.ok(image.variants.some(v=>v.width<=240),'Small thumbnails need a small source');
  for(const variant of image.variants) {
   const bytes=await readFile(new URL('../coming-soon'+variant.src,import.meta.url));
   const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
   assert.ok(variant.src.endsWith(`-${hash}.webp`));
   assert.equal(bytes.length,variant.bytes);
  }
 }
});
