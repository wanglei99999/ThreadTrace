'use strict';

const { runSetTrackedSourceEnabledTask } = require('./runSetTrackedSourceEnabledTask');

function runEnableTrackedSourceTask(options) {
  const safeOptions = options || {};
  return runSetTrackedSourceEnabledTask(Object.assign({}, safeOptions, {
    enabled: true,
    setTrackedSourceEnabled: safeOptions.enableTrackedSource
  }));
}

module.exports = {
  runEnableTrackedSourceTask
};
