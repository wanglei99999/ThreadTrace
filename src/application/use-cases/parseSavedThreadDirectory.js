'use strict';

const fs = require('fs');
const path = require('path');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { mergeThreadSnapshots } = require('../../domain/models/threadSnapshotMerger');
const { parseSavedThread } = require('./parseSavedThread');

function parseSavedThreadDirectory(options) {
  const adapter = assertForumAdapter(options.adapter);
  const inputDir = path.resolve(options.inputDir);
  const htmlFiles = fs.readdirSync(inputDir)
    .filter(function (fileName) {
      return /\.html?$/i.test(fileName);
    })
    .sort()
    .map(function (fileName) {
      return path.join(inputDir, fileName);
    });

  if (htmlFiles.length === 0) {
    throw new Error('No .html file found in directory: ' + inputDir);
  }

  const snapshots = htmlFiles.map(function (inputPath) {
    return parseSavedThread({
      adapter,
      inputPath
    });
  });

  return mergeThreadSnapshots(snapshots);
}

module.exports = {
  parseSavedThreadDirectory
};
