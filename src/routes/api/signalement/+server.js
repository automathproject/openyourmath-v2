// src/routes/api/signalement/+server.js
// Crée le ticket d'un signalement d'erreur, au nom du dépôt correspondant au
// compte de connexion (forge → automath/exobase, GitHub → automathproject/exobase).
import { json } from '@sveltejs/kit';
import { getExerciseByUuid } from '$lib/db/queries.js';
import { getExerciseCpge } from '$lib/db/cpge.js';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import { FOURNISSEURS } from '$lib/server/signalement/fournisseurs.js';
import { composerTicket, validerSignalement } from '$lib/server/signalement/ticket.js';

const HEURE_MS = 3_600_000;

function clientIp(event) {
  try { return event.getClientAddress(); } catch { return 'unknown'; }
}

export async function POST(event) {
  const auteur = event.locals.auteur;
  const fournisseur = auteur && FOURNISSEURS[auteur.fournisseur];
  if (!fournisseur || !fournisseur.configure()) {
    return json({ erreur: 'Connectez-vous avec la forge ou GitHub pour signaler une erreur.' }, { status: 401 });
  }

  for (const [cle, limite] of [[`signalement:${auteur.fournisseur}:${auteur.id}`, 10], [`signalement-ip:${clientIp(event)}`, 30]]) {
    const { allowed, retryAfter } = checkRateLimit(cle, limite, HEURE_MS);
    if (!allowed) {
      return json(
        { erreur: `Trop de signalements en une heure. Réessayez dans ${Math.ceil(retryAfter / 60)} min.` },
        { status: 429, headers: { 'retry-after': String(retryAfter) } }
      );
    }
  }

  const corps = await event.request.json().catch(() => null);
  const uuid = typeof corps?.uuid === 'string' ? corps.uuid : '';
  const exercise = uuid ? await getExerciseByUuid(uuid) : null;
  if (!exercise) return json({ erreur: 'Exercice introuvable.' }, { status: 404 });

  const verdict = validerSignalement(corps, { exercise, cpge: await getExerciseCpge(uuid) });
  if (!verdict.ok) return json({ erreur: verdict.erreur }, { status: 400 });

  const ticket = composerTicket({
    exercise,
    signalement: verdict.signalement,
    auteur,
    origine: event.url.origin,
    lienSource: fournisseur.lienSource
  });
  try {
    const cree = await fournisseur.creerTicket(ticket);
    return json({ url: cree.url, numero: cree.numero, depot: fournisseur.depot() });
  } catch (err) {
    console.error('Signalement, création du ticket :', err.message);
    return json({ erreur: 'Le ticket n’a pas pu être créé. Réessayez plus tard.' }, { status: 502 });
  }
}
