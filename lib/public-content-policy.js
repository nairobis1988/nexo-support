const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

const REJECTED_STATUSES = new Set([
  'banned',
  'blocked',
  'deleted',
  'deleting',
  'hidden',
  'rejected',
  'removed',
  'suspended',
  'unavailable',
]);

const CONTENT_BLOCK_FLAGS = [
  'deleted',
  'isDeleted',
  'deleting',
  'removed',
  'hidden',
  'banned',
  'unavailable',
  'adminDeleteRequested',
];

const AUTHOR_BLOCK_FLAGS = [
  'deleted',
  'isDeleted',
  'deleting',
  'removed',
  'hidden',
  'banned',
  'suspended',
  'unavailable',
];

export function isValidContentType(type) {
  return type === 'post' || type === 'video';
}

export function isValidContentId(id) {
  return typeof id === 'string' && VALID_ID.test(id) && !id.includes('..');
}

export function firestoreCollectionForType(type) {
  if (type === 'post') return 'posts';
  if (type === 'video') return 'video';
  return null;
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function truthy(value) {
  if (value === true || value === 1) return true;
  return ['true', '1', 'yes', 'si', 'sí'].includes(normalized(value));
}

function hasBlockedFlag(data, fields) {
  return fields.some((field) => truthy(data?.[field]));
}

function hasRejectedStatus(data) {
  return [data?.status, data?.moderationStatus]
    .map(normalized)
    .some((status) => status && REJECTED_STATUSES.has(status));
}

function isEphemeral(data) {
  if (
    ['isEphemeral', 'ephemeral', 'isTemporary', 'temporary', 'isStoryEphemeral']
      .some((field) => truthy(data?.[field]))
  ) {
    return true;
  }

  if (data?.showInMainFeed === false || data?.showInEphemeralFeed === true) {
    return true;
  }

  const mode = [
    data?.contentMode,
    data?.publishMode,
    data?.feedTarget,
    data?.destination,
    data?.targetFeed,
    data?.scope,
    data?.mode,
  ].map(normalized).join(' ');

  return ['ephemeral', 'efimero', 'efímero', 'temporary', '24h']
    .some((marker) => mode.includes(marker));
}

export function ownerIdFromContent(data) {
  for (const field of ['userId', 'uid', 'ownerId', 'authorId', 'createdBy', 'publisherId']) {
    const raw = data?.[field];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    if (value.includes('/')) return value.split('/').filter(Boolean).at(-1) ?? '';
    return value;
  }
  return '';
}

export function evaluatePublicContent({ type, id, content, author }) {
  if (!isValidContentType(type) || !isValidContentId(id)) return { allowed: false };
  if (!content || !author) return { allowed: false };
  if (normalized(content.visibility) !== 'public') return { allowed: false };
  if (hasBlockedFlag(content, CONTENT_BLOCK_FLAGS)) return { allowed: false };
  if (hasRejectedStatus(content) || isEphemeral(content)) return { allowed: false };
  if (hasBlockedFlag(author, AUTHOR_BLOCK_FLAGS) || hasRejectedStatus(author)) {
    return { allowed: false };
  }

  const ownerId = ownerIdFromContent(content);
  if (!isValidContentId(ownerId)) return { allowed: false };
  return { allowed: true, ownerId };
}

export function firstText(data, fields) {
  for (const field of fields) {
    const value = String(data?.[field] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function mediaCandidates(type, content, author, variant = 'content') {
  if (variant === 'avatar') {
    return [
      author?.avatarUrl,
      author?.avatar,
      author?.photoUrl,
      author?.profileImage,
      author?.profileImageUrl,
    ].filter(Boolean);
  }

  if (type === 'video') {
    return [
      content?.thumbnailUrl,
      content?.thumbnail,
      content?.thumbUrl,
      content?.posterUrl,
      content?.poster,
      content?.coverUrl,
      content?.previewImageUrl,
      content?.firstFrameUrl,
    ].filter(Boolean);
  }

  const firstMedia = Array.isArray(content?.media) ? content.media[0] : null;
  const firstImage = Array.isArray(content?.images) ? content.images[0] : null;
  return [
    typeof firstMedia === 'object' ? firstMedia?.url ?? firstMedia?.mediaUrl : firstMedia,
    firstImage,
    content?.thumbnailUrl,
    content?.coverUrl,
    content?.posterUrl,
    content?.imageUrl,
    content?.photoUrl,
    content?.firstMediaUrl,
    content?.mediaUrl,
  ].filter(Boolean);
}
