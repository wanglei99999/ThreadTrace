'use strict';

const { analyzeThreadHistory } = require('../../domain/analysis/basicHistoricalAnalyzer');
const { parseSavedThread } = require('./parseSavedThread');

function analyzeSavedThread(options) {
  const threadSnapshot = parseSavedThread(options);
  return {
    threadSnapshot,
    report: analyzeThreadHistory(threadSnapshot)
  };
}

module.exports = {
  analyzeSavedThread
};
