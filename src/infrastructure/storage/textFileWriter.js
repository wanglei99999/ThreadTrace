'use strict';

const fs = require('fs');
const path = require('path');

function writeTextFile(filePath, value) {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, String(value), 'utf8');
  return resolvedPath;
}

module.exports = {
  writeTextFile
};
