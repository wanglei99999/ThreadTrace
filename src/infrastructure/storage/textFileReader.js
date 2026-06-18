'use strict';

const fs = require('fs');

function readHtmlText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const asciiHead = buffer.slice(0, Math.min(buffer.length, 4096)).toString('ascii');
  const charsetMatch = /charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(asciiHead);
  const charset = charsetMatch ? charsetMatch[1].toLowerCase() : 'utf-8';

  if (charset === 'gbk' || charset === 'gb2312' || charset === 'gb18030') {
    return new TextDecoder('gb18030').decode(buffer);
  }

  return new TextDecoder('utf-8').decode(buffer);
}

module.exports = {
  readHtmlText
};
