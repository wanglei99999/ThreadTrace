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
              description: 'New post context report'
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
              description: 'Completed task and report'
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
              description: 'Completed semantic enrichment task'
            },
            400: {
              description: 'Invalid request'
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
              description: 'Completed raw page replay task'
            },
            400: {
              description: 'Invalid request'
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
                    url: { type: 'string' },
                    intervalMinutes: { type: 'number', example: 60 },
                    nextRunAt: { type: 'string', example: '2026-06-18T10:00:00.000Z' },
                    scheduleEnabled: { type: 'boolean' },
                    enabled: { type: 'boolean' },
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
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed ingest task and report'
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
                    storeDir: { type: 'string', example: 'D:/Coding/GitCoding/ThreadTrace/data/store' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Completed source insight pipeline task'
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
