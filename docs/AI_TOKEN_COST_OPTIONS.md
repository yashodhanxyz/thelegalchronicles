# AI Token and Collection Cost Options

Pricing checked against official OpenAI documentation on 2026-09-16. Re-run
the estimator with updated prices before purchasing a large production batch.

## Recommendation

1. Collect, validate, normalise, and load SCR metadata deterministically. This
   consumes no AI API tokens.
2. Derive decision year, case type, bench size, judge names, citations, Acts,
   sections, source keywords, and source categories with parsers wherever the
   source provides them. This also consumes no AI API tokens.
3. Use AI only for fields that require interpretation, such as a controlled
   taxonomy classification or a source-grounded summary.
4. Evaluate 100 representative judgments with GPT-5.6 Luna and GPT-5.6 Terra.
   If Luna meets the agreed legal-quality threshold, use it for the bulk run;
   route only low-confidence or failed records to Terra.
5. Use the Batch API for non-urgent enrichment. Official documentation states
   that Batch has a 50% cost discount and a completion window of up to 24 hours.

## Current listed API prices

| Model | Input / 1M tokens | Output / 1M tokens | Suggested role |
| --- | ---: | ---: | --- |
| GPT-5.6 Luna | $0.20 | $1.20 | First-pass high-volume classification |
| GPT-5.6 Terra | $2.00 | $12.00 | Escalation and quality comparison |
| GPT-5.6 Sol | $4.00 | $20.00 | Difficult exceptions only |
| GPT-6 Astra | $10.00 | $50.00 | Not justified for routine bulk tagging |

Sources: [OpenAI model catalog](https://developers.openai.com/api/docs/models)
and [OpenAI Batch API](https://developers.openai.com/api/docs/guides/batch).

## Estimator assumptions

`scripts/estimate-ai-cost.mjs` measures the staged metadata instead of using a
made-up average. For judgment bodies, its defaults are:

- 1,500–2,500 words per judgment;
- 1.33 input tokens per word;
- 250 instruction/schema tokens per request; and
- 150 structured-output tokens per judgment.

These are planning estimates, not invoices. Actual token counts depend on the
final prompt, tokenizer, document markup, and output schema.

Run:

```sh
npm run ai:estimate
```

Override assumptions without editing the script, for example:

```sh
OUTPUT_TOKENS=100 PROMPT_TOKENS=180 npm run ai:estimate
```
