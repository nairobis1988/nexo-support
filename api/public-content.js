import { fetchPublicContent } from '../lib/firebase-server.js';
import { isValidContentId, isValidContentType } from '../lib/public-content-policy.js';
import { renderPublicContent, renderUnavailable } from '../lib/render-public-content.js';

function sendHtml(response, status, html) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  if (status !== 200) response.setHeader('X-Robots-Tag', 'noindex, noarchive');
  response.end(html);
}

export function createPublicContentHandler({
  loadContent = fetchPublicContent,
} = {}) {
  return async function publicContentHandler(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      return sendHtml(response, 404, renderUnavailable());
    }

    const type = String(request.query?.type ?? '');
    const id = String(request.query?.id ?? '');
    if (!isValidContentType(type) || !isValidContentId(id)) {
      return sendHtml(response, 404, renderUnavailable());
    }

    try {
      const content = await loadContent({ type, id, request });
      if (!content) return sendHtml(response, 404, renderUnavailable());
      return sendHtml(response, 200, renderPublicContent(content));
    } catch {
      return sendHtml(response, 503, renderUnavailable({ status: 503 }));
    }
  };
}

export default createPublicContentHandler();
