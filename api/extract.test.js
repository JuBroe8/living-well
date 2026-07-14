'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSourceExamplesBlock } = require('./extract');

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
