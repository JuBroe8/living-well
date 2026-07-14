'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { groundingSummary, mergeUsage } = require('./grounded-research');

test('groundingSummary reports unused grounding when no candidates/metadata are present', () => {
  assert.deepEqual(groundingSummary(null), { used: false, sources: [], queries: [] });
  assert.deepEqual(groundingSummary({ candidates: [] }), { used: false, sources: [], queries: [] });
  assert.deepEqual(groundingSummary({ candidates: [{}] }), { used: false, sources: [], queries: [] });
});

test('groundingSummary extracts sources and queries from groundingMetadata', () => {
  const result = {
    candidates: [{
      groundingMetadata: {
        groundingChunks: [
          { web: { title: 'Example', uri: 'https://example.com' } },
          { web: { uri: 'https://example.org' } },
          null
        ],
        webSearchQueries: ['q1', 'q2']
      }
    }]
  };
  const summary = groundingSummary(result);
  assert.equal(summary.used, true);
  assert.deepEqual(summary.sources, [
    { title: 'Example', url: 'https://example.com' },
    { title: '', url: 'https://example.org' }
  ]);
  assert.deepEqual(summary.queries, ['q1', 'q2']);
});

test('mergeUsage passes a single usage object through unchanged', () => {
  const usage = { operation: 'extract', model: 'gemini-3.1-flash-lite', promptTokens: 10, groundingRequests: 0 };
  assert.equal(mergeUsage([usage]), usage);
});

test('mergeUsage sums token/cost fields and grounding requests across the research + structuring calls', () => {
  const research = {
    operation: 'extract_research', model: 'gemini-3.1-flash-lite',
    promptTokens: 100, outputTokens: 50, thinkingTokens: 0, totalTokens: 150,
    groundingRequests: 2, estimatedCostUsd: 0.01, estimatedCostEur: 0.009, durationMs: 2000,
    pricing: { inputUsdPerMillion: 0.25 }
  };
  const structuring = {
    operation: 'extract', model: 'gemini-3.1-flash-lite',
    promptTokens: 200, outputTokens: 300, thinkingTokens: 0, totalTokens: 500,
    groundingRequests: 0, estimatedCostUsd: 0.02, estimatedCostEur: 0.018, durationMs: 3000,
    pricing: { inputUsdPerMillion: 0.25 }
  };
  const merged = mergeUsage([research, structuring]);
  assert.equal(merged.operation, 'extract');
  assert.equal(merged.promptTokens, 300);
  assert.equal(merged.totalTokens, 650);
  assert.equal(merged.groundingRequests, 2);
  assert.equal(merged.estimatedCostUsd, 0.03);
  assert.equal(merged.durationMs, 5000);
});

test('mergeUsage returns null for a cost field if any contributing call could not estimate it', () => {
  const known = { promptTokens: 10, outputTokens: 10, totalTokens: 20, thinkingTokens: 0, groundingRequests: 0, estimatedCostUsd: 0.01, estimatedCostEur: 0.01, durationMs: 100, model: 'x', pricing: {} };
  const unknown = { ...known, estimatedCostUsd: null, estimatedCostEur: null };
  const merged = mergeUsage([known, unknown]);
  assert.equal(merged.estimatedCostUsd, null);
  assert.equal(merged.estimatedCostEur, null);
  assert.equal(merged.promptTokens, 20);
});

test('mergeUsage returns null when given an empty list', () => {
  assert.equal(mergeUsage([]), null);
});
