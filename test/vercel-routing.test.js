import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

test('contains only the approved public-content rewrites', () => {
  assert.deepEqual(config.rewrites, [
    { source: '/post/:id', destination: '/api/public-content?type=post&id=:id' },
    { source: '/video/:id', destination: '/api/public-content?type=video&id=:id' },
    { source: '/media/preview/post/:id', destination: '/api/media-preview?type=post&id=:id' },
    { source: '/media/preview/video/:id', destination: '/api/media-preview?type=video&id=:id' },
  ]);
  assert.equal(config.redirects, undefined);
});

test('.well-known AASA header remains exact and no protected route is rewritten', () => {
  assert.deepEqual(config.headers, [{
    source: '/.well-known/apple-app-site-association',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
  }]);
  for (const route of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json', '/', '/index.html', '/app-ads.txt']) {
    assert.equal(config.rewrites.some((rewrite) => rewrite.source === route), false);
  }
});
