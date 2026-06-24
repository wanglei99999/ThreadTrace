'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function makeWorkspaceTempDir(prefix) {
  const baseDir = path.resolve(__dirname, '..', '..', '.tmp', 'tests');
  await fs.mkdir(baseDir, { recursive: true });
  return fs.mkdtemp(path.join(baseDir, prefix));
}

module.exports = {
  makeWorkspaceTempDir
};
