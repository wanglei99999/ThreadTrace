'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('package exposes common operations entrypoints', async function () {
  const packageJson = JSON.parse(await fs.readFile(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};

  assert.equal(scripts['operations:list-events'], 'node src/presentation/cli/threadtrace.js list-events');
  assert.equal(scripts['operations:events-overview'], 'node src/presentation/cli/threadtrace.js events-overview');
  assert.equal(scripts['operations:dispatch-events'], 'node src/presentation/cli/threadtrace.js dispatch-events');
  assert.equal(scripts['operations:archive-events'], 'node src/presentation/cli/threadtrace.js archive-events');
  assert.equal(scripts['operations:resource-provisioning-plan'], 'node src/presentation/cli/threadtrace.js resource-provisioning-plan');
  assert.equal(scripts['deployment:gate'], 'node src/presentation/cli/threadtrace.js deployment-gate');
});
