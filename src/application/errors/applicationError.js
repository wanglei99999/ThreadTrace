'use strict';

class ApplicationError extends Error {
  constructor(code, message, options) {
    super(message);
    const safeOptions = options || {};
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = safeOptions.statusCode || 500;
    this.details = safeOptions.details;
  }
}

function createApplicationError(code, message, options) {
  return new ApplicationError(code, message, options);
}

function isApplicationError(error) {
  return Boolean(error && error.name === 'ApplicationError' && error.code);
}

module.exports = {
  ApplicationError,
  createApplicationError,
  isApplicationError
};
