import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialCardHandler, VALID_CACHE_CONTROL } from '../api/social-card.js';

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 0,
    body: Buffer.alloc(0),
    setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(body = Buffer.alloc(0)) { this.body = Buffer.from(body ?? ''); },
  };
}

function fakeCard() {
  return { bytes: Buffer.from('safe-jpeg'), contentType: 'image/jpeg', width: 1200, height: 630 };
}

test('valid social card has JPEG, cache, length, nosniff and ETag headers', async () => {
  const handler = createSocialCardHandler({
    loadData: async ({ type }) => ({ type, authorName: 'Ana', caption: 'Hola', preview: null, avatar: null }),
    loadLogo: async () => Buffer.from('logo'),
    renderCard: async () => fakeCard(),
  });
  const response = responseRecorder();
  await handler({ method: 'GET', query: { type: 'post', id: 'post_1' }, headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader('content-type'), 'image/jpeg');
  assert.equal(response.getHeader('cache-control'), VALID_CACHE_CONTROL);
  assert.equal(response.getHeader('content-length'), String(response.body.length));
  assert.equal(response.getHeader('x-content-type-options'), 'nosniff');
  assert.match(response.getHeader('etag'), /^"[a-f0-9]{64}"$/);
});

test('invalid, private, deleted, moderated or invalid-author content has no specific card', async () => {
  let calls = 0;
  const handler = createSocialCardHandler({ loadData: async () => { calls += 1; return null; } });
  const invalid = responseRecorder();
  await handler({ method: 'GET', query: { type: 'post', id: '../private' }, headers: {} }, invalid);
  assert.equal(invalid.statusCode, 404);
  assert.equal(calls, 0);

  for (const id of ['private_1', 'deleted_1', 'moderated_1', 'invalid_author_1']) {
    const response = responseRecorder();
    await handler({ method: 'GET', query: { type: 'post', id }, headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.toString(), 'Not available');
    assert.equal(response.getHeader('cache-control'), 'private, no-store');
  }
});

test('backend failures remain generic 503 without secrets', async () => {
  const handler = createSocialCardHandler({
    loadData: async () => { throw new Error('SECRET_TOKEN STACK firestore document'); },
  });
  const response = responseRecorder();
  await handler({ method: 'GET', query: { type: 'video', id: 'video_1' }, headers: { authorization: 'Bearer SECRET' } }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.toString(), 'Service unavailable');
  assert.doesNotMatch(response.body.toString(), /SECRET|Bearer|stack|document/i);
});

test('HEAD returns headers without image body and matching ETag can return 304', async () => {
  const handler = createSocialCardHandler({
    loadData: async ({ type }) => ({ type, authorName: 'Ana', caption: '', preview: null, avatar: null }),
    loadLogo: async () => Buffer.from('logo'),
    renderCard: async () => fakeCard(),
  });
  const head = responseRecorder();
  await handler({ method: 'HEAD', query: { type: 'post', id: 'post_1' }, headers: {} }, head);
  assert.equal(head.statusCode, 200);
  assert.equal(head.body.length, 0);
  const cached = responseRecorder();
  await handler({ method: 'GET', query: { type: 'post', id: 'post_1' }, headers: { 'if-none-match': head.getHeader('etag') } }, cached);
  assert.equal(cached.statusCode, 304);
  assert.equal(cached.body.length, 0);
});
