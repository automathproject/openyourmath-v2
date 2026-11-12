// src/routes/api/classe/[code]/flux/+server.js
// Flux temps réel (Server-Sent Events) d'une session : l'état est poussé à
// chaque changement. Le rôle se lit dans les cookies ; `role=hote` demande la
// vue de l'enseignant.
import { openStream } from '$lib/server/classe/sessions.js';
import { errorResponse, hostToken, participantToken } from '$lib/server/classe/http.js';

export function GET({ params, cookies, url }) {
  try {
    const asHost = url.searchParams.get('role') === 'hote';
    const stream = openStream(params.code, {
      hostToken: asHost ? hostToken(cookies, params.code) : '',
      participantToken: participantToken(cookies, params.code),
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Les mandataires ne doivent pas retenir les messages.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
