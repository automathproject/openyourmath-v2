// src/routes/api/classe/[code]/reponse/+server.js
// Réponse d'un participant à la question en cours ; modifiable tant que
// l'enseignant n'a pas clos les réponses.
import { json } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import { submitAnswer } from '$lib/server/classe/sessions.js';
import { errorResponse, participantToken, readBody } from '$lib/server/classe/http.js';

export async function POST({ params, cookies, request }) {
  try {
    const token = participantToken(cookies, params.code);
    const rate = checkRateLimit(`classe-reponse:${token.slice(0, 16)}`, 90, 60_000);
    if (!rate.allowed) return json({ error: 'Trop de réponses envoyées.', code: 'rythme' }, { status: 429 });

    const body = await readBody(request);
    return json(submitAnswer(params.code, token, Number(body.question), body.selection));
  } catch (error) {
    return errorResponse(error);
  }
}
