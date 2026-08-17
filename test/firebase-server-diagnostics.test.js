import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicContent } from '../lib/firebase-server.js';

const secretToken = 'SECRET_OIDC_TOKEN';
const secretId = 'SECRET_DOCUMENT_ID';
const secretCaption = 'SECRET_FIRESTORE_CONTENT';

function diagnosticHarness({ stsError, impersonationError, documents = {}, documentError } = {}) {
  const logs = [];
  return {
    logs,
    dependencies: {
      request: { headers: { authorization: 'Bearer SECRET_ACCESS_TOKEN' } },
      diagnosticLog: (...parts) => logs.push(parts),
      oidcTokenReader: () => secretToken,
      authSessionFactory: (token) => {
        assert.equal(token, secretToken);
        return {
          client: { opaque: true },
          exchangeSts: async () => {
            if (stsError) throw new Error('SECRET_STS_STACK');
          },
          impersonate: async () => {
            if (impersonationError) throw new Error('SECRET_IMPERSONATION_STACK');
          },
        };
      },
      documentReader: async (_client, collection) => {
        if (documentError) throw new Error('SECRET_FIRESTORE_STACK');
        return documents[collection] ?? null;
      },
    },
  };
}

function assertSanitized(logs) {
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /SECRET_|Bearer|authorization|stack|caption|ownerId/i);
}

test('diagnostics distinguish STS failure', async () => {
  const harness = diagnosticHarness({ stsError: true });
  await assert.rejects(
    fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies }),
    /sts_unavailable/,
  );
  assert.deepEqual(harness.logs.at(-1), ['sts_exchange_failed', 'post', 'failed']);
  assert.ok(!harness.logs.some(([stage]) => stage === 'impersonation_started'));
  assertSanitized(harness.logs);
});

test('diagnostics distinguish impersonation failure', async () => {
  const harness = diagnosticHarness({ impersonationError: true });
  await assert.rejects(
    fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies }),
    /impersonation_unavailable/,
  );
  assert.ok(harness.logs.some(([stage]) => stage === 'sts_exchange_succeeded'));
  assert.deepEqual(harness.logs.at(-1), ['impersonation_failed', 'post', 'failed']);
  assertSanitized(harness.logs);
});

test('diagnostics distinguish Firestore content 404', async () => {
  const harness = diagnosticHarness();
  const result = await fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies });
  assert.equal(result, null);
  assert.deepEqual(harness.logs.at(-1), ['firestore_document_404', 'post', 'not_found']);
  assertSanitized(harness.logs);
});

test('diagnostics distinguish Firestore backend failure', async () => {
  const harness = diagnosticHarness({ documentError: true });
  await assert.rejects(
    fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies }),
    /firestore_unavailable/,
  );
  assert.deepEqual(harness.logs.at(-1), ['firestore_request_failed', 'post', 'failed']);
  assertSanitized(harness.logs);
});

test('diagnostics distinguish Firestore content found', async () => {
  const harness = diagnosticHarness({
    documents: { posts: { visibility: 'public', userId: 'author_1' } },
  });
  const result = await fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies });
  assert.equal(result, null);
  assert.ok(harness.logs.some(([stage]) => stage === 'firestore_document_found'));
  assertSanitized(harness.logs);
});

test('diagnostics distinguish author 404', async () => {
  const harness = diagnosticHarness({
    documents: { posts: { visibility: 'public', userId: 'author_1' } },
  });
  await fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies });
  assert.ok(harness.logs.some(([stage]) => stage === 'author_firestore_document_404'));
  assert.deepEqual(harness.logs.at(-1), ['policy_rejected', 'post', 'rejected']);
  assertSanitized(harness.logs);
});

test('diagnostics distinguish policy rejection', async () => {
  const harness = diagnosticHarness({
    documents: {
      posts: { visibility: 'private', userId: 'author_1', caption: secretCaption },
      users: { displayName: 'SECRET_USER' },
    },
  });
  await fetchPublicContent({ type: 'post', id: secretId, ...harness.dependencies });
  assert.deepEqual(harness.logs.at(-1), ['policy_rejected', 'post', 'rejected']);
  assertSanitized(harness.logs);
});

test('diagnostics distinguish a complete successful flow', async () => {
  const harness = diagnosticHarness({
    documents: {
      video: { visibility: 'public', userId: 'author_1', caption: secretCaption },
      users: { displayName: 'SECRET_USER' },
    },
  });
  const result = await fetchPublicContent({ type: 'video', id: secretId, ...harness.dependencies });
  assert.equal(result.caption, secretCaption);
  assert.deepEqual(harness.logs.at(-1), ['public_content_ready', 'video', 'ready']);
  assertSanitized(harness.logs);
});
