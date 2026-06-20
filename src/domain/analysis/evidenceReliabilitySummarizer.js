'use strict';

function summarizeEvidenceReliability(input) {
  const safeInput = input || {};
  const chains = safeInput.opinionChains || [];
  const implicitReferences = safeInput.implicitReferenceCandidates || [];
  const totals = chains.reduce(function (summary, chain) {
    const levels = chain.evidenceLevels || {};
    summary.explicit += levels.explicit || 0;
    summary.inferred += levels.inferred || 0;
    return summary;
  }, { explicit: 0, inferred: 0 });
  const totalLinks = totals.explicit + totals.inferred;
  const explicitRatio = totalLinks > 0 ? Number((totals.explicit / totalLinks).toFixed(2)) : 0;
  const status = reliabilityStatus({
    explicitRatio,
    totalLinks,
    inferredCount: totals.inferred,
    implicitReferenceCount: implicitReferences.length
  });

  return {
    status,
    explicitCount: totals.explicit,
    inferredCount: totals.inferred,
    implicitReferenceCount: implicitReferences.length,
    explicitRatio,
    summary: reliabilitySummary({
      status,
      explicitCount: totals.explicit,
      inferredCount: totals.inferred,
      implicitReferenceCount: implicitReferences.length,
      explicitRatio
    }),
    cautions: reliabilityCautions({
      totalLinks,
      inferredCount: totals.inferred,
      implicitReferenceCount: implicitReferences.length
    })
  };
}

function reliabilityStatus(input) {
  if (input.totalLinks === 0) return 'insufficient';
  if (input.explicitRatio >= 0.75 && input.inferredCount <= 1) return 'well-supported';
  if (input.explicitRatio >= 0.45) return 'mixed';
  return 'inference-heavy';
}

function reliabilitySummary(input) {
  if (input.status === 'insufficient') {
    return '暂未形成足够观点链证据，需要更多历史楼层支撑。';
  }
  if (input.status === 'well-supported') {
    return '观点链主要由明确证据支撑，适合作为后续语境还原的基础。';
  }
  if (input.status === 'inference-heavy') {
    return '当前观点链较依赖相邻楼层和隐晦表达推断，使用时应优先回看原始楼层。';
  }
  return '观点链同时包含明确证据和推断关联，适合继续做人工或 LLM 核验。';
}

function reliabilityCautions(input) {
  const cautions = [];
  if (input.totalLinks === 0) {
    cautions.push('缺少可连接到实体的观点证据。');
  }
  if (input.inferredCount > 0) {
    cautions.push('推断关联来自相邻楼层、同作者上下文或隐晦承接，不应视为直接原文指认。');
  }
  if (input.implicitReferenceCount > 0) {
    cautions.push('隐晦表达候选只表示可能指代，需要结合历史观点链确认。');
  }
  if (cautions.length === 0) {
    cautions.push('仍需保留楼层、作者和原文片段，便于回溯验证。');
  }
  return cautions;
}

module.exports = {
  summarizeEvidenceReliability
};
