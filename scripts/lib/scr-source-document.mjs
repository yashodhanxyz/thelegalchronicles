import assert from "node:assert/strict";
import { parse, serializeOuter } from "parse5";

function text(node) {
  if (["script", "style", "template", "title"].includes(node.tagName)) return "";
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes || []).map(text).join("");
}
const compact = (value) => value.replace(/\s/gu, "");

// The browser checkpoint retained only the first container. Derive all legal
// containers from the immutable response, including sibling pagination notes.
export function extractScrSourceDocument(responseText, capturedDocumentHtml, expectedCitation, citationAliases = []) {
  const response = JSON.parse(responseText);
  assert.notEqual(response.session_expire, "Y", "Source session expired");
  assert.notEqual(response.status, false, "Source request failed");
  assert.equal(typeof response.outputfile, "string", "Missing source HTML");
  const document = parse(response.outputfile);
  const roots = [];
  const readingRegions = [];
  let body;
  function visit(node, insideRoot = false) {
    if (node.tagName === "body") body = node;
    const id = node.attrs?.find((attr) => attr.name === "id")?.value;
    const isRoot = /^_idContainer\d+$/u.test(id || "");
    const classes = node.attrs?.find((attr) => attr.name === "class")?.value || "";
    if (classes.split(/\s/u).includes("right-content")) readingRegions.push(node);
    if (isRoot && !insideRoot) roots.push(node);
    for (const child of node.childNodes || []) visit(child, insideRoot || isRoot);
  }
  visit(document);
  assert.ok(body && roots.length, "Missing SCR document roots");
  // Split View wraps the legal document in right-content and includes a
  // separate navigation column. Only that known reading region is compared.
  const sourceText = (readingRegions.length ? readingRegions : [body]).map(text).join("");
  assert.equal(compact(sourceText), compact(roots.map(text).join("")), "Source has visible text outside the SCR containers");
  if (capturedDocumentHtml !== undefined) {
    const captured = parse(capturedDocumentHtml);
    const capturedText = compact(text(captured));
    assert.ok(
      capturedText === compact(text(roots[0])) || capturedText === compact(roots.map(text).join("")),
      "Browser document differs from the immutable source response",
    );
  }
  const documentHtml = roots.map(serializeOuter).join("\n");
  assert.ok(!documentHtml.includes("�"), "Source has replacement characters");
  if (expectedCitation) {
    let citation;
    function findCitation(node) {
      const classes = node.attrs?.find((attr) => attr.name === "class")?.value || "";
      if (!citation && classes.split(/\s/u).some((value) => ["Citation", "DSCR-Citation"].includes(value))) citation = text(node);
      for (const child of node.childNodes || []) findCitation(child);
    }
    roots.forEach(findCitation);
    const observed = citation?.match(/\b\d{4}\s*INSC\s*\d+\b/iu)?.[0]?.replace(/\s/gu, "").toUpperCase();
    const accepted = [expectedCitation, ...citationAliases].map((value) => value.replace(/\s/gu, "").toUpperCase());
    assert.ok(observed && accepted.includes(observed), `Source citation mismatch: expected ${expectedCitation}, observed ${observed || "missing"}`);
  }
  return { documentHtml, sourceContainerCount: roots.length };
}
