'use strict';

const { assertForumCrawler } = require('../../application/ports/forumCrawler');

// 贴近真实浏览器的默认 UA——裸 UA（ThreadTrace/0.1）容易被论坛反爬拦。
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function createHttpForumCrawler(options) {
  const safeOptions = options || {};
  const env = safeOptions.env || process.env;
  const fetchImpl = safeOptions.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('HttpForumCrawler requires fetch. Use Node.js 20+ or pass fetch.');
  }

  // 会话密钥走 env（THREADTRACE_NGA_COOKIE / 通用 THREADTRACE_CRAWLER_COOKIE），绝不落源码。
  const cookie = firstValue(safeOptions.cookie, env.THREADTRACE_NGA_COOKIE, env.THREADTRACE_CRAWLER_COOKIE);
  const userAgent = firstValue(safeOptions.userAgent, env.THREADTRACE_CRAWLER_USER_AGENT, DEFAULT_USER_AGENT);
  const referer = firstValue(safeOptions.referer, env.THREADTRACE_CRAWLER_REFERER);

  const baseHeaders = Object.assign({
    'user-agent': userAgent,
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'zh-CN,zh;q=0.9'
  }, referer ? { referer: referer } : {}, cookie ? { cookie: cookie } : {}, safeOptions.headers || {});

  const crawler = {
    async fetchThreadPage(request) {
      const safeRequest = request || {};
      if (!safeRequest.url) {
        throw new Error('fetchThreadPage requires url.');
      }
      const response = await fetchImpl(safeRequest.url, {
        method: 'GET',
        headers: Object.assign({}, baseHeaders, safeRequest.headers || {})
      });

      if (!response.ok) {
        throw new Error('Thread page fetch failed with HTTP ' + response.status + ' for ' + safeRequest.url);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = headerValue(response, 'content-type');
      const charset = detectCharset(contentType, buffer);
      const html = decodeHtml(buffer, charset);

      return {
        html,
        finalUrl: response.url || safeRequest.url,
        contentEncoding: headerValue(response, 'content-encoding') || undefined,
        metadata: {
          status: response.status,
          contentType: contentType || undefined,
          charset: charset
        }
      };
    }
  };

  return assertForumCrawler(crawler);
}

// 论坛（尤其 NGA）常用 GBK；先看 content-type 头，再嗅 HTML meta，默认 utf-8。
function detectCharset(contentType, buffer) {
  const fromHeader = /charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(contentType || '');
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = buffer.slice(0, Math.min(buffer.length, 4096)).toString('ascii');
  const fromMeta = /charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(head);
  return fromMeta ? fromMeta[1].toLowerCase() : 'utf-8';
}

function decodeHtml(buffer, charset) {
  if (charset === 'gbk' || charset === 'gb2312' || charset === 'gb18030') {
    return new TextDecoder('gb18030').decode(buffer);
  }
  return new TextDecoder('utf-8').decode(buffer);
}

function headerValue(response, name) {
  return response.headers && response.headers.get ? response.headers.get(name) : undefined;
}

function firstValue() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

module.exports = {
  createHttpForumCrawler
};
