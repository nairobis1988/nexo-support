const SITE_NAME = 'Nexo Social';
const APP_STORE_URL = 'https://apps.apple.com/us/app/nexo-social/id6760243083';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nexosocial.app';

export function sanitizeText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shell({ title, description, canonicalUrl, imageUrl, imageType = 'image/jpeg', type, body, noIndex }) {
  const safeTitle = escapeHtml(sanitizeText(title, 100));
  const safeDescription = escapeHtml(sanitizeText(description, 220));
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeImage = escapeHtml(imageUrl);
  const imageAlt = escapeHtml(type === 'video' ? 'Video compartido en Nexo' : 'Publicación compartida en Nexo');
  const robots = noIndex ? '<meta name="robots" content="noindex, noarchive">' : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  ${robots}
  <link rel="icon" type="image/png" sizes="1024x1024" href="/assets/nexo-logo-official.png">
  <link rel="apple-touch-icon" sizes="1024x1024" href="/assets/nexo-logo-official.png">
  <link rel="canonical" href="${safeCanonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:type" content="${escapeHtml(imageType)}">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1920">
  <meta property="og:image:alt" content="${imageAlt}">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:type" content="${type === 'video' ? 'video.other' : 'article'}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="fb:app_id" content="1359041262925385">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#07050d;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px}.page{max-width:560px;margin:0 auto}.brand{font-weight:900;letter-spacing:.12em;font-size:28px;padding:18px 4px}.card{overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:linear-gradient(180deg,#171020,#0d0a13);box-shadow:0 20px 70px rgba(94,43,160,.25)}.author{display:flex;align-items:center;gap:12px;padding:18px}.avatar{width:46px;height:46px;border-radius:50%;object-fit:cover;background:#2a2037}.name{font-weight:800}.preview{position:relative;aspect-ratio:4/5;background:#130d1b;display:flex;align-items:center;justify-content:center}.preview img{width:100%;height:100%;object-fit:cover}.play{position:absolute;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.62);font-size:28px}.caption{font-size:17px;line-height:1.45;padding:20px;white-space:pre-wrap}.actions{display:grid;gap:12px;padding:0 20px 22px}.button{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:16px;text-decoration:none;font-weight:850}.primary{background:#fff;color:#100b16}.secondary{border:1px solid rgba(255,255,255,.18);color:#fff}.stores{display:grid;grid-template-columns:1fr 1fr;gap:10px}.footer{text-align:center;color:#978da4;padding:22px;font-size:13px}.missing{padding:54px 24px;text-align:center}.missing h1{font-size:25px}.missing p{color:#b8afc2;line-height:1.5}@media(max-width:390px){.stores{grid-template-columns:1fr}.preview{aspect-ratio:1/1}}
  </style>
</head>
<body><main class="page"><div class="brand">NEXO</div>${body}<div class="footer">Nexo Social</div></main></body>
</html>`;
}

export function renderPublicContent(content) {
  const canonicalUrl = `https://nexoapp.art/${content.type}/${encodeURIComponent(content.id)}`;
  const mediaUrl = `https://nexoapp.art/media/preview/${content.type}/${encodeURIComponent(content.id)}`;
  const socialCardUrl = `https://nexoapp.art/media/social-card/${content.type}/${encodeURIComponent(content.id)}`;
  const avatarUrl = `${mediaUrl}?variant=avatar`;
  const author = escapeHtml(sanitizeText(content.authorName || 'Usuario Nexo', 80));
  const captionText = sanitizeText(content.caption, 1200);
  const caption = escapeHtml(captionText || (content.type === 'video' ? 'Video compartido en Nexo' : 'Publicación compartida en Nexo'));
  const title = `${content.type === 'video' ? 'Video' : 'Publicación'} de ${content.authorName || 'Usuario Nexo'} en Nexo`;
  const description = captionText || `Descubre este contenido de ${content.authorName || 'un creador'} en Nexo.`;
  const play = content.type === 'video' ? '<div class="play" aria-label="Video">▶</div>' : '';

  return shell({
    title,
    description,
    canonicalUrl,
    imageUrl: socialCardUrl,
    type: content.type,
    noIndex: false,
    body: `<article class="card">
      <header class="author"><img class="avatar" src="${escapeHtml(avatarUrl)}" alt=""><div><div class="name">${author}</div><div>Contenido en Nexo</div></div></header>
      <div class="preview"><img src="${escapeHtml(mediaUrl)}" alt="Preview del contenido">${play}</div>
      <div class="caption">${caption}</div>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(canonicalUrl)}">Abrir en Nexo</a>
        <div class="stores">
          <a class="button secondary" href="${APP_STORE_URL}">App Store</a>
          <a class="button secondary" href="${PLAY_STORE_URL}">Google Play</a>
        </div>
      </div>
    </article>`,
  });
}

export function renderUnavailable({ status = 404 } = {}) {
  const description = status === 503
    ? 'Nexo no está disponible temporalmente.'
    : 'Este contenido no está disponible.';
  return shell({
    title: 'Contenido no disponible | Nexo',
    description,
    canonicalUrl: 'https://nexoapp.art/',
    imageUrl: 'https://nexoapp.art/assets/nexo-preview.svg',
    imageType: 'image/svg+xml',
    type: 'post',
    noIndex: true,
    body: `<section class="card missing"><h1>Este contenido no está disponible</h1><p>Puede que haya dejado de estar disponible o que no sea público.</p><div class="actions"><a class="button secondary" href="${APP_STORE_URL}">Descargar Nexo</a></div></section>`,
  });
}
