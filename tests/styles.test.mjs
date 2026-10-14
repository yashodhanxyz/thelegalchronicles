import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheet = await readFile(new URL("../coming-soon/catalog.css", import.meta.url), "utf8");

test("forced-colour mode keeps reading surfaces and controls distinguishable", () => {
  assert.match(stylesheet, /@media \(forced-colors: active\)/u);
  assert.match(stylesheet, /--paper: Canvas;/u);
  assert.match(stylesheet, /--ink: CanvasText;/u);
  assert.match(stylesheet, /--accent: LinkText;/u);
  assert.match(stylesheet, /outline-color: Highlight;/u);
  assert.match(stylesheet, /border-color: ButtonText;/u);
  assert.doesNotMatch(stylesheet, /forced-color-adjust:\s*none/u);
});
