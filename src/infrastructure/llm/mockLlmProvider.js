'use strict';

const { assertLlmProvider } = require('../../application/ports/llmProvider');

function createMockLlmProvider(options) {
  const safeOptions = options || {};
  const provider = {
    providerKey: 'mock',
    async completeStructured(request) {
      if (!request || request.task !== 'thread-history-semantic-enrichment') {
        throw new Error('MockLlmProvider only supports thread-history-semantic-enrichment.');
      }
      const output = buildSemanticEnrichment(request.input || {});
      return {
        provider: 'mock',
        output,
        usage: {
          inputTokens: estimateTokens(JSON.stringify(request.input || {})),
          outputTokens: estimateTokens(JSON.stringify(output))
        },
        raw: safeOptions.includeRaw ? { request } : undefined
      };
    }
  };

  return assertLlmProvider(provider);
}

function buildSemanticEnrichment(input) {
  const thread = input.thread || {};
  const entities = input.topEntities || [];
  const opinions = input.topOpinions || [];
  const evidence = input.highSignalEvidence || [];
  return {
    summary: buildSummary(thread, entities, opinions),
    entityInsights: entities.slice(0, 5).map(function (entity) {
      const mentions = entity.mentions || [];
      return {
        name: entity.displayName,
        type: entity.type,
        confidence: mentions.length >= 2 ? 'medium' : 'low',
        rationale: 'Mentioned ' + mentions.length + ' time(s) in extracted evidence.',
        evidenceRefs: mentions.slice(0, 3).map(function (mention) {
          return {
            floor: mention.floor,
            sourcePostId: mention.sourcePostId,
            quote: mention.evidenceText
          };
        })
      };
    }),
    opinionInsights: opinions.slice(0, 5).map(function (opinion) {
      return {
        floor: opinion.floor,
        author: opinion.author,
        attitude: opinion.attitude,
        confidence: opinion.confidence,
        rationale: 'Rule candidate preserved for LLM review: ' + (opinion.scope || 'unknown') + '.',
        evidenceRefs: [{
          floor: opinion.floor,
          sourcePostId: opinion.sourcePostId,
          quote: opinion.evidence && opinion.evidence.text
        }]
      };
    }),
    evidenceQuestions: evidence.slice(0, 5).map(function (item) {
      return {
        question: 'Does floor #' + item.floor + ' support the main thread claim or only provide context?',
        evidenceRefs: [{
          floor: item.floor,
          sourcePostId: item.sourcePostId,
          quote: item.excerpt
        }]
      };
    }),
    limitations: [
      'Mock provider is deterministic and does not infer beyond rule-based candidates.',
      'Replace provider with a real model for implicit references, tone shifts, and cross-post synthesis.'
    ]
  };
}

function buildSummary(thread, entities, opinions) {
  return [
    'Thread "' + (thread.title || thread.sourceThreadId || 'unknown') + '" has',
    String(thread.parsedPostCount || 0),
    'parsed posts,',
    String(entities.length),
    'entity candidates, and',
    String(opinions.length),
    'opinion candidates prepared for semantic review.'
  ].join(' ');
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

module.exports = {
  createMockLlmProvider
};
