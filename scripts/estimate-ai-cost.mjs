import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inventoryPath = resolve(process.argv[2] || "data/scr-inventory.ndjson");
const totalJudgments = Number(process.env.TOTAL_JUDGMENTS || 38_598);
const v1Judgments = Number(process.env.V1_JUDGMENTS || 279);
const promptTokensPerJudgment = Number(process.env.PROMPT_TOKENS || 250);
const outputTokensPerJudgment = Number(process.env.OUTPUT_TOKENS || 150);
const tokensPerWord = Number(process.env.TOKENS_PER_WORD || 1.33);
const bodyWordsMin = Number(process.env.BODY_WORDS_MIN || 1_500);
const bodyWordsMax = Number(process.env.BODY_WORDS_MAX || 2_500);

const models = [
  { model: "gpt-5.6-luna", inputPerMillion: 0.2, outputPerMillion: 1.2 },
  { model: "gpt-5.6-terra", inputPerMillion: 2, outputPerMillion: 12 },
  { model: "gpt-5.6-sol", inputPerMillion: 4, outputPerMillion: 20 },
  { model: "gpt-6-astra", inputPerMillion: 10, outputPerMillion: 50 },
];

const text = await readFile(inventoryPath, "utf8");
const records = text.trim().split("\n").filter(Boolean).map(JSON.parse);
const metadataCharacters = records.reduce(
  (total, record) => total + JSON.stringify(record).length,
  0,
);
const measuredMetadataTokensPerJudgment = metadataCharacters / 4 / records.length;

function tokenScenario(judgments, contentTokensPerJudgment) {
  return {
    judgments,
    input_tokens: Math.round(
      judgments * (promptTokensPerJudgment + contentTokensPerJudgment),
    ),
    output_tokens: Math.round(judgments * outputTokensPerJudgment),
  };
}

function priceScenario(tokens, model) {
  const synchronous =
    (tokens.input_tokens / 1_000_000) * model.inputPerMillion +
    (tokens.output_tokens / 1_000_000) * model.outputPerMillion;
  return {
    synchronous_usd: Number(synchronous.toFixed(2)),
    batch_usd: Number((synchronous * 0.5).toFixed(2)),
  };
}

const scenarios = {
  metadata_all: tokenScenario(totalJudgments, measuredMetadataTokensPerJudgment),
  bodies_v1_min: tokenScenario(v1Judgments, bodyWordsMin * tokensPerWord),
  bodies_v1_max: tokenScenario(v1Judgments, bodyWordsMax * tokensPerWord),
  bodies_all_min: tokenScenario(totalJudgments, bodyWordsMin * tokensPerWord),
  bodies_all_max: tokenScenario(totalJudgments, bodyWordsMax * tokensPerWord),
};

console.log(JSON.stringify({
  assumptions: {
    pricing_checked_on: "2026-09-16",
    inventory_sample_records: records.length,
    measured_metadata_tokens_per_judgment: Number(
      measuredMetadataTokensPerJudgment.toFixed(1),
    ),
    prompt_tokens_per_judgment: promptTokensPerJudgment,
    output_tokens_per_judgment: outputTokensPerJudgment,
    tokens_per_body_word: tokensPerWord,
    body_words: [bodyWordsMin, bodyWordsMax],
    batch_discount: "50%",
  },
  scenarios: Object.fromEntries(
    Object.entries(scenarios).map(([name, tokens]) => [name, {
      ...tokens,
      prices: Object.fromEntries(
        models.map((model) => [model.model, priceScenario(tokens, model)]),
      ),
    }]),
  ),
}, null, 2));
