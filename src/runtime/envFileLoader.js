'use strict';

const fs = require('fs');
const path = require('path');

function loadEnvFile(options) {
  const safeOptions = options || {};
  const cwd = safeOptions.cwd || process.cwd();
  const env = safeOptions.env || process.env;
  const filePath = path.resolve(cwd, safeOptions.filePath || '.env');
  const override = safeOptions.override === true;

  if (!fs.existsSync(filePath)) {
    return {
      loaded: false,
      filePath,
      values: {}
    };
  }

  const values = parseEnvFile(fs.readFileSync(filePath, 'utf8'));
  Object.keys(values).forEach(function (key) {
    if (override || env[key] === undefined) {
      env[key] = values[key];
    }
  });

  return {
    loaded: true,
    filePath,
    values
  };
}

function parseEnvFile(text) {
  const values = {};
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    values[key] = unquoteEnvValue(rawValue);
  });
  return values;
}

function unquoteEnvValue(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  const commentIndex = value.indexOf(' #');
  if (commentIndex >= 0) {
    return value.slice(0, commentIndex).trimEnd();
  }
  return value;
}

module.exports = {
  loadEnvFile,
  parseEnvFile
};
