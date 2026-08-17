import { ExternalAccountClient, Impersonated } from 'google-auth-library';
import {
  evaluatePublicContent,
  firestoreCollectionForType,
  firstText,
  isValidContentId,
  isValidContentType,
  mediaCandidates,
  ownerIdFromContent,
} from './public-content-policy.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 6000;

export function writePublicContentDiagnostic(stage, contentType, result) {
  console.info(JSON.stringify({ stage, contentType, result }));
}

function diagnose(diagnosticLog, stage, contentType, result) {
  diagnosticLog(stage, contentType, result);
}

function requiredEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error('backend_configuration_unavailable');
  return value;
}

export function readVercelOidcToken(request) {
  const header = request?.headers?.['x-vercel-oidc-token'] ??
    request?.headers?.get?.('x-vercel-oidc-token');
  const token = String(header ?? process.env.VERCEL_OIDC_TOKEN ?? '').trim();
  if (!token) throw new Error('oidc_unavailable');
  return token;
}

export function createGcpAuthClient(oidcToken) {
  const projectNumber = requiredEnv('GCP_PROJECT_NUMBER');
  const serviceAccount = requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL');
  const pool = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const provider = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');

  const client = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    scope: ['https://www.googleapis.com/auth/cloud-platform'],
    subject_token_supplier: {
      getSubjectToken: async () => oidcToken,
    },
  });

  if (!client) throw new Error('oidc_client_unavailable');
  return client;
}

export function createGcpAuthSession(oidcToken) {
  const projectNumber = requiredEnv('GCP_PROJECT_NUMBER');
  const serviceAccount = requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL');
  const pool = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const provider = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const scope = 'https://www.googleapis.com/auth/cloud-platform';

  const stsClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    scope: [scope],
    subject_token_supplier: {
      getSubjectToken: async () => oidcToken,
    },
  });
  if (!stsClient) throw new Error('oidc_client_unavailable');

  const impersonatedClient = new Impersonated({
    sourceClient: stsClient,
    targetPrincipal: serviceAccount,
    targetScopes: [scope],
    lifetime: 3600,
  });

  return {
    client: impersonatedClient,
    exchangeSts: async () => { await stsClient.getAccessToken(); },
    impersonate: async () => { await impersonatedClient.getAccessToken(); },
  };
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values ?? []).map(decodeFirestoreValue);
  }
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue?.fields ?? {});
  return null;
}

function decodeFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([key, value]) => [key, decodeFirestoreValue(value)]),
  );
}

async function authenticatedRequest(client, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await client.request({ ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readDocument(client, collection, id) {
  const projectId = requiredEnv('GCP_PROJECT_ID');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
  try {
    const response = await authenticatedRequest(client, { url, method: 'GET' });
    return decodeFirestoreFields(response.data?.fields ?? {});
  } catch (error) {
    if (error?.response?.status === 404 || error?.code === 404) return null;
    throw new Error('firestore_unavailable');
  }
}

export async function fetchPublicContent({
  type,
  id,
  request,
  diagnosticLog = writePublicContentDiagnostic,
  oidcTokenReader = readVercelOidcToken,
  authSessionFactory = createGcpAuthSession,
  documentReader = readDocument,
}) {
  if (!isValidContentType(type) || !isValidContentId(id)) return null;
  const oidcToken = oidcTokenReader(request);
  diagnose(diagnosticLog, 'oidc_token_present', type, 'present');
  const authSession = authSessionFactory(oidcToken);
  diagnose(diagnosticLog, 'auth_client_created', type, 'created');
  diagnose(diagnosticLog, 'sts_exchange_started', type, 'started');
  try {
    await authSession.exchangeSts();
    diagnose(diagnosticLog, 'sts_exchange_succeeded', type, 'succeeded');
  } catch {
    diagnose(diagnosticLog, 'sts_exchange_failed', type, 'failed');
    throw new Error('sts_unavailable');
  }
  diagnose(diagnosticLog, 'impersonation_started', type, 'started');
  try {
    await authSession.impersonate();
    diagnose(diagnosticLog, 'impersonation_succeeded', type, 'succeeded');
  } catch {
    diagnose(diagnosticLog, 'impersonation_failed', type, 'failed');
    throw new Error('impersonation_unavailable');
  }

  const client = authSession.client;
  const collection = firestoreCollectionForType(type);
  diagnose(diagnosticLog, 'firestore_request_started', type, 'started');
  let content;
  try {
    content = await documentReader(client, collection, id);
  } catch {
    diagnose(diagnosticLog, 'firestore_request_failed', type, 'failed');
    throw new Error('firestore_unavailable');
  }
  if (!content) {
    diagnose(diagnosticLog, 'firestore_document_404', type, 'not_found');
    return null;
  }
  diagnose(diagnosticLog, 'firestore_document_found', type, 'found');

  const ownerId = ownerIdFromContent(content);
  if (!isValidContentId(ownerId)) {
    diagnose(diagnosticLog, 'policy_rejected', type, 'invalid_owner');
    return null;
  }
  diagnose(diagnosticLog, 'author_firestore_request_started', type, 'started');
  let author;
  try {
    author = await documentReader(client, 'users', ownerId);
  } catch {
    diagnose(diagnosticLog, 'author_firestore_request_failed', type, 'failed');
    throw new Error('firestore_unavailable');
  }
  if (author) {
    diagnose(diagnosticLog, 'author_firestore_document_found', type, 'found');
  } else {
    diagnose(diagnosticLog, 'author_firestore_document_404', type, 'not_found');
  }
  const policy = evaluatePublicContent({ type, id, content, author });
  if (!policy.allowed) {
    diagnose(diagnosticLog, 'policy_rejected', type, 'rejected');
    return null;
  }

  const publicContent = {
    type,
    id,
    authorName: firstText(author, ['displayName', 'name', 'fullName', 'username']) || 'Usuario Nexo',
    caption: firstText(content, ['content', 'caption', 'text', 'description', 'title']),
  };
  diagnose(diagnosticLog, 'public_content_ready', type, 'ready');
  return publicContent;
}

function storageObjectFromUrl(rawUrl) {
  const bucket = requiredEnv('GCP_STORAGE_BUCKET');
  const value = String(rawUrl ?? '').trim();
  if (!value) return null;

  if (value.startsWith(`gs://${bucket}/`)) {
    return value.slice(`gs://${bucket}/`.length);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname === 'firebasestorage.googleapis.com') {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match || decodeURIComponent(match[1]) !== bucket) return null;
    try { return decodeURIComponent(match[2]); } catch { return null; }
  }
  if (url.hostname === 'storage.googleapis.com') {
    const prefix = `/${bucket}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    try { return decodeURIComponent(url.pathname.slice(prefix.length)); } catch { return null; }
  }
  if (url.hostname === `${bucket}.storage.googleapis.com`) {
    try { return decodeURIComponent(url.pathname.replace(/^\//, '')); } catch { return null; }
  }
  return null;
}

async function readStorageImage(client, objectName) {
  const bucket = requiredEnv('GCP_STORAGE_BUCKET');
  if (!objectName || objectName.includes('\0')) return null;
  const base = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(objectName)}`;

  let metadata;
  try {
    metadata = (await authenticatedRequest(client, { url: base, method: 'GET' })).data;
  } catch (error) {
    if (error?.response?.status === 404 || error?.code === 404) return null;
    throw new Error('storage_unavailable');
  }

  const contentType = String(metadata?.contentType ?? '').toLowerCase();
  const size = Number(metadata?.size ?? 0);
  if (!contentType.startsWith('image/') || !Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return null;
  }

  const response = await authenticatedRequest(client, {
    url: `${base}?alt=media`,
    method: 'GET',
    responseType: 'arraybuffer',
  });
  const bytes = Buffer.from(response.data);
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
  return { bytes, contentType };
}

export async function fetchPreviewImage({ type, id, variant, request }) {
  if (!isValidContentType(type) || !isValidContentId(id)) return null;
  if (variant !== 'content' && variant !== 'avatar') return null;
  const client = createGcpAuthClient(readVercelOidcToken(request));
  const collection = firestoreCollectionForType(type);
  const content = await readDocument(client, collection, id);
  if (!content) return null;
  const ownerId = ownerIdFromContent(content);
  if (!isValidContentId(ownerId)) return null;
  const author = await readDocument(client, 'users', ownerId);
  if (!evaluatePublicContent({ type, id, content, author }).allowed) return null;

  for (const candidate of mediaCandidates(type, content, author, variant)) {
    const objectName = storageObjectFromUrl(candidate);
    if (!objectName) continue;
    const image = await readStorageImage(client, objectName);
    if (image) return image;
  }
  return null;
}
