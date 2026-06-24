'use strict';

function getRolloutManifestApplyReport(options) {
  const safeOptions = options || {};
  const manifest = safeOptions.manifest || {};
  const execute = safeOptions.execute === true;
  const dryRun = !execute;
  const deploymentGate = safeOptions.deploymentGate;
  const sourceDraft = safeOptions.sourceDraft;
  const registration = safeOptions.registration;
  const registrationError = safeOptions.registrationError;
  const rollbackPlan = buildRollbackPlan({
    execute,
    registration,
    sourceDraft
  });
  const steps = [
    step('manifest.source', sourceDraft ? 'ok' : 'fail', sourceDraft ? 'Source draft was extracted from the rollout manifest.' : 'Rollout manifest must include a source object.', {
      sourceKey: sourceDraft && sourceDraft.sourceKey,
      sourceType: sourceDraft && sourceDraft.sourceType
    }),
    step('deployment.gate', reportStatus(deploymentGate), 'Deployment gate was evaluated before applying the manifest.', gateEvidence(deploymentGate)),
    step('source.registration', registrationStepStatus({ execute, deploymentGate, registration, registrationError, sourceDraft }), registrationSummary({ execute, deploymentGate, registration, registrationError, sourceDraft }), registrationEvidence({ registration, registrationError, dryRun }))
  ];

  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: aggregateStatus(steps.map(function (item) { return item.status; })),
    dryRun,
    executed: execute,
    applied: Boolean(registration && execute),
    manifestName: manifest.name,
    sourceDraft,
    registration,
    registrationError: publicError(registrationError),
    rollbackPlan,
    steps,
    nextActions: nextActions(steps, deploymentGate),
    deploymentGate
  };
}

function reportStatus(report) {
  if (!report) return 'warn';
  return report.status || 'warn';
}

function gateEvidence(gate) {
  if (!gate) return {};
  return {
    status: gate.status,
    gateCount: gate.gateCount,
    nextActionCount: (gate.nextActions || []).length
  };
}

function registrationStepStatus(options) {
  if (!options.sourceDraft) return 'fail';
  if (options.registrationError) return 'fail';
  if (options.execute && options.deploymentGate && options.deploymentGate.status === 'fail') return 'fail';
  if (options.registration) return 'ok';
  return options.execute ? 'warn' : 'ok';
}

function registrationSummary(options) {
  if (!options.sourceDraft) return 'No source draft is available to register.';
  if (options.registrationError) return 'Source registration failed.';
  if (options.execute && options.deploymentGate && options.deploymentGate.status === 'fail') return 'Source registration was blocked by a failing deployment gate.';
  if (options.registration) return (options.registration.created ? 'Source was created from the rollout manifest.' : 'Source was updated from the rollout manifest.');
  return 'Source registration is ready; dry-run mode did not write to the source repository.';
}

function registrationEvidence(options) {
  if (options.registration) {
    return {
      sourceId: options.registration.source && options.registration.source.id,
      created: options.registration.created
    };
  }
  if (options.registrationError) {
    return {
      error: publicError(options.registrationError)
    };
  }
  return {
    dryRun: options.dryRun
  };
}

function buildRollbackPlan(options) {
  const safeOptions = options || {};
  const registration = safeOptions.registration;
  const source = registration && registration.source || safeOptions.sourceDraft;
  const sourceId = source && source.id;
  const commands = sourceId
    ? [
      'node src/presentation/cli/threadtrace.js disable-source --source-id ' + sourceId + ' --execute true',
      'node src/presentation/cli/threadtrace.js source-diagnostics --source-id ' + sourceId
    ]
    : [
      'node src/presentation/cli/threadtrace.js list-sources',
      'node src/presentation/cli/threadtrace.js disable-source --source-id <source-id> --execute true'
    ];
  return {
    available: Boolean(sourceId),
    mode: safeOptions.execute ? 'post-apply' : 'dry-run-template',
    sourceId,
    sourceKey: source && source.sourceKey,
    sourceType: source && source.sourceType,
    summary: sourceId
      ? 'Disable the registered source if this rollout must be rolled back.'
      : 'After execute=true, use the registered source id to disable the source if rollback is needed.',
    commands
  };
}

function nextActions(steps, deploymentGate) {
  const actions = steps.filter(function (item) {
    return item.status !== 'ok';
  }).map(function (item) {
    return {
      key: item.key,
      severity: item.status === 'fail' ? 'critical' : 'warning',
      summary: item.summary,
      commands: commandsForStep(item.key)
    };
  });
  if (deploymentGate && deploymentGate.status !== 'ok') {
    actions.push({
      key: 'deployment.gate.actions',
      severity: deploymentGate.status === 'fail' ? 'critical' : 'warning',
      summary: 'Review deployment gate next actions before production rollout.',
      commands: (deploymentGate.nextActions || []).flatMap(function (action) {
        return action.commands || [];
      }),
      details: (deploymentGate.nextActions || []).flatMap(function (action) {
        return action.details || [];
      })
    });
  }
  return actions;
}

function commandsForStep(key) {
  const commands = {
    'manifest.source': ['node src/presentation/cli/threadtrace.js rollout-manifest-plan --manifest-file <file>'],
    'deployment.gate': ['node src/presentation/cli/threadtrace.js deployment-gate --manifest-file <file>'],
    'source.registration': ['node src/presentation/cli/threadtrace.js rollout-manifest-apply --manifest-file <file> --execute true']
  };
  return commands[key] || [];
}

function step(key, status, summary, evidence) {
  return {
    key,
    status,
    summary,
    evidence: evidence || {}
  };
}

function aggregateStatus(statuses) {
  if (statuses.some(function (status) { return status === 'fail'; })) return 'fail';
  if (statuses.some(function (status) { return status === 'warn'; })) return 'warn';
  return 'ok';
}

function publicError(error) {
  if (!error) return undefined;
  return {
    message: error.message,
    code: error.code,
    details: error.details
  };
}

module.exports = {
  getRolloutManifestApplyReport
};
