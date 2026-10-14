import assert from "node:assert/strict";
import test from "node:test";
import { extractScrSourceDocument } from "../scripts/lib/scr-source-document.mjs";
import { transformScrDocument } from "../scripts/lib/scr-body-transform.mjs";

const main = '<div id="_idContainer002"><p>Original judgment.</p></div>';
const note = '<div id="_idContainer003"><p>* Ed. Note: Pagination as per the original Judgment.</p></div>';
const response = (body) => JSON.stringify({ outputfile: `<html><head><style>p{color:black}</style></head><body>${body}</body></html>` });

test("includes sibling source notes omitted by first-container browser capture", () => {
  const source = extractScrSourceDocument(response(main + note), main);
  assert.equal(source.sourceContainerCount, 2);
  const render = transformScrDocument({ id: "sibling-note", neutralCitation: "2026 INSC 1", sourcePath: "2026_1_1_2", sourceNeutralKey: "2026INSC1", capturedAt: "2026-09-30T00:00:00Z", documentHtml: source.documentHtml });
  assert.deepEqual(render.renderDocument.blocks.map((block) => block.text), ["Original judgment.", "* Ed. Note: Pagination as per the original Judgment."]);
});

test("rejects visible source material outside recognized containers", () => {
  assert.throws(() => extractScrSourceDocument(response(main + "<p>Unmapped source paragraph.</p>"), main), /visible text outside/u);
});

test("rejects a captured document that differs from its raw response", () => {
  assert.throws(() => extractScrSourceDocument(response(main), main.replace("Original", "Changed")), /differs from the immutable/u);
});

test("does not duplicate nested source containers", () => {
  const source = extractScrSourceDocument(response('<div id="_idContainer000">' + main + '</div>'));
  assert.equal(source.sourceContainerCount, 1);
  assert.equal((source.documentHtml.match(/Original judgment/g) || []).length, 1);
});

test("rejects a different judgment even when capture metadata claims the expected identity", () => {
  const html = '<div id="_idContainer000"><p class="Citation">[2026] 7 S.C.R. 366 : 2026 INSC 655</p><p>Original judgment.</p></div>';
  assert.throws(() => extractScrSourceDocument(response(html), html, "2026 INSC 652"), /Source citation mismatch/u);
  assert.doesNotThrow(() => extractScrSourceDocument(response(html), html, "2026 INSC 655"));
  assert.throws(() => extractScrSourceDocument(response(html), html, "2026 INSC 65"), /Source citation mismatch/u);
});

test("recognizes the older DSCR citation class while preserving identity checks", () => {
  const html = '<div id="_idContainer000"><p class="DSCR-Citation ParaOverride-1">[2023] 12 S.C.R. 815 : <span class="Neutral-Citation">2023 INSC 879</span></p><p>Original judgment.</p></div>';
  assert.doesNotThrow(() => extractScrSourceDocument(response(html), html, "2023 INSC 879"));
  assert.throws(() => extractScrSourceDocument(response(html), html, "2023 INSC 878"), /Source citation mismatch/u);
  const missing = html.replace("2023 INSC 879", "");
  assert.throws(() => extractScrSourceDocument(response(missing), missing, "2023 INSC 879"), /observed missing/u);
});
