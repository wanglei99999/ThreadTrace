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

function validateThreadSnapshotPayload(payload, options) {
  const safeOptions = options || {};
  const checks = [];
  const sourceKey = payload && (payload.sourceKey || (payload.forum && payload.forum.sourceKey) || safeOptions.sourceKey);

  checks.push(check('threadJson.sourceKey', sourceKey ? 'ok' : 'fail', sourceKey || 'missing', 'Snapshot has a source key.'));
  checks.push(check('threadJson.sourceThreadId', hasText(payload && payload.sourceThreadId) ? 'ok' : 'fail', payload && payload.sourceThreadId || 'missing', 'Snapshot has a source thread id.'));
  checks.push(check('threadJson.title', hasText(payload && payload.title) ? 'ok' : 'fail', payload && payload.title || 'missing', 'Snapshot has a title.'));
  checks.push(check('threadJson.posts', Array.isArray(payload && payload.posts) ? 'ok' : 'fail', Array.isArray(payload && payload.posts) ? payload.posts.length : 'missing', 'Snapshot has a posts array.'));

  if (Array.isArray(payload && payload.posts)) {
    payload.posts.forEach(function (post, index) {
      appendPostChecks(checks, post, index);
    });
  }

  return {
    valid: checks.every(function (item) { return item.status !== 'fail'; }),
    status: aggregateStatus(checks),
    checks
  };
}

function appendPostChecks(checks, post, index) {
  const prefix = 'threadJson.posts[' + index + ']';
  checks.push(check(prefix + '.sourceKey', hasText(post && post.sourceKey) ? 'ok' : 'fail', post && post.sourceKey || 'missing', 'Post has a source key.'));
  checks.push(check(prefix + '.sourcePostId', hasText(post && post.sourcePostId) ? 'ok' : 'fail', post && post.sourcePostId || 'missing', 'Post has a source post id.'));
  checks.push(check(prefix + '.floor', Number.isFinite(post && post.floor) ? 'ok' : 'fail', post && post.floor, 'Post has a numeric floor.'));
  checks.push(check(prefix + '.author', post && typeof post.author === 'object' && !Array.isArray(post.author) ? 'ok' : 'fail', post && post.author ? 'present' : 'missing', 'Post has an author object.'));
  if (post && typeof post.author === 'object' && !Array.isArray(post.author)) {
    checks.push(check(prefix + '.author.sourceKey', hasText(post.author.sourceKey) ? 'ok' : 'fail', post.author.sourceKey || 'missing', 'Post author has a source key.'));
    checks.push(check(prefix + '.author.sourceAuthorId', hasText(post.author.sourceAuthorId) ? 'ok' : 'fail', post.author.sourceAuthorId || 'missing', 'Post author has a source author id.'));
    checks.push(check(prefix + '.author.displayName', hasText(post.author.displayName) ? 'ok' : 'fail', post.author.displayName || 'missing', 'Post author has a display name.'));
  }
  checks.push(check(prefix + '.contentText', typeof (post && post.contentText) === 'string' ? 'ok' : 'fail', typeof (post && post.contentText) === 'string' ? post.contentText.length : 'missing', 'Post has text content.'));
  if (post && post.links !== undefined) {
    checks.push(check(prefix + '.links', Array.isArray(post.links) ? 'ok' : 'fail', Array.isArray(post.links) ? post.links.length : 'invalid', 'Post links are an array when present.'));
  }
  if (post && post.relations !== undefined) {
    checks.push(check(prefix + '.relations', Array.isArray(post.relations) ? 'ok' : 'fail', Array.isArray(post.relations) ? post.relations.length : 'invalid', 'Post relations are an array when present.'));
  }
}

function check(key, status, value, summary) {
  return {
    key,
    status,
    value,
    summary
  };
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function aggregateStatus(checks) {
  if (checks.some(function (item) { return item.status === 'fail'; })) return 'fail';
  if (checks.some(function (item) { return item.status === 'warn'; })) return 'warn';
  return 'ok';
}

module.exports = {
  getThreadSnapshotJsonContract,
  validateThreadSnapshotPayload
};
