import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaPreviewHandler } from '../api/media-preview.js';

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: Buffer.alloc(0),
    setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(body = Buffer.alloc(0)) { this.body = Buffer.from(body); },
  };
}

test('serves a validated image response without exposing its storage origin', async () => {
  const handler = createMediaPreviewHandler({
    loadImage: async () => ({ bytes: Buffer.from('safe-image'), contentType: 'image/jpeg' }),
    loadFallback: async () => ({ bytes: Buffer.from('fallback'), contentType: 'image/svg+xml' }),
  });
  const response = responseRecorder();
  await handler({ query: { type: 'post', id: 'post_1' }, headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader('content-type'), 'image/jpeg');
  assert.equal(response.getHeader('cache-control'), 'private, no-store');
  assert.equal(response.body.toString(), 'safe-image');
});

test('invalid IDs and unavailable media return the branded fallback', async () => {
  let calls = 0;
  const handler = createMediaPreviewHandler({
    loadImage: async () => { calls += 1; return null; },
    loadFallback: async () => ({ bytes: Buffer.from('fallback'), contentType: 'image/svg+xml' }),
  });
  const invalid = responseRecorder();
  await handler({ query: { type: 'video', id: '../bad' }, headers: {} }, invalid);
  assert.equal(calls, 0);
  assert.equal(invalid.body.toString(), 'fallback');

  const unavailable = responseRecorder();
  await handler({ query: { type: 'video', id: 'video_1' }, headers: {} }, unavailable);
  assert.equal(calls, 1);
  assert.equal(unavailable.body.toString(), 'fallback');
});
