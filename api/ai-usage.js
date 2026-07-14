'use strict';

// Gemini Developer API standard paid-tier prices, in USD per 1M tokens.
// Source checked 2026-07-14: https://ai.google.dev/gemini-api/docs/pricing
const DEFAULT_MODEL_PRICING = Object.freeze({
  'gemini-3.1-flash-lite': Object.freeze({
    inputUsdPerMillion: 0.25,
    outputUsdPerMillion: 1.50,
    searchUsdPerGroundedPrompt: 0.014
  }),
  'gemini-2.5-flash': Object.freeze({
    inputUsdPerMillion: 0.30,
    outputUsdPerMillion: 2.50,
    searchUsdPerGroundedPrompt: 0.035
  }),
  'gemini-3.5-flash': Object.freeze({
    inputUsdPerMillion: 1.50,
    outputUsdPerMillion: 9.00,
    searchUsdPerGroundedPrompt: 0.014
  })
});

// A deliberately explicit operational estimate, not a live FX quote.
// Override in production when a different accounting rate is preferred.
const DEFAULT_USD_TO_EUR_RATE = 0.92;
// Marginal price after the Gemini 2.5 Flash daily free allowance.
const DEFAULT_SEARCH_USD_PER_GROUNDED_PROMPT = 0.035;

function readNumber(value, fallback, { allowZero = true } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  const minimumAccepted = allowZero ? 0 : Number.MIN_VALUE;
  return Number.isFinite(parsed) && parsed >= minimumAccepted ? parsed : fallback;
}

function readTokenCount(metadata, camelCaseKey, snakeCaseKey) {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata[camelCaseKey] ?? metadata[snakeCaseKey];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function roundMoney(value) {
  return Number(value.toFixed(8));
}

function resolvePricing(model, env = process.env) {
  const defaults = DEFAULT_MODEL_PRICING[model] || {};
  return {
    inputUsdPerMillion: readNumber(
      env.GEMINI_INPUT_PRICE_USD_PER_1M,
      defaults.inputUsdPerMillion ?? null
    ),
    outputUsdPerMillion: readNumber(
      env.GEMINI_OUTPUT_PRICE_USD_PER_1M,
      defaults.outputUsdPerMillion ?? null
    ),
    usdToEurRate: readNumber(
      env.GEMINI_USD_TO_EUR_RATE,
      DEFAULT_USD_TO_EUR_RATE,
      { allowZero: false }
    ),
    searchUsdPerGroundedPrompt: readNumber(
      env.GEMINI_SEARCH_PRICE_USD_PER_REQUEST,
      defaults.searchUsdPerGroundedPrompt ?? DEFAULT_SEARCH_USD_PER_GROUNDED_PROMPT
    )
  };
}

function calculateUsage({ usageMetadata, model, operation, durationMs, groundingRequestCount = 0, env = process.env }) {
  const promptTokens = readTokenCount(usageMetadata, 'promptTokenCount', 'prompt_token_count');
  const outputTokens = readTokenCount(usageMetadata, 'candidatesTokenCount', 'candidates_token_count');
  const thinkingTokens = readTokenCount(usageMetadata, 'thoughtsTokenCount', 'thoughts_token_count') ?? 0;
  const toolUsePromptTokens = readTokenCount(
    usageMetadata,
    'toolUsePromptTokenCount',
    'tool_use_prompt_token_count'
  ) ?? 0;
  const reportedTotalTokens = readTokenCount(usageMetadata, 'totalTokenCount', 'total_token_count');
  const totalTokens = reportedTotalTokens ?? (
    promptTokens !== null && outputTokens !== null
      ? promptTokens + outputTokens + thinkingTokens + toolUsePromptTokens
      : null
  );

  // Google prices generated thinking tokens at the output-token rate.
  const billableInputTokens = promptTokens === null ? null : promptTokens + toolUsePromptTokens;
  const billableOutputTokens = outputTokens === null ? null : outputTokens + thinkingTokens;
  const pricing = resolvePricing(model, env);
  const canEstimate = billableInputTokens !== null
    && billableOutputTokens !== null
    && pricing.inputUsdPerMillion !== null
    && pricing.outputUsdPerMillion !== null;
  const tokenCostUsd = canEstimate
    ? (
      (billableInputTokens * pricing.inputUsdPerMillion
        + billableOutputTokens * pricing.outputUsdPerMillion) / 1_000_000
    )
    : null;
  const groundingRequests = Math.max(0, Math.trunc(Number(groundingRequestCount) || 0));
  const groundingCostUsd = groundingRequests * pricing.searchUsdPerGroundedPrompt;
  const estimatedCostUsd = tokenCostUsd === null ? null : roundMoney(tokenCostUsd + groundingCostUsd);
  const estimatedCostEur = estimatedCostUsd === null
    ? null
    : roundMoney(estimatedCostUsd * pricing.usdToEurRate);

  return {
    operation,
    model,
    promptTokens,
    outputTokens,
    thinkingTokens,
    totalTokens,
    groundingRequests,
    estimatedCostUsd,
    estimatedCostEur,
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
    pricing: {
      inputUsdPerMillion: pricing.inputUsdPerMillion,
      outputUsdPerMillion: pricing.outputUsdPerMillion,
      usdToEurRate: pricing.usdToEurRate,
      searchUsdPerGroundedPrompt: pricing.searchUsdPerGroundedPrompt
    }
  };
}

function recordUsage(usage) {
  // Structured server log contains cost/usage only: no prompt, response, or API key.
  console.info(JSON.stringify({ event: 'ai_usage', ...usage }));
}

module.exports = {
  DEFAULT_MODEL_PRICING,
  DEFAULT_USD_TO_EUR_RATE,
  DEFAULT_SEARCH_USD_PER_GROUNDED_PROMPT,
  calculateUsage,
  resolvePricing,
  recordUsage
};
