import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchPreviewImage } from '../lib/firebase-server.js';
import { isValidContentId, isValidContentType } from '../lib/public-content-policy.js';

const FALLBACK_PATH = fileURLToPath(new URL('../assets/nexo-preview.svg', import.meta.url));

async function fallbackImage() {
  return { bytes: await readFile(FALLBACK_PATH), contentType: 'image/svg+xml' };
}

function sendImage(response, image) {
  response.statusCode = 200;
  response.setHeader('Content-Type', image.contentType);
  response.setHeader('Content-Length', String(image.bytes.length));
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(image.bytes);
}

export function createMediaPreviewHandler({ loadImage = fetchPreviewImage, loadFallback = fallbackImage } = {}) {
  return async function mediaPreviewHandler(request, response) {
    const type = String(request.query?.type ?? '');
    const id = String(request.query?.id ?? '');
    const variant = String(request.query?.variant ?? 'content');
    if (!isValidContentType(type) || !isValidContentId(id) || !['content', 'avatar'].includes(variant)) {
      return sendImage(response, await loadFallback());
    }
    try {
      const image = await loadImage({ type, id, variant, request });
      return sendImage(response, image ?? await loadFallback());
    } catch {
      return sendImage(response, await loadFallback());
    }
  };
}

export default createMediaPreviewHandler();
