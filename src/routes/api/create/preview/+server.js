// Rendu de validation pour /create. Réutilise exactement le convertisseur
// Pandoc employé par scripts/parse-latex.js afin de vérifier notamment les
// tableaux avant l'export d'une source .tex.

import { json, error } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import {
  convertLaTeXToHTML,
  wrapAlignWithDollar,
} from '../../../../../scripts/utils/tex2html-utils.js';

const VALID_TYPES = new Set(['text', 'question', 'indication', 'reponse', 'code']);
const MAX_BLOCKS = 80;
const MAX_LATEX_CHARS = 30_000;

function getClientIp(event) {
  const forwarded = event.request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  try {
    return event.getClientAddress();
  } catch {
    return 'unknown';
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function POST(event) {
  const ip = getClientIp(event);
  const rate = checkRateLimit(`create-preview:${ip}`, 8);
  if (!rate.allowed) {
    return json({ error: 'Trop de vérifications de rendu, réessayez dans une minute.' }, { status: 429 });
  }

  let payload;
  try {
    payload = await event.request.json();
  } catch {
    throw error(400, { message: 'Corps JSON invalide' });
  }

  const blocks = Array.isArray(payload?.blocks) ? payload.blocks : [];
  if (!blocks.length || blocks.length > MAX_BLOCKS) {
    throw error(400, { message: `Nombre de blocs invalide (1 à ${MAX_BLOCKS})` });
  }
  const totalLength = blocks.reduce((sum, block) => sum + String(block?.latex || '').length, 0);
  if (totalLength > MAX_LATEX_CHARS) {
    throw error(413, { message: 'Exercice trop long pour la vérification de rendu' });
  }

  try {
    const content = await Promise.all(blocks.map(async (block, index) => {
      if (!VALID_TYPES.has(block?.type) || typeof block?.latex !== 'string') {
        throw new Error('Bloc invalide');
      }
      const latex = block.latex.trim();
      const html = block.type === 'code'
        ? `<pre class="tex-preview-code"><code>${escapeHtml(latex)}</code></pre>`
        : latex ? await convertLaTeXToHTML(wrapAlignWithDollar(latex)) : '';
      return { id: String(index), type: block.type, latex, html, order: index + 1 };
    }));
    return json({ content, renderer: 'pandoc' });
  } catch (err) {
    console.error('[create/preview] Échec du rendu:', err.message);
    return json({ error: 'Le rendu final n’a pas pu être vérifié.' }, { status: 502 });
  }
}
