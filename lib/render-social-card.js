import sharp from 'sharp';

export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;
export const SOCIAL_CARD_CONTENT_TYPE = 'image/jpeg';
export const SOCIAL_CARD_LOGO_SIZE = 92;
export const SOCIAL_CARD_LOGO_LEFT = 1080;
export const SOCIAL_CARD_LOGO_TOP = 510;
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
    const fallbackPlay = isVideo
      ? `<circle cx="600" cy="466" r="31" fill="#02060a" fill-opacity="0.76" stroke="#fff" stroke-opacity="0.58"/>
         <path d="M592 449 L592 483 L618 466 Z" fill="#fff"/>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs><radialGradient id="fallbackGlow"><stop stop-color="#c98317" stop-opacity="0.24"/><stop offset="1" stop-color="#02080c" stop-opacity="0"/></radialGradient></defs>
      <circle cx="600" cy="290" r="310" fill="url(#fallbackGlow)"/>
      <text x="600" y="417" text-anchor="middle" fill="#f8f4eb" font-family="Arial, sans-serif" font-size="34" font-weight="700">Contenido en Nexo</text>
      ${fallbackPlay}
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
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1592">
      <path d="M72 0 H1008 Q1080 0 1080 72 V1592 H0 V72 Q0 0 72 0 Z" fill="white"/>
    </svg>`);
    return await sharp(image.bytes)
      .rotate()
      .resize(1080, 1592, { fit: 'cover', position: 'attention' })
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
      <circle cx="540" cy="870" r="430" fill="url(#fallbackGlow)"/>
      <text x="540" y="1090" text-anchor="middle" fill="#f4f2ed" font-family="Arial, sans-serif" font-size="48" font-weight="700">Contenido en Nexo</text>
      ${border}
    </svg>`;
  }

  const author = escapeXml(normalizeSocialText(authorName || 'Usuario Nexo', 50));
  const captionLines = wrapCaption(normalizeSocialText(caption, 120), 2, 34).map(escapeXml);
  const captionMarkup = captionLines.map((line, index) =>
    `<tspan x="190" dy="${index === 0 ? 0 : 43}">${line}</tspan>`).join('');
  const placeholder = hasAvatar ? '' : `<circle cx="110" cy="1712" r="52" fill="#0a171d" stroke="#c9953f" stroke-width="2"/>
    <text x="110" y="1729" text-anchor="middle" fill="#d6a64d" font-family="Arial, sans-serif" font-size="46" font-weight="800">N</text>`;
  const play = isVideo
    ? `<circle cx="540" cy="796" r="76" fill="#010305" fill-opacity="0.70" stroke="#fff" stroke-opacity="0.48" stroke-width="2"/>
       <circle cx="540" cy="796" r="67" fill="#111820" fill-opacity="0.28"/>
       <path d="M520 750 L520 842 L588 796 Z" fill="#fff"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs>
      <linearGradient id="footer" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#020608" stop-opacity="0.98"/>
        <stop offset="0.62" stop-color="#031219" stop-opacity="0.99"/>
        <stop offset="1" stop-color="#010305"/>
      </linearGradient>
      <linearGradient id="separator" x1="0" y1="0" x2="1" y2="0">
        <stop stop-color="#8b6429" stop-opacity="0"/>
        <stop offset="0.5" stop-color="#d3a24e" stop-opacity="0.62"/>
        <stop offset="1" stop-color="#8b6429" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M5 1592 H1075 V1847 Q1075 1915 1007 1915 H73 Q5 1915 5 1847 Z" fill="url(#footer)"/>
    <rect x="48" y="1592" width="984" height="2" fill="url(#separator)"/>
    ${placeholder}
    <circle cx="110" cy="1712" r="53" fill="none" stroke="#d3a24e" stroke-opacity="0.88" stroke-width="2"/>
    <text x="190" y="1705" fill="#fff" font-family="Arial, sans-serif" font-size="42" font-weight="700" direction="auto" unicode-bidi="plaintext">${author}</text>
    <text x="190" y="1770" fill="#c8ced1" font-family="Arial, sans-serif" font-size="34" direction="auto" unicode-bidi="plaintext">${captionMarkup}</text>
    ${play}
    ${border}
  </svg>`;
}

export async function renderVerticalShareCard({ type, authorName, caption, preview, avatar, logoBytes }) {
  if (type !== 'post' && type !== 'video') throw new TypeError('invalid_social_card_type');
  if (!logoBytes?.length) throw new TypeError('missing_social_card_logo');

  const [previewBytes, avatarBytes] = await Promise.all([
    normalizedVerticalPreview(preview),
    normalizedVerticalAvatar(avatar),
  ]);
  const logoSize = previewBytes ? 120 : 260;
  const logo = await sharp(logoBytes)
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();
  const overlay = Buffer.from(buildVerticalShareCardSvg({
    type,
    authorName,
    caption,
    hasPreview: Boolean(previewBytes),
    hasAvatar: Boolean(avatarBytes),
  }));
  const layers = [];
  if (previewBytes) layers.push({ input: previewBytes, left: 0, top: 0 });
  layers.push({ input: overlay, left: 0, top: 0 });
  layers.push({
    input: logo,
    left: previewBytes ? 902 : 410,
    top: previewBytes ? 1652 : 720,
  });
  if (previewBytes && avatarBytes) layers.push({ input: avatarBytes, left: 58, top: 1660 });

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
  if (type !== 'post' && type !== 'video') throw new TypeError('invalid_social_card_type');
  if (!logoBytes?.length) throw new TypeError('missing_social_card_logo');

  const previewBytes = await normalizedPreview(preview);
  const logoSize = previewBytes ? SOCIAL_CARD_LOGO_SIZE : 156;
  const logo = await sharp(logoBytes)
    .resize(logoSize, logoSize, { fit: 'contain' })
    .png()
    .toBuffer();
  const overlay = Buffer.from(buildSocialCardSvg({
    type,
    authorName,
    caption,
    hasPreview: Boolean(previewBytes),
    hasAvatar: false,
  }));
  const layers = [];
  if (previewBytes) layers.push({ input: previewBytes, left: 0, top: 0 });
  layers.push({ input: overlay, left: 0, top: 0 });
  layers.push({
    input: logo,
    left: previewBytes ? SOCIAL_CARD_LOGO_LEFT : 522,
    top: previewBytes ? SOCIAL_CARD_LOGO_TOP : 70,
  });

  const bytes = await sharp(Buffer.from(baseSvg()))
    .composite(layers)
    .jpeg({ quality: 87, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return {
    bytes,
    contentType: SOCIAL_CARD_CONTENT_TYPE,
    width: SOCIAL_CARD_WIDTH,
    height: SOCIAL_CARD_HEIGHT,
    usedFallback: !previewBytes,
  };
}
