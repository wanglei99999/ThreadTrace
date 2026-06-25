'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getConnectorModuleContract } = require('../src/domain/contracts/connectorModuleContract');
const { createThreadTraceRuntime } = require('../src/runtime/threadTraceRuntime');

test('connector module contract exposes runtime extension shapes', function () {
  const contract = getConnectorModuleContract();
  const runtime = createThreadTraceRuntime({});
  const runtimeContract = runtime.getConnectorModuleContract();

  assert.equal(contract.version, '1.0.0');
  assert.equal(contract.name, 'ThreadTrace Connector Module');
  assert.ok(contract.exports.objectShape.optional.includes('register'));
  assert.ok(contract.context.registerSourceIngestHandler);
  assert.ok(contract.sdk.helpers.includes('defineConnectorModule(options)'));
  assert.deepEqual(contract.forumAdapter.required, ['sourceKey', 'displayName', 'parseSavedHtml']);
  assert.ok(contract.sourceIngestHandler.required.includes('sourceType'));
  assert.ok(contract.validation.requiredChecks.includes('connectorModule.handlerContracts'));
  assert.ok(contract.registrationReport.forumAdapterDetails);
  assert.match(contract.example, /external-feed/);
  assert.equal(runtimeContract.version, contract.version);
});
