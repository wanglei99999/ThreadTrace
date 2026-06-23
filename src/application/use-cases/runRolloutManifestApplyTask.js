'use strict';

const { assertTaskRepository } = require('../ports/taskRepository');
const {
  createTaskRecord,
  markTaskCompleted,
  markTaskFailed,
  markTaskRunning
} = require('../jobs/taskRecordFactory');
const {
  buildIdempotentReplay,
  findReusableCompletedTask
} = require('../jobs/taskIdempotency');

async function runRolloutManifestApplyTask(options) {
  const safeOptions = options || {};
  const taskRepository = assertTaskRepository(safeOptions.taskRepository);
  if (typeof safeOptions.applyRolloutManifest !== 'function') {
    throw new Error('runRolloutManifestApplyTask requires applyRolloutManifest(request).');
  }

  let task = createTaskRecord('rollout-manifest-apply', {
    manifest: safeOptions.manifest,
    execute: safeOptions.execute === true,
    dryRun: safeOptions.execute !== true,
    storeDir: safeOptions.storeDir,
    now: safeOptions.now
  }, safeOptions);
  const reusableTask = await findReusableCompletedTask(taskRepository, task);
  if (reusableTask) {
    return {
      task: reusableTask,
      report: reusableTask.output && reusableTask.output.report,
      idempotency: buildIdempotentReplay(reusableTask)
    };
  }

  await taskRepository.saveTask(task);
  task = markTaskRunning(task);
  await taskRepository.saveTask(task);

  try {
    const report = await safeOptions.applyRolloutManifest({
      manifest: safeOptions.manifest,
      execute: safeOptions.execute,
      forum: safeOptions.forum,
      sourceKey: safeOptions.sourceKey,
      sourceId: safeOptions.sourceId,
      enabled: safeOptions.enabled,
      limit: safeOptions.limit,
      pipelineLimit: safeOptions.pipelineLimit,
      now: safeOptions.now,
      storeDir: safeOptions.storeDir,
      runningStaleAfterMs: safeOptions.runningStaleAfterMs,
      workerStaleAfterMs: safeOptions.workerStaleAfterMs
    });
    task = markTaskCompleted(task, {
      status: report.status,
      dryRun: report.dryRun,
      executed: report.executed,
      applied: report.applied,
      manifestName: report.manifestName,
      source: summarizeSource(report.sourceDraft),
      registration: summarizeRegistration(report.registration),
      rollbackPlan: report.rollbackPlan,
      deploymentGate: report.deploymentGate ? {
        status: report.deploymentGate.status,
        gateCount: report.deploymentGate.gateCount
      } : undefined,
      report: compactApplyReport(report)
    });
    await taskRepository.saveTask(task);

    return {
      task,
      report
    };
  } catch (error) {
    task = markTaskFailed(task, error);
    await taskRepository.saveTask(task);
    throw error;
  }
}

function summarizeSource(source) {
  if (!source) return undefined;
  return {
    id: source.id,
    sourceKey: source.sourceKey,
    sourceType: source.sourceType,
    displayName: source.displayName
  };
}

function summarizeRegistration(registration) {
  if (!registration || !registration.source) return undefined;
  return {
    created: registration.created,
    source: summarizeSource(registration.source)
  };
}

function compactApplyReport(report) {
  if (!report) return undefined;
  return {
    generatedAt: report.generatedAt,
    status: report.status,
    dryRun: report.dryRun,
    executed: report.executed,
    applied: report.applied,
    manifestName: report.manifestName,
    sourceDraft: summarizeSource(report.sourceDraft),
    registration: summarizeRegistration(report.registration),
    rollbackPlan: report.rollbackPlan,
    steps: report.steps,
    nextActions: report.nextActions,
    deploymentGate: report.deploymentGate ? {
      generatedAt: report.deploymentGate.generatedAt,
      status: report.deploymentGate.status,
      gateCount: report.deploymentGate.gateCount,
      gates: report.deploymentGate.gates,
      nextActions: report.deploymentGate.nextActions
    } : undefined
  };
}

module.exports = {
  runRolloutManifestApplyTask
};
