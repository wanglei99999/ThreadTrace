#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseSavedThread } = require('../../application/use-cases/parseSavedThread');
const { analyzeSavedThread } = require('../../application/use-cases/analyzeSavedThread');
const { parseSavedThreadDirectory } = require('../../application/use-cases/parseSavedThreadDirectory');
const { analyzeSavedThreadDirectory } = require('../../application/use-cases/analyzeSavedThreadDirectory');
const { interpretNewPostFromSavedThreadDirectory } = require('../../application/use-cases/interpretNewPostFromSavedThreadDirectory');
const { writeJsonFile } = require('../../infrastructure/storage/jsonFileStorage');
const { writeTextFile } = require('../../infrastructure/storage/textFileWriter');
const { getForumAdapter } = require('../../infrastructure/forum-adapters/registry');
const { renderBasicHistoryMarkdown } = require('../../domain/analysis/markdownReportRenderer');
const { renderNewPostContextMarkdown } = require('../../domain/analysis/contextMarkdownRenderer');
const { createThreadTraceRuntime } = require('../../runtime/threadTraceRuntime');

function main(argv) {
  const command = argv[2] || 'help';
  const options = parseArgs(argv.slice(3));
  const runtime = createThreadTraceRuntime({
    defaultForum: options.forum || 'nga',
    defaultInputDir: options.input || path.resolve(process.cwd(), 'example'),
    storeDir: options.storeDir || path.resolve(process.cwd(), 'data', 'store')
  });

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

  if (command === 'ingest-html-dir') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.ingestDirectory({
      forum: options.forum,
      inputDir,
      storeDir
    }).then(function (result) {
      printThreadSummary(result.threadSnapshot);
      printReportSummary(result.report);
      console.log('Snapshot and report stored under: ' + storeDir);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-ingest-task') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.runIngestDirectoryTask({
      forum: options.forum,
      inputDir,
      storeDir
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Snapshot and report stored under: ' + storeDir);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-tasks') {
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.listTasks({
      storeDir,
      status: options.status,
      type: options.type,
      limit: options.limit ? Number(options.limit) : 20
    }).then(function (tasks) {
      tasks.forEach(function (task) {
        console.log(task.id + '\t' + task.status + '\t' + task.type + '\t' + task.createdAt);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'register-source') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.registerSource({
      id: options.sourceId,
      forum: options.forum,
      sourceType: options.sourceType || 'saved-html-directory',
      displayName: options.name,
      inputDir,
      url: options.url,
      enabled: options.enabled !== 'false',
      storeDir
    }).then(function (result) {
      console.log((result.created ? 'Created' : 'Updated') + ' source: ' + result.source.id);
      console.log(result.source.sourceKey + '\t' + result.source.sourceType + '\t' + result.source.displayName);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-sources') {
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.listSources({
      forum: options.forum,
      enabled: options.enabled === undefined ? undefined : options.enabled === 'true',
      limit: options.limit ? Number(options.limit) : 50,
      storeDir
    }).then(function (sources) {
      sources.forEach(function (source) {
        console.log(source.id + '\t' + source.sourceKey + '\t' + source.sourceType + '\t' + source.displayName);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-source-task') {
    if (!options.sourceId) {
      throw new Error('run-source-task requires --source-id.');
    }
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.runSourceIngestTask({
      sourceId: options.sourceId,
      storeDir
    }).then(function (result) {
      console.log('Task completed: ' + result.task.id);
      console.log('Source: ' + options.sourceId);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'run-sources-task') {
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.runEnabledSourcesIngestTasks({
      forum: options.forum,
      limit: options.limit ? Number(options.limit) : 50,
      storeDir
    }).then(function (result) {
      console.log('Sources: ' + result.sourceCount);
      console.log('Completed: ' + result.completedCount);
      console.log('Failed: ' + result.failedCount);
      result.results.forEach(function (item) {
        console.log(item.status + '\t' + item.source.id + '\t' + (item.task ? item.task.id : item.error.message));
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'interpret-text-dir') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const text = options.text;
    if (!text) {
      throw new Error('interpret-text-dir requires --text.');
    }

    const adapter = getForumAdapter(options.forum || 'nga');
    const report = interpretNewPostFromSavedThreadDirectory({
      adapter,
      inputDir,
      authorId: options.authorId,
      author: options.author,
      contentText: text
    });
    const outputPath = options.output || path.resolve(process.cwd(), 'data', 'parsed', 'new-post-context.json');
    const markdownPath = options.markdownOutput || path.resolve(process.cwd(), 'data', 'reports', 'new-post-context.md');
    const writtenPath = writeJsonFile(outputPath, report);
    const writtenMarkdownPath = writeTextFile(markdownPath, renderNewPostContextMarkdown(report));

    console.log('Context report written to: ' + writtenPath);
    console.log('Context markdown written to: ' + writtenMarkdownPath);
    console.log('Related evidence count: ' + report.relatedEvidence.length);
    return;
  }

  if (command === 'index-html-dir') {
    const inputDir = options.input || path.resolve(process.cwd(), 'example');
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.indexDirectory({
      forum: options.forum,
      inputDir,
      storeDir
    }).then(function (result) {
      console.log('Indexed documents: ' + result.indexedDocumentCount);
      printThreadSummary(result.threadSnapshot);
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'search-index') {
    if (!options.text) {
      throw new Error('search-index requires --text.');
    }
    const storeDir = options.storeDir || path.resolve(process.cwd(), 'data', 'store');
    runtime.search({
      text: options.text,
      limit: options.limit ? Number(options.limit) : 10,
      storeDir
    }).then(function (results) {
      results.forEach(function (result) {
        console.log(result.score + '\t#' + result.metadata.floor + '\t' + result.metadata.author + '\t' + result.text);
      });
    }).catch(function (error) {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    });
    return;
  }

  if (command === 'list-adapters') {
    runtime.listAdapters().forEach(function (adapter) {
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
    } else if (item === '--store-dir') {
      options.storeDir = args[index + 1];
      index += 1;
    } else if (item === '--text') {
      options.text = args[index + 1];
      index += 1;
    } else if (item === '--author-id') {
      options.authorId = args[index + 1];
      index += 1;
    } else if (item === '--author') {
      options.author = args[index + 1];
      index += 1;
    } else if (item === '--status') {
      options.status = args[index + 1];
      index += 1;
    } else if (item === '--type') {
      options.type = args[index + 1];
      index += 1;
    } else if (item === '--limit') {
      options.limit = args[index + 1];
      index += 1;
    } else if (item === '--source-id') {
      options.sourceId = args[index + 1];
      index += 1;
    } else if (item === '--source-type') {
      options.sourceType = args[index + 1];
      index += 1;
    } else if (item === '--name') {
      options.name = args[index + 1];
      index += 1;
    } else if (item === '--url') {
      options.url = args[index + 1];
      index += 1;
    } else if (item === '--enabled') {
      options.enabled = args[index + 1];
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
  console.log('  node src/presentation/cli/threadtrace.js ingest-html-dir [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-ingest-task [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-tasks [--store-dir dir] [--status status] [--type type] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js register-source [--forum nga] [--input dir] [--name name] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js list-sources [--forum nga] [--enabled true] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-source-task --source-id id [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js run-sources-task [--forum nga] [--limit n] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js index-html-dir [--forum nga] [--input dir] [--store-dir dir]');
  console.log('  node src/presentation/cli/threadtrace.js search-index --text text [--store-dir dir] [--limit n]');
  console.log('  node src/presentation/cli/threadtrace.js interpret-text-dir [--forum nga] [--input dir] --text text [--author-id id] [--output file] [--markdown-output file]');
}

main(process.argv);
