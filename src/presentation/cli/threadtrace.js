#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseSavedThread } = require('../../application/use-cases/parseSavedThread');
const { analyzeSavedThread } = require('../../application/use-cases/analyzeSavedThread');
const { parseSavedThreadDirectory } = require('../../application/use-cases/parseSavedThreadDirectory');
const { analyzeSavedThreadDirectory } = require('../../application/use-cases/analyzeSavedThreadDirectory');
const { writeJsonFile } = require('../../infrastructure/storage/jsonFileStorage');
const { writeTextFile } = require('../../infrastructure/storage/textFileWriter');
const { getForumAdapter, listForumAdapters } = require('../../infrastructure/forum-adapters/registry');
const { renderBasicHistoryMarkdown } = require('../../domain/analysis/markdownReportRenderer');

function main(argv) {
  const command = argv[2] || 'help';
  const options = parseArgs(argv.slice(3));

  if (command === 'parse-html') {
    const inputPath = options.input || findDefaultExampleHtml();
    const adapter = getForumAdapter(options.forum || 'nga');
    const threadSnapshot = parseSavedThread({
      adapter,
      inputPath
    });
    const outputPath = options.output || defaultParsedOutputPath(threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, threadSnapshot);

    printThreadSummary(threadSnapshot);
    console.log('Parsed JSON written to: ' + writtenPath);
    return;
  }

  if (command === 'parse-html-dir') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const adapter = getForumAdapter(options.forum || 'nga');
    const threadSnapshot = parseSavedThreadDirectory({
      adapter,
      inputDir
    });
    const outputPath = options.output || defaultParsedOutputPath(threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, threadSnapshot);

    printThreadSummary(threadSnapshot);
    console.log('Parsed merged JSON written to: ' + writtenPath);
    return;
  }

  if (command === 'analyze-html') {
    const inputPath = options.input || findDefaultExampleHtml();
    const adapter = getForumAdapter(options.forum || 'nga');
    const result = analyzeSavedThread({
      adapter,
      inputPath
    });
    const outputPath = options.output || defaultReportOutputPath(result.threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, result.report);
    const markdownPath = options.markdownOutput || defaultMarkdownReportOutputPath(result.threadSnapshot);
    const writtenMarkdownPath = writeTextFile(markdownPath, renderBasicHistoryMarkdown(result.report));

    printThreadSummary(result.threadSnapshot);
    printReportSummary(result.report);
    console.log('Analysis report written to: ' + writtenPath);
    console.log('Markdown report written to: ' + writtenMarkdownPath);
    return;
  }

  if (command === 'analyze-html-dir') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const adapter = getForumAdapter(options.forum || 'nga');
    const result = analyzeSavedThreadDirectory({
      adapter,
      inputDir
    });
    const outputPath = options.output || defaultReportOutputPath(result.threadSnapshot);
    const writtenPath = writeJsonFile(outputPath, result.report);
    const markdownPath = options.markdownOutput || defaultMarkdownReportOutputPath(result.threadSnapshot);
    const writtenMarkdownPath = writeTextFile(markdownPath, renderBasicHistoryMarkdown(result.report));

    printThreadSummary(result.threadSnapshot);
    printReportSummary(result.report);
    console.log('Merged analysis report written to: ' + writtenPath);
    console.log('Merged markdown report written to: ' + writtenMarkdownPath);
    return;
  }

  if (command === 'list-adapters') {
    listForumAdapters().forEach(function (adapter) {
      console.log(adapter.sourceKey + '\t' + adapter.displayName);
    });
    return;
  }

  printHelp();
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item === '--input' || item === '-i') {
      options.input = args[index + 1];
      index += 1;
    } else if (item === '--output' || item === '-o') {
      options.output = args[index + 1];
      index += 1;
    } else if (item === '--markdown-output') {
      options.markdownOutput = args[index + 1];
      index += 1;
    } else if (item === '--forum') {
      options.forum = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function findDefaultExampleHtml() {
  const exampleDir = path.resolve(process.cwd(), 'example');
  const files = fs.readdirSync(exampleDir)
    .filter(function (name) {
      return /\.html?$/i.test(name);
    })
    .sort();

  if (files.length === 0) {
    throw new Error('No .html file found in example directory.');
  }

  return path.join(exampleDir, files[0]);
}

function defaultParsedOutputPath(threadSnapshot) {
  const id = threadSnapshot.sourceThreadId || 'unknown';
  return path.resolve(process.cwd(), 'data', 'parsed', 'nga-thread-' + id + '.json');
}

function defaultReportOutputPath(threadSnapshot) {
  const id = threadSnapshot.sourceThreadId || 'unknown';
  return path.resolve(process.cwd(), 'data', 'parsed', 'nga-thread-' + id + '.basic-report.json');
}

function defaultMarkdownReportOutputPath(threadSnapshot) {
  const id = threadSnapshot.sourceThreadId || 'unknown';
  return path.resolve(process.cwd(), 'data', 'reports', 'nga-thread-' + id + '.basic-report.md');
}

function printThreadSummary(threadSnapshot) {
  console.log('ThreadTrace');
  console.log('Forum: ' + threadSnapshot.forum.displayName);
  console.log('Thread: ' + threadSnapshot.title + ' (' + threadSnapshot.sourceThreadId + ')');
  console.log('Posts parsed: ' + threadSnapshot.posts.length);
  if (threadSnapshot.totalPages) {
    console.log('Pages: current ' + (threadSnapshot.page || '?') + ', total ' + threadSnapshot.totalPages);
  }
}

function printReportSummary(report) {
  console.log('Primary author: ' + (report.primaryAuthor ? report.primaryAuthor.displayName : 'unknown'));
  console.log('Authors found: ' + report.authorStats.length);
  console.log('High-signal candidates: ' + report.evidenceCandidates.highSignalPosts.length);
  console.log('Low-signal candidates: ' + report.evidenceCandidates.lowSignalPosts.length);
  console.log('External links: ' + report.evidenceCandidates.externalLinks.length);
}

function printHelp() {
  console.log('Usage:');
  console.log('  node src/presentation/cli/threadtrace.js list-adapters');
  console.log('  node src/presentation/cli/threadtrace.js parse-html [--forum nga] [--input file] [--output file]');
  console.log('  node src/presentation/cli/threadtrace.js parse-html-dir [--forum nga] [--input dir] [--output file]');
  console.log('  node src/presentation/cli/threadtrace.js analyze-html [--forum nga] [--input file] [--output file] [--markdown-output file]');
  console.log('  node src/presentation/cli/threadtrace.js analyze-html-dir [--forum nga] [--input dir] [--output file] [--markdown-output file]');
}

main(process.argv);
