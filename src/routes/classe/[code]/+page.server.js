// src/routes/classe/[code]/+page.server.js : vue d'un participant.
import { error, redirect } from '@sveltejs/kit';
import { ClasseError, findParticipant, getSession, isHost, normalizeCode, sessionSummary } from '$lib/server/classe/sessions.js';
import { hostToken, participantToken } from '$lib/server/classe/http.js';

export function load({ params, cookies }) {
  const code = normalizeCode(params.code);
  if (code !== params.code) throw redirect(307, `/classe/${code}`);
  try {
    const session = getSession(code);
    const participant = findParticipant(session, participantToken(cookies, code));
    return {
      code,
      summary: sessionSummary(code),
      name: participant?.name ?? null,
      // La personne qui anime peut aussi ouvrir la vue participant : on lui rappelle son écran.
      host: isHost(session, hostToken(cookies, code)),
    };
  } catch (err) {
    if (err instanceof ClasseError) throw error(err.status, err.message);
    throw err;
  }
}
