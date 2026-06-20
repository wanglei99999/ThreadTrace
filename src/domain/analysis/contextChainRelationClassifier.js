'use strict';

function classifyNewPostChainRelation(chain, newOpinions, hasImplicitReference, hasSharedEntity) {
  const latestAttitude = normalizeComparableAttitude(chain && chain.latestAttitude);
  const newAttitudes = unique((newOpinions || []).map(function (opinion) {
    return normalizeComparableAttitude(opinion.attitude);
  }).filter(Boolean));
  const evidenceLevel = inferRelationEvidenceLevel({
    hasImplicitReference,
    hasSharedEntity,
    latestAttitude,
    newAttitudes
  });
  const reviewReasons = relationReviewReasons({
    chain,
    hasImplicitReference,
    hasSharedEntity,
    latestAttitude,
    newAttitudes,
    evidenceLevel
  });

  if (newAttitudes.length === 0 && hasImplicitReference) {
    return relation({
      relationType: 'implicit_continuation',
      relationFamily: 'continuity',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '新发言含隐晦延续信号，可能接在该历史观点链之后。',
      scoreBoost: 2,
      reviewReasons
    });
  }

  if (!latestAttitude && hasSharedEntity && newAttitudes.length > 0) {
    return relation({
      relationType: 'explicit_entity_attitude_candidate',
      relationFamily: 'candidate',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '新发言直接命中实体并给出态度信号，但历史链最新市场态度不足，需要回看证据确认。',
      scoreBoost: 2,
      reviewReasons
    });
  }

  if (!latestAttitude || newAttitudes.length === 0) {
    return hasImplicitReference
      ? relation({
          relationType: 'implicit_reference_match',
          relationFamily: 'candidate',
          evidenceLevel,
          latestAttitude,
          newAttitudes,
          summary: '新发言有隐晦表达，可作为待确认的历史链候选。',
          scoreBoost: 1.5,
          reviewReasons
        })
      : relation({
          relationType: 'unrelated',
          relationFamily: 'unmatched',
          evidenceLevel: 'weak',
          latestAttitude,
          newAttitudes,
          summary: '',
          scoreBoost: 0,
          reviewReasons
        });
  }

  if (newAttitudes.indexOf(latestAttitude) >= 0) {
    return relation({
      relationType: 'attitude_continuation',
      relationFamily: 'continuity',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '新发言态度与历史链最新态度一致。',
      scoreBoost: 2.5,
      reviewReasons
    });
  }

  if (latestAttitude === 'watch' && newAttitudes.indexOf('bullish') >= 0) {
    return relation({
      relationType: 'validation_after_watch',
      relationFamily: 'validation',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '历史链处于观察状态，新发言出现验证或走强信号。',
      scoreBoost: 3,
      reviewReasons
    });
  }

  if (latestAttitude === 'bullish' && newAttitudes.indexOf('bearish') >= 0) {
    return relation({
      relationType: 'reversal_after_bullish',
      relationFamily: 'reversal',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '历史链偏强，新发言出现转弱或放弃信号。',
      scoreBoost: 3.2,
      reviewReasons
    });
  }

  if (latestAttitude === 'bullish' && newAttitudes.some(function (attitude) { return attitude === 'risk' || attitude === 'watch'; })) {
    return relation({
      relationType: 'caution_after_bullish',
      relationFamily: 'caution',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '历史链偏强，新发言转为谨慎或等待确认。',
      scoreBoost: 3,
      reviewReasons
    });
  }

  if ((latestAttitude === 'risk' || latestAttitude === 'bearish') && newAttitudes.indexOf('bullish') >= 0) {
    return relation({
      relationType: 'recovery_after_risk',
      relationFamily: 'recovery',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '历史链偏风险，新发言出现恢复或走强信号。',
      scoreBoost: 3,
      reviewReasons
    });
  }

  if ((latestAttitude === 'risk' || latestAttitude === 'bearish') && newAttitudes.indexOf('watch') >= 0) {
    return relation({
      relationType: 'risk_cooling_to_watch',
      relationFamily: 'caution',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '历史链偏风险，新发言转为观察或等待确认。',
      scoreBoost: 2.4,
      reviewReasons
    });
  }

  if (latestAttitude === 'watch' && newAttitudes.some(function (attitude) { return attitude === 'risk' || attitude === 'bearish'; })) {
    return relation({
      relationType: 'risk_after_watch',
      relationFamily: 'caution',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '历史链处于观察状态，新发言出现风险或转弱信号。',
      scoreBoost: 2.8,
      reviewReasons
    });
  }

  if (newAttitudes.some(function (attitude) { return attitude !== latestAttitude; })) {
    return relation({
      relationType: 'attitude_shift_candidate',
      relationFamily: 'shift',
      evidenceLevel,
      latestAttitude,
      newAttitudes,
      summary: '新发言态度与历史链最新态度不同，需要证据确认。',
      scoreBoost: 2,
      reviewReasons
    });
  }

  return relation({
    relationType: 'unrelated',
    relationFamily: 'unmatched',
    evidenceLevel: 'weak',
    latestAttitude,
    newAttitudes,
    summary: '',
    scoreBoost: 0,
    reviewReasons
  });
}

function inferRelationEvidenceLevel(input) {
  if (input.hasSharedEntity && input.newAttitudes.length > 0 && input.hasImplicitReference) return 'mixed';
  if (input.hasSharedEntity && input.newAttitudes.length > 0) return 'explicit';
  if (input.newAttitudes.length > 0 && !input.hasImplicitReference) return 'explicit';
  if (input.newAttitudes.length > 0 && input.hasImplicitReference) return 'mixed';
  if (input.hasImplicitReference) return 'inferred';
  return input.latestAttitude ? 'weak' : 'none';
}

function relationReviewReasons(input) {
  const reasons = [];
  const levels = input.chain && input.chain.evidenceLevels ? input.chain.evidenceLevels : {};
  const explicit = levels.explicit || 0;
  const inferred = levels.inferred || 0;

  if (input.hasImplicitReference) {
    reasons.push('new_post_has_implicit_reference');
  }
  if (input.evidenceLevel === 'inferred' || input.evidenceLevel === 'mixed') {
    reasons.push('relation_uses_inference');
  }
  if (inferred > explicit) {
    reasons.push('chain_inference_heavy');
  }
  if (input.newAttitudes.length > 1) {
    reasons.push('new_post_has_multiple_attitudes');
  }
  if (!input.latestAttitude && input.newAttitudes.length > 0) {
    reasons.push('chain_latest_attitude_unknown');
  }

  return reasons;
}

function relation(input) {
  return {
    relationType: input.relationType,
    relationFamily: input.relationFamily,
    evidenceLevel: input.evidenceLevel,
    latestAttitude: input.latestAttitude,
    newAttitudes: input.newAttitudes,
    summary: input.summary,
    scoreBoost: input.scoreBoost,
    reviewRequired: input.reviewReasons.length > 0,
    reviewReasons: input.reviewReasons
  };
}

function normalizeComparableAttitude(value) {
  if (value === 'bullish' || value === 'bearish' || value === 'risk' || value === 'watch') return value;
  return undefined;
}

function unique(values) {
  return values.filter(function (value, index) {
    return values.indexOf(value) === index;
  });
}

module.exports = {
  classifyNewPostChainRelation
};
