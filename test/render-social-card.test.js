import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  buildVerticalShareCardSvg,
  escapeXml,
  normalizeSocialText,
  renderSocialCard,
  renderVerticalShareCard,
  SOCIAL_CARD_WIDTH,
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_CONTENT_HEIGHT,
  SOCIAL_CARD_FALLBACK_LOGO_LEFT,
  SOCIAL_CARD_FALLBACK_LOGO_SIZE,
  SOCIAL_CARD_FALLBACK_LOGO_TOP,
} from '../lib/render-social-card.js';

const logoPath = fileURLToPath(new URL('../assets/nexo-logo-official.png', import.meta.url));
const logoBytes = await readFile(logoPath);

async function fixtureImage(color) {
  return sharp({ create: { width: 900, height: 1100, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

async function assertJpeg(card) {
  const metadata = await sharp(card.bytes).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  assert.equal(metadata.exif, undefined);
}

test('renders a 1080x1920 JPEG post card with a real preview', async () => {
  const preview = { bytes: await fixtureImage('#176b87'), contentType: 'image/jpeg' };
  const avatar = { bytes: await fixtureImage('#d59b2d'), contentType: 'image/jpeg' };
  const card = await renderSocialCard({ type: 'post', authorName: 'Ana', caption: 'Hola Nexo', preview, avatar, logoBytes });
  await assertJpeg(card);
  assert.equal(card.usedFallback, false);
});

test('renders video as JPEG and uses a geometric play icon', async () => {
  const preview = { bytes: await fixtureImage('#40276d'), contentType: 'image/jpeg' };
  const card = await renderSocialCard({ type: 'video', authorName: 'Creador', caption: 'Video premium', preview, avatar: null, logoBytes });
  await assertJpeg(card);
  const svg = buildVerticalShareCardSvg({ type: 'video', authorName: 'Creador', caption: 'Video', hasPreview: true, hasAvatar: false });
  assert.match(svg, /<circle cx="540" cy="960"/);
  assert.match(svg, /<path d="M520 914 L520 1006 L588 960 Z"/);
  assert.doesNotMatch(svg, /▶|&#x25B6;/);
});

test('social card with preview contains no embedded logo, footer or native metadata copy', async () => {
  const preview = { bytes: await fixtureImage('#176b87'), contentType: 'image/jpeg' };
  const card = await renderSocialCard({
    type: 'post',
    authorName: 'CEO NEXO',
    caption: 'No duplicar este caption',
    preview,
    avatar: null,
    logoBytes,
  });
  await assertJpeg(card);
  assert.equal(SOCIAL_CARD_WIDTH, 1080);
  assert.equal(SOCIAL_CARD_HEIGHT, 1920);
  assert.equal(SOCIAL_CARD_CONTENT_HEIGHT, 1920);
  const svg = buildVerticalShareCardSvg({
    type: 'post',
    authorName: 'CEO NEXO',
    caption: 'No duplicar este caption',
    hasPreview: true,
    hasAvatar: false,
  });
  assert.doesNotMatch(svg, /<text|footer|separator|logoGlow|CEO NEXO|No duplicar|nexoapp\.art|NEXO SOCIAL|App Store|Google Play|Abrir en Nexo/);
});

test('missing or invalid preview produces a raster Nexo fallback, never SVG', async () => {
  for (const preview of [null, { bytes: Buffer.from('not-an-image'), contentType: 'image/jpeg' }]) {
    const card = await renderSocialCard({ type: 'post', authorName: '', caption: '', preview, avatar: null, logoBytes });
    await assertJpeg(card);
    assert.equal(card.contentType, 'image/jpeg');
    assert.equal(card.usedFallback, true);
  }
  assert.equal(SOCIAL_CARD_FALLBACK_LOGO_SIZE, 260);
  assert.equal(SOCIAL_CARD_FALLBACK_LOGO_LEFT + (SOCIAL_CARD_FALLBACK_LOGO_SIZE / 2), 540);
  assert.equal(SOCIAL_CARD_FALLBACK_LOGO_TOP + (SOCIAL_CARD_FALLBACK_LOGO_SIZE / 2), 960);
  const fallbackSvg = buildVerticalShareCardSvg({
    type: 'video',
    authorName: 'Private author',
    caption: 'Private caption',
    hasPreview: false,
    hasAvatar: false,
  });
  assert.doesNotMatch(fallbackSvg, /<text|<path|Contenido en Nexo|nexoapp\.art|Private author|Private caption|VIDEO/);
});

test('preview overlay has no footer, logo, avatar, author, caption, domain or other copy', () => {
  const svg = buildVerticalShareCardSvg({ type: 'post', authorName: 'Ana', caption: 'Caption', hasPreview: true, hasAvatar: true });
  assert.doesNotMatch(svg, /<text|footer|separator|logo|>N<\/text>|Ana|Caption|nexoapp\.art/);
});

test('normalizes, truncates and XML-escapes malicious Unicode text', () => {
  const malicious = `<&>"'\u0000 مرحبا 👑 ${'muy largo '.repeat(30)}`;
  const normalized = normalizeSocialText(malicious, 140);
  assert.ok(Array.from(normalized).length <= 140);
  assert.ok(normalized.endsWith('…'));
  assert.equal(escapeXml(`<&>"'`), '&lt;&amp;&gt;&quot;&apos;');
  const svg = buildVerticalShareCardSvg({ type: 'post', authorName: malicious, caption: malicious, hasPreview: true, hasAvatar: false });
  assert.doesNotMatch(svg, /\u0000|<script|<&>/);
  assert.doesNotMatch(svg, /مرحبا|👑|<tspan/u);
});

test('real social-card renderer uses owner-approved 1080x1920 format', async () => {
  const preview = { bytes: await fixtureImage('#153d4b'), contentType: 'image/jpeg' };
  const avatar = { bytes: await fixtureImage('#bb852c'), contentType: 'image/jpeg' };
  for (const type of ['post', 'video']) {
    const card = await renderSocialCard({ type, authorName: 'Autor real', caption: 'Caption real', preview, avatar, logoBytes });
    const metadata = await sharp(card.bytes).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 1080);
    assert.equal(metadata.height, 1920);
    assert.equal(metadata.exif, undefined);
  }
});

test('vertical card contains no footer text and geometric play only for video', () => {
  const post = buildVerticalShareCardSvg({ type: 'post', authorName: 'Autor real', caption: 'Caption real', hasPreview: true, hasAvatar: false });
  const video = buildVerticalShareCardSvg({ type: 'video', authorName: 'Autor real', caption: 'Caption real', hasPreview: true, hasAvatar: true });
  for (const svg of [post, video]) {
    assert.doesNotMatch(svg, /nexoapp\.art|NEXO SOCIAL|>VIDEO<|App Store|Google Play|Abrir en Nexo|>https?:\/\//i);
    assert.doesNotMatch(svg, /<text|Autor real|Caption real/);
  }
  assert.doesNotMatch(post, /M520 914 L520 1006 L588 960 Z/);
  assert.match(video, /M520 914 L520 1006 L588 960 Z/);
  assert.doesNotMatch(video, /▶|&#x25B6;/);
});

test('vertical fallback is a 1080x1920 JPEG with centered logo and no text', async () => {
  const card = await renderVerticalShareCard({ type: 'post', authorName: 'Do not show', caption: 'Do not show', preview: null, avatar: null, logoBytes });
  const metadata = await sharp(card.bytes).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  assert.equal(card.usedFallback, true);
  const svg = buildVerticalShareCardSvg({ type: 'post', authorName: 'Do not show', caption: 'Do not show', hasPreview: false, hasAvatar: false });
  assert.doesNotMatch(svg, /<text|Contenido en Nexo|Do not show|nexoapp\.art|NEXO SOCIAL/);
});
