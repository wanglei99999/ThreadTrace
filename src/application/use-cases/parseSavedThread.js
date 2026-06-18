'use strict';

const path = require('path');
const { assertForumAdapter } = require('../../infrastructure/forum-adapters/forumAdapter');
const { readHtmlText } = require('../../infrastructure/storage/textFileReader');

function parseSavedThread(options) {
  const adapter = assertForumAdapter(options.adapter);
  const inputPath = path.resolve(options.inputPath);
  const html = readHtmlText(inputPath);

  return adapter.parseSavedHtml(html, {
    sourceFile: inputPath,
    url: options.url,
    title: options.title,
    sourceThreadId: options.sourceThreadId
  });
}

module.exports = {
  parseSavedThread
};
