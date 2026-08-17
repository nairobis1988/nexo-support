import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicContentHandler } from '../api/public-content.js';
import { fetchPublicContent } from '../lib/firebase-server.js';

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

function dependencies({ stsError, impersonationError, documents = {}, documentError } = {}) {
  return {
    oidcTokenReader: () => 'SECRET_OIDC_TOKEN',
    authSessionFactory: () => ({
      client: { opaque: true },
      exchangeSts: async () => {
        if (stsError) throw new Error('SECRET_STS_STACK');
      },
      impersonate: async () => {
        if (impersonationError) throw new Error('SECRET_IMPERSONATION_STACK');
      },
    }),
    documentReader: async (_client, collection) => {
      if (documentError) throw new Error('SECRET_FIRESTORE_STACK');
      return documents[collection] ?? null;
    },
  };
}

async function requestPublicContent(type, options) {
  const deps = dependencies(options);
  const handler = createPublicContentHandler({
    loadContent: ({ id, request }) => fetchPublicContent({
      type,
      id,
      request,
      ...deps,
    }),
  });
  const response = responseRecorder();
  await handler({
    method: 'GET',
    query: { type, id: 'content_1' },
    headers: { authorization: 'Bearer SECRET_ACCESS_TOKEN' },
  }, response);
  return response;
}

function assertGeneric503(response) {
  assert.equal(response.statusCode, 503);
  assert.match(response.body, /Nexo no está disponible temporalmente/);
  assert.doesNotMatch(response.body, /SECRET_|Bearer|Error:|stack/i);
}

test('STS failure remains a generic public 503', async () => {
  assertGeneric503(await requestPublicContent('post', { stsError: true }));
});

test('impersonation failure remains a generic public 503', async () => {
  assertGeneric503(await requestPublicContent('post', { impersonationError: true }));
});

test('Firestore backend failure remains a generic public 503', async () => {
  assertGeneric503(await requestPublicContent('post', { documentError: true }));
});

test('missing Firestore content remains a branded public 404', async () => {
  const response = await requestPublicContent('post');
  assert.equal(response.statusCode, 404);
  assert.match(response.body, /Este contenido no está disponible/);
});

test('missing author remains the same branded public 404', async () => {
  const response = await requestPublicContent('post', {
    documents: { posts: { visibility: 'public', userId: 'author_1' } },
  });
  assert.equal(response.statusCode, 404);
  assert.match(response.body, /Este contenido no está disponible/);
});

test('policy rejection remains the same branded public 404', async () => {
  const response = await requestPublicContent('post', {
    documents: {
      posts: { visibility: 'private', userId: 'author_1', caption: 'SECRET_CAPTION' },
      users: { displayName: 'SECRET_USER' },
    },
  });
  assert.equal(response.statusCode, 404);
  assert.match(response.body, /Este contenido no está disponible/);
  assert.doesNotMatch(response.body, /SECRET_CAPTION|SECRET_USER/);
});

test('successful explicit auth flow remains a public 200', async () => {
  const response = await requestPublicContent('video', {
    documents: {
      video: { visibility: 'public', userId: 'author_1', caption: 'Public caption' },
      users: { displayName: 'Public author' },
    },
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Public caption|Public author/);
  assert.doesNotMatch(response.body, /SECRET_|Bearer|authorization/i);
});
