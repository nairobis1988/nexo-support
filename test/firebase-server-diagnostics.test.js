import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicContent } from '../lib/firebase-server.js';

const secret = 'SECRET_OIDC_TOKEN';

function diagnosticHarness(documents) {
  const logs = [];
  return {
    logs,
    dependencies: {
      request: { headers: { authorization: 'Bearer SECRET_ACCESS_TOKEN' } },
      diagnosticLog: (...parts) => logs.push(parts),
      oidcTokenReader: () => secret,
      authClientFactory: (token) => {
        assert.equal(token, secret);
        return { opaque: true };
      },
      documentReader: async (_client, collection) => documents[collection] ?? null,
    },
  };
}

test('diagnostics distinguish content 404 without logging secrets', async () => {
  const harness = diagnosticHarness({});
  const result = await fetchPublicContent({ type: 'post', id: 'post_1', ...harness.dependencies });
  assert.equal(result, null);
  assert.deepEqual(harness.logs.at(-1), ['firestore_content_404', 'post', 'not_found']);
  assert.doesNotMatch(JSON.stringify(harness.logs), /SECRET_|Bearer|authorization/i);
});

test('diagnostics distinguish author 404', async () => {
  const harness = diagnosticHarness({ posts: { visibility: 'public', userId: 'author_1' } });
  const result = await fetchPublicContent({ type: 'post', id: 'post_1', ...harness.dependencies });
  assert.equal(result, null);
  assert.ok(harness.logs.some(([stage]) => stage === 'author_404'));
  assert.deepEqual(harness.logs.at(-1), ['policy_rejected', 'post', 'rejected']);
});

test('diagnostics distinguish policy rejection', async () => {
  const harness = diagnosticHarness({
    posts: { visibility: 'private', userId: 'author_1', caption: 'SECRET_CAPTION' },
    users: { displayName: 'SECRET_USER' },
  });
  const result = await fetchPublicContent({ type: 'post', id: 'post_1', ...harness.dependencies });
  assert.equal(result, null);
  assert.deepEqual(harness.logs.at(-1), ['policy_rejected', 'post', 'rejected']);
  assert.doesNotMatch(JSON.stringify(harness.logs), /SECRET_CAPTION|SECRET_USER/);
});

test('diagnostics identify ready public content without document data', async () => {
  const harness = diagnosticHarness({
    video: { visibility: 'public', userId: 'author_1', caption: 'SECRET_CAPTION' },
    users: { displayName: 'SECRET_USER' },
  });
  const result = await fetchPublicContent({ type: 'video', id: 'video_1', ...harness.dependencies });
  assert.equal(result.caption, 'SECRET_CAPTION');
  assert.deepEqual(harness.logs.at(-1), ['public_content_ready', 'video', 'ready']);
  assert.doesNotMatch(JSON.stringify(harness.logs), /SECRET_CAPTION|SECRET_USER/);
});
