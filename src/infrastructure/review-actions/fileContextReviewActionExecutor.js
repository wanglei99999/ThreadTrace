'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

function createFileContextReviewActionExecutor(options) {
  const safeOptions = options || {};
  const baseDir = safeOptions.baseDir;

  return {
    async closeTasks(request) {
      const safeRequest = request || {};
      const record = await writeAuditRecord({
        baseDir: resolveBaseDir(baseDir, safeRequest.storeDir),
        action: 'tasks.closure',
        request: {
          taskId: safeRequest.taskId,
          closeTaskIds: safeRequest.closeTaskIds || [],
          actionGate: compactActionGate(safeRequest.actionGate),
          now: safeRequest.now,
          storeDir: safeRequest.storeDir
        }
      });
      return {
        adapter: 'file-audit',
        action: 'tasks.closure',
        auditFile: record.filePath,
        closeTaskIds: safeRequest.closeTaskIds || [],
        changed: false
      };
    },

    async mergeContext(request) {
      const safeRequest = request || {};
      const record = await writeAuditRecord({
        baseDir: resolveBaseDir(baseDir, safeRequest.storeDir),
        action: 'context.merge',
        request: {
          taskId: safeRequest.taskId,
          mergeCandidates: safeRequest.mergeCandidates || [],
          actionGate: compactActionGate(safeRequest.actionGate),
          now: safeRequest.now,
          storeDir: safeRequest.storeDir
        }
      });
      return {
        adapter: 'file-audit',
        action: 'context.merge',
        auditFile: record.filePath,
        mergeCandidateCount: (safeRequest.mergeCandidates || []).length,
        changed: false
      };
    }
  };
}

async function writeAuditRecord(options) {
  const safeOptions = options || {};
  const baseDir = safeOptions.baseDir;
  const timestamp = safeTimestamp(safeOptions.request && safeOptions.request.now);
  const suffix = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const filePath = path.join(baseDir, timestamp + '-' + safeFilePart(safeOptions.action) + '-' + suffix + '.json');
  const payload = {
    version: '1.0',
    adapter: 'file-audit',
    action: safeOptions.action,
    generatedAt: safeOptions.request && safeOptions.request.now ? safeOptions.request.now : new Date().toISOString(),
    request: safeOptions.request
  };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return {
    filePath
  };
}

function resolveBaseDir(baseDir, storeDir) {
  if (baseDir) return baseDir;
  if (storeDir) return path.join(storeDir, 'review-action-audits');
  return path.join(process.cwd(), 'data', 'store', 'review-action-audits');
}

function compactActionGate(actionGate) {
  if (!actionGate) return undefined;
  return {
    generatedAt: actionGate.generatedAt,
    status: actionGate.status,
    gateCount: actionGate.gateCount,
    executable: actionGate.executable,
    recommendedNextAction: actionGate.recommendedNextAction,
    actionPlan: actionGate.actionPlan ? {
      count: actionGate.actionPlan.count,
      status: actionGate.actionPlan.status,
      closeTaskIds: actionGate.actionPlan.closeTaskIds,
      mergeCandidates: actionGate.actionPlan.mergeCandidates,
      risk: actionGate.actionPlan.risk
    } : undefined
  };
}

function safeTimestamp(value) {
  return String(value || new Date().toISOString()).replace(/[^0-9A-Za-z.-]+/g, '-');
}

function safeFilePart(value) {
  return String(value || 'action').replace(/[^0-9A-Za-z.-]+/g, '-');
}

module.exports = {
  createFileContextReviewActionExecutor
};
