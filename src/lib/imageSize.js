// src/lib/imageSize.js
// Dimensions naturelles d'une image, lues dans son en-tête, sans bibliothèque.
//
// Servent à réserver la place d'une figure avant qu'elle ne soit chargée (width
// et height donnent le rapport à la mise en page) : la page ne saute plus quand
// l'image arrive. Les dimensions sont en pixels CSS.

const CSS_PX_PER_UNIT = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

const round = (value) => Number(value.toFixed(2));

function lengthToPx(value) {
  const match = /^\s*([0-9]*\.?[0-9]+)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(value ?? '');
  if (!match) return null;
  return Number(match[1]) * CSS_PX_PER_UNIT[(match[2] || 'px').toLowerCase()];
}

function attribute(tag, name) {
  return new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined);
}

/** SVG : width/height de la racine (en unités CSS), à défaut son viewBox. */
function svgSize(text) {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return null;
  const width = lengthToPx(attribute(tag, 'width'));
  const height = lengthToPx(attribute(tag, 'height'));
  if (width && height) return { width: round(width), height: round(height) };
  const box = attribute(tag, 'viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) return { width: round(box[2]), height: round(box[3]) };
  return null;
}

function pngSize(bytes) {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** JPEG : le premier marqueur « start of frame » porte les dimensions. */
function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    // Marqueurs sans longueur : RSTn, SOI, EOI, TEM.
    if (marker === 0x01 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    offset += 2 + length;
  }
  return null;
}

/**
 * Dimensions d'une image à partir de son contenu.
 *
 * @param {Buffer} bytes
 * @param {string} extension  sans point : « png », « jpg », « jpeg », « svg »
 * @returns {{ width: number, height: number } | null}
 */
export function readImageSize(bytes, extension) {
  const ext = String(extension).toLowerCase();
  let size = null;
  if (ext === 'svg') size = svgSize(bytes.toString('utf8', 0, Math.min(bytes.length, 8192)));
  else if (ext === 'png') size = pngSize(bytes);
  else if (ext === 'jpg' || ext === 'jpeg') size = jpegSize(bytes);
  return size && size.width > 0 && size.height > 0 ? size : null;
}
