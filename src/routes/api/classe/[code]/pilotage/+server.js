// src/routes/api/classe/[code]/pilotage/+server.js
// Commandes de l'enseignant : ouvrir, clore, corriger, changer de question, terminer.
import { json } from '@sveltejs/kit';
import { control } from '$lib/server/classe/sessions.js';
import { clearTokens, errorResponse, hostToken, readBody } from '$lib/server/classe/http.js';

export async function POST({ params, cookies, request }) {
  try {
    const body = await readBody(request);
    const result = control(params.code, hostToken(cookies, params.code), String(body.action || ''), body.index);
    if (result.ended) clearTokens(cookies, params.code);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
