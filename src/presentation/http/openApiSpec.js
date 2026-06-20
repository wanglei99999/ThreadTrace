'use strict';

function createOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'ThreadTrace API',
      version: '0.1.0',
      description: 'Forum thread context tracing and evidence analysis API.'
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: {
            200: {
              description: 'Service status'
            }
          }
        }
      },
      '/adapters': {
        get: {
          summary: 'List forum adapters',
          responses: {
            200: {
              description: 'Registered forum adapters'
            }
          }
        }
      },
      '/api/adapters/diagnostics': {
        get: {
          summary: 'Diagnose forum adapter registry contracts',
          parameters: [
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } }
          ],
          responses: {
            200: {
              description: 'Adapter diagnostics are ok or warn'
            },
            503: {
              description: 'Adapter diagnostics failed'
            }
          }
        }
      },
      '/api/source-ingest-handlers': {
        get: {
          summary: 'List source ingest handlers',
          responses: {
            200: {
              description: 'Registered source ingest handlers'
            }
          }
        }
      },
      '/api/contracts/thread-snapshot-json': {
        get: {
          summary: 'Get the canonical ThreadSnapshot JSON contract for normalized-thread-json sources',
          responses: {
            200: {
              description: 'ThreadSnapshot JSON contract and example payload'
            }
          }
        }
      },
      '/api/contracts/connector-module': {
        get: {
          summary: 'Get the external connector module contract for runtime extension modules',
          responses: {
            200: {
              description: 'Connector module export shapes, registration context, and example module'
            }
          }
        }
      },
      '/api/contracts/context-review-handoff': {
        get: {
          summary: 'Get the ContextReviewHandoff JSON contract for new-post review handoff packages',
          responses: {
            200: {
              description: 'ContextReviewHandoff schema, example payload, and downstream hook guidance'
            }
          }
        }
      },
      '/api/contracts/context-review-handoff/validate': {
        post: {
          summary: 'Validate a ContextReviewHandoff payload before review, persistence, or notification',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    handoff: { type: 'object' },
                    payload: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'ContextReviewHandoff payload is valid'
            },
            400: {
              description: 'ContextReviewHandoff payload is invalid'
            }
          }
        }
      },
      '/api/contracts/context-review-result': {
        get: {
          summary: 'Get the ContextReviewResult JSON contract for human or LLM review outputs',
          responses: {
            200: {
              description: 'ContextReviewResult schema, example payload, and downstream hook guidance'
            }
          }
        }
      },
      '/api/contracts/context-review-result/validate': {
        post: {
          summary: 'Validate a ContextReviewResult payload before merge, persistence, or task closure',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: { type: 'object' },
                    payload: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'ContextReviewResult payload is valid'
            },
            400: {
              description: 'ContextReviewResult payload is invalid'
            }
          }
        }
      },
      '/api/context-review-results/summarize': {
        post: {
          summary: 'Validate and summarize a ContextReviewResult for task closure, merge, and notification planning',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: { type: 'object' },
                    payload: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'ContextReviewResult is valid and summary is available'
            },
            400: {
              description: 'ContextReviewResult payload is invalid'
            }
          }
        }
      },
      '/api/context-review-results': {
        get: {
          summary: 'List submitted ContextReviewResult records from the durable review archive',
          parameters: [
            { name: 'handoffId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'partially-accepted' } },
            { name: 'reviewerId', in: 'query', required: false, schema: { type: 'string', example: 'operator-1' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 50 } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Submitted review result records'
            }
          }
        },
        post: {
          summary: 'Validate, summarize, and persist a ContextReviewResult into the durable review archive',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    result: { type: 'object' },
                    payload: { type: 'object' },
                    traceId: { type: 'string' },
                    now: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: 'ContextReviewResult was validated, summarized, and stored'
            },
            400: {
              description: 'ContextReviewResult payload is invalid'
            }
          }
        }
      },
      '/api/context-review-results/overview': {
        get: {
          summary: 'Summarize submitted ContextReviewResult records for dashboards and merge workers',
          parameters: [
            { name: 'handoffId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'partially-accepted' } },
            { name: 'reviewerId', in: 'query', required: false, schema: { type: 'string', example: 'operator-1' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Review result status, severity, task, and merge-candidate aggregates'
            }
          }
        }
      },
      '/api/context-review-results/action-plan': {
        get: {
          summary: 'Build a read-only closure and merge action plan from submitted ContextReviewResult records',
          parameters: [
            { name: 'handoffId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'partially-accepted' } },
            { name: 'reviewerId', in: 'query', required: false, schema: { type: 'string', example: 'operator-1' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Read-only review result action plan with close, keep-open, merge, blocked, attention, and risk sections'
            }
          }
        }
      },
      '/api/context-review-results/events': {
        post: {
          summary: 'Dry-run or execute synthesis of attention-worthy ContextReviewResult records into notification events',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    execute: { type: 'boolean', example: false },
                    dryRun: { type: 'boolean', example: true },
                    handoffId: { type: 'string' },
                    status: { type: 'string', example: 'partially-accepted' },
                    reviewerId: { type: 'string', example: 'operator-1' },
                    limit: { type: 'number', example: 50 },
                    now: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Context review result notification event synthesis result'
            }
          }
        }
      },
      '/api/connectors/catalog': {
        get: {
          summary: 'List source connector catalog',
          parameters: [
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } }
          ],
          responses: {
            200: {
              description: 'Source types, required locations, and compatible forum adapters'
            }
          }
        }
      },
      '/api/connectors/readiness': {
        get: {
          summary: 'Summarize source connector readiness across handlers, adapters, and tracked sources',
          parameters: [
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Connectors are ready or have warnings'
            },
            503: {
              description: 'At least one connector has failing readiness checks'
            }
          }
        }
      },
      '/api/analyze-directory': {
        post: {
          summary: 'Analyze a saved HTML directory',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Basic historical analysis report'
            }
          }
        }
      },
      '/api/enrich-directory': {
        post: {
          summary: 'Analyze and semantically enrich a saved HTML directory',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Analysis report with semanticInsights'
            }
          }
        }
      },
      '/api/interpret-text': {
        post: {
          summary: 'Restore context for a new post text',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    text: { type: 'string', example: '科技后面看量确认' },
                    authorId: { type: 'string', example: '150058' },
                    author: { type: 'string', example: '-阿狼-' },
                    publishedAt: { type: 'string', example: '2026-06-18 20:00' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'New post context report with interpretationSummary, contextMatchSummary, contextReviewTasks, and contextReviewHandoff'
            },
            400: {
              description: 'Invalid request'
            }
          }
        }
      },
      '/api/tasks/ingest-directory': {
        post: {
          summary: 'Run an ingest/analyze/persist task for a saved HTML directory',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed task and report; includes idempotency replay metadata when a completed task is reused'
            }
          }
        }
      },
      '/api/tasks': {
        get: {
          summary: 'List task records',
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'type', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'requestId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'traceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'idempotencyKey', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } }
          ],
          responses: {
            200: {
              description: 'Task records'
            }
          }
        }
      },
      '/api/sources/tasks/insight-pipeline-runs': {
        get: {
          summary: 'List recent source insight pipeline runs',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'completed' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'scanLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source insight pipeline run summaries'
            }
          }
        }
      },
      '/api/reports': {
        get: {
          summary: 'List analysis reports',
          parameters: [
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceThreadId', in: 'query', required: false, schema: { type: 'string', example: '45974302' } },
            { name: 'reportType', in: 'query', required: false, schema: { type: 'string', example: 'semantic-enrichment' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Analysis reports'
            }
          }
        }
      },
      '/api/reports/tasks/semantic-enrichment': {
        post: {
          summary: 'Run and persist semantic enrichment for a stored base report',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sourceThreadId'],
                  properties: {
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceThreadId: { type: 'string', example: '45974302' },
                    baseReportType: { type: 'string', example: 'basic-history' },
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed semantic enrichment task; includes idempotency replay metadata when a completed task is reused'
            },
            400: {
              description: 'Invalid request'
            }
          }
        }
      },
      '/api/connectors/modules/validate': {
        post: {
          summary: 'Validate that a connector module file can load and register adapters or handlers',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
                  },
                  required: ['modulePath']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Connector module validation passed'
            },
            503: {
              description: 'Connector module validation failed'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/connectors/rollout-plan': {
        post: {
          summary: 'Build a read-only connector rollout plan from contract, module validation, onboarding preflight, readiness, and deployment checks',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    forum: { type: 'string', example: 'external' },
                    sourceKey: { type: 'string', example: 'external' },
                    sourceType: { type: 'string', example: 'external-feed' },
                    displayName: { type: 'string', example: 'External feed' },
                    modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
                    inputDir: { type: 'string' },
                    inputFile: { type: 'string' },
                    url: { type: 'string' },
                    location: { type: 'object' },
                    intervalMinutes: { type: 'number', example: 60 },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    scheduleEnabled: { type: 'boolean' },
                    enabled: { type: 'boolean' },
                    allowUnknownSourceType: { type: 'boolean', example: false },
                    allowRemoteFetch: { type: 'boolean', example: false },
                    dryRunIngest: { type: 'boolean', example: true },
                    limit: { type: 'number', example: 100 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Rollout plan is ok or has warnings'
            },
            503: {
              description: 'Rollout plan contains a failing step'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/operations/overview': {
        get: {
          summary: 'Get operational overview across sources, tasks, events, and raw pages',
          parameters: [
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Operational overview'
            }
          }
        }
      },
      '/api/operations/readiness': {
        get: {
          summary: 'Get operations readiness status for probes and monitoring',
          parameters: [
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Readiness is ok or warn'
            },
            503: {
              description: 'Readiness failed'
            }
          }
        }
      },
      '/api/operations/trace-context': {
        get: {
          summary: 'Get tasks correlated by request, trace, or idempotency key',
          parameters: [
            { name: 'requestId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'traceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'idempotencyKey', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'type', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Trace-correlated task context'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/operations/runbook': {
        get: {
          summary: 'Get actionable operations runbook items from diagnostics and recent pipeline runs',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'pipelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'taskLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Runbook has no critical actions'
            },
            503: {
              description: 'Runbook contains critical actions'
            }
          }
        }
      },
      '/api/operations/runbook/events': {
        post: {
          summary: 'Dry-run or execute synthesis of operations runbook actions into notification outbox events',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    execute: { type: 'boolean', example: false },
                    dryRun: { type: 'boolean', example: true },
                    forum: { type: 'string', example: 'nga' },
                    sourceKey: { type: 'string', example: 'nga' },
                    enabled: { type: 'boolean' },
                    limit: { type: 'number', example: 100 },
                    pipelineLimit: { type: 'number', example: 20 },
                    taskLimit: { type: 'number', example: 100 },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
                    sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
                    includeRunbook: { type: 'boolean', example: false },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Runbook notification event synthesis result'
            }
          }
        }
      },
      '/api/operations/worker-topology-plan': {
        get: {
          summary: 'Plan worker deployment topology for local, single-process, or split-worker operations',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'topology', in: 'query', required: false, schema: { type: 'string', enum: ['operations-worker', 'split-workers'] } },
            { name: 'sourceTaskMode', in: 'query', required: false, schema: { type: 'string', enum: ['ingest', 'insight-pipeline'] } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'workerStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } }
          ],
          responses: {
            200: {
              description: 'Worker topology plan is ok or has warnings'
            },
            503: {
              description: 'Worker topology plan has failing checks'
            }
          }
        }
      },
      '/api/operations/rollout-manifest-plan': {
        post: {
          summary: 'Evaluate a repeatable rollout manifest across source onboarding, connector checks, ingest dry-run, and worker topology',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    version: { type: 'string', example: '1.0' },
                    name: { type: 'string', example: 'nga-sample-rollout' },
                    source: {
                      type: 'object',
                      properties: {
                        sourceKey: { type: 'string', example: 'nga' },
                        sourceType: { type: 'string', example: 'saved-html-directory' },
                        displayName: { type: 'string', example: 'NGA sample archive' },
                        inputDir: { type: 'string', example: 'example' },
                        inputFile: { type: 'string' },
                        url: { type: 'string' },
                        location: { type: 'object' }
                      }
                    },
                    connector: {
                      type: 'object',
                      properties: {
                        modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' }
                      }
                    },
                    ingest: {
                      type: 'object',
                      properties: {
                        dryRun: { type: 'boolean', example: true },
                        allowRemoteFetch: { type: 'boolean', example: false }
                      }
                    },
                    workers: {
                      type: 'object',
                      properties: {
                        topology: { type: 'string', enum: ['operations-worker', 'split-workers'] },
                        sourceTaskMode: { type: 'string', enum: ['ingest', 'insight-pipeline'] }
                      }
                    },
                    deployment: {
                      type: 'object',
                      properties: {
                        storeDir: { type: 'string' },
                        limit: { type: 'number', example: 100 },
                        workerStaleAfterMs: { type: 'number' }
                      }
                    },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Manifest plan is ok or has warnings'
            },
            503: {
              description: 'Manifest plan has failing checks'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/operations/resource-provisioning-plan': {
        post: {
          summary: 'Plan external resources, environment variables, and bootstrap commands required by the current runtime and optional rollout manifest',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    manifest: {
                      type: 'object',
                      description: 'Optional rollout manifest to include source, connector, ingest, and worker-specific resource requirements'
                    },
                    source: {
                      type: 'object',
                      description: 'A rollout manifest can also be supplied directly as the request body'
                    },
                    forum: { type: 'string', example: 'nga' },
                    sourceKey: { type: 'string', example: 'nga' },
                    enabled: { type: 'boolean' },
                    limit: { type: 'number', example: 100 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' },
                    workerStaleAfterMs: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Resource provisioning plan is ok or has warnings'
            },
            503: {
              description: 'Required resource provisioning has failing checks'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/operations/rollout-manifest/apply': {
        post: {
          summary: 'Dry-run or execute rollout manifest source registration after deployment gate evaluation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    manifest: {
                      type: 'object',
                      description: 'Rollout manifest to apply'
                    },
                    source: {
                      type: 'object',
                      description: 'A rollout manifest can also be supplied directly as the request body'
                    },
                    execute: { type: 'boolean', example: false },
                    dryRun: { type: 'boolean', example: true },
                    limit: { type: 'number', example: 100 },
                    pipelineLimit: { type: 'number', example: 20 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' },
                    workerStaleAfterMs: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Manifest apply dry-run or execution completed and returned a task audit record with report'
            },
            503: {
              description: 'Manifest apply was blocked by missing source data, gate failure, or registration failure'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/runtime/diagnostics': {
        get: {
          summary: 'Get redacted runtime configuration diagnostics',
          parameters: [
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } }
          ],
          responses: {
            200: {
              description: 'Runtime diagnostics are ok or warn'
            },
            503: {
              description: 'Runtime diagnostics failed'
            }
          }
        }
      },
      '/api/deployment/checklist': {
        get: {
          summary: 'Get deployment readiness checklist across runtime, sources, workers, notifications, and LLM',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Deployment checklist is ok or warn'
            },
            503: {
              description: 'Deployment checklist failed'
            }
          }
        }
      },
      '/api/deployment/gate': {
        post: {
          summary: 'Evaluate rollout, resource provisioning, deployment checklist, and operations runbook gates before deployment',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    manifest: {
                      type: 'object',
                      description: 'Optional rollout manifest'
                    },
                    source: {
                      type: 'object',
                      description: 'A rollout manifest can also be supplied directly as the request body'
                    },
                    forum: { type: 'string', example: 'nga' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceId: { type: 'string' },
                    enabled: { type: 'boolean' },
                    limit: { type: 'number', example: 100 },
                    pipelineLimit: { type: 'number', example: 20 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' },
                    workerStaleAfterMs: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Deployment gate is ok or has warnings'
            },
            503: {
              description: 'Deployment gate has failing checks'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/notifications/diagnostics': {
        get: {
          summary: 'Diagnose notification delivery channel configuration',
          parameters: [
            { name: 'channel', in: 'query', required: false, schema: { type: 'string', example: 'file' } },
            { name: 'webhookUrl', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Notification channel diagnostics are ok or warn'
            },
            503: {
              description: 'Notification channel diagnostics failed'
            }
          }
        }
      },
      '/api/events': {
        get: {
          summary: 'List notification events',
          parameters: [
            { name: 'type', in: 'query', required: false, schema: { type: 'string', example: 'source-changed' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'acknowledged', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'deliveryStatus', in: 'query', required: false, schema: { type: 'string', example: 'pending' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Notification events'
            }
          }
        }
      },
      '/api/events/dispatch': {
        post: {
          summary: 'Dispatch pending notification events',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    channel: { type: 'string', example: 'webhook' },
                    webhookUrl: { type: 'string', example: 'https://example.com/threadtrace-events' },
                    timeoutMs: { type: 'number', example: 10000 },
                    limit: { type: 'number', example: 50 },
                    maxAttempts: { type: 'number', example: 3 },
                    retryBackoffMs: { type: 'number', example: 60000 },
                    maxRetryBackoffMs: { type: 'number', example: 3600000 },
                    includeFailed: { type: 'boolean' },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Dispatch summary'
            }
          }
        }
      },
      '/api/raw-pages': {
        get: {
          summary: 'List stored raw forum pages',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceThreadId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'url', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Raw page evidence records'
            }
          }
        }
      },
      '/api/crawl-page': {
        post: {
          summary: 'Fetch and store a raw forum page',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    sourceId: { type: 'string' },
                    sourceThreadId: { type: 'string', example: '45974302' },
                    url: { type: 'string', example: 'https://bbs.nga.cn/read.php?tid=45974302' },
                    page: { type: 'number', example: 1 },
                    headers: { type: 'object' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Stored raw page evidence'
            },
            400: {
              description: 'Invalid request'
            }
          }
        }
      },
      '/api/raw-pages/tasks/ingest': {
        post: {
          summary: 'Replay a stored raw page into snapshot and report storage',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['contentSha1'],
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    contentSha1: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed raw page replay task; includes idempotency replay metadata when a completed task is reused'
            },
            400: {
              description: 'Invalid request'
            }
          }
        }
      },
      '/api/thread-json/validate': {
        post: {
          summary: 'Validate a normalized ThreadSnapshot JSON file before registering or ingesting it',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['inputFile'],
                  properties: {
                    forum: { type: 'string', example: 'external' },
                    sourceKey: { type: 'string', example: 'external' },
                    inputFile: { type: 'string', example: 'D:/feeds/threadtrace/thread.json' },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Thread JSON is valid'
            },
            400: {
              description: 'Thread JSON is invalid'
            }
          }
        }
      },
      '/api/events/{eventId}/ack': {
        post: {
          summary: 'Acknowledge a notification event',
          parameters: [
            { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    acknowledgedBy: { type: 'string', example: 'web' },
                    note: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Acknowledged notification event'
            }
          }
        }
      },
      '/api/sources': {
        get: {
          summary: 'List tracked forum sources',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } }
          ],
          responses: {
            200: {
              description: 'Tracked sources'
            }
          }
        },
        post: {
          summary: 'Register or update a tracked forum source',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    forum: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'saved-html-directory' },
                    displayName: { type: 'string', example: 'NGA sample archive' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    inputFile: { type: 'string', example: 'D:/feeds/threadtrace/thread.json' },
                    url: { type: 'string' },
                    intervalMinutes: { type: 'number', example: 60 },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    scheduleEnabled: { type: 'boolean' },
                    enabled: { type: 'boolean' },
                    allowUnknownSourceType: { type: 'boolean', example: false },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Created source'
            },
            200: {
              description: 'Updated source'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/sources/validate': {
        post: {
          summary: 'Validate a tracked source before saving it',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    forum: { type: 'string', example: 'nga' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'saved-html-directory' },
                    displayName: { type: 'string', example: 'NGA sample archive' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    inputFile: { type: 'string', example: 'D:/feeds/threadtrace/thread.json' },
                    url: { type: 'string' },
                    location: { type: 'object' },
                    intervalMinutes: { type: 'number', example: 60 },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    scheduleEnabled: { type: 'boolean' },
                    enabled: { type: 'boolean' },
                    allowUnknownSourceType: { type: 'boolean', example: false },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Validation report with source draft and readiness checks'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/sources/onboarding/preflight': {
        post: {
          summary: 'Run source onboarding preflight across catalog, readiness, source draft, and optional ThreadSnapshot JSON',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    forum: { type: 'string', example: 'nga' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'normalized-thread-json' },
                    displayName: { type: 'string', example: 'External ThreadSnapshot feed' },
                    modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    inputFile: { type: 'string', example: 'D:/feeds/threadtrace/thread.json' },
                    url: { type: 'string' },
                    location: { type: 'object' },
                    intervalMinutes: { type: 'number', example: 60 },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    scheduleEnabled: { type: 'boolean' },
                    enabled: { type: 'boolean' },
                    allowUnknownSourceType: { type: 'boolean', example: false },
                    limit: { type: 'number', example: 100 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Preflight is ok or warn'
            },
            503: {
              description: 'Preflight failed'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/sources/ingest/dry-run': {
        post: {
          summary: 'Execute a source ingest handler against isolated in-memory repositories before registering or scheduling a source',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    forum: { type: 'string', example: 'external' },
                    sourceKey: { type: 'string', example: 'external' },
                    sourceType: { type: 'string', example: 'normalized-thread-json' },
                    displayName: { type: 'string', example: 'External dry-run feed' },
                    modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
                    inputDir: { type: 'string' },
                    inputFile: { type: 'string', example: 'D:/feeds/threadtrace/thread.json' },
                    url: { type: 'string' },
                    location: { type: 'object' },
                    allowRemoteFetch: { type: 'boolean', example: false },
                    allowUnknownSourceType: { type: 'boolean', example: false },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Dry-run completed successfully'
            },
            503: {
              description: 'Dry-run validation or handler execution failed'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      },
      '/api/sources/diagnostics': {
        get: {
          summary: 'Diagnose tracked source ingest configuration',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source diagnostics are ok or warn'
            },
            503: {
              description: 'Source diagnostics failed'
            }
          }
        }
      },
      '/api/sources/lifecycle': {
        get: {
          summary: 'Report tracked source lifecycle state, disable guards, failure resets, and recent lifecycle tasks',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'taskLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Lifecycle report with disable guard state, failure retry state, and recent lifecycle task audit records'
            }
          }
        }
      },
      '/api/sources/schedule': {
        get: {
          summary: 'Preview tracked source due scheduling decisions without running workers',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Schedule preview with due and skipped sources plus decision reasons'
            }
          }
        }
      },
      '/api/sources/{sourceId}/disable': {
        post: {
          summary: 'Dry-run or execute a safe tracked source disable operation with task audit record',
          parameters: [
            { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    execute: { type: 'boolean', example: false },
                    dryRun: { type: 'boolean', example: true },
                    force: { type: 'boolean', example: false },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Source disable dry-run or execution result with task audit record'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            },
            409: {
              $ref: '#/components/responses/Conflict'
            }
          }
        }
      },
      '/api/sources/{sourceId}/enable': {
        post: {
          summary: 'Dry-run or execute a safe tracked source enable operation with task audit record',
          parameters: [
            { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    execute: { type: 'boolean', example: false },
                    dryRun: { type: 'boolean', example: true },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Source enable dry-run or execution result with task audit record'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            }
          }
        }
      },
      '/api/sources/{sourceId}/failure/reset': {
        post: {
          summary: 'Dry-run or execute a tracked source failure-state reset with task audit record',
          parameters: [
            { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    execute: { type: 'boolean', example: false },
                    dryRun: { type: 'boolean', example: true },
                    retryNow: { type: 'boolean', example: true },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    resetBy: { type: 'string', example: 'operator' },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Source failure reset dry-run or execution result with task audit record'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            }
          }
        }
      },
      '/api/sources/{sourceId}/tasks/ingest': {
        post: {
          summary: 'Run an ingest task from a tracked source',
          parameters: [
            { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed ingest task and report'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            },
            409: {
              $ref: '#/components/responses/Conflict'
            }
          }
        }
      },
      '/api/sources/{sourceId}/tasks/insight-pipeline': {
        post: {
          summary: 'Run source ingest and optional semantic enrichment pipeline',
          parameters: [
            { name: 'sourceId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string' },
                    baseReportType: { type: 'string', example: 'basic-history' },
                    semanticEnrichmentEnabled: { type: 'boolean' },
                    semanticSkipIfUnchanged: { type: 'boolean' },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed source insight pipeline task'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            },
            409: {
              $ref: '#/components/responses/Conflict'
            }
          }
        }
      },
      '/api/sources/tasks/ingest': {
        post: {
          summary: 'Run ingest tasks for all enabled tracked sources',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    limit: { type: 'number', example: 50 },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Batch task summary'
            }
          }
        }
      },
      '/api/sources/tasks/ingest-due': {
        post: {
          summary: 'Run ingest tasks for due tracked sources only',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    limit: { type: 'number', example: 50 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
                    sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Due-source batch task summary'
            }
          }
        }
      },
      '/api/sources/tasks/insight-pipeline-due': {
        post: {
          summary: 'Run source insight pipelines for due tracked sources only',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    limit: { type: 'number', example: 50 },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
                    sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string' },
                    baseReportType: { type: 'string', example: 'basic-history' },
                    semanticEnrichmentEnabled: { type: 'boolean' },
                    semanticSkipIfUnchanged: { type: 'boolean' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Due source insight pipeline batch summary'
            }
          }
        }
      },
      '/api/index-directory': {
        post: {
          summary: 'Index posts from a saved HTML directory into the retrieval index',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forum: { type: 'string', example: 'nga' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Index summary'
            }
          }
        }
      },
      '/api/search': {
        post: {
          summary: 'Search indexed historical evidence',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: { type: 'string', example: '科技' },
                    limit: { type: 'number', example: 10 },
                    filter: { type: 'object' },
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Search results'
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            }
          }
        }
      }
    },
    components: {
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['message'],
              properties: {
                message: { type: 'string' },
                code: {
                  type: 'string',
                  example: 'source_run_already_running'
                },
                details: {
                  type: 'object',
                  additionalProperties: true
                },
                requestId: {
                  type: 'string',
                  example: '0f5f2fcb-6bdb-4319-8b5b-ff54c2ac48b0'
                }
              }
            }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Invalid request or validation failure',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        NotFound: {
          description: 'Requested resource was not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        Conflict: {
          description: 'Request conflicts with the current resource state',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        RequestTooLarge: {
          description: 'Request body exceeds the configured limit',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        }
      }
    }
  };
}

module.exports = {
  createOpenApiSpec
};
