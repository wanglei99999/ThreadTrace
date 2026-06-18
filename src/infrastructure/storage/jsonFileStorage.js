'use strict';

const fs = require('fs');
const path = require('path');

function writeJsonFile(filePath, value) {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  return resolvedPath;
}

module.exports = {
  writeJsonFile
};
