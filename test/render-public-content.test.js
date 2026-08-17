import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderPublicContent, renderUnavailable } from '../lib/render-public-content.js';

test('renders dynamic Open Graph and canonical metadata for a post', () => {
  const html = renderPublicContent({ type: 'post', id: 'post_123', authorName: 'Ana', caption: 'Hola Nexo' });
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:description" content="Hola Nexo">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/nexoapp\.art\/media\/social-card\/post\/post_123">/);
  assert.match(html, /<meta property="og:image:secure_url"/);
  assert.match(html, /<meta property="og:image:type" content="image\/jpeg">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta property="og:image:alt"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/nexoapp\.art\/post\/post_123">/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.match(html, /twitter:image" content="https:\/\/nexoapp\.art\/media\/social-card\/post\/post_123"/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="1024x1024" href="\/assets\/nexo-logo-official\.png">/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="1024x1024" href="\/assets\/nexo-logo-official\.png">/);
  assert.match(html, /<div class="preview"><img src="https:\/\/nexoapp\.art\/media\/preview\/post\/post_123"/);
  const body = html.match(/<body>[\s\S]*<\/body>/)?.[0] ?? '';
  assert.equal(createHash('sha256').update(body).digest('hex'), '3a6efa04ad629a5d13f33a7f2ee761eb420320bcac2e56cbb80baed1152b341a');
});

test('renders video indicator without embedding or autoplaying a video', () => {
  const html = renderPublicContent({ type: 'video', id: 'video_123', authorName: 'Ana', caption: 'Video' });
  assert.match(html, /aria-label="Video">▶/);
  assert.doesNotMatch(html, /<video|autoplay|og:video/);
  assert.match(html, /media\/preview\/video\/video_123/);
});

test('escapes user content in HTML and Open Graph', () => {
  const html = renderPublicContent({
    type: 'post',
    id: 'safe_id',
    authorName: '<img src=x onerror=alert(1)>',
    caption: '\"><script>alert(1)</script>',
  });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('never exposes storage fields, URLs or download tokens in HTML', () => {
  const html = renderPublicContent({
    type: 'post',
    id: 'post_1',
    authorName: 'Autor',
    caption: 'Caption segura',
    mediaUrl: 'https://firebasestorage.googleapis.com/private?token=secret',
    videoUrl: 'https://firebasestorage.googleapis.com/video?token=secret',
    imageUrl: 'https://firebasestorage.googleapis.com/image?token=secret',
    token: 'secret',
  });
  for (const forbidden of ['firebasestorage.googleapis.com', 'mediaUrl', 'videoUrl', 'imageUrl', 'token=secret']) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});

test('unavailable page is branded and does not reveal a reason', () => {
  const html = renderUnavailable();
  assert.match(html, /Este contenido no está disponible/);
  assert.match(html, /noindex, noarchive/);
  assert.doesNotMatch(html, /privado|moderado|eliminado/);
});
