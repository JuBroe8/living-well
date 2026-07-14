'use strict';

const { calculateUsage } = require('./ai-usage');

async function generateWithTransientRetry(ai, request, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      lastErr = err;
      const message = err && err.message ? err.message : '';
      const transient = message.includes('503')
        || message.includes('UNAVAILABLE')
        || message.toLowerCase().includes('high demand');
      if (!transient || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function groundingSummary(result) {
  const metadata = result && result.candidates && result.candidates[0] && result.candidates[0].groundingMetadata;
  if (!metadata) return { used: false, sources: [], queries: [] };
  const sources = (metadata.groundingChunks || []).map((chunk) => chunk && chunk.web).filter(Boolean).map((web) => ({
    title: web.title || '',
    url: web.uri || ''
  }));
  return { used: sources.length > 0, sources, queries: metadata.webSearchQueries || [] };
}

// Gemini does not reliably combine tools (googleSearch) with
// responseMimeType: 'application/json' in one call — the JSON constraint
// wins and the search tool is silently skipped, so citations end up
// reconstructed from training memory rather than a live search. Callers run
// this ungrounded-format research step first, then feed its plain-text
// findings + real source URLs into their own separate JSON-structuring call.
async function runGroundedResearch({ ai, model, systemInstruction, contents, requestStartedAt, operation }) {
  const result = await generateWithTransientRetry(ai, {
    model,
    contents,
    config: { systemInstruction, tools: [{ googleSearch: {} }], temperature: 0.3 }
  });
  const grounding = groundingSummary(result);
  const usage = calculateUsage({
    usageMetadata: result.usageMetadata,
    model,
    operation,
    durationMs: Date.now() - requestStartedAt,
    groundingRequestCount: grounding.used ? Math.max(1, grounding.queries.length) : 0
  });
  const sourceListText = grounding.sources
    .filter((s) => s.url)
    .map((s, i) => `${i + 1}. ${s.title || s.url} — ${s.url}`)
    .join('\n');
  return { grounding, usage, findingsText: result.text || '', sourceListText };
}

function sumField(list, key) {
  let total = 0;
  for (const u of list) {
    if (u[key] === null || u[key] === undefined) return null;
    total += u[key];
  }
  return total;
}

// Combines a research call's usage with a structuring call's usage into a
// single row so one grounded operation still shows up as one cost line.
function mergeUsage(usages) {
  const valid = usages.filter(Boolean);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0];
  return {
    operation: valid[valid.length - 1].operation,
    model: valid[valid.length - 1].model,
    promptTokens: sumField(valid, 'promptTokens'),
    outputTokens: sumField(valid, 'outputTokens'),
    thinkingTokens: sumField(valid, 'thinkingTokens'),
    totalTokens: sumField(valid, 'totalTokens'),
    groundingRequests: valid.reduce((acc, u) => acc + (u.groundingRequests || 0), 0),
    estimatedCostUsd: sumField(valid, 'estimatedCostUsd'),
    estimatedCostEur: sumField(valid, 'estimatedCostEur'),
    durationMs: valid.reduce((acc, u) => acc + (u.durationMs || 0), 0),
    pricing: valid[valid.length - 1].pricing
  };
}

module.exports = { generateWithTransientRetry, groundingSummary, runGroundedResearch, mergeUsage };
