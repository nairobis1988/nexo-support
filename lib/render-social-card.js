import sharp from 'sharp';

export const SOCIAL_CARD_WIDTH = 1080;
export const SOCIAL_CARD_HEIGHT = 1920;
export const SOCIAL_CARD_CONTENT_TYPE = 'image/jpeg';
export const SOCIAL_CARD_CONTENT_HEIGHT = 1920;
export const SOCIAL_CARD_FALLBACK_LOGO_SIZE = 260;
export const SOCIAL_CARD_FALLBACK_LOGO_LEFT = 410;
export const SOCIAL_CARD_FALLBACK_LOGO_TOP = 830;
export const VERTICAL_SHARE_CARD_WIDTH = 1080;
export const VERTICAL_SHARE_CARD_HEIGHT = 1920;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizeSocialText(value, maxCharacters) {
  const normalized = String(value ?? '')
    .replace(CONTROL_CHARACTERS, '')
    .replace(/\s+/gu, ' ')
    .trim();
  const characters = Array.from(normalized);
  if (characters.length <= maxCharacters) return normalized;
  return `${characters.slice(0, Math.max(0, maxCharacters - 1)).join('').trimEnd()}…`;
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapCaption(value, maxLines = 3, lineLength = 25) {
  const text = normalizeSocialText(value, 140);
  if (!text) return [];
  const lines = [];
  let remaining = Array.from(text);
  while (remaining.length && lines.length < maxLines) {
    if (remaining.length <= lineLength) {
      lines.push(remaining.join('').trim());
      remaining = [];
      break;
    }
    const candidate = remaining.slice(0, lineLength + 1);
    let splitAt = candidate.lastIndexOf(' ');
    if (splitAt < Math.floor(lineLength * 0.55)) splitAt = lineLength;
    lines.push(remaining.slice(0, splitAt).join('').trim());
    remaining = remaining.slice(splitAt);
    while (remaining[0] === ' ') remaining.shift();
  }
  if (remaining.length && lines.length) {
    const finalCharacters = Array.from(lines.at(-1));
    lines[lines.length - 1] = `${finalCharacters.slice(0, Math.max(0, lineLength - 1)).join('').trimEnd()}…`;
  }
  return lines;
}

function baseSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#02070a"/>
        <stop offset="0.55" stop-color="#06141b"/>
        <stop offset="1" stop-color="#020306"/>
      </linearGradient>
      <radialGradient id="glow" cx="85%" cy="8%" r="72%">
        <stop stop-color="#b97816" stop-opacity="0.22"/>
        <stop offset="1" stop-color="#021018" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#background)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
  </svg>`;
}

export function buildSocialCardSvg({ type, authorName, caption, hasPreview, hasAvatar }) {
  const isVideo = type === 'video';
  const play = isVideo
    ? `<circle cx="600" cy="315" r="52" fill="#02060a" fill-opacity="0.72" stroke="#fff" stroke-opacity="0.72" stroke-width="2"/>
       <path d="M587 285 L587 345 L632 315 Z" fill="#fff"/>`
    : '';

  if (!hasPreview) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs><radialGradient id="fallbackGlow"><stop stop-color="#c98317" stop-opacity="0.24"/><stop offset="1" stop-color="#02080c" stop-opacity="0"/></radialGradient></defs>
      <circle cx="600" cy="315" r="310" fill="url(#fallbackGlow)"/>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <radialGradient id="logoGlow">
        <stop stop-color="#d29a39" stop-opacity="0.20"/>
        <stop offset="1" stop-color="#020405" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="1126" cy="556" r="70" fill="url(#logoGlow)"/>
    ${play}
  </svg>`;
}

async function normalizedPreview(image) {
  if (!image?.bytes?.length) return null;
  try {
    return await sharp(image.bytes)
      .rotate()
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

async function normalizedAvatar(image) {
  if (!image?.bytes?.length) return null;
  try {
    const mask = Buffer.from('<svg width="68" height="68"><circle cx="34" cy="34" r="34" fill="white"/></svg>');
    return await sharp(image.bytes)
      .rotate()
      .resize(68, 68, { fit: 'cover', position: 'attention' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function normalizedVerticalPreview(image) {
  if (!image?.bytes?.length) return null;
  try {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${SOCIAL_CARD_CONTENT_HEIGHT}">
      <rect width="1080" height="${SOCIAL_CARD_CONTENT_HEIGHT}" rx="68" fill="white"/>
    </svg>`);
    return await sharp(image.bytes)
      .rotate()
      .resize(1080, SOCIAL_CARD_CONTENT_HEIGHT, { fit: 'cover', position: 'attention' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function normalizedVerticalAvatar(image) {
  if (!image?.bytes?.length) return null;
  try {
    const mask = Buffer.from('<svg width="104" height="104"><circle cx="52" cy="52" r="52" fill="white"/></svg>');
    return await sharp(image.bytes)
      .rotate()
      .resize(104, 104, { fit: 'cover', position: 'attention' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function verticalBaseSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#010304"/>
        <stop offset="0.58" stop-color="#031016"/>
        <stop offset="1" stop-color="#010203"/>
      </linearGradient>
      <radialGradient id="goldGlow" cx="88%" cy="92%" r="48%">
        <stop stop-color="#b97816" stop-opacity="0.12"/>
        <stop offset="1" stop-color="#020609" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1080" height="1920" fill="#000"/>
    <rect x="5" y="5" width="1070" height="1910" rx="68" fill="url(#card)"/>
    <rect x="5" y="5" width="1070" height="1910" rx="68" fill="url(#goldGlow)"/>
  </svg>`;
}

export function buildVerticalShareCardSvg({ type, authorName, caption, hasPreview, hasAvatar }) {
  const isVideo = type === 'video';
  const border = '<rect x="5" y="5" width="1070" height="1910" rx="68" fill="none" stroke="#c9953f" stroke-opacity="0.82" stroke-width="2"/>';
  if (!hasPreview) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
      <defs><radialGradient id="fallbackGlow"><stop stop-color="#c78a27" stop-opacity="0.15"/><stop offset="1" stop-color="#010608" stop-opacity="0"/></radialGradient></defs>
      <circle cx="540" cy="960" r="430" fill="url(#fallbackGlow)"/>
      ${border}
    </svg>`;
  }
  const play = isVideo
    ? `<circle cx="540" cy="960" r="76" fill="#010305" fill-opacity="0.70" stroke="#fff" stroke-opacity="0.48" stroke-width="2"/>
       <circle cx="540" cy="960" r="67" fill="#111820" fill-opacity="0.28"/>
       <path d="M520 914 L520 1006 L588 960 Z" fill="#fff"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    ${play}
    ${border}
  </svg>`;
}

export async function renderVerticalShareCard({ type, authorName, caption, preview, avatar, logoBytes }) {
  if (type !== 'post' && type !== 'video') throw new TypeError('invalid_social_card_type');
  if (!logoBytes?.length) throw new TypeError('missing_social_card_logo');

  const previewBytes = await normalizedVerticalPreview(preview);
  const logo = previewBytes ? null : await sharp(logoBytes)
    .resize(SOCIAL_CARD_FALLBACK_LOGO_SIZE, SOCIAL_CARD_FALLBACK_LOGO_SIZE, { fit: 'contain' })
    .png()
    .toBuffer();
  const overlay = Buffer.from(buildVerticalShareCardSvg({
    type,
    authorName,
    caption,
    hasPreview: Boolean(previewBytes),
    hasAvatar: false,
  }));
  const layers = [];
  if (previewBytes) layers.push({ input: previewBytes, left: 0, top: 0 });
  layers.push({ input: overlay, left: 0, top: 0 });
  if (logo) layers.push({
    input: logo,
    left: SOCIAL_CARD_FALLBACK_LOGO_LEFT,
    top: SOCIAL_CARD_FALLBACK_LOGO_TOP,
  });

  const bytes = await sharp(Buffer.from(verticalBaseSvg()))
    .composite(layers)
    .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return {
    bytes,
    contentType: SOCIAL_CARD_CONTENT_TYPE,
    width: VERTICAL_SHARE_CARD_WIDTH,
    height: VERTICAL_SHARE_CARD_HEIGHT,
    usedFallback: !previewBytes,
  };
}

export async function renderSocialCard({ type, authorName, caption, preview, avatar, logoBytes }) {
  return renderVerticalShareCard({ type, authorName, caption, preview, avatar, logoBytes });
}
