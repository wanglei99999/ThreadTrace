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
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
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
                    sourceId: { type: 'string' },
                    sourceKey: { type: 'string', example: 'nga' },
                    forum: { type: 'string', example: 'nga' },
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
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
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
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Read-only review result action plan with close, keep-open, merge, blocked, attention, and risk sections',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ContextReviewActionPlan'
                  }
                }
              }
            }
          }
        }
      },
      '/api/context-review-results/action-gate': {
        get: {
          summary: 'Evaluate whether a ContextReviewResult action plan is safe for downstream closure or merge workers',
          parameters: [
            { name: 'handoffId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'partially-accepted' } },
            { name: 'reviewerId', in: 'query', required: false, schema: { type: 'string', example: 'operator-1' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Action gate report with readiness gates, executable flags, next actions, and the underlying action plan',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ContextReviewActionGate'
                  }
                }
              }
            }
          }
        }
      },
      '/api/context-review-results/action-tasks/apply': {
        post: {
          summary: 'Create an audited dry-run task for applying ContextReviewResult closure and merge actions',
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
                    sourceId: { type: 'string' },
                    sourceKey: { type: 'string', example: 'nga' },
                    limit: { type: 'number', example: 100 },
                    now: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
                    storeDir: { type: 'string' },
                    traceId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Context review action task completed in dry-run mode or executor-backed execution mode'
            },
            503: {
              description: 'Review action gate failed or execution was requested without configured executors'
            }
          }
        }
      },
      '/api/context-review-results/action-audits': {
        get: {
          summary: 'List file-audit executor records for ContextReviewResult action execution',
          parameters: [
              { name: 'action', in: 'query', required: false, schema: { type: 'string', example: 'tasks.closure' } },
              { name: 'taskId', in: 'query', required: false, schema: { type: 'string' } },
              { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
              { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
              { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 50 } },
              { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Review action audit records with action type, compact executor request, and audit file path',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ContextReviewActionAuditListResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/context-review-results/action-audits/overview': {
        get: {
          summary: 'Summarize file-audit executor records for operational monitoring',
          parameters: [
              { name: 'action', in: 'query', required: false, schema: { type: 'string', example: 'tasks.closure' } },
              { name: 'taskId', in: 'query', required: false, schema: { type: 'string' } },
              { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
              { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
              { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Review action audit counts by action and adapter, planned closure and merge totals, and recent records',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ContextReviewActionAuditOverview'
                  }
                }
              }
            }
          }
        }
      },
      '/api/context-review-results/action-executions': {
        get: {
          summary: 'List review action execution ledger records for idempotency and replay inspection',
          parameters: [
            { name: 'action', in: 'query', required: false, schema: { type: 'string', example: 'tasks.closure' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'completed' } },
            { name: 'taskId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 50 } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Execution ledger records with action type, status, request hash, result, and file path when available',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ContextReviewActionExecutionListResult'
                  }
                }
              }
            },
            503: {
              description: 'Execution ledger repository is not configured for this storage mode'
            }
          }
        }
      },
      '/api/context-review-results/action-executor/diagnostics': {
        get: {
          summary: 'Report review action executor mode, readiness, and audit evidence before execute=true',
          parameters: [
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-21T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Executor diagnostics with configured mode, method readiness, audit evidence, checks, and next actions'
            },
            503: {
              description: 'Executor mode is configured but required methods are missing'
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
                    sourceId: { type: 'string' },
                    sourceKey: { type: 'string', example: 'nga' },
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
            { name: 'modulePath', in: 'query', required: false, schema: { type: 'string', example: 'D:/connectors/custom-forum.cjs' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } }
          ],
          responses: {
            200: {
              description: 'Source types, required locations, compatible forum adapters, and onboarding recipes',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceConnectorCatalog'
                  }
                }
              }
            }
          }
        }
      },
      '/api/connectors/packages/recommended-manifest': {
        get: {
          summary: 'Load a connector package recommended rollout manifest',
          parameters: [
            { name: 'modulePath', in: 'query', required: true, schema: { type: 'string', example: 'docs/examples/rss-archive-connector-package/index.cjs' } },
            { name: 'packageName', in: 'query', required: false, schema: { type: 'string', example: '@threadtrace/example-rss-archive-connector-package' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'rss-archive-normalized-feed' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-25T10:00:00.000Z' } }
          ],
          responses: {
            200: {
              description: 'Connector package recommended rollout manifest',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ConnectorPackageRecommendedManifest'
                  }
                }
              }
            }
          }
        }
      },
      '/api/connectors/source-type-readiness': {
        get: {
          summary: 'Summarize source type readiness across catalog coverage and tracked source diagnostics',
          parameters: [
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'modulePath', in: 'query', required: false, schema: { type: 'string', example: 'D:/connectors/custom-forum.cjs' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source type readiness report',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeReadinessReport'
                  }
                }
              }
            },
            503: {
              description: 'At least one source type is failing readiness',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeReadinessReport'
                  }
                }
              }
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
      '/api/llm/preflight': {
        post: {
          summary: 'Run an LLM provider preflight sample and validate structured output',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string', example: 'manual-llm-preflight' },
                    now: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
                    input: { type: 'object', additionalProperties: true }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Provider returned valid semantic enrichment JSON',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmProviderPreflightReport' }
                }
              }
            },
            503: {
              description: 'Provider configuration, call, or structured output validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmProviderPreflightReport' }
                }
              }
            }
          }
        }
      },
      '/api/llm/evaluate': {
        post: {
          summary: 'Run LLM provider semantic evaluation samples and quality checks',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string', example: 'manual-llm-evaluation' },
                    now: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
                    samples: {
                      type: 'array',
                      items: { type: 'object', additionalProperties: true }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Provider returned valid semantic enrichment JSON for evaluation samples, with optional quality warnings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmProviderEvaluationReport' }
                }
              }
            },
            503: {
              description: 'Provider configuration, call, or structured output validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmProviderEvaluationReport' }
                }
              }
            }
          }
        }
      },
      '/api/llm/readiness': {
        post: {
          summary: 'Summarize LLM configuration, optional preflight, and optional evaluation readiness',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string', example: 'mock' },
                    llmReadinessMode: { type: 'string', enum: ['configuration', 'preflight', 'evaluation'] },
                    traceId: { type: 'string', example: 'manual-llm-readiness' },
                    now: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
                    input: { type: 'object', additionalProperties: true },
                    samples: {
                      type: 'array',
                      items: { type: 'object', additionalProperties: true }
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'LLM readiness profile is available, with optional warnings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmReadinessProfile' }
                }
              }
            },
            503: {
              description: 'LLM readiness profile has failing preflight or evaluation checks',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmReadinessProfile' }
                }
              }
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
      '/api/tasks/{taskId}': {
        get: {
          summary: 'Get task detail with trace context and operations links',
          parameters: [
            { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'traceLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Task detail, correlated trace context, and recommended operations',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/TaskDetail'
                  }
                }
              }
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            },
            404: {
              $ref: '#/components/responses/NotFound'
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
      '/api/intelligence/authors': {
        get: {
          summary: 'Build an author and opinion intelligence dashboard from stored basic-history reports',
          parameters: [
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceThreadId', in: 'query', required: false, schema: { type: 'string', example: '45974302' } },
            { name: 'authorId', in: 'query', required: false, schema: { type: 'string', example: '150058' } },
            { name: 'author', in: 'query', required: false, schema: { type: 'string', example: '-阿狼-' } },
            { name: 'includeReportRevisions', in: 'query', required: false, schema: { type: 'boolean', example: false } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'timelineLimit', in: 'query', required: false, schema: { type: 'number', example: 50 } },
            { name: 'reviewQueueLimit', in: 'query', required: false, schema: { type: 'number', example: 20 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-22T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Author summaries, source review pressure, focus entities, opinion timeline, evidence gaps, and supporting evidence'
            }
          }
        }
      },
      '/api/intelligence/authors/markdown': {
        get: {
          summary: 'Render the author intelligence dashboard as a Markdown review handoff',
          parameters: [
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceThreadId', in: 'query', required: false, schema: { type: 'string', example: '45974302' } },
            { name: 'authorId', in: 'query', required: false, schema: { type: 'string', example: '150058' } },
            { name: 'author', in: 'query', required: false, schema: { type: 'string', example: '-闃跨嫾-' } },
            { name: 'includeReportRevisions', in: 'query', required: false, schema: { type: 'boolean', example: false } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 100 } },
            { name: 'timelineLimit', in: 'query', required: false, schema: { type: 'number', example: 50 } },
            { name: 'reviewQueueLimit', in: 'query', required: false, schema: { type: 'number', example: 20 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-22T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Markdown author intelligence review handoff'
            }
          }
        }
      },
      '/api/intelligence/author-review-queue': {
        get: {
          summary: 'List durable author intelligence review queue items',
          parameters: [
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceThreadId', in: 'query', required: false, schema: { type: 'string', example: '45974302' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', example: 'open' } },
            { name: 'type', in: 'query', required: false, schema: { type: 'string', example: 'high-confidence-opinion' } },
            { name: 'priority', in: 'query', required: false, schema: { type: 'string', example: 'medium' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 50 } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Durable author review queue items, aggregate counts, and source hotspots',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AuthorReviewQueueListResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/intelligence/author-review-queue/sync': {
        post: {
          summary: 'Persist current author intelligence review queue items',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceThreadId: { type: 'string', example: '45974302' },
                    includeReportRevisions: { type: 'boolean', example: false },
                    limit: { type: 'number', example: 100 },
                    reviewQueueLimit: { type: 'number', example: 20 },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Created or updated durable review queue records'
            }
          }
        }
      },
      '/api/intelligence/author-review-queue/{itemId}/status': {
        post: {
          summary: 'Update one durable author review queue item status',
          parameters: [
            { name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: { type: 'string', example: 'confirmed' },
                    reviewedBy: { type: 'string', example: 'operator' },
                    note: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Updated author review queue item'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            }
          }
        }
      },
      '/api/intelligence/author-review-queue/events': {
        post: {
          summary: 'Synthesize notification outbox events from open author review queue items',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceThreadId: { type: 'string', example: '45974302' },
                    status: { type: 'string', example: 'open' },
                    type: { type: 'string', example: 'high-confidence-opinion' },
                    priority: { type: 'string', example: 'high' },
                    execute: { type: 'boolean', example: false },
                    resolveStale: { type: 'boolean', example: true },
                    limit: { type: 'number', example: 50 },
                    staleLimit: { type: 'number', example: 100 },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Notification event synthesis preview or execution result'
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
          summary: 'Validate that a connector module file loads, registers extensions, and satisfies connector contracts',
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
              description: 'Connector module validation passed, including contract summary'
            },
            503: {
              description: 'Connector module validation failed with per-check contract details'
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
                    startPage: { type: 'number', example: 1 },
                    pageCount: { type: 'number', example: 2 },
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
              description: 'Rollout plan is ok or has warnings',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ConnectorRolloutPlan'
                  }
                }
              }
            },
            503: {
              description: 'Rollout plan contains a failing step',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ConnectorRolloutPlan'
                  }
                }
              }
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
              { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
              { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
              { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
              { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
              { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Operational overview',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/OperationalOverview'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-cockpit': {
        get: {
          summary: 'Get prioritized source operations cockpit queue across schedule, lifecycle, runbook, attention, and source-type signals',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'cockpitLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceTypeLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'pipelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'eventLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'maxAttempts', in: 'query', required: false, schema: { type: 'number', example: 3 } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'workerStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'modulePath', in: 'query', required: false, schema: { type: 'string', example: 'D:/connectors/custom-forum.cjs' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source operations cockpit is ok or has warnings',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOperationsCockpit'
                  }
                }
              }
            },
            503: {
              description: 'Source operations cockpit contains critical queue items',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOperationsCockpit'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-cockpit/action-plan': {
        get: {
          summary: 'Get a dry-run action plan for a ranked source operations cockpit queue item',
          parameters: [
            { name: 'rank', in: 'query', required: false, schema: { type: 'number', example: 1 } },
            { name: 'itemId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'provider', in: 'query', required: false, schema: { type: 'string', example: 'mock' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'cockpitLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceTypeLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Side-effect-free cockpit action plan',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOperationsCockpitActionPlan'
                  }
                }
              }
            },
            404: {
              $ref: '#/components/responses/NotFound'
            }
          }
        }
      },
      '/api/operations/source-drilldown': {
        get: {
          summary: 'Get source-scoped operational drill-down across workers, tasks, events, and review queues',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'timelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'taskScanLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'leaseScanLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'workerStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source drill-down is ok or has warnings',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOperationsDrilldown'
                  }
                }
              }
            },
            503: {
              description: 'Source drill-down contains failing health signals',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOperationsDrilldown'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-collection-health': {
        get: {
          summary: 'Get source collection automation health across schedule, cursor, replay, workers, tasks, and events',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'timelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'taskScanLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'leaseScanLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'includeDrilldown', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'workerStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source collection health is ok or has warnings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SourceCollectionHealthProfile' }
                }
              }
            },
            503: {
              description: 'Source collection health contains failing signals',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SourceCollectionHealthProfile' }
                }
              }
            }
          }
        }
      },
      '/api/operations/automation-readiness': {
        get: {
          summary: 'Get v0.2 unattended automation readiness across sources, workers, LLM, cockpit, and demo closure',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'thread-url' } },
            { name: 'topology', in: 'query', required: false, schema: { type: 'string', enum: ['operations-worker', 'split-workers'] } },
            { name: 'sourceTaskMode', in: 'query', required: false, schema: { type: 'string', enum: ['ingest', 'insight-pipeline'] } },
            { name: 'llmReadinessMode', in: 'query', required: false, schema: { type: 'string', enum: ['configuration', 'preflight', 'evaluation'] } },
            { name: 'provider', in: 'query', required: false, schema: { type: 'string', example: 'mock' } },
            { name: 'includeInputs', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Automation readiness is ok or has warnings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AutomationReadinessPlan' }
                }
              }
            },
            503: {
              description: 'Automation readiness contains failing gates',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AutomationReadinessPlan' }
                }
              }
            }
          }
        }
      },
      '/api/operations/automation-cockpit': {
        get: {
          summary: 'Get a combined Automation Cockpit snapshot for web, API, and notification surfaces',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'thread-url' } },
            { name: 'sourceTaskMode', in: 'query', required: false, schema: { type: 'string', enum: ['ingest', 'insight-pipeline'] } },
            { name: 'llmReadinessMode', in: 'query', required: false, schema: { type: 'string', enum: ['configuration', 'preflight', 'evaluation'] } },
            { name: 'provider', in: 'query', required: false, schema: { type: 'string', example: 'mock' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'notificationLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'auditLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'executionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Automation Cockpit snapshot is ok or has warnings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AutomationCockpitSnapshot' }
                }
              }
            },
            503: {
              description: 'Automation Cockpit snapshot contains failing signals',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AutomationCockpitSnapshot' }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-type-drilldown': {
        get: {
          summary: 'Get source-type operational drill-down across sources, workers, tasks, events, and source-type operations',
          parameters: [
            { name: 'sourceType', in: 'query', required: true, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'scanLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceTypeLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'taskLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'pipelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'eventLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'maxAttempts', in: 'query', required: false, schema: { type: 'number', example: 3 } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'workerStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'modulePath', in: 'query', required: false, schema: { type: 'string', example: 'D:/connectors/custom-forum.cjs' } },
            { name: 'includeSourceTypeOperations', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source type drill-down is ok or has warnings',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeOperationsDrilldown'
                  }
                }
              }
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            },
            503: {
              description: 'Source type drill-down contains failing health signals',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeOperationsDrilldown'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/readiness': {
        get: {
          summary: 'Get operations readiness status for probes and monitoring',
          parameters: [
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
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
          summary: 'Get tasks correlated by task, request, trace, or idempotency key',
          parameters: [
            { name: 'taskId', in: 'query', required: false, schema: { type: 'string' } },
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
            },
            404: {
              $ref: '#/components/responses/NotFound'
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
            { name: 'eventLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'maxAttempts', in: 'query', required: false, schema: { type: 'number', example: 3 } },
            { name: 'taskLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Runbook has no critical actions; source diagnostics repair actions and filtered source readiness actions carry source scope when present',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/OperationsRunbook'
                  }
                }
              }
            },
            503: {
              description: 'Runbook contains critical actions, including source-scoped diagnostics and source readiness actions when stored sources are broken',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/OperationsRunbook'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-attention': {
        get: {
          summary: 'Get source-level attention rows merged from schedule, lifecycle, and runbook signals',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'pipelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'eventLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'maxAttempts', in: 'query', required: false, schema: { type: 'number', example: 3 } },
            { name: 'taskLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source attention report has no critical source signals',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceAttentionReport'
                  }
                }
              }
            },
            503: {
              description: 'Source attention report contains at least one critical source signal',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceAttentionReport'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-type-operations': {
        get: {
          summary: 'Get source-type operations matrix merged from readiness, schedule, lifecycle, and attention signals',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'modulePath', in: 'query', required: false, schema: { type: 'string', example: 'D:/connectors/custom-forum.cjs' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceTypeLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'attentionLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'pipelineLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'eventLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'maxAttempts', in: 'query', required: false, schema: { type: 'number', example: 3 } },
            { name: 'taskLimit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source type operations report has no failing source type operations signals',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeOperationsReport'
                  }
                }
              }
            },
            503: {
              description: 'Source type operations report contains failing source type operations signals',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeOperationsReport'
                  }
                }
              }
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
                    sourceId: { type: 'string' },
                    enabled: { type: 'boolean' },
                    limit: { type: 'number', example: 100 },
                    staleLimit: { type: 'number', example: 100 },
                    resolveStale: { type: 'boolean', example: true },
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
              description: 'Runbook notification event synthesis result; event identity and stale resolution are scoped by sourceId/sourceKey/forum when provided',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/RunbookNotificationEventSynthesisResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-attention/events': {
        post: {
          summary: 'Dry-run or execute synthesis of source attention items into notification outbox events',
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
                    sourceId: { type: 'string' },
                    enabled: { type: 'boolean' },
                    limit: { type: 'number', example: 100 },
                    attentionLimit: { type: 'number', example: 100 },
                    staleLimit: { type: 'number', example: 100 },
                    resolveStale: { type: 'boolean', example: true },
                    priorityScoreThreshold: { type: 'number', example: 70 },
                    pipelineLimit: { type: 'number', example: 20 },
                    eventLimit: { type: 'number', example: 100 },
                    taskLimit: { type: 'number', example: 100 },
                    maxAttempts: { type: 'number', example: 3 },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
                    sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
                    runningStaleAfterMs: { type: 'number', example: 600000 },
                    workerStaleAfterMs: { type: 'number', example: 300000 },
                    includeSourceAttention: { type: 'boolean', example: false },
                    now: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Source attention notification event synthesis result; event identity and stale resolution are scoped by sourceId/sourceKey/forum when provided',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceAttentionNotificationEventSynthesisResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/source-type-operations/events': {
        post: {
          summary: 'Dry-run or execute synthesis of source type operations into notification outbox events',
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
                    sourceType: { type: 'string', example: 'saved-html-directory' },
                    enabled: { type: 'boolean' },
                    limit: { type: 'number', example: 100 },
                    sourceTypeLimit: { type: 'number', example: 100 },
                    attentionLimit: { type: 'number', example: 100 },
                    staleLimit: { type: 'number', example: 100 },
                    resolveStale: { type: 'boolean', example: true },
                    priorityScoreThreshold: { type: 'number', example: 70 },
                    includeReadinessWarnings: { type: 'boolean', example: false },
                    modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
                    pipelineLimit: { type: 'number', example: 20 },
                    eventLimit: { type: 'number', example: 100 },
                    taskLimit: { type: 'number', example: 100 },
                    maxAttempts: { type: 'number', example: 3 },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
                    sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
                    runningStaleAfterMs: { type: 'number', example: 600000 },
                    workerStaleAfterMs: { type: 'number', example: 300000 },
                    includeSourceTypeOperations: { type: 'boolean', example: false },
                    now: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Source type operations notification event synthesis result; stale resolution can be scoped by sourceType',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceTypeOperationsNotificationEventSynthesisResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/operations/worker-topology-plan': {
        get: {
          summary: 'Plan worker deployment topology for local, single-process, or split-worker operations',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string', example: 'tracked-source-nga-001' } },
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
              description: 'Worker topology plan is ok or has warnings',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/WorkerTopologyPlan'
                  }
                }
              }
            },
            503: {
              description: 'Worker topology plan has failing checks',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/WorkerTopologyPlan'
                  }
                }
              }
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
              description: 'Manifest plan is ok or has warnings',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/RolloutManifestPlan'
                  }
                }
              }
            },
            503: {
              description: 'Manifest plan has failing checks',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/RolloutManifestPlan'
                  }
                }
              }
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
                    workerStaleAfterMs: { type: 'number' },
                    provider: { type: 'string', example: 'mock' },
                    llmReadinessMode: { type: 'string', enum: ['configuration', 'preflight', 'evaluation'] }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Resource provisioning plan is ok or has warnings, including compact evidenceSummary and optional PostgreSQL schemaDrift details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ResourceProvisioningPlan'
                  }
                }
              }
            },
            503: {
              description: 'Required resource provisioning has failing checks, including compact evidenceSummary and optional PostgreSQL schemaDrift details',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ResourceProvisioningPlan'
                  }
                }
              }
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
          description: 'Apply reports carry deployment gate action details, including resource evidence and source diagnostics repair actions from checklist failures.',
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
              description: 'Manifest apply dry-run or execution completed and returned a task audit record, report, and rollback plan',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/RolloutManifestApplyResult'
                  }
                }
              }
            },
            503: {
              description: 'Manifest apply was blocked by missing source data, gate failure, or registration failure',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/RolloutManifestApplyResult'
                  }
                }
              }
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
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'provider', in: 'query', required: false, schema: { type: 'string', example: 'mock' } },
            { name: 'llmReadinessMode', in: 'query', required: false, schema: { type: 'string', enum: ['configuration', 'preflight', 'evaluation'] } }
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
          description: 'Gate nextActions include lower-level details with evidenceSummary, including resource provisioning evidence and source diagnostics repair actions from deployment checklist failures.',
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
              description: 'Deployment gate is ok or has warnings, with lower-level action details when available',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DeploymentGateReport'
                  }
                }
              }
            },
            503: {
              description: 'Deployment gate has failing checks, with lower-level action details and evidenceSummary when available',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/DeploymentGateReport'
                  }
                }
              }
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
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'acknowledged', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'deliveryStatus', in: 'query', required: false, schema: { type: 'string', example: 'pending' } },
            { name: 'includeArchived', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Notification events',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventListResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/events/{eventId}': {
        get: {
          summary: 'Get notification event detail with source, task, and operations links',
          parameters: [
            { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Notification event detail, related task summary, and recommended operations',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventDetail'
                  }
                }
              }
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            }
          }
        }
      },
      '/api/events/{eventId}/actions/intent': {
        post: {
          summary: 'Prepare a dry-run notification event action intent',
          description: 'Returns a side-effect-free action intent for one notification event action, including target API/CLI plan, readiness gate evidence, and audit metadata for future execution.',
          parameters: [
            { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['actionKey'],
                  properties: {
                    actionKey: { type: 'string', example: 'event.acknowledge' },
                    actor: { type: 'string', example: 'operator' },
                    requestedBy: { type: 'string', example: 'operator' },
                    reason: { type: 'string', example: 'reviewed in web console' },
                    note: { type: 'string' },
                    now: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Dry-run event action intent',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventActionIntentResult'
                  }
                }
              }
            },
            400: {
              $ref: '#/components/responses/BadRequest'
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
      '/api/events/{eventId}/actions/execute': {
        post: {
          summary: 'Dry-run or execute a supported notification event action',
          description: 'Defaults to dry-run preview. Set execute=true to apply the supported event.acknowledge action through the notification event action execution ledger.',
          parameters: [
            { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['actionKey'],
                  properties: {
                    actionKey: { type: 'string', example: 'event.acknowledge' },
                    execute: { type: 'boolean', default: false },
                    actor: { type: 'string', example: 'operator' },
                    acknowledgedBy: { type: 'string', example: 'operator' },
                    requestedBy: { type: 'string', example: 'operator' },
                    reason: { type: 'string', example: 'handled from event detail' },
                    note: { type: 'string' },
                    now: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Notification event action execution result or dry-run preview',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventActionExecutionResult'
                  }
                }
              }
            },
            400: {
              $ref: '#/components/responses/BadRequest'
            },
            404: {
              $ref: '#/components/responses/NotFound'
            },
            409: {
              $ref: '#/components/responses/Conflict'
            },
            503: {
              $ref: '#/components/responses/ServiceUnavailable'
            }
          }
        }
      },
      '/api/events/action-intents': {
        get: {
          summary: 'List persisted notification event action intents',
          parameters: [
            { name: 'eventId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'actionKey', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'actor', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Persisted notification event action intents',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventActionIntentListResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/events/action-executions': {
        get: {
          summary: 'List notification event action execution ledger records',
          parameters: [
            { name: 'eventId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'actionKey', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['running', 'completed', 'failed'] } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'actor', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'runningStaleAfterMs', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Notification event action execution ledger records',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventActionExecutionListResult'
                  }
                }
              }
            },
            503: {
              $ref: '#/components/responses/ServiceUnavailable'
            }
          }
        }
      },
      '/api/events/overview': {
        get: {
          summary: 'Summarize notification outbox health and backlog distribution',
          parameters: [
            { name: 'type', in: 'query', required: false, schema: { type: 'string', example: 'source-changed' } },
            { name: 'sourceId', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'acknowledged', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'deliveryStatus', in: 'query', required: false, schema: { type: 'string', example: 'pending' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number', example: 200 } },
            { name: 'maxAttempts', in: 'query', required: false, schema: { type: 'number', example: 3 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Notification outbox overview with counts by type, severity, status, acknowledgement, source pressure, sourceHotspots, and attention samples',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventOverview'
                  }
                }
              }
            }
          }
        }
      },
      '/api/events/synthesis-policy': {
        get: {
          summary: 'Describe notification synthesis policy defaults and per-event alert rules',
          parameters: [
            { name: 'priorityScoreThreshold', in: 'query', required: false, schema: { type: 'number', example: 70 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-25T10:00:00.000Z' } }
          ],
          responses: {
            200: {
              description: 'Notification synthesis policy report',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationSynthesisPolicyReport'
                  }
                }
              }
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
                    sourceId: { type: 'string', example: 'tracked-source-nga-001' },
                    sourceKey: { type: 'string', example: 'nga' },
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
              description: 'Dispatch summary',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventDispatchResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/events/archive': {
        post: {
          summary: 'Dry-run or execute notification event retention archiving',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    execute: { type: 'boolean', example: false },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceId: { type: 'string' },
                    type: { type: 'string', example: 'runbook-action' },
                    deliveryStatuses: { type: 'array', items: { type: 'string' }, example: ['delivered', 'resolved'] },
                    requireAcknowledged: { type: 'boolean', example: true },
                    olderThanDays: { type: 'number', example: 30 },
                    cutoffAt: { type: 'string', example: '2026-06-01T00:00:00.000Z' },
                    scanLimit: { type: 'number', example: 500 },
                    archiveLimit: { type: 'number', example: 100 },
                    archivedBy: { type: 'string', example: 'operator' },
                    reason: { type: 'string' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Retention plan or archive execution result',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventArchiveResult'
                  }
                }
              }
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
      '/api/events/ack': {
        post: {
          summary: 'Acknowledge notification events in bulk',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    eventIds: { type: 'array', items: { type: 'string' } },
                    type: { type: 'string', example: 'runbook-action' },
                    sourceId: { type: 'string' },
                    sourceKey: { type: 'string', example: 'nga' },
                    acknowledged: { type: 'boolean', example: false },
                    deliveryStatus: { type: 'string', example: 'delivered' },
                    limit: { type: 'number', example: 50 },
                    dryRun: { type: 'boolean', example: true },
                    execute: { type: 'boolean', example: false },
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
              description: 'Bulk acknowledgement result with acknowledged and skipped counts',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventAckResult'
                  }
                }
              }
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
              description: 'Acknowledged notification event',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NotificationEventAckSingleResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/sources': {
        get: {
          summary: 'List tracked forum sources',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } }
          ],
          responses: {
            200: {
              description: 'Tracked sources',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/TrackedSourceListResult'
                  }
                }
              }
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
                    startPage: { type: 'number', example: 1 },
                    pageCount: { type: 'number', example: 2 },
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
              description: 'Created source',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/TrackedSourceRegistrationResult'
                  }
                }
              }
            },
            200: {
              description: 'Updated source',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/TrackedSourceRegistrationResult'
                  }
                }
              }
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
          description: 'Returns valid/status/checks plus nextActions with evidence and evidenceSummary when the draft is missing handler-required location fields or other source readiness checks fail.',
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
                    startPage: { type: 'number', example: 1 },
                    pageCount: { type: 'number', example: 2 },
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
              description: 'Validation report with source draft and readiness checks',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/TrackedSourceValidationResult'
                  }
                }
              }
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
          description: 'Returns steps, composed subreports, nextActions, and rolloutManifestDraft. Source fields can be supplied directly or derived from a rollout manifest. Source registration failures carry detail actions with evidenceSummary for connector-specific missing location fields.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    manifest: {
                      type: 'object',
                      description: 'Optional rollout manifest. When present, source and connector fields are derived from manifest.source and manifest.connector unless explicit request fields override them.',
                      additionalProperties: true
                    },
                    forum: { type: 'string', example: 'nga' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'normalized-thread-json' },
                    displayName: { type: 'string', example: 'External ThreadSnapshot feed' },
                    modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
                    inputDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/example' },
                    inputFile: { type: 'string', example: 'D:/feeds/threadtrace/thread.json' },
                    url: { type: 'string' },
                    startPage: { type: 'number', example: 1 },
                    pageCount: { type: 'number', example: 2 },
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
              description: 'Preflight is ok or warn, including rolloutManifestDraft for downstream manifest plan, deployment gate, and apply flows',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOnboardingPreflight'
                  }
                }
              }
            },
            503: {
              description: 'Preflight failed, including diagnostic steps and rolloutManifestDraft when the source draft is available',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceOnboardingPreflight'
                  }
                }
              }
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
                    startPage: { type: 'number', example: 1 },
                    pageCount: { type: 'number', example: 2 },
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
          description: 'Returns source checks plus top-level and per-source nextActions with sourceId, commands, evidence, and evidenceSummary for stored source repair.',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
            { name: 'enabled', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Source diagnostics are ok or warn',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceDiagnostics'
                  }
                }
              }
            },
            503: {
              description: 'Source diagnostics failed',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceDiagnostics'
                  }
                }
              }
            }
          }
        }
      },
      '/api/sources/lifecycle': {
        get: {
          summary: 'Report tracked source lifecycle state, disable guards, failure resets, recommended commands, and recent lifecycle tasks',
          parameters: [
            { name: 'forum', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceKey', in: 'query', required: false, schema: { type: 'string', example: 'nga' } },
            { name: 'sourceType', in: 'query', required: false, schema: { type: 'string', example: 'saved-html-directory' } },
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
              description: 'Lifecycle report with disable guard state, failure retry state, recommended commands, and recent lifecycle task audit records',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceLifecycleReport'
                  }
                }
              }
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
            { name: 'collectionStatus', in: 'query', required: false, schema: { type: 'string', example: 'due,retry-waiting' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
            { name: 'sourceRunStaleAfterMs', in: 'query', required: false, schema: { type: 'number', example: 600000 } },
            { name: 'sourceFailureRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 60000 } },
            { name: 'sourceFailureMaxRetryBackoffMs', in: 'query', required: false, schema: { type: 'number', example: 3600000 } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', example: '2026-06-18T10:00:00.000Z' } },
            { name: 'storeDir', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'Schedule preview with due and skipped sources plus decision reasons',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceScheduleReport'
                  }
                }
              }
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
              description: 'Source disable dry-run or execution result with task audit record',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceLifecycleMutationTaskResult'
                  }
                }
              }
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
              description: 'Source enable dry-run or execution result with task audit record',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceLifecycleMutationTaskResult'
                  }
                }
              }
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
              description: 'Source failure reset dry-run or execution result with task audit record',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceFailureResetTaskResult'
                  }
                }
              }
            },
            404: {
              $ref: '#/components/responses/NotFound'
            }
          }
        }
      },
      '/api/sources/{sourceId}/schedule': {
        post: {
          summary: 'Dry-run or execute a tracked source schedule configuration update with task audit record',
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
                    intervalMinutes: { type: 'number', example: 60 },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    scheduleEnabled: { type: 'boolean', example: true },
                    runNow: { type: 'boolean', example: true },
                    clearSchedule: { type: 'boolean', example: false },
                    now: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    storeDir: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Source schedule update dry-run or execution result with task audit record',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceScheduleUpdateTaskResult'
                  }
                }
              }
            },
            400: {
              $ref: '#/components/responses/BadRequest'
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
              description: 'Completed ingest task and report',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceIngestTaskResult'
                  }
                }
              }
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
              description: 'Completed source insight pipeline task',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceInsightPipelineTaskResult'
                  }
                }
              }
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
                    sourceId: { type: 'string', example: 'tracked-source-nga-001' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'saved-html-directory' },
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
              description: 'Batch task summary',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceIngestBatchTaskResult'
                  }
                }
              }
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
                    sourceId: { type: 'string', example: 'tracked-source-nga-001' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'saved-html-directory' },
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
              description: 'Due-source batch task summary',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceDueIngestBatchTaskResult'
                  }
                }
              }
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
                    sourceId: { type: 'string', example: 'tracked-source-nga-001' },
                    sourceKey: { type: 'string', example: 'nga' },
                    sourceType: { type: 'string', example: 'saved-html-directory' },
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
              description: 'Due source insight pipeline batch summary',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/SourceDueInsightPipelineBatchTaskResult'
                  }
                }
              }
            }
          }
        }
      },
      '/api/demo/source-cycle': {
        post: {
          summary: 'Run an end-to-end source demo cycle from due insight pipeline to event review evidence',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sourceId: { type: 'string', example: 'tracked-source-nga-001' },
                    sourceKey: { type: 'string', example: 'nga' },
                    forum: { type: 'string', example: 'nga' },
                    limit: { type: 'number', example: 10 },
                    drilldownLimit: { type: 'number', example: 20 },
                    now: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
                    provider: { type: 'string', example: 'mock' },
                    traceId: { type: 'string', example: 'demo-cycle-001' },
                    acknowledgeEvents: { type: 'boolean', example: false },
                    executeAcknowledgement: { type: 'boolean', example: false },
                    acknowledgedBy: { type: 'string', example: 'web' },
                    acknowledgementNote: { type: 'string' },
                    sourceRunStaleAfterMs: { type: 'number', example: 600000 },
                    sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
                    sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
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
              description: 'Demo cycle report',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SourceDemoCycleReport' }
                }
              }
            },
            503: {
              description: 'At least one due source pipeline failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SourceDemoCycleReport' }
                }
              }
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
        LlmProviderPreflightReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            provider: { type: 'string', example: 'mock' },
            traceId: { type: 'string', example: 'llm-preflight:mock:2026-06-25T10:00:00.000Z' },
            task: { type: 'string', example: 'thread-history-semantic-enrichment' },
            schemaVersion: { type: 'string', example: 'semantic-enrichment.v1' },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', example: 'llm.semantic.validation' },
                  status: { type: 'string', example: 'ok' },
                  summary: { type: 'string' }
                }
              }
            },
            validation: { type: 'object', additionalProperties: true },
            usage: { type: 'object', additionalProperties: true },
            outputPreview: { type: 'object', additionalProperties: true },
            error: { type: 'object', additionalProperties: true },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        LlmProviderEvaluationReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            provider: { type: 'string', example: 'mock' },
            traceId: { type: 'string', example: 'llm-evaluation:mock:2026-06-25T10:00:00.000Z' },
            task: { type: 'string', example: 'thread-history-semantic-enrichment' },
            schemaVersion: { type: 'string', example: 'semantic-enrichment.v1' },
            sampleCount: { type: 'number', example: 2 },
            summary: {
              type: 'object',
              properties: {
                ok: { type: 'number' },
                warn: { type: 'number' },
                fail: { type: 'number' }
              }
            },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
                  validation: { type: 'object', additionalProperties: true },
                  qualityChecks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        status: { type: 'string' },
                        summary: { type: 'string' }
                      }
                    }
                  },
                  usage: { type: 'object', additionalProperties: true },
                  outputPreview: { type: 'object', additionalProperties: true },
                  error: { type: 'object', additionalProperties: true }
                },
                additionalProperties: true
              }
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        LlmReadinessProfile: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            provider: { type: 'string', example: 'openai-compatible' },
            mode: { type: 'string', enum: ['configuration', 'preflight', 'evaluation'] },
            configuration: {
              type: 'object',
              properties: {
                provider: { type: 'string', example: 'openai-compatible' },
                selectedProvider: { type: 'string', example: 'openai-compatible' },
                remoteProvider: { type: 'boolean', example: true },
                baseUrlConfigured: { type: 'boolean', example: true },
                modelConfigured: { type: 'boolean', example: true },
                apiKeyConfigured: { type: 'boolean', example: true },
                timeoutMs: { type: 'number', example: 30000 }
              },
              additionalProperties: true
            },
            readiness: {
              type: 'object',
              properties: {
                mockMode: { type: 'boolean', example: false },
                realProviderCandidate: { type: 'boolean', example: true },
                preflightPassed: { type: 'boolean', example: true },
                evaluationPassed: { type: 'boolean', example: true }
              },
              additionalProperties: true
            },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', example: 'llm.provider.model' },
                  area: { type: 'string', example: 'configuration' },
                  status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
                  value: { type: 'string', example: 'configured' },
                  summary: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            preflight: { $ref: '#/components/schemas/LlmProviderPreflightReport' },
            evaluation: { $ref: '#/components/schemas/LlmProviderEvaluationReport' },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        SourceDemoCycleReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail', 'noop', 'review'] },
            traceId: { type: 'string', example: 'source-demo-cycle:tracked-source-nga-001:2026-06-25T10:00:00.000Z' },
            primarySource: { $ref: '#/components/schemas/SourceScope' },
            summary: {
              type: 'object',
              additionalProperties: true
            },
            task: { $ref: '#/components/schemas/TaskRecord' },
            pipeline: {
              type: 'object',
              additionalProperties: true
            },
            sourceChangedEvents: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEvent' }
            },
            acknowledgement: {
              type: 'object',
              additionalProperties: true
            },
            closure: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'review', 'fail'] },
                readyForDailyUse: { type: 'boolean', example: false },
                summary: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', example: 6 },
                    completed: { type: 'number', example: 5 },
                    warning: { type: 'number', example: 1 },
                    noop: { type: 'number', example: 0 },
                    failed: { type: 'number', example: 0 },
                    readinessScore: { type: 'number', example: 83 },
                    missingStepKeys: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['operator-acknowledgement']
                    }
                  },
                  additionalProperties: true
                },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string', example: 'operator-acknowledgement' },
                      title: { type: 'string', example: 'Operator acknowledgement' },
                      status: { type: 'string', enum: ['ok', 'warn', 'fail', 'noop'] },
                      required: { type: 'boolean', example: true },
                      summary: { type: 'string' },
                      evidence: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            key: { type: 'string' },
                            value: { type: 'string' }
                          },
                          additionalProperties: true
                        }
                      },
                      nextAction: { type: 'string' }
                    },
                    additionalProperties: true
                  }
                },
                recommendedNextAction: { type: 'string' }
              },
              additionalProperties: true
            },
            drilldown: { $ref: '#/components/schemas/SourceOperationsDrilldown' },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        SourceScope: {
          type: 'object',
          properties: {
            sourceId: { type: 'string', example: 'tracked-source-nga-001' },
            sourceKey: { type: 'string', example: 'nga' }
          },
          additionalProperties: false
        },
        WorkerRun: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '5eacb7ef-e116-4974-87fd-234b34e45a54' },
            workerType: { type: 'string', example: 'due-source' },
            workerId: { type: 'string', example: 'due-source:host:12345' },
            status: { type: 'string', enum: ['running', 'completed', 'failed', 'skipped'] },
            scope: { $ref: '#/components/schemas/SourceScope' },
            scoped: { type: 'boolean', example: true },
            input: { type: 'object', additionalProperties: true },
            progress: { type: 'object', additionalProperties: true },
            output: { type: 'object', additionalProperties: true },
            error: { type: 'object', additionalProperties: true },
            startedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            updatedAt: { type: 'string', example: '2026-06-18T10:01:00.000Z' },
            heartbeatAt: { type: 'string', example: '2026-06-18T10:01:00.000Z' },
            finishedAt: { type: 'string', example: '2026-06-18T10:02:00.000Z' }
          }
        },
        WorkerLease: {
          type: 'object',
          properties: {
            leaseKey: { type: 'string', example: 'worker:due-source:source-id:tracked-source-nga-001' },
            workerType: { type: 'string', example: 'due-source' },
            ownerId: { type: 'string', example: 'due-source:host:12345' },
            acquiredAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            updatedAt: { type: 'string', example: '2026-06-18T10:01:00.000Z' },
            expiresAt: { type: 'string', example: '2026-06-18T10:06:00.000Z' },
            scope: { $ref: '#/components/schemas/SourceScope' },
            scoped: { type: 'boolean', example: true },
            expired: { type: 'boolean', example: false }
          }
        },
        WorkerLeaseSummary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 3 },
            active: { type: 'number', example: 2 },
            expired: { type: 'number', example: 1 },
            sourceScoped: { type: 'number', example: 2 },
            unscoped: { type: 'number', example: 1 },
            byWorkerType: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'due-source': 1, 'notification-event': 1 }
            },
            bySourceId: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'tracked-source-nga-001': 1 }
            },
            bySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { nga: 1 }
            },
            activeBySourceId: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'tracked-source-nga-001': 1 }
            },
            activeBySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { nga: 1 }
            },
            expiredBySourceId: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            expiredBySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            latest: { $ref: '#/components/schemas/WorkerLease' },
            expiredLeases: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkerLease' }
            },
            sourceScopedLeases: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkerLease' }
            }
          }
        },
        AuthorReviewQueueSourceHotspot: {
          type: 'object',
          properties: {
            sourceKey: { type: 'string', example: 'nga' },
            itemCount: { type: 'number', example: 3 },
            openCount: { type: 'number', example: 3 },
            highPriorityOpenCount: { type: 'number', example: 1 },
            byType: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'evidence-gap': 1, 'high-confidence-opinion': 2 }
            },
            latestUpdatedAt: { type: 'string', example: '2026-06-23T09:59:00.000Z' },
            sourceThreadIds: {
              type: 'array',
              items: { type: 'string' },
              example: ['45974302']
            }
          }
        },
        AuthorReviewQueueItem: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'author-review:abc123' },
            queueKey: { type: 'string' },
            status: { type: 'string', enum: ['open', 'confirmed', 'ignored'] },
            type: { type: 'string', example: 'evidence-gap' },
            priority: { type: 'string', example: 'high' },
            score: { type: 'number', example: 100 },
            title: { type: 'string' },
            summary: { type: 'string' },
            reason: { type: 'string' },
            nextAction: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceThreadId: { type: 'string', example: '45974302' },
            floor: { type: 'number', example: 3 },
            sourcePostId: { type: 'string' },
            author: { type: 'object', additionalProperties: true },
            entity: { type: 'object', additionalProperties: true },
            refs: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            firstSeenAt: { type: 'string', example: '2026-06-23T09:59:00.000Z' },
            lastSeenAt: { type: 'string', example: '2026-06-23T10:00:00.000Z' },
            seenCount: { type: 'number', example: 2 },
            updatedAt: { type: 'string', example: '2026-06-23T10:00:00.000Z' }
          }
        },
        AuthorReviewQueueSummary: {
          type: 'object',
          properties: {
            itemCount: { type: 'number', example: 3 },
            openCount: { type: 'number', example: 3 },
            highPriorityOpenCount: { type: 'number', example: 1 },
            byStatus: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { open: 3 }
            },
            byPriority: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { high: 1, medium: 2 }
            },
            byType: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { 'evidence-gap': 1, 'high-confidence-opinion': 2 }
            },
            bySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { nga: 3 }
            },
            openBySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { nga: 3 }
            },
            highPriorityOpenBySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { nga: 1 }
            },
            sourceHotspots: {
              type: 'array',
              items: { $ref: '#/components/schemas/AuthorReviewQueueSourceHotspot' }
            },
            latestUpdatedAt: { type: 'string', example: '2026-06-23T10:00:00.000Z' }
          }
        },
        AuthorReviewQueueListResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-23T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            itemCount: { type: 'number', example: 3 },
            summary: { $ref: '#/components/schemas/AuthorReviewQueueSummary' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/AuthorReviewQueueItem' }
            },
            recommendedNextAction: { type: 'string' }
          }
        },
        ContextReviewActionSourceScope: {
          type: 'object',
          properties: {
            sourceIds: {
              type: 'array',
              items: { type: 'string' }
            },
            sourceKeys: {
              type: 'array',
              items: { type: 'string' }
            },
            mixed: { type: 'boolean', example: false }
          }
        },
        ContextReviewActionPlanRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', example: 'partially-accepted' },
            handoffId: { type: 'string' },
            submittedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            reviewer: { type: 'string', example: 'operator-1' },
            severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
            closeCandidateCount: { type: 'number' },
            keepOpenCandidateCount: { type: 'number' },
            mergeCandidateCount: { type: 'number' },
            blockedTaskCount: { type: 'number' },
            recommendedNextAction: { type: 'string' }
          }
        },
        ContextReviewMergeCandidate: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            recordId: { type: 'string' },
            handoffId: { type: 'string' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            submittedAt: { type: 'string' },
            reviewer: { type: 'string' },
            severity: { type: 'string', enum: ['info', 'warning', 'critical'] }
          },
          additionalProperties: true
        },
        ContextReviewBlockedTask: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            reason: { type: 'string' },
            recordId: { type: 'string' },
            handoffId: { type: 'string' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            submittedAt: { type: 'string' },
            reviewer: { type: 'string' },
            severity: { type: 'string', enum: ['info', 'warning', 'critical'] }
          },
          additionalProperties: true
        },
        ContextReviewActionPlanAttention: {
          type: 'object',
          properties: {
            criticalCount: { type: 'number' },
            warningCount: { type: 'number' },
            conflictTaskIds: {
              type: 'array',
              items: { type: 'string' }
            },
            lowConfidenceRecordIds: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        ContextReviewActionPlanRisk: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['ok', 'warning', 'critical'] },
            reasons: {
              type: 'array',
              items: { type: 'string' },
              example: ['warning-review-results']
            }
          }
        },
        ContextReviewActionPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn'] },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceScope: { $ref: '#/components/schemas/ContextReviewActionSourceScope' },
            windowLimit: { type: 'number', example: 100 },
            count: { type: 'number', example: 1 },
            closeTaskIds: {
              type: 'array',
              items: { type: 'string' }
            },
            keepOpenTaskIds: {
              type: 'array',
              items: { type: 'string' }
            },
            mergeCandidates: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewMergeCandidate' }
            },
            blockedTasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewBlockedTask' }
            },
            records: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionPlanRecord' }
            },
            attention: { $ref: '#/components/schemas/ContextReviewActionPlanAttention' },
            risk: { $ref: '#/components/schemas/ContextReviewActionPlanRisk' },
            recommendedNextAction: { type: 'string' }
          }
        },
        ContextReviewActionGateItem: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'reviewResults.sourceScope' },
            area: { type: 'string', example: 'review-results' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            summary: { type: 'string' },
            evidence: {
              type: 'object',
              additionalProperties: true
            },
            commands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        ContextReviewActionGateExecutable: {
          type: 'object',
          properties: {
            canCloseTasks: { type: 'boolean' },
            canMergeContext: { type: 'boolean' },
            requiresHumanReview: { type: 'boolean' },
            closeTaskCount: { type: 'number' },
            mergeCandidateCount: { type: 'number' }
          }
        },
        ContextReviewActionGateNextAction: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            severity: { type: 'string', enum: ['warning', 'critical'] },
            summary: { type: 'string' },
            commands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        ContextReviewActionGate: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            gateCount: { type: 'number', example: 6 },
            gates: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionGateItem' }
            },
            executable: { $ref: '#/components/schemas/ContextReviewActionGateExecutable' },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionGateNextAction' }
            },
            recommendedNextAction: { type: 'string' },
            actionPlan: { $ref: '#/components/schemas/ContextReviewActionPlan' }
          }
        },
        ContextReviewActionAuditRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            generatedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            action: { type: 'string', example: 'tasks.closure' },
            adapter: { type: 'string', example: 'file-audit' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            request: {
              type: 'object',
              additionalProperties: true
            },
            result: {
              type: 'object',
              additionalProperties: true
            },
            filePath: { type: 'string' }
          }
        },
        ContextReviewActionAuditListResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            count: { type: 'number', example: 2 },
            audits: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionAuditRecord' }
            }
          }
        },
        ContextReviewActionAuditOverview: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn'] },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            query: {
              type: 'object',
              additionalProperties: true
            },
            count: { type: 'number', example: 2 },
            taskCount: { type: 'number', example: 1 },
            byAction: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            byAdapter: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            bySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            bySourceId: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            plannedClosureCount: { type: 'number' },
            plannedMergeCandidateCount: { type: 'number' },
            latestGeneratedAt: { type: 'string' },
            recentAudits: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionAuditRecord' }
            },
            recommendedNextAction: { type: 'string' }
          }
        },
        ContextReviewActionExecutionRecord: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            action: { type: 'string', example: 'tasks.closure' },
            status: { type: 'string', enum: ['running', 'completed', 'failed'] },
            taskId: { type: 'string' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            requestHash: { type: 'string' },
            request: {
              type: 'object',
              additionalProperties: true
            },
            result: {
              type: 'object',
              additionalProperties: true
            },
            error: {
              type: 'object',
              additionalProperties: true
            },
            attemptCount: { type: 'number' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            completedAt: { type: 'string' },
            failedAt: { type: 'string' },
            runningAgeMs: { type: 'number' },
            staleRunning: { type: 'boolean' },
            filePath: { type: 'string' }
          }
        },
        ContextReviewActionExecutionListResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-21T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            healthStatus: { type: 'string', enum: ['ok', 'warn'] },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            count: { type: 'number', example: 2 },
            runningStaleAfterMs: { type: 'number', example: 600000 },
            staleRunningCount: { type: 'number', example: 0 },
            staleRunningExecutions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionExecutionRecord' }
            },
            executions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ContextReviewActionExecutionRecord' }
            }
          }
        },
        SourceDiagnosticCheck: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'source.adapter' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            value: {
              description: 'Observed diagnostic value such as a source key, source type, location summary, boolean, or error text.'
            },
            summary: { type: 'string', example: 'Forum adapter is registered.' }
          }
        },
        SourceDiagnosticActionEvidence: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            checkValue: {
              description: 'Observed check value that caused the action.'
            },
            requiredFields: {
              type: 'array',
              items: { type: 'string' }
            },
            providedFields: {
              type: 'array',
              items: { type: 'string' }
            },
            missingRequiredFields: {
              type: 'array',
              items: { type: 'string' }
            },
            registeredHandler: { type: 'boolean' },
            enabled: { type: 'boolean' }
          },
          additionalProperties: true
        },
        SourceDiagnosticAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'source.adapter' },
            sourceId: { type: 'string' },
            severity: { type: 'string', enum: ['warning', 'critical'] },
            summary: { type: 'string' },
            commands: {
              type: 'array',
              items: { type: 'string' }
            },
            evidence: { $ref: '#/components/schemas/SourceDiagnosticActionEvidence' },
            evidenceSummary: { type: 'string' }
          }
        },
        SourceDiagnosticItem: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            checks: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDiagnosticCheck' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDiagnosticAction' }
            }
          }
        },
        SourceDiagnostics: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            sourceCount: { type: 'number', example: 1 },
            sources: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDiagnosticItem' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDiagnosticAction' }
            }
          }
        },
        TrackedSource: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'nga-saved-html-directory-3e2b38c64f' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            displayName: { type: 'string', example: 'NGA sample archive' },
            location: {
              type: 'object',
              additionalProperties: true
            },
            enabled: { type: 'boolean', example: true },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            schedule: { $ref: '#/components/schemas/SourceScheduleConfig' },
            cursor: {
              type: 'object',
              additionalProperties: true
            },
            runState: { $ref: '#/components/schemas/SourceRunState' },
            createdAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            updatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
          }
        },
        TrackedSourceListResult: {
          type: 'object',
          properties: {
            sources: {
              type: 'array',
              items: { $ref: '#/components/schemas/TrackedSource' }
            }
          }
        },
        TrackedSourceRegistrationResult: {
          type: 'object',
          properties: {
            source: { $ref: '#/components/schemas/TrackedSource' },
            created: { type: 'boolean', example: true }
          }
        },
        TrackedSourceValidationError: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            code: { type: 'string', example: 'source_location_invalid' },
            details: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        TrackedSourceValidationResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            valid: { type: 'boolean', example: true },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            source: { $ref: '#/components/schemas/TrackedSource' },
            checks: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDiagnosticCheck' }
            },
            error: { $ref: '#/components/schemas/TrackedSourceValidationError' },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDiagnosticAction' }
            }
          }
        },
        SourceMutationSourceSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            updatedAt: { type: 'string' }
          }
        },
        SourceLifecycleMutationGuard: {
          type: 'object',
          properties: {
            running: { type: 'boolean', example: false },
            stale: { type: 'boolean', example: false },
            forced: { type: 'boolean', example: false },
            blocked: { type: 'boolean', example: false },
            runStatus: { type: 'string', example: 'completed' },
            lastStartedAt: { type: 'string' },
            staleAfterMs: { type: 'number', example: 600000 }
          }
        },
        SourceLifecycleMutationResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok'] },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            changed: { type: 'boolean', example: true },
            guard: { $ref: '#/components/schemas/SourceLifecycleMutationGuard' },
            sourceBefore: { $ref: '#/components/schemas/SourceMutationSourceSummary' },
            sourceAfter: { $ref: '#/components/schemas/SourceMutationSourceSummary' }
          }
        },
        SourceLifecycleMutationTaskResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            result: { $ref: '#/components/schemas/SourceLifecycleMutationResult' },
            idempotency: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceFailureResetSourceSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            updatedAt: { type: 'string' },
            schedule: { $ref: '#/components/schemas/SourceScheduleConfig' },
            runState: { $ref: '#/components/schemas/SourceRunState' }
          }
        },
        SourceFailureResetResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok'] },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            changed: { type: 'boolean', example: true },
            reason: { type: 'string', example: 'failure-reset-and-requeued' },
            retryNow: { type: 'boolean', example: true },
            nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            sourceBefore: { $ref: '#/components/schemas/SourceFailureResetSourceSummary' },
            sourceAfter: { $ref: '#/components/schemas/SourceFailureResetSourceSummary' }
          }
        },
        SourceFailureResetTaskResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            result: { $ref: '#/components/schemas/SourceFailureResetResult' },
            idempotency: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceScheduleUpdateSourceSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            updatedAt: { type: 'string' },
            schedule: { $ref: '#/components/schemas/SourceScheduleConfig' }
          }
        },
        SourceScheduleUpdateResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok'] },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            changed: { type: 'boolean', example: true },
            clearSchedule: { type: 'boolean', example: false },
            runNow: { type: 'boolean', example: true },
            sourceBefore: { $ref: '#/components/schemas/SourceScheduleUpdateSourceSummary' },
            sourceAfter: { $ref: '#/components/schemas/SourceScheduleUpdateSourceSummary' }
          }
        },
        SourceScheduleUpdateTaskResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            result: { $ref: '#/components/schemas/SourceScheduleUpdateResult' },
            idempotency: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceRunState: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'completed' },
            lastStartedAt: { type: 'string', example: '2026-06-18T09:00:00.000Z' },
            lastFinishedAt: { type: 'string', example: '2026-06-18T09:01:00.000Z' },
            lastTaskId: { type: 'string' },
            failureCount: { type: 'number', example: 0 },
            lastError: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceFailureRetryPlan: {
          type: 'object',
          properties: {
            active: { type: 'boolean', example: false },
            elapsed: { type: 'boolean', example: true },
            retryAt: { type: 'string', example: '2026-06-18T09:02:00.000Z' },
            failureCount: { type: 'number', example: 1 },
            backoffMs: { type: 'number', example: 60000 }
          }
        },
        SourceDisableGuard: {
          type: 'object',
          properties: {
            canDisable: { type: 'boolean', example: true },
            blocked: { type: 'boolean', example: false },
            running: { type: 'boolean', example: false },
            stale: { type: 'boolean', example: false },
            staleAfterMs: { type: 'number', example: 600000 },
            lastStartedAt: { type: 'string', example: '2026-06-18T09:00:00.000Z' }
          }
        },
        SourceLifecycleTask: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['disable-tracked-source', 'enable-tracked-source', 'reset-tracked-source-failure'] },
            status: { type: 'string', enum: ['running', 'completed', 'failed'] },
            sourceId: { type: 'string' },
            execute: { type: 'boolean' },
            dryRun: { type: 'boolean' },
            force: { type: 'boolean' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            finishedAt: { type: 'string' },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              },
              additionalProperties: true
            }
          }
        },
        SourceLifecycleItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            runState: { $ref: '#/components/schemas/SourceRunState' },
            disableGuard: { $ref: '#/components/schemas/SourceDisableGuard' },
            failureRetry: { $ref: '#/components/schemas/SourceFailureRetryPlan' },
            latestLifecycleTask: { $ref: '#/components/schemas/SourceLifecycleTask' },
            nextAction: {
              type: 'string',
              enum: [
                'enable-source',
                'wait-for-run-or-force-disable',
                'wait-for-failure-backoff',
                'run-due-source-task',
                'disable-or-recover-stale-run',
                'disable-source'
              ]
            },
            recommendedCommands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        SourceLifecycleBlockedDisable: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            displayName: { type: 'string' },
            lastStartedAt: { type: 'string' },
            staleAfterMs: { type: 'number', example: 600000 },
            nextAction: { type: 'string', example: 'wait-for-run-or-force-disable' },
            recommendedCommands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        SourceLifecycleSummary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 1 },
            enabled: { type: 'number', example: 1 },
            disabled: { type: 'number', example: 0 },
            running: { type: 'number', example: 0 },
            staleRunning: { type: 'number', example: 0 },
            failureRetryWaiting: { type: 'number', example: 0 },
            disableBlocked: { type: 'number', example: 0 }
          }
        },
        SourceLifecycleReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn'] },
            windowLimit: { type: 'number', example: 100 },
            taskWindowLimit: { type: 'number', example: 100 },
            sourceRunStaleAfterMs: { type: 'number', example: 600000 },
            summary: { $ref: '#/components/schemas/SourceLifecycleSummary' },
            blockedDisables: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceLifecycleBlockedDisable' }
            },
            sources: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceLifecycleItem' }
            },
            recentLifecycleTasks: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceLifecycleTask' }
            }
          }
        },
        SourceScheduleConfig: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            intervalMinutes: { type: 'number', example: 15 },
            nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' }
          }
        },
        SourceScheduleDecision: {
          type: 'object',
          properties: {
            due: { type: 'boolean', example: true },
            reason: { type: 'string', example: 'never-finished' },
            nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            retryAt: { type: 'string', example: '2026-06-18T10:01:00.000Z' },
            failureCount: { type: 'number', example: 1 },
            backoffMs: { type: 'number', example: 60000 },
            baseReason: { type: 'string', example: 'never-finished' }
          }
        },
        SourceCollectionPlan: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'due' },
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            source: { $ref: '#/components/schemas/SourceScope' },
            strategy: { type: 'object', additionalProperties: true },
            schedule: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                intervalMinutes: { type: 'number' },
                nextRunAt: { type: 'string' },
                decision: { $ref: '#/components/schemas/SourceScheduleDecision' }
              },
              additionalProperties: true
            },
            cursor: { type: 'object', additionalProperties: true },
            incremental: { type: 'object', additionalProperties: true },
            lastRun: { type: 'object', additionalProperties: true },
            replay: {
              type: 'object',
              properties: {
                evidenceKinds: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['raw-pages']
                },
                rawPageHashes: {
                  type: 'array',
                  items: { type: 'string' }
                },
                pageNumbers: {
                  type: 'array',
                  items: { type: 'number' },
                  example: [1, 2]
                },
                sourceUrls: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              additionalProperties: true
            },
            recommendedCommands: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          additionalProperties: true
        },
        SourceScheduleItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'thread-url' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            schedule: { $ref: '#/components/schemas/SourceScheduleConfig' },
            runState: { $ref: '#/components/schemas/SourceRunState' },
            decision: { $ref: '#/components/schemas/SourceScheduleDecision' },
            collectionPlan: { $ref: '#/components/schemas/SourceCollectionPlan' }
          }
        },
        SourceScheduleSummary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 1 },
            due: { type: 'number', example: 1 },
            skipped: { type: 'number', example: 0 },
            byReason: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            byCollectionStatus: {
              type: 'object',
              additionalProperties: { type: 'number' }
            }
          }
        },
        SourceScheduleReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok'] },
            windowLimit: { type: 'number', example: 100 },
            sourceRunStaleAfterMs: { type: 'number', example: 600000 },
            sourceFailureRetryBackoffMs: { type: 'number', example: 60000 },
            sourceFailureMaxRetryBackoffMs: { type: 'number', example: 3600000 },
            collectionStatus: {
              type: 'array',
              items: { type: 'string' }
            },
            summary: { $ref: '#/components/schemas/SourceScheduleSummary' },
            unfilteredSummary: { $ref: '#/components/schemas/SourceScheduleSummary' },
            dueSources: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceScheduleItem' }
            },
            skippedSources: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceScheduleItem' }
            },
            sources: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceScheduleItem' }
            }
          }
        },
        SourceAttentionSignal: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'warning', 'warn', 'info', 'ok', 'muted'] },
            label: { type: 'string', example: 'retry wait' },
            summary: { type: 'string' },
            reason: { type: 'string', example: 'waiting-failure-backoff' },
            action: { type: 'string', example: 'wait-for-failure-backoff' },
            actionKey: { type: 'string' },
            retryAt: { type: 'string', example: '2026-06-18T10:01:00.000Z' },
            backoffMs: { type: 'number', example: 120000 }
          }
        },
        SourceAttentionSource: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            displayName: { type: 'string' },
            enabled: { type: 'boolean' },
            runState: { $ref: '#/components/schemas/SourceRunState' },
            disableGuard: {
              type: 'object',
              additionalProperties: true
            },
            failureRetry: {
              type: 'object',
              additionalProperties: true
            },
            nextAction: { type: 'string' },
            recommendedCommands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        SourceAttentionItem: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'sourceId:tracked-source-nga-001' },
            source: { $ref: '#/components/schemas/SourceAttentionSource' },
            severity: { type: 'string', enum: ['critical', 'warning', 'warn', 'info', 'ok', 'muted'] },
            attentionRank: { type: 'number', example: 1 },
            priorityScore: { type: 'number', example: 128 },
            signalCount: { type: 'number', example: 2 },
            runnable: { type: 'boolean' },
            signals: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceAttentionSignal' }
            },
            commands: {
              type: 'array',
              items: { type: 'string' }
            },
            nextAction: { type: 'string' },
            recommendedNextAction: { type: 'string' },
            recommendedCommand: { type: 'string' }
          }
        },
        SourceOperationsCockpitSummary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 3 },
            fail: { type: 'number', example: 1 },
            warning: { type: 'number', example: 2 },
            info: { type: 'number', example: 0 },
            muted: { type: 'number', example: 0 },
            runnable: { type: 'number', example: 1 },
            sourceScoped: { type: 'number', example: 2 },
            sourceTypeScoped: { type: 'number', example: 1 },
            highestPriorityScore: { type: 'number', example: 205 },
            byKind: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            inputs: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceOperationsCockpitItem: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'source-attention:sourceId:source-1' },
            rank: { type: 'number', example: 1 },
            kind: { type: 'string', enum: ['source-attention', 'source-type-operations', 'runbook', 'due-source'] },
            scope: { type: 'string', example: 'source' },
            severity: { type: 'string', enum: ['critical', 'warning', 'info', 'muted'] },
            priorityScore: { type: 'number', example: 110 },
            title: { type: 'string', example: 'NGA saved page' },
            summary: { type: 'string', example: 'retry wait: Failure retry window has not elapsed.' },
            source: { $ref: '#/components/schemas/SourceScope' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            sourceCount: { type: 'number', example: 2 },
            signalCount: { type: 'number', example: 3 },
            signals: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            runnable: { type: 'boolean' },
            recommendedNextAction: { type: 'string' },
            recommendedCommand: { type: 'string' },
            relatedCommands: {
              type: 'array',
              items: { type: 'string' }
            },
            topAttention: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            runbookKey: { type: 'string' }
          }
        },
        SourceOperationsCockpit: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            windowLimit: { type: 'number', example: 25 },
            summary: { $ref: '#/components/schemas/SourceOperationsCockpitSummary' },
            queue: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceOperationsCockpitItem' }
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            inputs: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceOperationsCockpitAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'source.drilldown' },
            label: { type: 'string', example: 'Open source drill-down' },
            mode: { type: 'string', enum: ['view', 'dry-run', 'execute', 'manual'] },
            severity: { type: 'string', example: 'warning' },
            summary: { type: 'string' },
            api: {
              type: 'object',
              properties: {
                method: { type: 'string', example: 'GET' },
                path: { type: 'string', example: '/api/operations/source-drilldown?sourceId=source-1' },
                body: { type: 'object', additionalProperties: true }
              }
            },
            command: { type: 'string' },
            destructive: { type: 'boolean' },
            confirmationRequired: { type: 'boolean' }
          }
        },
        SourceOperationsCockpitActionPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['review', 'actionable'] },
            selectedItem: { $ref: '#/components/schemas/SourceOperationsCockpitItem' },
            summary: {
              type: 'object',
              properties: {
                actionCount: { type: 'number', example: 4 },
                viewCount: { type: 'number', example: 1 },
                dryRunCount: { type: 'number', example: 1 },
                executeCount: { type: 'number', example: 2 },
                destructiveCount: { type: 'number', example: 1 }
              }
            },
            actions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceOperationsCockpitAction' }
            },
            recommendedNextAction: { type: 'string' },
            inputs: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceAttentionSummary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 2 },
            critical: { type: 'number', example: 0 },
            warning: { type: 'number', example: 1 },
            info: { type: 'number', example: 1 },
            muted: { type: 'number', example: 0 },
            runnable: { type: 'number', example: 1 },
            actionable: { type: 'number', example: 1 },
            highestPriorityScore: { type: 'number', example: 128 },
            bySignal: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            bySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' }
            }
          }
        },
        SourceAttentionReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            windowLimit: { type: 'number', example: 100 },
            summary: { $ref: '#/components/schemas/SourceAttentionSummary' },
            sources: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceAttentionItem' }
            },
            inputs: {
              type: 'object',
              properties: {
                scheduleGeneratedAt: { type: 'string' },
                lifecycleGeneratedAt: { type: 'string' },
                runbookGeneratedAt: { type: 'string' }
              }
            }
          }
        },
        SourceTypeOperationsSummary: {
          type: 'object',
          properties: {
            sourceTypeCount: { type: 'number', example: 3 },
            okSourceTypeCount: { type: 'number', example: 1 },
            warnSourceTypeCount: { type: 'number', example: 2 },
            failSourceTypeCount: { type: 'number', example: 0 },
            sourceCount: { type: 'number', example: 5 },
            enabledSourceCount: { type: 'number', example: 4 },
            dueSourceCount: { type: 'number', example: 1 },
            runningSourceCount: { type: 'number', example: 1 },
            staleRunningSourceCount: { type: 'number', example: 0 },
            failureRetryWaitingSourceCount: { type: 'number', example: 1 },
            attentionSourceCount: { type: 'number', example: 2 },
            criticalAttentionSourceCount: { type: 'number', example: 0 },
            warningAttentionSourceCount: { type: 'number', example: 1 },
            actionableSourceCount: { type: 'number', example: 1 },
            highestPriorityScore: { type: 'number', example: 110 }
          }
        },
        SourceTypeOperationsItem: {
          type: 'object',
          properties: {
            sourceType: { type: 'string', example: 'saved-html-directory' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            readiness: {
              type: 'object',
              additionalProperties: true
            },
            schedule: {
              type: 'object',
              additionalProperties: true
            },
            lifecycle: {
              type: 'object',
              additionalProperties: true
            },
            attention: {
              type: 'object',
              additionalProperties: true
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            recommendedCommands: {
              type: 'array',
              items: { type: 'string' }
            },
            topAttention: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        SourceTypeOperationsReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            windowLimit: { type: 'number', example: 100 },
            summary: { $ref: '#/components/schemas/SourceTypeOperationsSummary' },
            sourceTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceTypeOperationsItem' }
            },
            inputs: {
              type: 'object',
              properties: {
                readinessGeneratedAt: { type: 'string' },
                scheduleGeneratedAt: { type: 'string' },
                lifecycleGeneratedAt: { type: 'string' },
                attentionGeneratedAt: { type: 'string' }
              }
            }
          }
        },
        SourceTypeOperationsDrilldown: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            storageMode: { type: 'string', example: 'file' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceFound: { type: 'boolean', example: true },
            scope: {
              type: 'object',
              properties: {
                sourceType: { type: 'string', example: 'saved-html-directory' },
                sourceIds: {
                  type: 'array',
                  items: { type: 'string' }
                },
                sourceKeys: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              additionalProperties: true
            },
            operations: { $ref: '#/components/schemas/SourceTypeOperationsItem' },
            health: {
              type: 'object',
              properties: {
                sources: { type: 'object', additionalProperties: true },
                tasks: { type: 'object', additionalProperties: true },
                events: { type: 'object', additionalProperties: true },
                workers: {
                  type: 'object',
                  properties: {
                    runs: { type: 'object', additionalProperties: true },
                    leases: { type: 'object', additionalProperties: true }
                  },
                  additionalProperties: true
                },
                operations: { type: 'object', additionalProperties: true }
              },
              additionalProperties: true
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            recent: {
              type: 'object',
              properties: {
                sources: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                tasks: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                events: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/NotificationEvent' }
                },
                workerRuns: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerRun' }
                },
                workerLeases: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerLease' }
                }
              },
              additionalProperties: true
            },
            sourceTypeOperations: { $ref: '#/components/schemas/SourceTypeOperationsReport' }
          },
          additionalProperties: true
        },
        SourceCursorDiff: {
          type: 'object',
          properties: {
            changed: { type: 'boolean', example: true },
            reason: { type: 'string', example: 'new-posts' },
            previousPostCount: { type: 'number', example: 10 },
            currentPostCount: { type: 'number', example: 12 },
            newPostCount: { type: 'number', example: 2 },
            previousLastPostId: { type: 'string' },
            currentLastPostId: { type: 'string' }
          },
          additionalProperties: true
        },
        SourceCursor: {
          type: 'object',
          properties: {
            sourceKey: { type: 'string', example: 'nga' },
            sourceThreadId: { type: 'string' },
            title: { type: 'string' },
            lastPostId: { type: 'string' },
            postCount: { type: 'number', example: 12 },
            updatedAt: { type: 'string' }
          },
          additionalProperties: true
        },
        SourceIngestTaskResult: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            task: { $ref: '#/components/schemas/TaskRecord' },
            report: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceInsightPipelineSemanticResult: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['completed', 'skipped'] },
            reason: { type: 'string', example: 'unchanged' },
            taskId: { type: 'string' },
            reportType: { type: 'string', example: 'basic-history' },
            provider: { type: 'string', example: 'mock' },
            traceId: { type: 'string' },
            summary: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceInsightPipelineIngestResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            cursor: { $ref: '#/components/schemas/SourceCursor' },
            cursorDiff: { $ref: '#/components/schemas/SourceCursorDiff' }
          }
        },
        SourceInsightPipelineTaskResult: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            task: { $ref: '#/components/schemas/TaskRecord' },
            ingest: { $ref: '#/components/schemas/SourceInsightPipelineIngestResult' },
            semantic: { $ref: '#/components/schemas/SourceInsightPipelineSemanticResult' }
          }
        },
        SourceBatchTaskItem: {
          type: 'object',
          properties: {
            source: { $ref: '#/components/schemas/TrackedSource' },
            status: { type: 'string', enum: ['completed', 'failed'] },
            scheduleReason: { type: 'string', example: 'never-finished' },
            task: { $ref: '#/components/schemas/TaskRecord' },
            ingestTask: { $ref: '#/components/schemas/TaskRecord' },
            report: {
              type: 'object',
              additionalProperties: true
            },
            cursorDiff: { $ref: '#/components/schemas/SourceCursorDiff' },
            semantic: { $ref: '#/components/schemas/SourceInsightPipelineSemanticResult' },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              },
              additionalProperties: true
            }
          }
        },
        SourceDueBatchSkippedItem: {
          type: 'object',
          properties: {
            source: { $ref: '#/components/schemas/TrackedSource' },
            reason: { type: 'string', example: 'waiting-interval' },
            nextRunAt: { type: 'string' },
            retryAt: { type: 'string' },
            failureCount: { type: 'number', example: 1 },
            backoffMs: { type: 'number', example: 60000 },
            baseReason: { type: 'string', example: 'never-finished' }
          }
        },
        SourceIngestBatchTaskResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            startedAt: { type: 'string' },
            finishedAt: { type: 'string' },
            sourceCount: { type: 'number', example: 1 },
            completedCount: { type: 'number', example: 1 },
            failedCount: { type: 'number', example: 0 },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceBatchTaskItem' }
            }
          }
        },
        SourceDueIngestBatchTaskResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            startedAt: { type: 'string' },
            checkedAt: { type: 'string' },
            finishedAt: { type: 'string' },
            sourceCount: { type: 'number', example: 1 },
            dueCount: { type: 'number', example: 1 },
            skippedCount: { type: 'number', example: 0 },
            completedCount: { type: 'number', example: 1 },
            failedCount: { type: 'number', example: 0 },
            skipped: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDueBatchSkippedItem' }
            },
            evidence: { $ref: '#/components/schemas/SourceDueBatchEvidence' },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceBatchTaskItem' }
            }
          }
        },
        SourceDueInsightPipelineBatchTaskResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            startedAt: { type: 'string' },
            checkedAt: { type: 'string' },
            finishedAt: { type: 'string' },
            sourceCount: { type: 'number', example: 1 },
            dueCount: { type: 'number', example: 1 },
            skippedCount: { type: 'number', example: 0 },
            completedCount: { type: 'number', example: 1 },
            failedCount: { type: 'number', example: 0 },
            skipped: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceDueBatchSkippedItem' }
            },
            evidence: { $ref: '#/components/schemas/SourceDueBatchEvidence' },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceBatchTaskItem' }
            }
          }
        },
        SourceDueBatchEvidence: {
          type: 'object',
          properties: {
            batch: {
              type: 'object',
              additionalProperties: true
            },
            summary: {
              type: 'object',
              properties: {
                sourceCount: { type: 'number', example: 2 },
                dueCount: { type: 'number', example: 1 },
                skippedCount: { type: 'number', example: 1 },
                completedCount: { type: 'number', example: 1 },
                failedCount: { type: 'number', example: 0 },
                replayableCount: { type: 'number', example: 1 },
                backoffSkippedCount: { type: 'number', example: 1 }
              },
              additionalProperties: true
            },
            due: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            skipped: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            timeline: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        SourceOnboardingPreflightStep: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'source.registrationDraft' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            summary: { type: 'string' },
            evidence: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceOnboardingPreflightAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'source.registrationDraft' },
            severity: { type: 'string', enum: ['warning', 'critical'] },
            summary: { type: 'string' },
            commands: {
              type: 'array',
              items: { type: 'string' }
            },
            evidence: {
              type: 'object',
              additionalProperties: true
            },
            evidenceSummary: { type: 'string' },
            details: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        SourceConnectorCatalogAdapter: {
          type: 'object',
          properties: {
            sourceKey: { type: 'string', example: 'nga' },
            displayName: { type: 'string', example: 'NGA forum' },
            capabilities: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceConnectorPackageSourceType: {
          type: 'object',
          properties: {
            sourceType: { type: 'string', example: 'rss-archive-normalized-feed' },
            displayName: { type: 'string', example: 'RSS/API Archive Normalized Feed' },
            description: { type: 'string' },
            kind: { type: 'string', example: 'normalized-thread-json' },
            locationExample: { type: 'string', example: 'sample-location.json' },
            rolloutManifestExample: { type: 'string', example: '../rss-archive-rollout-manifest.sample.json' }
          }
        },
        SourceConnectorPackageAdapter: {
          type: 'object',
          properties: {
            sourceKey: { type: 'string', example: 'custom-forum' },
            displayName: { type: 'string', example: 'Custom Forum' }
          }
        },
        SourceConnectorPackage: {
          type: 'object',
          properties: {
            modulePath: { type: 'string', example: 'D:/connectors/rss-archive/index.cjs' },
            packagePath: { type: 'string', example: 'D:/connectors/rss-archive/package.json' },
            packageName: { type: 'string', example: '@threadtrace/example-rss-archive-connector-package' },
            packageVersion: { type: 'string', example: '0.1.0' },
            manifestVersion: { type: 'string', example: '1.0' },
            displayName: { type: 'string', example: 'RSS/API Archive Connector Template' },
            packageType: { type: 'string', example: 'normalized-thread-json' },
            categories: {
              type: 'array',
              items: { type: 'string' },
              example: ['rss', 'api', 'archive', 'json-package']
            },
            capabilities: {
              type: 'object',
              additionalProperties: true
            },
            rollout: {
              type: 'object',
              additionalProperties: true
            },
            sourceTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceConnectorPackageSourceType' }
            },
            adapters: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceConnectorPackageAdapter' }
            }
          }
        },
        ConnectorPackageRecommendedManifest: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            modulePath: { type: 'string', example: 'D:/connectors/rss-archive/index.cjs' },
            packagePath: { type: 'string', example: 'D:/connectors/rss-archive/package.json' },
            packageName: { type: 'string', example: '@threadtrace/example-rss-archive-connector-package' },
            packageVersion: { type: 'string', example: '0.1.0' },
            sourceType: { type: 'string', example: 'rss-archive-normalized-feed' },
            recommendedManifest: { type: 'string', example: '../rss-archive-rollout-manifest.sample.json' },
            manifestPath: { type: 'string', example: 'D:/connectors/rss-archive-rollout-manifest.sample.json' },
            manifest: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceConnectorCatalogSourceTypePackage: {
          type: 'object',
          properties: {
            packageName: { type: 'string', example: '@threadtrace/example-rss-archive-connector-package' },
            packageVersion: { type: 'string', example: '0.1.0' },
            displayName: { type: 'string', example: 'RSS/API Archive Connector Template' },
            packageType: { type: 'string', example: 'normalized-thread-json' },
            categories: {
              type: 'array',
              items: { type: 'string' }
            },
            capabilities: {
              type: 'object',
              additionalProperties: true
            },
            rollout: {
              type: 'object',
              additionalProperties: true
            },
            sourceType: { $ref: '#/components/schemas/SourceConnectorPackageSourceType' }
          }
        },
        ConnectorModuleError: {
          type: 'object',
          properties: {
            modulePath: { type: 'string', example: 'D:/connectors/broken.cjs' },
            message: { type: 'string', example: 'Cannot find module' }
          }
        },
        SourceOnboardingRecipeFlowStep: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'preflight' },
            phase: { type: 'string', example: 'validate' },
            summary: { type: 'string' },
            cli: { type: 'string', example: 'node src/presentation/cli/threadtrace.js source-onboarding-preflight --forum nga --source-type thread-url --location-file <file>' },
            api: { type: 'string', example: 'POST /api/sources/onboarding/preflight' }
          }
        },
        SourceOnboardingRecipeAdapterGuidance: {
          type: 'object',
          properties: {
            required: { type: 'boolean', example: true },
            compatibleSourceKeys: {
              type: 'array',
              items: { type: 'string' },
              example: ['nga']
            },
            summary: { type: 'string' }
          }
        },
        SourceOnboardingRecipe: {
          type: 'object',
          properties: {
            sourceType: { type: 'string', example: 'thread-url' },
            requiresAdapter: { type: 'boolean', example: true },
            requiredLocationFields: {
              type: 'array',
              items: { type: 'string' },
              example: ['url']
            },
            optionalLocationFields: {
              type: 'array',
              items: { type: 'string' }
            },
            compatibleSourceKeys: {
              type: 'array',
              items: { type: 'string' },
              example: ['nga']
            },
            adapterGuidance: { $ref: '#/components/schemas/SourceOnboardingRecipeAdapterGuidance' },
            recommendedFlow: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceOnboardingRecipeFlowStep' }
            },
            rolloutManifestTemplate: { $ref: '#/components/schemas/SourceRolloutManifestDraft' }
          }
        },
        SourceConnectorCatalogSourceType: {
          type: 'object',
          properties: {
            sourceType: { type: 'string', example: 'thread-url' },
            description: { type: 'string' },
            requiresAdapter: { type: 'boolean', example: true },
            locationSchema: {
              type: 'object',
              additionalProperties: true
            },
            capabilities: {
              type: 'object',
              additionalProperties: true
            },
            package: { $ref: '#/components/schemas/SourceConnectorCatalogSourceTypePackage' },
            compatibleSourceKeys: {
              type: 'array',
              items: { type: 'string' },
              example: ['nga']
            },
            onboardingRecipe: { $ref: '#/components/schemas/SourceOnboardingRecipe' }
          }
        },
        SourceConnectorCatalog: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            packages: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceConnectorPackage' }
            },
            moduleErrors: {
              type: 'array',
              items: { $ref: '#/components/schemas/ConnectorModuleError' }
            },
            sourceTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceConnectorCatalogSourceType' }
            },
            adapters: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceConnectorCatalogAdapter' }
            }
          }
        },
        SourceTypeReadinessCheck: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'sourceType.inventory' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            value: {},
            summary: { type: 'string' }
          }
        },
        SourceTypeReadinessSummary: {
          type: 'object',
          properties: {
            sourceTypeCount: { type: 'number', example: 3 },
            readySourceTypeCount: { type: 'number', example: 1 },
            warnSourceTypeCount: { type: 'number', example: 2 },
            failSourceTypeCount: { type: 'number', example: 0 },
            unknownSourceTypeCount: { type: 'number', example: 0 },
            sourceCount: { type: 'number', example: 5 },
            enabledSourceCount: { type: 'number', example: 4 }
          }
        },
        SourceTypeReadinessItem: {
          type: 'object',
          properties: {
            sourceType: { type: 'string', example: 'saved-html-directory' },
            description: { type: 'string' },
            requiresAdapter: { type: 'boolean', example: true },
            compatibleSourceKeys: {
              type: 'array',
              items: { type: 'string' },
              example: ['nga']
            },
            capabilities: {
              type: 'object',
              additionalProperties: true
            },
            locationSchema: {
              type: 'object',
              additionalProperties: true
            },
            onboardingRecipe: { $ref: '#/components/schemas/SourceOnboardingRecipe' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            sourceCount: { type: 'number', example: 1 },
            enabledSourceCount: { type: 'number', example: 1 },
            statusCounts: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { ok: 1, warn: 0, fail: 0 }
            },
            checks: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceTypeReadinessCheck' }
            },
            sources: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        SourceTypeReadinessReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            summary: { $ref: '#/components/schemas/SourceTypeReadinessSummary' },
            sourceTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceTypeReadinessItem' }
            },
            unknownSourceTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceTypeReadinessItem' }
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            catalog: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceOnboardingCatalogSummary: {
          type: 'object',
          properties: {
            sourceType: {
              type: 'object',
              additionalProperties: true
            },
            sourceTypeCount: { type: 'number', example: 4 },
            adapterCount: { type: 'number', example: 1 }
          }
        },
        SourceRolloutManifestDraft: {
          type: 'object',
          properties: {
            version: { type: 'string', example: '1.0' },
            name: { type: 'string', example: 'nga-saved-html-directory-rollout-2026-06-18' },
            source: {
              type: 'object',
              additionalProperties: true
            },
            connector: {
              type: 'object',
              properties: {
                modulePath: { type: 'string' }
              },
              additionalProperties: true
            },
            ingest: {
              type: 'object',
              properties: {
                dryRun: { type: 'boolean', example: true }
              },
              additionalProperties: true
            },
            workers: {
              type: 'object',
              properties: {
                topology: { type: 'string', example: 'operations-worker' },
                sourceTaskMode: { type: 'string', example: 'ingest' }
              },
              additionalProperties: true
            }
          }
        },
        SourceOnboardingPreflight: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            steps: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceOnboardingPreflightStep' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceOnboardingPreflightAction' }
            },
            catalog: { $ref: '#/components/schemas/SourceOnboardingCatalogSummary' },
            connectorReadiness: {
              type: 'object',
              additionalProperties: true
            },
            sourceValidation: {
              type: 'object',
              additionalProperties: true
            },
            connectorModuleValidation: {
              type: 'object',
              additionalProperties: true
            },
            threadJsonValidation: {
              type: 'object',
              additionalProperties: true
            },
            threadSnapshotContract: {
              type: 'object',
              properties: {
                version: { type: 'string' },
                required: {
                  type: 'array',
                  items: { type: 'string' }
                },
                schemaType: { type: 'string', example: 'object' }
              },
              additionalProperties: true
            },
            rolloutManifestDraft: { $ref: '#/components/schemas/SourceRolloutManifestDraft' }
          }
        },
        OperationsPlanStep: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'manifest.structure' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            summary: { type: 'string' },
            evidence: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        OperationsPlanAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'resources.provisioning' },
            sourceId: { type: 'string' },
            severity: { type: 'string', enum: ['warning', 'critical'] },
            summary: { type: 'string' },
            command: { type: 'string' },
            commands: {
              type: 'array',
              items: { type: 'string' }
            },
            relatedCommands: {
              type: 'array',
              items: { type: 'string' }
            },
            env: {
              type: 'array',
              items: { type: 'string' }
            },
            evidence: {
              type: 'object',
              additionalProperties: true
            },
            evidenceSummary: { type: 'string' },
            details: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        ConnectorRolloutPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            sourceKey: { type: 'string', example: 'external' },
            sourceType: { type: 'string', example: 'external-feed' },
            modulePath: { type: 'string', example: 'D:/connectors/custom-forum.cjs' },
            steps: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanStep' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanAction' }
            },
            connectorModuleValidation: {
              type: 'object',
              additionalProperties: true
            },
            sourceOnboardingPreflight: { $ref: '#/components/schemas/SourceOnboardingPreflight' },
            sourceIngestDryRun: {
              type: 'object',
              additionalProperties: true
            },
            connectorReadiness: {
              type: 'object',
              additionalProperties: true
            },
            deploymentChecklist: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        RolloutManifestPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            manifestVersion: { type: 'string', example: '1.0' },
            name: { type: 'string', example: 'nga-sample-rollout' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            modulePath: { type: 'string' },
            steps: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanStep' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanAction' }
            },
            manifest: {
              type: 'object',
              additionalProperties: true
            },
            connectorRolloutPlan: { $ref: '#/components/schemas/ConnectorRolloutPlan' },
            workerTopologyPlan: { $ref: '#/components/schemas/WorkerTopologyPlan' }
          }
        },
        PostgresSchemaDrift: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'fail'] },
            missingCount: { type: 'number' },
            missingExtensions: {
              type: 'array',
              items: { type: 'string' }
            },
            missingTables: {
              type: 'array',
              items: { type: 'string' }
            },
            missingColumns: {
              type: 'array',
              items: { type: 'string' }
            },
            missingIndexes: {
              type: 'array',
              items: { type: 'string' }
            },
            inspectionErrors: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            applyCommand: {
              type: 'string',
              example: 'psql "$env:THREADTRACE_DATABASE_URL" -f docs/postgresql-schema.sql'
            }
          }
        },
        ResourceProvisioningItem: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'storage.postgres' },
            area: { type: 'string', example: 'storage' },
            required: { type: 'boolean' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            summary: { type: 'string' },
            evidence: {
              type: 'object',
              additionalProperties: true
            },
            evidenceSummary: { type: 'string' },
            env: {
              type: 'array',
              items: { type: 'string' }
            },
            commands: {
              type: 'array',
              items: { type: 'string' }
            },
            provisioning: {
              type: 'array',
              items: { type: 'string' }
            },
            schemaDrift: { $ref: '#/components/schemas/PostgresSchemaDrift' }
          }
        },
        ResourceProvisioningEnvironment: {
          type: 'object',
          properties: {
            storageMode: { type: 'string', example: 'postgres' },
            sourceTaskMode: { type: 'string', example: 'ingest' },
            notificationChannel: { type: 'string', example: 'file' },
            reviewActionExecutor: { type: 'string', example: 'file-audit' },
            llmProvider: { type: 'string', example: 'mock' },
            manifestName: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' }
          }
        },
        ResourceProvisioningPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            environment: { $ref: '#/components/schemas/ResourceProvisioningEnvironment' },
            resources: {
              type: 'array',
              items: { $ref: '#/components/schemas/ResourceProvisioningItem' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanAction' }
            },
            runtimeDiagnostics: {
              type: 'object',
              additionalProperties: true
            },
            deploymentChecklist: {
              type: 'object',
              additionalProperties: true
            },
            rolloutManifestPlan: { $ref: '#/components/schemas/RolloutManifestPlan' }
          }
        },
        DeploymentGateItem: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'resources.provisioning' },
            area: { type: 'string', example: 'resources' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            summary: { type: 'string' },
            evidence: {
              type: 'object',
              additionalProperties: true
            },
            commands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        DeploymentGateReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            gateCount: { type: 'number', example: 4 },
            gates: {
              type: 'array',
              items: { $ref: '#/components/schemas/DeploymentGateItem' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanAction' }
            },
            rolloutManifestPlan: { $ref: '#/components/schemas/RolloutManifestPlan' },
            resourceProvisioningPlan: { $ref: '#/components/schemas/ResourceProvisioningPlan' },
            deploymentChecklist: {
              type: 'object',
              additionalProperties: true
            },
            operationsRunbook: { $ref: '#/components/schemas/OperationsRunbook' }
          }
        },
        TaskRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', example: 'rollout-manifest-apply' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
            input: {
              type: 'object',
              additionalProperties: true
            },
            progress: {
              type: 'object',
              additionalProperties: true
            },
            output: {
              type: 'object',
              additionalProperties: true
            },
            error: {
              type: 'object',
              additionalProperties: true
            },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            startedAt: { type: 'string' },
            finishedAt: { type: 'string' }
          }
        },
        TaskDetail: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            task: { $ref: '#/components/schemas/TaskRecord' },
            sourceScope: { $ref: '#/components/schemas/TaskSourceScope' },
            traceContext: { $ref: '#/components/schemas/TaskTraceContext' },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskDetailLink' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskDetailAction' }
            }
          }
        },
        TaskSourceScope: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            sourceThreadId: { type: 'string' }
          }
        },
        TaskTraceContext: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            query: {
              type: 'object',
              additionalProperties: true
            },
            taskCount: { type: 'number' },
            summary: {
              type: 'object',
              additionalProperties: true
            },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        TaskDetailLink: {
          type: 'object',
          properties: {
            rel: { type: 'string', example: 'trace-context' },
            method: { type: 'string', example: 'GET' },
            href: { type: 'string' }
          }
        },
        TaskDetailAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'task.trace-context' },
            severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
            summary: { type: 'string' },
            command: { type: 'string' },
            evidence: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        RolloutManifestRollbackPlan: {
          type: 'object',
          properties: {
            available: { type: 'boolean' },
            mode: { type: 'string', enum: ['dry-run-template', 'post-apply'] },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string', example: 'nga' },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            summary: { type: 'string' },
            commands: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        RolloutManifestRegistration: {
          type: 'object',
          properties: {
            created: { type: 'boolean' },
            source: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        RolloutManifestApplyReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            applied: { type: 'boolean', example: false },
            manifestName: { type: 'string', example: 'nga-sample-rollout' },
            sourceDraft: {
              type: 'object',
              additionalProperties: true
            },
            registration: { $ref: '#/components/schemas/RolloutManifestRegistration' },
            registrationError: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                details: {
                  type: 'object',
                  additionalProperties: true
                }
              }
            },
            rollbackPlan: { $ref: '#/components/schemas/RolloutManifestRollbackPlan' },
            steps: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanStep' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/OperationsPlanAction' }
            },
            deploymentGate: { $ref: '#/components/schemas/DeploymentGateReport' }
          }
        },
        RolloutManifestApplyResult: {
          type: 'object',
          properties: {
            task: { $ref: '#/components/schemas/TaskRecord' },
            report: { $ref: '#/components/schemas/RolloutManifestApplyReport' },
            idempotency: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        RunbookAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'sourceDiagnostics.source.handler.tracked-source-nga-001' },
            severity: { type: 'string', enum: ['critical', 'warning'] },
            area: { type: 'string', example: 'sources' },
            title: { type: 'string', example: 'Fix tracked source ingest handler.' },
            summary: { type: 'string' },
            recommendedCommand: {
              type: 'string',
              example: 'node src/presentation/cli/threadtrace.js source-diagnostics --source-id tracked-source-nga-001'
            },
            relatedCommands: {
              type: 'array',
              items: { type: 'string' }
            },
            evidence: {
              type: 'object',
              description: 'Structured evidence from readiness, source diagnostics, lifecycle, notification, review action, author queue, or pipeline checks.',
              additionalProperties: true
            },
            evidenceSummary: { type: 'string' }
          }
        },
        OperationsRunbook: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            actionCount: { type: 'number', example: 2 },
            actions: {
              type: 'array',
              items: { $ref: '#/components/schemas/RunbookAction' }
            },
            checklist: {
              type: 'object',
              additionalProperties: true
            },
            sourceLifecycleReport: {
              type: 'object',
              additionalProperties: true
            },
            reviewActionGate: {
              type: 'object',
              additionalProperties: true
            },
            notificationEventOverview: {
              type: 'object',
              additionalProperties: true
            },
            pipelineRuns: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        NotificationEvent: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'runbook-action-afdda22a04d1' },
            type: {
              type: 'string',
              enum: ['source-changed', 'runbook-action', 'context-review-result', 'author-review-queue', 'source-attention', 'source-type-operations']
            },
            severity: { type: 'string', enum: ['debug', 'info', 'warning', 'critical'] },
            sourceId: { type: 'string', example: 'tracked-source-nga-001' },
            sourceKey: { type: 'string', example: 'nga' },
            taskId: { type: 'string' },
            createdAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            title: { type: 'string' },
            summary: { type: 'string' },
            payload: {
              type: 'object',
              additionalProperties: true
            },
            deliveryStatus: { type: 'string', enum: ['pending', 'delivered', 'failed', 'resolved'] },
            deliveryAttempts: { type: 'number', example: 0 },
            nextDeliveryAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            deliveryResult: {
              type: 'object',
              additionalProperties: true
            },
            lastDeliveryError: {
              type: 'object',
              additionalProperties: true
            },
            lastDeliveryAttemptAt: { type: 'string' },
            lastDeliveredAt: { type: 'string' },
            acknowledgedAt: { type: 'string' },
            acknowledgedBy: { type: 'string' },
            acknowledgementNote: { type: 'string' },
            archivedAt: { type: 'string' },
            archivedBy: { type: 'string' },
            archiveReason: { type: 'string' },
            archiveBatchId: { type: 'string' }
          }
        },
        NotificationEventListResult: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEvent' }
            }
          }
        },
        NotificationEventDetail: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            event: { $ref: '#/components/schemas/NotificationEvent' },
            sourceScope: { $ref: '#/components/schemas/TaskSourceScope' },
            relatedTask: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                status: { type: 'string' },
                missing: { type: 'boolean' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                finishedAt: { type: 'string' }
              },
              additionalProperties: true
            },
            actionReadiness: { $ref: '#/components/schemas/NotificationEventActionReadiness' },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskDetailLink' }
            },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskDetailAction' }
            }
          }
        },
        NotificationEventActionReadinessGate: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            status: { type: 'string', enum: ['ok', 'warn', 'skipped', 'blocked'] },
            executable: { type: 'boolean' },
            blocking: { type: 'boolean' },
            summary: { type: 'string' }
          },
          additionalProperties: true
        },
        NotificationEventActionReadiness: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            gateCount: { type: 'number' },
            warningCount: { type: 'number' },
            executableActionKeys: {
              type: 'array',
              items: { type: 'string' }
            },
            gates: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventActionReadinessGate' }
            }
          }
        },
        NotificationEventActionIntentApiPlan: {
          type: 'object',
          properties: {
            method: { type: 'string', example: 'POST' },
            path: { type: 'string', example: '/api/events/event-id/ack' },
            body: { type: 'object', additionalProperties: true }
          },
          additionalProperties: true
        },
        NotificationEventActionIntent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', example: 'notification-event-action' },
            actionKey: { type: 'string', example: 'event.acknowledge' },
            eventId: { type: 'string' },
            summary: { type: 'string' },
            command: { type: 'string' },
            api: { $ref: '#/components/schemas/NotificationEventActionIntentApiPlan' },
            actor: { type: 'string' },
            reason: { type: 'string' },
            evidence: { type: 'object', additionalProperties: true },
            audit: { type: 'object', additionalProperties: true }
          },
          additionalProperties: true
        },
        NotificationEventActionIntentLedger: {
          type: 'object',
          properties: {
            recorded: { type: 'boolean' },
            recordId: { type: 'string' },
            filePath: { type: 'string' },
            reason: { type: 'string' }
          },
          additionalProperties: true
        },
        NotificationEventActionIntentRecord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', example: 'notification-event-action-intent' },
            generatedAt: { type: 'string' },
            mode: { type: 'string', enum: ['dry-run'] },
            dryRun: { type: 'boolean' },
            executed: { type: 'boolean' },
            status: { type: 'string' },
            eventId: { type: 'string' },
            actionKey: { type: 'string' },
            actor: { type: 'string' },
            sourceScope: { $ref: '#/components/schemas/TaskSourceScope' },
            intent: { $ref: '#/components/schemas/NotificationEventActionIntent' },
            readinessGate: { $ref: '#/components/schemas/NotificationEventActionReadinessGate' },
            filePath: { type: 'string' }
          },
          additionalProperties: true
        },
        NotificationEventActionIntentResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            mode: { type: 'string', enum: ['dry-run'] },
            dryRun: { type: 'boolean' },
            executed: { type: 'boolean' },
            status: { type: 'string', enum: ['ok', 'warn', 'blocked'] },
            event: { $ref: '#/components/schemas/NotificationEventSummary' },
            sourceScope: { $ref: '#/components/schemas/TaskSourceScope' },
            relatedTask: { type: 'object', additionalProperties: true },
            action: { $ref: '#/components/schemas/TaskDetailAction' },
            readinessGate: { $ref: '#/components/schemas/NotificationEventActionReadinessGate' },
            intent: { $ref: '#/components/schemas/NotificationEventActionIntent' },
            ledger: { $ref: '#/components/schemas/NotificationEventActionIntentLedger' },
            actionReadiness: { $ref: '#/components/schemas/NotificationEventActionReadiness' },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskDetailAction' }
            }
          }
        },
        NotificationEventActionIntentListResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            status: { type: 'string' },
            eventId: { type: 'string' },
            actionKey: { type: 'string' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string' },
            actor: { type: 'string' },
            count: { type: 'number' },
            intents: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventActionIntentRecord' }
            }
          }
        },
        NotificationEventActionExecutionLedger: {
          type: 'object',
          properties: {
            recorded: { type: 'boolean' },
            key: { type: 'string' },
            status: { type: 'string', enum: ['completed', 'running', 'failed'] },
            replayed: { type: 'boolean' },
            originalUpdatedAt: { type: 'string' },
            filePath: { type: 'string' },
            reason: { type: 'string' }
          },
          additionalProperties: true
        },
        NotificationEventActionExecutionRecord: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            type: { type: 'string', example: 'notification-event-action-execution' },
            status: { type: 'string', enum: ['running', 'completed', 'failed'] },
            attemptCount: { type: 'number' },
            eventId: { type: 'string' },
            actionKey: { type: 'string', example: 'event.acknowledge' },
            actor: { type: 'string' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string' },
            sourceScope: { $ref: '#/components/schemas/TaskSourceScope' },
            requestHash: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            completedAt: { type: 'string' },
            failedAt: { type: 'string' },
            staleRunning: { type: 'boolean' },
            runningAgeMs: { type: 'number' },
            intent: { type: 'object', additionalProperties: true },
            result: { type: 'object', additionalProperties: true },
            error: { type: 'object', additionalProperties: true },
            filePath: { type: 'string' }
          },
          additionalProperties: true
        },
        NotificationEventActionExecutionResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            mode: { type: 'string', enum: ['dry-run', 'execute'] },
            dryRun: { type: 'boolean' },
            executed: { type: 'boolean' },
            status: { type: 'string', enum: ['ok', 'warn', 'blocked'] },
            event: { $ref: '#/components/schemas/NotificationEventSummary' },
            sourceScope: { $ref: '#/components/schemas/TaskSourceScope' },
            relatedTask: { type: 'object', additionalProperties: true },
            action: { $ref: '#/components/schemas/TaskDetailAction' },
            readinessGate: { $ref: '#/components/schemas/NotificationEventActionReadinessGate' },
            intent: { $ref: '#/components/schemas/NotificationEventActionIntent' },
            ledger: { $ref: '#/components/schemas/NotificationEventActionIntentLedger' },
            executionLedger: { $ref: '#/components/schemas/NotificationEventActionExecutionLedger' },
            actionReadiness: { $ref: '#/components/schemas/NotificationEventActionReadiness' },
            nextActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/TaskDetailAction' }
            }
          },
          additionalProperties: true
        },
        NotificationEventActionExecutionListResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string' },
            status: { type: 'string' },
            healthStatus: { type: 'string' },
            eventId: { type: 'string' },
            actionKey: { type: 'string' },
            sourceId: { type: 'string' },
            sourceKey: { type: 'string' },
            actor: { type: 'string' },
            count: { type: 'number' },
            runningStaleAfterMs: { type: 'number' },
            runningCount: { type: 'number' },
            completedCount: { type: 'number' },
            failedCount: { type: 'number' },
            staleRunningCount: { type: 'number' },
            message: { type: 'string' },
            executions: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventActionExecutionRecord' }
            }
          }
        },
        NotificationEventDispatchItem: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['delivered', 'failed'] },
            event: { $ref: '#/components/schemas/NotificationEvent' },
            deliveryResult: {
              type: 'object',
              additionalProperties: true
            },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              },
              additionalProperties: true
            }
          }
        },
        NotificationEventDispatchResult: {
          type: 'object',
          properties: {
            channelKey: { type: 'string', example: 'webhook' },
            dispatchedCount: { type: 'number', example: 1 },
            failedCount: { type: 'number', example: 0 },
            skippedCount: { type: 'number', example: 0 },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventDispatchItem' }
            }
          }
        },
        NotificationEventSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'runbook-action-afdda22a04d1' },
            type: { type: 'string', example: 'runbook-action' },
            severity: { type: 'string', enum: ['debug', 'info', 'warning', 'critical'] },
            sourceId: { type: 'string', example: 'tracked-source-nga-001' },
            sourceKey: { type: 'string', example: 'nga' },
            title: { type: 'string' },
            summary: { type: 'string' },
            createdAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            deliveryStatus: { type: 'string', enum: ['pending', 'delivered', 'failed', 'resolved'] },
            deliveryAttempts: { type: 'number', example: 0 },
            nextDeliveryAt: { type: 'string' },
            lastDeliveryError: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        NotificationEventAckItem: {
          type: 'object',
          properties: {
            eventId: { type: 'string', example: 'runbook-action-afdda22a04d1' },
            status: { type: 'string', enum: ['candidate', 'acknowledged', 'skipped'] },
            reason: { type: 'string', example: 'already-acknowledged' },
            event: { $ref: '#/components/schemas/NotificationEventSummary' }
          }
        },
        NotificationEventAckResult: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['preview', 'ok', 'noop'] },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            requestedCount: { type: 'number', example: 1 },
            eventCount: { type: 'number', example: 1 },
            candidateCount: { type: 'number', example: 1 },
            acknowledgedCount: { type: 'number', example: 0 },
            skippedCount: { type: 'number', example: 0 },
            acknowledgedBy: { type: 'string', example: 'operator' },
            filters: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                sourceId: { type: 'string' },
                sourceKey: { type: 'string', example: 'nga' },
                acknowledged: { type: 'boolean', example: false },
                deliveryStatus: { type: 'string', example: 'delivered' },
                limit: { type: 'number', example: 50 }
              }
            },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventAckItem' }
            }
          }
        },
        NotificationEventAckSingleResult: {
          type: 'object',
          properties: {
            event: { $ref: '#/components/schemas/NotificationEvent' }
          }
        },
        NotificationEventArchiveItem: {
          type: 'object',
          properties: {
            eventId: { type: 'string', example: 'runbook-action-afdda22a04d1' },
            status: { type: 'string', enum: ['archived', 'skipped'] },
            reason: { type: 'string', example: 'not-found' },
            event: { $ref: '#/components/schemas/NotificationEventSummary' }
          }
        },
        NotificationEventArchiveResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            status: { type: 'string', enum: ['actionable', 'ok', 'warn', 'noop'] },
            dryRun: { type: 'boolean', example: true },
            execute: { type: 'boolean', example: false },
            batchId: { type: 'string', example: 'notification-event-archive-20260619T100000-c9e923df' },
            cutoffAt: { type: 'string', example: '2026-05-20T10:00:00.000Z' },
            olderThanDays: { type: 'number', example: 30 },
            scanLimit: { type: 'number', example: 500 },
            archiveLimit: { type: 'number', example: 100 },
            scannedCount: { type: 'number', example: 5 },
            candidateCount: { type: 'number', example: 1 },
            archivedCount: { type: 'number', example: 0 },
            skippedCount: { type: 'number', example: 0 },
            filters: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                sourceId: { type: 'string' },
                sourceKey: { type: 'string', example: 'nga' },
                deliveryStatuses: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['delivered', 'resolved']
                },
                requireAcknowledged: { type: 'boolean', example: true }
              }
            },
            candidates: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventSummary' }
            },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventArchiveItem' }
            },
            recommendedNextAction: { type: 'string' }
          }
        },
        NotificationEventSourceHotspot: {
          type: 'object',
          properties: {
            sourceId: { type: 'string', example: 'tracked-source-nga-001' },
            sourceKey: { type: 'string', example: 'nga' },
            eventCount: { type: 'number', example: 5 },
            openCount: { type: 'number', example: 3 },
            failedCount: { type: 'number', example: 1 },
            dueForDeliveryCount: { type: 'number', example: 2 },
            retryExhaustedCount: { type: 'number', example: 0 },
            latestCreatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            oldestUnacknowledgedAt: { type: 'string', example: '2026-06-19T09:00:00.000Z' }
          }
        },
        NotificationEventAttention: {
          type: 'object',
          properties: {
            failedEvents: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventSummary' }
            },
            dueEvents: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventSummary' }
            },
            retryExhaustedEvents: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventSummary' }
            },
            reviewableEvents: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventSummary' }
            },
            unacknowledgedByType: {
              type: 'object',
              additionalProperties: { type: 'number' }
            }
          }
        },
        NotificationSynthesisPolicyRule: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'severity-warning' },
            severity: { type: 'string', example: 'warning' },
            threshold: { type: 'number', example: 70 },
            summary: { type: 'string' }
          }
        },
        NotificationSynthesisPolicyEventType: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'source-attention' },
            sourceScoped: { type: 'boolean', example: true },
            staleResolution: { type: 'boolean', example: true },
            reopensAutoResolved: { type: 'boolean', example: true },
            skipsAcknowledged: { type: 'boolean', example: true },
            skipsDelivered: { type: 'boolean', example: true },
            preservesDeliveryState: { type: 'boolean', example: true },
            alertRules: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationSynthesisPolicyRule' }
            }
          }
        },
        NotificationSynthesisPolicyReport: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            defaults: {
              type: 'object',
              properties: {
                dryRun: { type: 'boolean', example: true },
                alertSeverities: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['critical', 'warning']
                },
                sourceAttentionPriorityScoreThreshold: { type: 'number', example: 70 },
                immutableExistingStates: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['acknowledged', 'delivered']
                },
                mutationStatuses: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['created', 'updated', 'resolved', 'reopened']
                }
              }
            },
            sharedRules: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationSynthesisPolicyRule' }
            },
            eventTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationSynthesisPolicyEventType' }
            },
            recommendedNextAction: { type: 'string' }
          }
        },
        NotificationEventOverview: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            windowLimit: { type: 'number', example: 200 },
            filters: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                sourceId: { type: 'string' },
                sourceKey: { type: 'string' },
                acknowledged: { type: 'boolean' },
                deliveryStatus: { type: 'string' }
              }
            },
            eventCount: { type: 'number', example: 5 },
            pendingCount: { type: 'number', example: 2 },
            failedCount: { type: 'number', example: 1 },
            unacknowledgedCount: { type: 'number', example: 3 },
            acknowledgedCount: { type: 'number', example: 2 },
            dueForDeliveryCount: { type: 'number', example: 1 },
            retryExhaustedCount: { type: 'number', example: 0 },
            nextDeliveryAt: { type: 'string' },
            oldestUnacknowledgedAt: { type: 'string' },
            latestCreatedAt: { type: 'string' },
            byType: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            bySeverity: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            byDeliveryStatus: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            byOpenDeliveryStatus: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            byAcknowledgement: {
              type: 'object',
              properties: {
                acknowledged: { type: 'number' },
                unacknowledged: { type: 'number' }
              }
            },
            bySourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            byOpenSourceKey: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            sourceHotspots: {
              type: 'array',
              items: { $ref: '#/components/schemas/NotificationEventSourceHotspot' }
            },
            attention: { $ref: '#/components/schemas/NotificationEventAttention' },
            recommendedNextAction: { type: 'string' }
          }
        },
        RunbookNotificationEventSynthesisItem: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['created', 'updated', 'resolved', 'reopened', 'skipped'] },
            actionKey: { type: 'string', example: 'checklist.sources.ingestConfiguration' },
            event: { $ref: '#/components/schemas/NotificationEvent' },
            reason: { type: 'string', example: 'runbook-action-cleared' }
          }
        },
        RunbookNotificationEventSynthesisResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-19T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            actionCount: { type: 'number', example: 1 },
            eventCount: { type: 'number', example: 1 },
            createdCount: { type: 'number', example: 1 },
            updatedCount: { type: 'number', example: 0 },
            resolvedCount: { type: 'number', example: 0 },
            reopenedCount: { type: 'number', example: 0 },
            skippedCount: { type: 'number', example: 0 },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/RunbookNotificationEventSynthesisItem' }
            },
            runbook: { $ref: '#/components/schemas/OperationsRunbook' }
          }
        },
        SourceAttentionNotificationEventSynthesisItem: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['created', 'updated', 'resolved', 'reopened', 'skipped'] },
            attentionKey: { type: 'string', example: 'sourceId:tracked-source-nga-001' },
            event: { $ref: '#/components/schemas/NotificationEvent' },
            reason: { type: 'string', example: 'source-attention-cleared' }
          }
        },
        SourceAttentionNotificationEventSynthesisResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            sourceCount: { type: 'number', example: 3 },
            actionCount: { type: 'number', example: 1 },
            eventCount: { type: 'number', example: 1 },
            createdCount: { type: 'number', example: 1 },
            updatedCount: { type: 'number', example: 0 },
            resolvedCount: { type: 'number', example: 0 },
            reopenedCount: { type: 'number', example: 0 },
            skippedCount: { type: 'number', example: 0 },
            priorityScoreThreshold: { type: 'number', example: 70 },
            recommendedNextAction: { type: 'string' },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceAttentionNotificationEventSynthesisItem' }
            },
            sourceAttention: { $ref: '#/components/schemas/SourceAttentionReport' }
          }
        },
        SourceTypeOperationsNotificationEventSynthesisItem: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['created', 'updated', 'resolved', 'reopened', 'skipped'] },
            sourceType: { type: 'string', example: 'saved-html-directory' },
            event: { $ref: '#/components/schemas/NotificationEvent' },
            reason: { type: 'string', example: 'source-type-operations-cleared' }
          }
        },
        SourceTypeOperationsNotificationEventSynthesisResult: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-25T10:00:00.000Z' },
            status: { type: 'string', example: 'ok' },
            dryRun: { type: 'boolean', example: true },
            executed: { type: 'boolean', example: false },
            sourceTypeCount: { type: 'number', example: 3 },
            actionCount: { type: 'number', example: 1 },
            eventCount: { type: 'number', example: 1 },
            createdCount: { type: 'number', example: 1 },
            updatedCount: { type: 'number', example: 0 },
            resolvedCount: { type: 'number', example: 0 },
            reopenedCount: { type: 'number', example: 0 },
            skippedCount: { type: 'number', example: 0 },
            priorityScoreThreshold: { type: 'number', example: 70 },
            includeReadinessWarnings: { type: 'boolean', example: false },
            recommendedNextAction: { type: 'string' },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/SourceTypeOperationsNotificationEventSynthesisItem' }
            },
            sourceTypeOperations: { $ref: '#/components/schemas/SourceTypeOperationsReport' }
          }
        },
        WorkerTopologyWorker: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'worker.dueSource' },
            workerType: { type: 'string', example: 'due-source' },
            role: { type: 'string' },
            required: { type: 'boolean', example: true },
            scale: { type: 'string', example: 'single-active-per-lease' },
            leaseKey: { type: 'string', example: 'worker:due-source:source-id:tracked-source-nga-001' },
            intervalMs: { type: 'number', example: 300000 },
            scope: { $ref: '#/components/schemas/SourceScope' },
            command: {
              type: 'string',
              example: 'node src/presentation/worker/dueSourceWorkerMain.js --loop --source-task-mode ingest --source-key nga --source-id tracked-source-nga-001'
            }
          }
        },
        WorkerTopologyPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            topology: { type: 'string', enum: ['operations-worker', 'split-workers'] },
            storageMode: { type: 'string', example: 'postgres' },
            sourceTaskMode: { type: 'string', enum: ['ingest', 'insight-pipeline'] },
            sourceId: { type: 'string', example: 'tracked-source-nga-001' },
            sourceKey: { type: 'string', example: 'nga' },
            scope: { $ref: '#/components/schemas/SourceScope' },
            workers: {
              type: 'array',
              items: { $ref: '#/components/schemas/WorkerTopologyWorker' }
            },
            checks: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            runtime: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        SourceOperationsDrilldown: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            storageMode: { type: 'string', example: 'file' },
            scope: { $ref: '#/components/schemas/SourceScope' },
            sourceFound: { type: 'boolean', example: true },
            source: { type: 'object', additionalProperties: true },
            sourceCandidates: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            collectionPlan: { $ref: '#/components/schemas/SourceCollectionPlan' },
            health: {
              type: 'object',
              properties: {
                source: { type: 'object', additionalProperties: true },
                tasks: { type: 'object', additionalProperties: true },
                events: { type: 'object', additionalProperties: true },
                workers: {
                  type: 'object',
                  properties: {
                    runs: { type: 'object', additionalProperties: true },
                    leases: { type: 'object', additionalProperties: true }
                  },
                  additionalProperties: true
                },
                authorReviewQueue: { $ref: '#/components/schemas/AuthorReviewQueueSummary' },
                reviewActions: { type: 'object', additionalProperties: true },
                notificationEventActions: { type: 'object', additionalProperties: true }
              },
              additionalProperties: true
            },
            attention: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
                found: { type: 'boolean' },
                key: { type: 'string' },
                attentionRank: { type: 'number' },
                priorityScore: { type: 'number' },
                severity: { type: 'string', enum: ['critical', 'warning', 'warn', 'info', 'ok', 'muted'] },
                signalCount: { type: 'number' },
                runnable: { type: 'boolean' },
                recommendedNextAction: { type: 'string' },
                recommendedCommand: { type: 'string' },
                signals: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SourceAttentionSignal' }
                },
                commands: {
                  type: 'array',
                  items: { type: 'string' }
                },
                reportSummary: { $ref: '#/components/schemas/SourceAttentionSummary' }
              },
              additionalProperties: true
            },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            timeline: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string', example: 'worker-run' },
                  id: { type: 'string' },
                  status: { type: 'string' },
                  severity: { type: 'string', enum: ['critical', 'warning', 'info', 'ok', 'muted'] },
                  timestamp: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  sourceId: { type: 'string' },
                  sourceKey: { type: 'string' },
                  reference: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            recent: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                events: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                workerRuns: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerRun' }
                },
                workerLeases: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerLease' }
                },
                authorReviewQueue: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuthorReviewQueueItem' }
                },
                reviewActionExecutions: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                notificationEventActionExecutions: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/NotificationEventActionExecutionRecord' }
                }
              },
              additionalProperties: true
            }
          }
        },
        SourceCollectionHealthProfile: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            scope: { $ref: '#/components/schemas/SourceScope' },
            sourceFound: { type: 'boolean', example: true },
            source: { type: 'object', additionalProperties: true },
            automation: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'scheduled' },
                strategy: { type: 'object', additionalProperties: true },
                schedule: { type: 'object', additionalProperties: true },
                lastRun: { type: 'object', additionalProperties: true }
              },
              additionalProperties: true
            },
            incremental: {
              type: 'object',
              properties: {
                cursor: { type: 'object', additionalProperties: true },
                incremental: { type: 'object', additionalProperties: true }
              },
              additionalProperties: true
            },
            replay: {
              type: 'object',
              properties: {
                available: { type: 'boolean', example: true },
                taskId: { type: 'string' },
                cursorFingerprint: { type: 'string' },
                rawPageHashCount: { type: 'number' },
                pageNumbers: { type: 'array', items: { type: 'number' } },
                sourceUrls: { type: 'array', items: { type: 'string' } },
                evidenceKinds: { type: 'array', items: { type: 'string' } },
                location: { type: 'object', additionalProperties: true }
              },
              additionalProperties: true
            },
            operations: { type: 'object', additionalProperties: true },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', example: 'collection.replayEvidence' },
                  area: { type: 'string', example: 'replay' },
                  status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
                  value: { type: 'string' },
                  summary: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            drilldown: { $ref: '#/components/schemas/SourceOperationsDrilldown' },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        AutomationReadinessPlan: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            scope: { $ref: '#/components/schemas/SourceScope' },
            readyForUnattendedRun: { type: 'boolean', example: false },
            summary: {
              type: 'object',
              properties: {
                sources: { type: 'object', additionalProperties: true },
                operations: { type: 'object', additionalProperties: true },
                representativeSource: { type: 'object', additionalProperties: true },
                workers: { type: 'object', additionalProperties: true },
                llm: { type: 'object', additionalProperties: true },
                demo: { type: 'object', additionalProperties: true }
              },
              additionalProperties: true
            },
            automation: {
              type: 'object',
              properties: {
                sourceTaskMode: { type: 'string', example: 'insight-pipeline' },
                topology: { type: 'string', example: 'operations-worker' },
                dueSources: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                skippedSources: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: true }
                },
                nextScheduledSource: { type: 'object', additionalProperties: true },
                representativeSource: { type: 'object', additionalProperties: true },
                workerCommands: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      workerType: { type: 'string' },
                      leaseKey: { type: 'string' },
                      intervalMs: { type: 'number' },
                      command: { type: 'string' }
                    },
                    additionalProperties: true
                  }
                }
              },
              additionalProperties: true
            },
            remediation: { $ref: '#/components/schemas/AutomationReadinessRemediationPlan' },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', example: 'automation.sources.scheduled' },
                  area: { type: 'string', example: 'sources' },
                  status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
                  value: { type: 'string' },
                  summary: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            inputs: { type: 'object', additionalProperties: true },
            sourceScheduleReport: { $ref: '#/components/schemas/SourceScheduleReport' },
            sourceOperationsCockpit: { $ref: '#/components/schemas/SourceOperationsCockpit' },
            sourceCollectionHealthProfile: { $ref: '#/components/schemas/SourceCollectionHealthProfile' },
            workerTopologyPlan: { $ref: '#/components/schemas/WorkerTopologyPlan' },
            llmReadinessProfile: { $ref: '#/components/schemas/LlmReadinessProfile' },
            demoCycle: { $ref: '#/components/schemas/SourceDemoCycleReport' },
            nextActions: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            }
          }
        },
        AutomationCockpitSnapshot: {
          type: 'object',
          properties: {
            schemaVersion: { type: 'string', example: 'automation-cockpit-snapshot.v1' },
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            readyForUnattendedRun: { type: 'boolean', example: false },
            summary: {
              type: 'object',
              properties: {
                readinessStatus: { type: 'string', example: 'warn' },
                notificationStatus: { type: 'string', example: 'ok' },
                auditStatus: { type: 'string', example: 'warn' },
                executionStatus: { type: 'string', example: 'ok' },
                diagnosticsStatus: { type: 'string', example: 'ok' },
                openNotificationCount: { type: 'number' },
                pendingNotificationCount: { type: 'number' },
                auditCount: { type: 'number' },
                executionCount: { type: 'number' }
              },
              additionalProperties: true
            },
            plan: { $ref: '#/components/schemas/AutomationReadinessPlan' },
            notificationOverview: { $ref: '#/components/schemas/NotificationEventOverview' },
            reviewActionAuditOverview: { $ref: '#/components/schemas/ContextReviewActionAuditOverview' },
            reviewActionExecutions: { $ref: '#/components/schemas/ContextReviewActionExecutionListResult' },
            notificationDiagnostics: { type: 'object', additionalProperties: true },
            operatorRunbook: { $ref: '#/components/schemas/AutomationCockpitOperatorRunbook' }
          }
        },
        AutomationCockpitOperatorRunbook: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'warn', 'fail'] },
            commandCount: { type: 'number', example: 4 },
            actionableCommandCount: { type: 'number', example: 2 },
            dryRunCommandCount: { type: 'number', example: 1 },
            executeCommandCount: { type: 'number', example: 1 },
            copyOnlyCommandCount: { type: 'number', example: 2 },
            nextCommand: { type: 'object', additionalProperties: true },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', example: 'workers' },
                  title: { type: 'string', example: 'Start long-running workers' },
                  status: { type: 'string', enum: ['ok', 'warn', 'fail', 'unknown'] },
                  commandCount: { type: 'number' },
                  commands: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        title: { type: 'string' },
                        command: { type: 'string' },
                        severity: { type: 'string' },
                        intent: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', example: 'set-source-schedule' },
                            sourceId: { type: 'string' },
                            sourceKey: { type: 'string' },
                            sourceType: { type: 'string' },
                            execute: { type: 'boolean' },
                            intervalMinutes: { type: 'number', example: 60 },
                            runNow: { type: 'boolean' },
                            scheduleEnabled: { type: 'boolean' }
                          },
                          additionalProperties: true
                        }
                      },
                      additionalProperties: true
                    }
                  }
                },
                additionalProperties: true
              }
            }
          }
        },
        AutomationReadinessRemediationPlan: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['actionable', 'manual', 'none'] },
            actionCount: { type: 'number', example: 1 },
            executableCount: { type: 'number', example: 1 },
            dryRunCount: { type: 'number', example: 1 },
            manualActionCount: { type: 'number', example: 2 },
            safeToAutoApply: { type: 'boolean', example: true },
            actions: {
              type: 'array',
              items: { $ref: '#/components/schemas/AutomationReadinessRemediationAction' }
            },
            manualActions: {
              type: 'array',
              items: { $ref: '#/components/schemas/AutomationReadinessManualAction' }
            },
            nextAction: { type: 'object', additionalProperties: true }
          }
        },
        AutomationReadinessRemediationAction: {
          type: 'object',
          properties: {
            key: { type: 'string', example: 'automation.remediate.source.schedule.source-1' },
            checkKey: { type: 'string', example: 'automation.sources.scheduled' },
            type: { type: 'string', example: 'configure-source-schedule' },
            severity: { type: 'string', enum: ['warning', 'critical'] },
            summary: { type: 'string' },
            scope: { $ref: '#/components/schemas/SourceScope' },
            reason: { type: 'string', example: 'no-schedule' },
            destructive: { type: 'boolean', example: false },
            dryRun: { type: 'object', additionalProperties: true },
            execute: { type: 'object', additionalProperties: true },
            command: { type: 'string' },
            executeCommand: { type: 'string' }
          },
          additionalProperties: true
        },
        AutomationReadinessManualAction: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            checkKey: { type: 'string' },
            severity: { type: 'string', enum: ['warning', 'critical'] },
            summary: { type: 'string' },
            command: { type: 'string' }
          },
          additionalProperties: true
        },
        OperationalOverview: {
          type: 'object',
          properties: {
            generatedAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
            storageMode: { type: 'string', example: 'file' },
            windowLimit: { type: 'number', example: 100 },
            sources: { type: 'object', additionalProperties: true },
            tasks: { type: 'object', additionalProperties: true },
            events: { type: 'object', additionalProperties: true },
            workers: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                running: { type: 'number' },
                stale: { type: 'number' },
                completed: { type: 'number' },
                failed: { type: 'number' },
                skipped: { type: 'number' },
                sourceScoped: { type: 'number' },
                unscoped: { type: 'number' },
                byWorkerType: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                bySourceId: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                bySourceKey: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                runningBySourceId: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                runningBySourceKey: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                staleBySourceId: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                staleBySourceKey: {
                  type: 'object',
                  additionalProperties: { type: 'number' }
                },
                latestHeartbeatAt: { type: 'string' },
                leases: { $ref: '#/components/schemas/WorkerLeaseSummary' },
                latestRun: { $ref: '#/components/schemas/WorkerRun' },
                staleRuns: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerRun' }
                }
              }
            },
            rawPages: { type: 'object', additionalProperties: true },
            authorReviewQueue: { $ref: '#/components/schemas/AuthorReviewQueueSummary' },
            reviewActions: { type: 'object', additionalProperties: true },
            notificationEventActions: { type: 'object', additionalProperties: true },
            recent: {
              type: 'object',
              properties: {
                workerLeases: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerLease' }
                },
                workerRuns: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/WorkerRun' }
                },
                authorReviewQueue: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/AuthorReviewQueueItem' }
                },
                notificationEventActionExecutions: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/NotificationEventActionExecutionRecord' }
                }
              },
              additionalProperties: true
            }
          }
        },
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
        },
        ServiceUnavailable: {
          description: 'Required runtime dependency is unavailable or unhealthy',
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
