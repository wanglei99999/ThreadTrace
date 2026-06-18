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
      }
    }
  };
}

module.exports = {
  createOpenApiSpec
};
