import assert from "node:assert/strict";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function parseArguments(argv) {
  const options = {
    output: "data/scr-inventory.ndjson",
    checkpoint: "data/scr-inventory.checkpoint.json",
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") options.output = argv[++index];
    else if (argv[index] === "--checkpoint") options.checkpoint = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }

  return options;
}

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function readExisting(path) {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`Invalid JSON on ${path} line ${index + 1}: ${error.message}`);
        }
      });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function recordKey(record) {
  const lookup = record.source_lookup;
  return `source:${lookup.citation_year}:${lookup.path}:${lookup.neutral_key}`;
}

function validateRecord(record) {
  assert.ok(Number.isInteger(record.position) && record.position > 0);
  assert.ok(record.title_source);
  assert.ok(record.source_lookup);
  assert.ok(Number.isInteger(record.source_lookup.citation_year));
  assert.ok(record.source_lookup.path);
  assert.ok(record.source_lookup.neutral_key);
  assert.equal(typeof record.actions_listed?.split_view, "boolean");
  assert.equal(typeof record.actions_listed?.html_view, "boolean");
  assert.equal(typeof record.actions_listed?.flip_view, "boolean");
  assert.equal(typeof record.actions_listed?.pdf, "boolean");
  assert.ok(Array.isArray(record.languages));
}

const options = parseArguments(process.argv.slice(2));
const outputPath = resolve(options.output);
const checkpointPath = resolve(options.checkpoint);
const input = await readStandardInput();
assert.ok(input, "Expected a JSON array on stdin");

const incoming = JSON.parse(input);
assert.ok(Array.isArray(incoming) && incoming.length > 0, "Input must be a non-empty array");
incoming.forEach(validateRecord);

const existing = await readExisting(outputPath);
const records = new Map(existing.map((record) => [recordKey(record), record]));

for (const record of incoming) records.set(recordKey(record), record);

const merged = [...records.values()].sort(
  (left, right) => left.position - right.position || recordKey(left).localeCompare(recordKey(right)),
);

const duplicatePositions = [...new Set(
  merged
    .filter((record, index) => index > 0 && record.position === merged[index - 1].position)
    .map((record) => record.position),
)];
const positions = new Set(merged.map((record) => record.position));
const minPosition = Math.min(...positions);
const maxPosition = Math.max(...positions);
const missingPositions = [];
for (let position = minPosition; position <= maxPosition; position += 1) {
  if (!positions.has(position)) missingPositions.push(position);
}

await mkdir(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await writeFile(
  temporaryPath,
  `${merged.map((record) => JSON.stringify(record)).join("\n")}\n`,
  "utf8",
);
await rename(temporaryPath, outputPath);

const checkpoint = {
  source: "Supreme Court Reports (SCR)",
  updated_at: new Date().toISOString(),
  records_received: incoming.length,
  records_unique: merged.length,
  min_position: minPosition,
  max_position: maxPosition,
  missing_positions: missingPositions,
  duplicate_positions: duplicatePositions,
};
await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(
  `Imported ${incoming.length} records; ${merged.length} unique records staged ` +
    `(positions ${minPosition}-${maxPosition}).`,
);
if (missingPositions.length) console.log(`Missing positions: ${missingPositions.join(", ")}`);
if (duplicatePositions.length) console.log(`Duplicate positions: ${duplicatePositions.join(", ")}`);
