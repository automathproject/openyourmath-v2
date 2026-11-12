// src/routes/api/classe/+server.js
// Ouvre une session de qcm en direct à partir d'une liste de contenus.
import { json } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import { createSession, limits, occupancy } from '$lib/server/classe/sessions.js';
import { clientAddress, errorResponse, loadQuestions, readBody, setHostToken } from '$lib/server/classe/http.js';

const UUID = /^[A-Za-z0-9_-]{3,12}$/;

/** Occupation du service : la page d'accueil dit s'il reste de la place. */
export function GET() {
  const { sessions, limits: bounds } = occupancy();
  return json({
    sessions,
    maxSessions: bounds.maxSessions,
    maxParticipants: bounds.maxParticipants,
    maxQuestions: bounds.maxQuestions,
  });
}

export async function POST(event) {
  try {
    // Une salle de classe partage souvent une seule adresse : la limite ne vise
    // que la création en rafale.
    const rate = checkRateLimit(`classe-creation:${clientAddress(event)}`, 10, 10 * 60_000);
    if (!rate.allowed) {
      return json({ error: 'Trop de sessions créées. Patientez quelques minutes.', code: 'rythme' }, {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfter) },
      });
    }

    const body = await readBody(event.request);
    const uuids = (Array.isArray(body.uuids) ? body.uuids : [])
      .filter((uuid) => typeof uuid === 'string' && UUID.test(uuid))
      // Une liste ne peut pas dépasser le nombre de questions jouables.
      .slice(0, limits().maxQuestions);
    const loaded = await loadQuestions(uuids);
    const { code, hostToken } = createSession({ title: body.title, questions: loaded.questions });
    setHostToken(event.cookies, code, hostToken);
    return json({
      code,
      questions: loaded.questions.length,
      qcm: loaded.qcm,
      skipped: loaded.skipped,
      missing: loaded.missing,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
