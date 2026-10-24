// src/routes/signalement/deconnexion/+server.js
import { json } from '@sveltejs/kit';
import { COOKIE_SESSION } from '$lib/server/signalement/cookies.js';

export function POST({ cookies }) {
  cookies.delete(COOKIE_SESSION, { path: '/' });
  return json({ ok: true });
}
