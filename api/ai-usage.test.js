'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_MODEL_PRICING,
  calculateUsage,
  resolvePricing
} = require('./ai-usage');

test('calculates Gemini 2.5 Flash cost including thinking tokens', () => {
  const usage = calculateUsage({
    usageMetadata: {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 100_000,
      thoughtsTokenCount: 20_000,
      totalTokenCount: 1_120_000
    },
    model: 'gemini-2.5-flash',
    operation: 'extract',
    durationMs: 1234,
    env: { GEMINI_USD_TO_EUR_RATE: '0.9' }
  });

  assert.equal(usage.estimatedCostUsd, 0.6);
  assert.equal(usage.estimatedCostEur, 0.54);
  assert.equal(usage.outputTokens, 100_000);
  assert.equal(usage.thinkingTokens, 20_000);
  assert.equal(usage.totalTokens, 1_120_000);
  assert.equal(usage.durationMs, 1234);
});

test('allows all price and exchange-rate defaults to be overridden by env', () => {
  const env = {
    GEMINI_INPUT_PRICE_USD_PER_1M: '1',
    GEMINI_OUTPUT_PRICE_USD_PER_1M: '4',
    GEMINI_USD_TO_EUR_RATE: '0.5',
    GEMINI_SEARCH_PRICE_USD_PER_REQUEST: '0.02'
  };
  const pricing = resolvePricing('gemini-2.5-flash', env);
  const usage = calculateUsage({
    usageMetadata: { promptTokenCount: 500_000, candidatesTokenCount: 250_000 },
    model: 'gemini-2.5-flash',
    operation: 'enhance',
    durationMs: 10,
    env
  });

  assert.deepEqual(pricing, {
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 4,
    usdToEurRate: 0.5,
    searchUsdPerGroundedPrompt: 0.02
  });
  assert.equal(usage.estimatedCostUsd, 1.5);
  assert.equal(usage.estimatedCostEur, 0.75);
});

test('adds the marginal Google Search grounding price when grounding was used', () => {
  const usage = calculateUsage({
    usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 1000 },
    model: 'gemini-2.5-flash',
    operation: 'extract',
    durationMs: 100,
    groundingRequestCount: 1,
    env: { GEMINI_SEARCH_PRICE_USD_PER_REQUEST: '0.035', GEMINI_USD_TO_EUR_RATE: '1' }
  });

  assert.equal(usage.groundingRequests, 1);
  assert.equal(usage.estimatedCostUsd, 0.0378);
});

test('uses Gemini 3.5 Flash token and search prices for grounded extraction', () => {
  const usage = calculateUsage({
    usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000 },
    model: 'gemini-3.5-flash',
    operation: 'extract',
    durationMs: 100,
    groundingRequestCount: 2,
    env: { GEMINI_USD_TO_EUR_RATE: '1' }
  });

  assert.equal(usage.estimatedCostUsd, 2.428);
});

test('uses Gemini 3.1 Flash-Lite pricing for the high-volume capture flow', () => {
  const usage = calculateUsage({
    usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000 },
    model: 'gemini-3.1-flash-lite',
    operation: 'extract',
    durationMs: 100,
    env: { GEMINI_USD_TO_EUR_RATE: '1' }
  });

  assert.equal(usage.estimatedCostUsd, 0.4);
});

test('supports snake_case metadata and derives a missing total', () => {
  const usage = calculateUsage({
    usageMetadata: {
      prompt_token_count: 50,
      candidates_token_count: 20,
      thoughts_token_count: 5,
      tool_use_prompt_token_count: 3
    },
    model: 'gemini-2.5-flash',
    operation: 'extract',
    durationMs: -1,
    env: {}
  });

  assert.equal(usage.promptTokens, 50);
  assert.equal(usage.outputTokens, 20);
  assert.equal(usage.thinkingTokens, 5);
  assert.equal(usage.totalTokens, 78);
  assert.equal(usage.durationMs, 0);
});

test('returns null estimates when usage metadata or model pricing is unavailable', () => {
  const missingMetadata = calculateUsage({
    usageMetadata: undefined,
    model: 'gemini-2.5-flash',
    operation: 'extract',
    durationMs: 5,
    env: {}
  });
  const unknownModel = calculateUsage({
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
    model: 'unknown-model',
    operation: 'extract',
    durationMs: 5,
    env: {}
  });

  assert.equal(missingMetadata.estimatedCostUsd, null);
  assert.equal(missingMetadata.totalTokens, null);
  assert.equal(unknownModel.estimatedCostUsd, null);
  assert.equal(DEFAULT_MODEL_PRICING['gemini-2.5-flash'].inputUsdPerMillion, 0.30);
});
