'use strict';

const { setTrackedSourceEnabled } = require('./setTrackedSourceEnabled');

async function enableTrackedSource(options) {
  return setTrackedSourceEnabled(Object.assign({}, options || {}, {
    enabled: true
  }));
}

module.exports = {
  enableTrackedSource
};
