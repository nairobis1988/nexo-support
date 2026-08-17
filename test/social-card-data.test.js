import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSocialCardData } from '../lib/firebase-server.js';

function dependencies({ stsError, impersonationError, documentError, documents = {}, assetError } = {}) {
  const reads = [];
  let assetCalls = 0;
  return {
    reads,
    get assetCalls() { return assetCalls; },
    values: {
      oidcTokenReader: () => 'SECRET_OIDC_TOKEN',
      authSessionFactory: () => ({
        client: { opaque: true },
        exchangeSts: async () => { if (stsError) throw new Error('SECRET_STS'); },
        impersonate: async () => { if (impersonationError) throw new Error('SECRET_IMPERSONATION'); },
      }),
      documentReader: async (_client, collection, id) => {
        reads.push(`${collection}/${id}`);
        if (documentError) throw new Error('SECRET_FIRESTORE');
        return documents[collection] ?? null;
      },
      assetReader: async (_client, candidates) => {
        assetCalls += 1;
        if (assetError) throw new Error('SECRET_STORAGE');
        return candidates.length ? { bytes: Buffer.from('image'), contentType: 'image/jpeg' } : null;
      },
    },
  };
}

async function load(options = {}) {
  const deps = dependencies(options);
  const promise = fetchSocialCardData({ type: 'post', id: 'content_1', request: {}, ...deps.values });
  return { deps, promise };
}

test('uses one auth session and only exact content/author reads', async () => {
  const { deps, promise } = await load({
    documents: {
      posts: { visibility: 'public', userId: 'author_1', imageUrl: 'https://safe.invalid/image.jpg', caption: 'Public caption' },
      users: { displayName: 'Public author', avatarUrl: 'https://safe.invalid/avatar.jpg' },
    },
  });
  const data = await promise;
  assert.deepEqual(deps.reads, ['posts/content_1', 'users/author_1']);
  assert.equal(deps.assetCalls, 2);
  assert.equal(data.authorName, 'Public author');
  assert.equal(data.caption, 'Public caption');
});

test('policy rejection returns null before any Storage read', async () => {
  const { deps, promise } = await load({
    documents: {
      posts: { visibility: 'private', userId: 'author_1', imageUrl: 'SECRET_STORAGE_URL' },
      users: { displayName: 'SECRET_AUTHOR' },
    },
  });
  assert.equal(await promise, null);
  assert.equal(deps.assetCalls, 0);
});

test('separates STS, impersonation, Firestore and Storage backend failures', async () => {
  const cases = [
    [{ stsError: true }, /sts_unavailable/],
    [{ impersonationError: true }, /impersonation_unavailable/],
    [{ documentError: true }, /firestore_unavailable/],
    [{
      assetError: true,
      documents: {
        posts: { visibility: 'public', userId: 'author_1' },
        users: { displayName: 'Author' },
      },
    }, /storage_unavailable/],
  ];
  for (const [options, expected] of cases) {
    const { promise } = await load(options);
    await assert.rejects(promise, expected);
  }
});
