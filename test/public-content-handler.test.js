import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicContentHandler } from '../api/public-content.js';

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(body = '') { this.body = String(body); },
  };
}

test('valid post and video return complete server-rendered HTML', async () => {
  for (const type of ['post', 'video']) {
    const handler = createPublicContentHandler({
      loadContent: async ({ id }) => ({ type, id, authorName: 'Autor', caption: 'Caption' }),
    });
    const response = responseRecorder();
    await handler({ method: 'GET', query: { type, id: `${type}_1` }, headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.getHeader('content-type'), 'text/html; charset=utf-8');
    assert.match(response.body, new RegExp(`nexoapp\\.art/${type}/${type}_1`));
  }
});

test('invalid or nonexistent content returns indistinguishable 404', async () => {
  let calls = 0;
  const handler = createPublicContentHandler({ loadContent: async () => { calls += 1; return null; } });
  const invalid = responseRecorder();
  await handler({ method: 'GET', query: { type: 'post', id: '../bad' }, headers: {} }, invalid);
  assert.equal(invalid.statusCode, 404);
  assert.equal(calls, 0);
  assert.equal(invalid.getHeader('x-robots-tag'), 'noindex, noarchive');

  const missing = responseRecorder();
  await handler({ method: 'GET', query: { type: 'post', id: 'missing_1' }, headers: {} }, missing);
  assert.equal(missing.statusCode, 404);
  assert.equal(calls, 1);
  assert.equal(missing.body, invalid.body);
});

test('backend errors return generic 503 without stack traces', async () => {
  const logs = [];
  const handler = createPublicContentHandler({
    loadContent: async () => { throw new Error('SECRET_STACK'); },
    diagnosticLog: (...parts) => logs.push(parts),
  });
  const response = responseRecorder();
  await handler({
    method: 'GET',
    query: { type: 'video', id: 'video_1' },
    headers: { authorization: 'Bearer SECRET_TOKEN' },
  }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.getHeader('x-robots-tag'), 'noindex, noarchive');
  assert.doesNotMatch(response.body, /SECRET_STACK|Error:/);
  assert.deepEqual(logs, [
    ['public_content_request_valid', 'video', 'valid'],
    ['public_content_backend_failure', 'video', 'error'],
  ]);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET_STACK|SECRET_TOKEN|Bearer/);
});
