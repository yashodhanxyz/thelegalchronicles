import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BODY_VALIDATION_VERSION,
  transformScrDocument,
  visibleText,
} from "../scripts/lib/scr-body-transform.mjs";

const captureDirectory = new URL("../pilot/source/scr-2026-live-capture/", import.meta.url);
let manifest;
try {
  manifest = JSON.parse(await readFile(new URL("manifest.json", captureDirectory), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  manifest = {records: []};
}

test("visible text decodes entities and normalizes source spacing", () => {
  assert.equal(visibleText("A&nbsp;&amp;<br> B"), "A & B");
});

test("preserves references after whitespace and variable SCR root IDs", () => {
  const result = transformScrDocument({
    id: "spacing-root-regression", neutralCitation: "2026 INSC 1",
    sourcePath: "2026_1_1_2", sourceNeutralKey: "2026INSC1",
    capturedAt: "2026-09-30T00:00:00.000Z",
    documentHtml: '<div id="_idContainer001"><p>Source text <a class="_idFootnoteLink" id="footnote-001-backlink" href="#footnote-001">1</a> continues.</p><p class="Footnote"><a class="_idFootnoteAnchor" href="#footnote-001-backlink">1</a> Source note.</p></div>',
  });
  const paragraph = result.renderDocument.blocks[0];
  const reference = paragraph.footnoteReferences[0];
  assert.equal(paragraph.text, "Source text 1 continues.");
  assert.equal(paragraph.text.slice(reference.offset, reference.offset + reference.number.length), "1");
  assert.equal(result.footnoteCount, 1);
});

if (manifest.records.length === 0) {
  test("private SCR capture integration fixtures are available", {skip: "capture manifest is intentionally absent from this checkout"}, () => {});
}
for (const capture of manifest.records) {
  test(`transforms ${capture.neutral_citation} without losing visible source text`, async () => {
    const documentHtml = await readFile(new URL(capture.html_file, captureDirectory), "utf8");
    const transformed = transformScrDocument({
      id: capture.id,
      neutralCitation: capture.neutral_citation,
      sourcePath: capture.source_path,
      sourceNeutralKey: capture.source_neutral_key,
      capturedAt: capture.captured_at,
      documentHtml,
    });

    assert.equal(transformed.renderDocument.version, BODY_VALIDATION_VERSION);
    assert.ok(transformed.blockCount > 0);
    assert.ok(transformed.renderDocument.wordCount > 0);
    assert.match(transformed.renderSha256, /^[a-f0-9]{64}$/u);
    assert.ok(!transformed.renderJson.includes("�"));
    assert.ok(transformed.renderDocument.blocks.some(
      (block) => block.className === "Judgment_Heading",
    ));
    assert.ok(transformed.renderDocument.blocks.some(
      (block) => block.className.startsWith("Result-of-the-Case"),
    ));
  });
}

test("rejects captures without the official document root", () => {
  assert.throws(() => transformScrDocument({
    id: "invalid",
    neutralCitation: "2026 INSC 1",
    sourcePath: "invalid",
    sourceNeutralKey: "2026INSC1",
    capturedAt: "2026-09-23T00:00:00.000Z",
    documentHtml: "<div><p>Not a judgment root</p></div>",
  }), /no SCR document root/u);
});

test("rejects Unicode replacement characters", () => {
  assert.throws(() => transformScrDocument({
    id: "invalid-unicode",
    neutralCitation: "2026 INSC 1",
    sourcePath: "invalid",
    sourceNeutralKey: "2026INSC1",
    capturedAt: "2026-09-23T00:00:00.000Z",
    documentHtml: '<div id="_idContainer000"><p class="Judgement_L1">Bad � text</p></div>',
  }), /replacement character/u);
});

const legacyOptions = (href='[2025]_5_S.C.R._275-330.html#footnote-001') => ({
 id:'legacy-recovery',neutralCitation:'2025 INSC 555',sourcePath:'2025_5_275_330',sourceNeutralKey:'2025INSC555',capturedAt:'2026-09-30T00:00:00Z',recoverLegacyFootnotes:true,
 documentHtml:`<div id="_idContainer000"><p>Source <a class="_idFootnoteLink" href="${href}">1</a>.</p><p class="Footnote"><a class="_idFootnoteAnchor" href="[2025]_5_S.C.R._275-330.html#footnote-001-backlink">1</a> Original note.</p></div>`,
});
test('opt-in recovery reconstructs navigation from matching local source footnotes without changing text',()=>{
 const result=transformScrDocument(legacyOptions());assert.equal(result.renderDocument.blocks[0].text,'Source 1.');assert.equal(result.renderDocument.blocks[1].text,'1 Original note.');assert.equal(result.renderDocument.blocks[0].footnoteReferences[0].backlinkId,'footnote-001-backlink');
 assert.throws(()=>transformScrDocument({...legacyOptions(),recoverLegacyFootnotes:false}),/incomplete footnote reference/);
});
test('legacy recovery rejects external and other-document footnote links',()=>{
 assert.throws(()=>transformScrDocument(legacyOptions('https://example.com/a.html#footnote-001')),/nonlocal/);
 assert.throws(()=>transformScrDocument(legacyOptions('[2025]_5_S.C.R._331-340.html#footnote-001')),/another source/);
});
test('legacy recovery rejects duplicate references and mismatched source note numbers',()=>{
 const options=legacyOptions();assert.throws(()=>transformScrDocument({...options,documentHtml:options.documentHtml.replace('Source <a','Source <a class="_idFootnoteLink" href="#footnote-001">1</a><a')}),/ambiguous footnote backlinks/);
 assert.throws(()=>transformScrDocument({...options,documentHtml:options.documentHtml.replace('>1</a> Original note','>2</a> Original note')}),/mismatched footnote numbering/);
});
