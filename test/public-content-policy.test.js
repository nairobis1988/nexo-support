import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePublicContent,
  isValidContentId,
} from '../lib/public-content-policy.js';

const validContent = { visibility: 'public', userId: 'author_1' };
const validAuthor = { displayName: 'Nexo Creator' };

test('accepts a valid public post or video policy input', () => {
  assert.equal(evaluatePublicContent({ type: 'post', id: 'post_1', content: validContent, author: validAuthor }).allowed, true);
  assert.equal(evaluatePublicContent({ type: 'video', id: 'video_1', content: validContent, author: validAuthor }).allowed, true);
});

test('rejects invalid IDs and traversal', () => {
  for (const id of ['', '../secret', 'a/b', 'a%2Fb', 'x?token=1', 'a.b', 'a'.repeat(129), 'x\u0000y']) {
    assert.equal(isValidContentId(id), false, id);
  }
  assert.equal(isValidContentId('Abc_123-Z'), true);
});

test('rejects missing, private, deleted, moderated and ephemeral content', () => {
  const cases = [
    null,
    { ...validContent, visibility: 'private' },
    { ...validContent, deleted: true },
    { ...validContent, isDeleted: true },
    { ...validContent, moderationStatus: 'rejected' },
    { ...validContent, status: 'blocked' },
    { ...validContent, isEphemeral: true },
    { ...validContent, showInMainFeed: false },
  ];
  for (const content of cases) {
    assert.equal(evaluatePublicContent({ type: 'post', id: 'post_1', content, author: validAuthor }).allowed, false);
  }
});

test('rejects invalid, deleted or banned authors', () => {
  for (const author of [null, { deleted: true }, { deleting: true }, { banned: true }, { status: 'suspended' }]) {
    assert.equal(evaluatePublicContent({ type: 'post', id: 'post_1', content: validContent, author }).allowed, false);
  }
});
