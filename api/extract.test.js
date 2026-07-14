'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSourceExamplesBlock, mergeUsage } = require('./extract');

test('returns empty string when no examples are given', () => {
  assert.equal(buildSourceExamplesBlock(undefined), '');
  assert.equal(buildSourceExamplesBlock(null), '');
  assert.equal(buildSourceExamplesBlock([]), '');
});

test('ignores examples without a quelle field', () => {
  assert.equal(buildSourceExamplesBlock([{ quelle_url: 'https://example.com' }, null, 'not-an-object']), '');
});

test('formats up to 5 examples with quelle, URL and quality', () => {
  const block = buildSourceExamplesBlock([
    { quelle: 'Seneca, Epistulae Morales, Brief 1', quelle_url: 'https://gutenberg.org/x', quellenqualitaet: 'geprueft' },
    { quelle: 'Walter Isaacson, Steve Jobs, Kapitel 11', quellenqualitaet: 'primaer' }
  ]);
  assert.match(block, /BEISPIELE FÜR BEREITS GEPRÜFTE, GUTE QUELLENANGABEN/);
  assert.match(block, /1\. Seneca, Epistulae Morales, Brief 1 \(https:\/\/gutenberg\.org\/x\) — Qualität: geprueft/);
  assert.match(block, /2\. Walter Isaacson, Steve Jobs, Kapitel 11 — Qualität: primaer/);
});

test('caps at 5 examples and truncates oversized fields', () => {
  const examples = Array.from({ length: 8 }, (_, i) => ({ quelle: 'Quelle ' + i, quellenqualitaet: 'primaer' }));
  const block = buildSourceExamplesBlock(examples);
  assert.equal((block.match(/^\d+\./gm) || []).length, 5);

  const longBlock = buildSourceExamplesBlock([{ quelle: 'x'.repeat(500), quelle_url: 'y'.repeat(500) }]);
  assert.ok(longBlock.includes('x'.repeat(200)) && !longBlock.includes('x'.repeat(201)));
  assert.ok(longBlock.includes('y'.repeat(300)) && !longBlock.includes('y'.repeat(301)));
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
