import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const BODY_VALIDATION_VERSION = "scr-body-v1";

const inlineStyleBySourceClass = new Map([
  ["bold_Word", "strong"],
  ["Bold_Italic", "strong-emphasis"],
  ["Italic_words", "emphasis"],
  ["Italic_underline", "emphasis-underline"],
  ["Bold_underline", "strong-underline"],
  ["underline", "underline"],
]);

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, key) => {
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return named[key.toLowerCase()] ?? entity;
  });
}

export function visibleText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\b[^>]*>/giu, " ")
      .replace(/<[^>]*>/gu, ""),
  ).replace(/\s+/gu, " ").trim();
}

function parseAttribute(attributes, name) {
  const doubleQuoted = attributes.match(new RegExp(`\\b${name}="([^"]*)"`, "iu"))?.[1];
  if (doubleQuoted !== undefined) return decodeHtmlEntities(doubleQuoted);
  const singleQuoted = attributes.match(new RegExp(`\\b${name}='([^']*)'`, "iu"))?.[1];
  return singleQuoted === undefined ? null : decodeHtmlEntities(singleQuoted);
}

function sourceClass(attributes) {
  return (parseAttribute(attributes, "class") || "")
    .split(/\s+/u)
    .find((className) => className && !/^(?:Para|Char|Cell|Table)Override-/u.test(className)) || "";
}

function blockType(tagName, className) {
  if (tagName === "hr") return "rule";
  if (/Heading$/u.test(className) || /^h[1-6]$/u.test(tagName)) return "heading";
  if (/^Judgement-Q[1-3]$/u.test(className)) return "quote";
  if (className === "Footnote" || className === "_idFootnotes") return "footnotes";
  return "paragraph";
}

function extractInlineRanges(innerHtml, blockText, id) {
  const tokenPattern = /<[^>]+>|[^<]+/gu;
  const stack = [];
  const rawRanges = [];
  let rawText = "";
  let token;

  while ((token = tokenPattern.exec(innerHtml))) {
    const value = token[0];
    if (!value.startsWith("<")) {
      rawText += decodeHtmlEntities(value);
      continue;
    }
    if (/^<br\b/iu.test(value)) {
      rawText += " ";
      continue;
    }

    const closing = value.match(/^<\/(span|strong|b|em|i|u)>/iu);
    if (closing) {
      const entry = stack.pop();
      assert.equal(entry?.tag, closing[1].toLowerCase(), `${id} has unbalanced inline markup`);
      if (entry.kind && rawText.length > entry.start) {
        rawRanges.push({ kind: entry.kind, rawStart: entry.start, rawEnd: rawText.length });
      }
      continue;
    }

    const opening = value.match(/^<(span|strong|b|em|i|u)\b([^>]*)>/iu);
    if (!opening || /\/>$/u.test(value)) continue;
    const tag = opening[1].toLowerCase();
    const classes = (parseAttribute(opening[2], "class") || "").split(/\s+/u);
    const sourceClassName = classes.find((className) => inlineStyleBySourceClass.has(className));
    const nativeKind = tag === "strong" || tag === "b"
      ? "strong"
      : tag === "em" || tag === "i"
        ? "emphasis"
        : tag === "u"
          ? "underline"
          : null;
    stack.push({
      tag,
      kind: sourceClassName ? inlineStyleBySourceClass.get(sourceClassName) : nativeKind,
      start: rawText.length,
    });
  }

  assert.equal(stack.length, 0, `${id} has unclosed inline markup`);
  assert.equal(
    rawText.replace(/\s/gu, ""),
    blockText.replace(/\s/gu, ""),
    `${id} inline text changed during parsing`,
  );

  const blockCharacterIndexes = [];
  for (let index = 0; index < blockText.length; index += 1) {
    if (!/\s/u.test(blockText[index])) blockCharacterIndexes.push(index);
  }
  const ranges = rawRanges.map(({ kind, rawStart, rawEnd }) => {
    const compactStart = rawText.slice(0, rawStart).replace(/\s/gu, "").length;
    const compactEnd = rawText.slice(0, rawEnd).replace(/\s/gu, "").length;
    const start = blockCharacterIndexes[compactStart] ?? blockText.length;
    const end = compactEnd > compactStart
      ? (blockCharacterIndexes[compactEnd - 1] ?? blockText.length - 1) + 1
      : start;
    return { kind, start, end };
  }).filter((range) => range.end > range.start);

  const uniqueRanges = [...new Map(
    ranges.map((range) => [`${range.kind}:${range.start}:${range.end}`, range]),
  ).values()].sort((a, b) => a.start - b.start || b.end - a.end || a.kind.localeCompare(b.kind));
  for (let index = 0; index < uniqueRanges.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < uniqueRanges.length; otherIndex += 1) {
      const first = uniqueRanges[index];
      const second = uniqueRanges[otherIndex];
      if (second.start >= first.end) break;
      assert.ok(second.end <= first.end, `${id} has crossing inline ranges`);
    }
  }
  return uniqueRanges;
}

export function transformScrDocument({
  id,
  neutralCitation,
  sourcePath,
  sourceNeutralKey,
  capturedAt,
  documentHtml,
  recoverLegacyFootnotes = false,
}) {
  assert.match(documentHtml, /id=["']_idContainer\d+["']/u, `${id} has no SCR document root`);
  assert.ok(!documentHtml.includes("�"), `${id} contains a Unicode replacement character`);

  const localFootnoteFragment = href => {
    assert.equal(typeof href, 'string', `${id} has a missing footnote href`);
    assert.match(href, /^(?:[^/#:]+\.html)?#[A-Za-z0-9_-]+$/u, `${id} has a nonlocal footnote href`);
    const [file, fragment] = href.split('#');
    if (file) assert.equal((file.match(/\d+/gu) || []).join('_'), sourcePath, `${id} footnote points to another source document`);
    return fragment;
  };
  const elementPattern = /<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>|<hr\b([^>]*)\/?\s*>/giu;
  const blocks = [];
  let match;
  while ((match = elementPattern.exec(documentHtml))) {
    const tagName = (match[1] || "hr").toLowerCase();
    const attributes = match[2] || match[4] || "";
    const innerHtml = match[3] || "";
    const className = sourceClass(attributes);
    const text = visibleText(innerHtml);
    const type = blockType(tagName, className);
    if (type !== "rule" && !text) continue;

    const block = { type, className, text };
    const paragraphMarker = innerHtml.match(
      /<span\b[^>]*class=["'][^"']*_idGenBNMarker-[^"']*["'][^>]*>([\s\S]*?)<\/span>/iu,
    )?.[1];
    if (paragraphMarker) block.paragraphMarker = visibleText(paragraphMarker);

    const footnoteReferences = [];
    const referencePattern = /<a\b([^>]*class=["'][^"']*_idFootnoteLink[^"']*["'][^>]*)>([\s\S]*?)<\/a>/giu;
    let referenceMatch;
    while ((referenceMatch = referencePattern.exec(innerHtml))) {
      const number = visibleText(referenceMatch[2]);
      const href = parseAttribute(referenceMatch[1], "href");
      const targetId = recoverLegacyFootnotes ? localFootnoteFragment(href) : href?.replace(/^#/u, "");
      const backlinkId = parseAttribute(referenceMatch[1], "id")
        || (recoverLegacyFootnotes && targetId ? `${targetId}-backlink` : null);
      // Preserve a collapsed trailing space before the reference. Trimming the
      // prefix alone shifts references following whitespace one character left.
      const offset = visibleText(`${innerHtml.slice(0, referenceMatch.index)}X`).length - 1;
      assert.equal(text.slice(offset, offset + number.length), number, `${id} footnote offset mismatch`);
      assert.ok(targetId && backlinkId, `${id} has an incomplete footnote reference`);
      footnoteReferences.push({ number, targetId, backlinkId, offset });
    }
    if (footnoteReferences.length) block.footnoteReferences = footnoteReferences;

    const footnoteAnchor = innerHtml.match(
      /<a\b([^>]*class=["'][^"']*_idFootnoteAnchor[^"']*["'][^>]*)>([\s\S]*?)<\/a>/iu,
    );
    if (footnoteAnchor) {
      const number = visibleText(footnoteAnchor[2]);
      const href = parseAttribute(footnoteAnchor[1], "href");
      const backlinkId = recoverLegacyFootnotes ? localFootnoteFragment(href) : href?.replace(/^#/u, "");
      const footnoteId = backlinkId?.replace(/-backlink$/u, "");
      assert.ok(footnoteId && backlinkId, `${id} has an incomplete footnote`);
      assert.ok(text.startsWith(number), `${id} footnote number mismatch`);
      block.footnote = { number, id: footnoteId, backlinkId };
    }

    const inlineRanges = extractInlineRanges(innerHtml, text, id);
    if (inlineRanges.length) block.inlineRanges = inlineRanges;
    blocks.push(block);
  }

  assert.ok(blocks.length > 0, `${id} produced no visible blocks`);
  const unparsedVisibleText = visibleText(
    documentHtml
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
      .replace(/<(p|h[1-6])\b[^>]*>[\s\S]*?<\/\1>|<hr\b[^>]*\/?\s*>/giu, ""),
  );
  assert.equal(unparsedVisibleText, "", `${id} contains visible text outside supported blocks`);
  const sourceVisibleText = [...documentHtml.matchAll(
    /<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/giu,
  )].map((sourceMatch) => visibleText(sourceMatch[2])).filter(Boolean).join("\n");
  const renderVisibleText = blocks.filter((block) => block.type !== "rule").map((block) => block.text).join("\n");
  assert.equal(
    sourceVisibleText.replace(/\s/gu, ""),
    renderVisibleText.replace(/\s/gu, ""),
    `${id} source/render text mismatch`,
  );

  const referenceTargets = new Set(blocks.flatMap(
    (block) => (block.footnoteReferences || []).map((reference) => reference.targetId),
  ));
  const footnoteIds = new Set(blocks.flatMap((block) => block.footnote ? [block.footnote.id] : []));
  for (const targetId of referenceTargets) {
    assert.ok(footnoteIds.has(targetId), `${id} footnote target ${targetId} is missing`);
  }

  if (recoverLegacyFootnotes) {
    const references = blocks.flatMap(block => block.footnoteReferences || []);
    const notes = blocks.flatMap(block => block.footnote ? [block.footnote] : []);
    assert.equal(new Set(references.map(ref => ref.backlinkId)).size, references.length, `${id} has ambiguous footnote backlinks`);
    assert.equal(new Set(notes.map(note => note.id)).size, notes.length, `${id} has ambiguous footnote targets`);
    for (const ref of references) {
      const note = notes.find(note => note.id === ref.targetId);
      assert.ok(note && note.number === ref.number, `${id} has mismatched footnote numbering`);
    }
  }

  const renderDocument = {
    version: BODY_VALIDATION_VERSION,
    id,
    neutralCitation,
    sourcePath,
    sourceNeutralKey,
    capturedAt,
    blockSha256: sha256(JSON.stringify(blocks)),
    characterCount: sourceVisibleText.length,
    wordCount: sourceVisibleText.split(/\s+/u).filter(Boolean).length,
    blocks,
  };
  const renderJson = `${JSON.stringify(renderDocument)}\n`;
  return {
    renderDocument,
    renderJson,
    renderSha256: sha256(renderJson),
    renderBytes: Buffer.byteLength(renderJson, "utf8"),
    sourceTextSha256: sha256(sourceVisibleText),
    blockCount: blocks.length,
    footnoteReferenceCount: [...referenceTargets].length,
    footnoteCount: footnoteIds.size,
  };
}
