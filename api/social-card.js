import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchSocialCardData } from '../lib/firebase-server.js';
import { isValidContentId, isValidContentType } from '../lib/public-content-policy.js';
import { renderSocialCard } from '../lib/render-social-card.js';

const LOGO_PATH = fileURLToPath(new URL('../assets/nexo-logo-official.png', import.meta.url));
const VALID_CACHE_CONTROL = 'public, max-age=300, s-maxage=900, must-revalidate';

function sendError(response, status) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(status === 503 ? 'Service unavailable' : 'Not available');
}

function sendCard(request, response, card) {
  const etag = `"${createHash('sha256').update(card.bytes).digest('hex')}"`;
  response.setHeader('Content-Type', 'image/jpeg');
  response.setHeader('Content-Length', String(card.bytes.length));
  response.setHeader('Cache-Control', VALID_CACHE_CONTROL);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('ETag', etag);

  if (request.headers?.['if-none-match'] === etag) {
    response.statusCode = 304;
    return response.end();
  }
  response.statusCode = 200;
  return response.end(request.method === 'HEAD' ? undefined : card.bytes);
}

export function createSocialCardHandler({
  loadData = fetchSocialCardData,
  loadLogo = () => readFile(LOGO_PATH),
  renderCard = renderSocialCard,
} = {}) {
  return async function socialCardHandler(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      return sendError(response, 404);
    }
    const type = String(request.query?.type ?? '');
    const id = String(request.query?.id ?? '');
    if (!isValidContentType(type) || !isValidContentId(id)) return sendError(response, 404);

    try {
      const data = await loadData({ type, id, request });
      if (!data) return sendError(response, 404);
      const [logoBytes] = await Promise.all([loadLogo()]);
      const card = await renderCard({ ...data, logoBytes });
      return sendCard(request, response, card);
    } catch {
      return sendError(response, 503);
    }
  };
}

export { VALID_CACHE_CONTROL };
export default createSocialCardHandler();
