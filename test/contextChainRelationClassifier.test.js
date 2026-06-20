'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyNewPostChainRelation } = require('../src/domain/analysis/contextChainRelationClassifier');

test('context chain relation classifier detects validation after watch', function () {
  const relation = classifyNewPostChainRelation(chain('watch'), [opinion('bullish')], false);

  assert.equal(relation.relationType, 'validation_after_watch');
  assert.equal(relation.relationFamily, 'validation');
  assert.equal(relation.evidenceLevel, 'explicit');
  assert.equal(relation.reviewRequired, false);
});

test('context chain relation classifier detects caution after bullish', function () {
  const relation = classifyNewPostChainRelation(chain('bullish'), [opinion('risk')], false);

  assert.equal(relation.relationType, 'caution_after_bullish');
  assert.equal(relation.relationFamily, 'caution');
  assert.deepEqual(relation.newAttitudes, ['risk']);
});

test('context chain relation classifier detects recovery after risk', function () {
  const relation = classifyNewPostChainRelation(chain('risk'), [opinion('bullish')], false);

  assert.equal(relation.relationType, 'recovery_after_risk');
  assert.equal(relation.relationFamily, 'recovery');
});

test('context chain relation classifier separates explicit entity candidates from implicit candidates', function () {
  const relation = classifyNewPostChainRelation(chain('disclaimer'), [opinion('watch')], true, true);

  assert.equal(relation.relationType, 'explicit_entity_attitude_candidate');
  assert.equal(relation.relationFamily, 'candidate');
  assert.equal(relation.evidenceLevel, 'mixed');
  assert.equal(relation.reviewRequired, true);
  assert.ok(relation.reviewReasons.includes('chain_latest_attitude_unknown'));
});

test('context chain relation classifier marks implicit continuation for review', function () {
  const relation = classifyNewPostChainRelation(chain('watch'), [], true);

  assert.equal(relation.relationType, 'implicit_continuation');
  assert.equal(relation.evidenceLevel, 'inferred');
  assert.equal(relation.reviewRequired, true);
  assert.ok(relation.reviewReasons.includes('new_post_has_implicit_reference'));
  assert.ok(relation.reviewReasons.includes('relation_uses_inference'));
});

function chain(latestAttitude) {
  return {
    latestAttitude,
    evidenceLevels: {
      explicit: 2,
      inferred: 0
    }
  };
}

function opinion(attitude) {
  return {
    attitude
  };
}
