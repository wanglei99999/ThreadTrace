'use strict';

function getThreadSnapshotJsonContract() {
  return {
    version: '1.0.0',
    name: 'ThreadTrace ThreadSnapshot JSON',
    description: 'Canonical thread snapshot payload accepted by normalized-thread-json sources.',
    schema: {
      type: 'object',
      required: ['sourceKey', 'sourceThreadId', 'title', 'posts'],
      properties: {
        forum: {
          type: 'object',
          required: ['sourceKey'],
          properties: {
            sourceKey: { type: 'string' },
            displayName: { type: 'string' },
            url: { type: 'string' }
          }
        },
        sourceKey: { type: 'string' },
        sourceThreadId: { type: 'string' },
        title: { type: 'string' },
        url: { type: 'string' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
        posts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['sourceKey', 'sourcePostId', 'floor', 'author', 'contentText'],
            properties: {
              sourceKey: { type: 'string' },
              sourcePostId: { type: 'string' },
              floor: { type: 'number' },
              subject: { type: 'string' },
              author: {
                type: 'object',
                required: ['sourceKey', 'sourceAuthorId', 'displayName'],
                properties: {
                  sourceKey: { type: 'string' },
                  sourceAuthorId: { type: 'string' },
                  displayName: { type: 'string' },
                  metadata: { type: 'object' }
                }
              },
              publishedAt: { type: 'string' },
              contentText: { type: 'string' },
              contentHtml: { type: 'string' },
              links: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    text: { type: 'string' }
                  }
                }
              },
              relations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    targetThreadId: { type: 'string' },
                    targetPostId: { type: 'string' },
                    targetFloor: { type: 'number' },
                    evidenceText: { type: 'string' }
                  }
                }
              },
              score: { type: 'number' },
              metadata: { type: 'object' }
            }
          }
        },
        metadata: { type: 'object' }
      }
    },
    example: {
      forum: {
        sourceKey: 'external',
        displayName: 'External System'
      },
      sourceKey: 'external',
      sourceThreadId: 'thread-1',
      title: 'External normalized thread',
      posts: [
        {
          sourceKey: 'external',
          sourcePostId: 'post-1',
          floor: 0,
          author: {
            sourceKey: 'external',
            sourceAuthorId: 'author-1',
            displayName: 'External Author'
          },
          publishedAt: '2026-06-19T10:00:00.000Z',
          contentText: 'A normalized source can feed ThreadTrace without HTML parsing.',
          links: [],
          relations: []
        }
      ],
      metadata: {
        collector: 'example'
      }
    }
  };
}

module.exports = {
  getThreadSnapshotJsonContract
};
