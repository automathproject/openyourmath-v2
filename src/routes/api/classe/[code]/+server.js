// src/routes/api/classe/[code]/+server.js
// GET : renseignements publics d'une session. POST : y entrer.
import { json } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import { findParticipant, getSession, joinSession, sessionSummary } from '$lib/server/classe/sessions.js';
import { clientAddress, errorResponse, participantToken, readBody, setParticipantToken } from '$lib/server/classe/http.js';

export function GET({ params }) {
  try {
    return json(sessionSummary(params.code));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(event) {
  const { params, cookies, request } = event;
  try {
    // Limite large : toute une classe peut sortir par la même adresse.
    const rate = checkRateLimit(`classe-entree:${clientAddress(event)}`, 300, 60_000);
    if (!rate.allowed) return json({ error: 'Trop de tentatives. Réessayez dans une minute.', code: 'rythme' }, { status: 429 });

    // Déjà inscrit (page rechargée) : on ne crée pas un second participant.
    const known = findParticipant(getSession(params.code), participantToken(cookies, params.code));
    if (known) return json({ name: known.name });

    const body = await readBody(request);
    const joined = joinSession(params.code, body.name);
    setParticipantToken(cookies, params.code, joined.token);
    return json({ name: joined.name }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
