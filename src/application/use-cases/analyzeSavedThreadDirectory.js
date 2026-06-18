'use strict';

const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { parseSavedThreadDirectory } = require('./parseSavedThreadDirectory');

function analyzeSavedThreadDirectory(options) {
  const threadSnapshot = parseSavedThreadDirectory(options);
  return {
    threadSnapshot,
    report: analyzeThreadHistory(threadSnapshot)
  };
}

module.exports = {
  analyzeSavedThreadDirectory
};
