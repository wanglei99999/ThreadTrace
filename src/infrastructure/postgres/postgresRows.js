'use strict';

function toIso(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function optionalJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return value;
}

function pushLimit(params, limit) {
  if (!limit) return '';
  params.push(Number(limit));
  return ' limit $' + params.length;
}

module.exports = {
  optionalJson,
  pushLimit,
  toIso
};
