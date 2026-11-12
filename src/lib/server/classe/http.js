// src/lib/server/classe/http.js
// Liaison HTTP des sessions en direct : cookies de rôle, erreurs, chargement
// des questions depuis la base.

import { json } from '@sveltejs/kit';
import { getExerciseByUuid } from '$lib/db/queries.js';
import { withRenderedMath } from '$lib/server/exerciseMath.js';
import { withFigureAttributes } from '$lib/server/exerciseFigures.js';
import { isQcm, qcmQuestionsOf } from '$lib/qcm/blocks.js';
import { ClasseError, limits, normalizeCode } from './sessions.js';

/** Durée des cookies de rôle : celle d'une session, au plus. */
const cookieOptions = () => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: limits().maxMinutes * 60,
});

const hostCookie = (code) => `oym_classe_h_${normalizeCode(code)}`;
const participantCookie = (code) => `oym_classe_p_${normalizeCode(code)}`;

// Pas de compte : c'est un cookie propre à la session qui dit qui anime et qui
// participe. Il ne quitte jamais le navigateur dans une adresse.
export const hostToken = (cookies, code) => cookies.get(hostCookie(code)) ?? '';
export const participantToken = (cookies, code) => cookies.get(participantCookie(code)) ?? '';
export const setHostToken = (cookies, code, value) => cookies.set(hostCookie(code), value, cookieOptions());
export const setParticipantToken = (cookies, code, value) => cookies.set(participantCookie(code), value, cookieOptions());

export function clearTokens(cookies, code) {
  cookies.delete(hostCookie(code), { path: '/' });
  cookies.delete(participantCookie(code), { path: '/' });
}

/** Réponse JSON d'erreur ; une erreur imprévue est journalisée et masquée. */
export function errorResponse(error) {
  if (error instanceof ClasseError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Session en direct :', error);
  return json({ error: 'Erreur du serveur.', code: 'serveur' }, { status: 500 });
}

/** Corps JSON d'une requête, ou objet vide s'il est absent ou illisible. */
export async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

export function clientAddress(event) {
  try {
    return event.getClientAddress();
  } catch {
    return 'inconnu';
  }
}

/**
 * Questions de qcm d'une liste, dans l'ordre de la liste. Les exercices d'une
 * liste mixte ne se jouent pas en direct : ils sont comptés, puis écartés.
 * Les formules sont composées une fois ici, pas à chaque diffusion.
 *
 * @param {string[]} uuids
 * @returns {Promise<{ questions: object[], qcm: number, skipped: number, missing: number }>}
 */
export async function loadQuestions(uuids) {
  const questions = [];
  let qcm = 0;
  let skipped = 0;
  let missing = 0;
  for (const uuid of uuids) {
    const exercise = await getExerciseByUuid(uuid);
    if (!exercise) {
      missing++;
      continue;
    }
    if (!isQcm(exercise)) {
      skipped++;
      continue;
    }
    qcm++;
    questions.push(...qcmQuestionsOf(withFigureAttributes(withRenderedMath(exercise))));
  }
  return { questions, qcm, skipped, missing };
}
