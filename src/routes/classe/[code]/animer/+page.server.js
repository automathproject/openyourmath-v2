// src/routes/classe/[code]/animer/+page.server.js : écran de l'enseignant.
import { error, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { ClasseError, getSession, isHost, normalizeCode, sessionSummary } from '$lib/server/classe/sessions.js';
import { hostToken } from '$lib/server/classe/http.js';

export async function load({ params, cookies, url }) {
  const code = normalizeCode(params.code);
  if (code !== params.code) throw redirect(307, `/classe/${code}/animer`);
  let session;
  try {
    session = getSession(code);
  } catch (err) {
    if (err instanceof ClasseError) throw error(err.status, err.message);
    throw err;
  }
  // Seul le navigateur qui a ouvert la session l'anime ; les autres y participent.
  if (!isHost(session, hostToken(cookies, code))) throw redirect(303, `/classe/${code}`);

  const joinUrl = `${url.origin}/classe/${code}`;
  return {
    code,
    joinUrl,
    joinHost: url.host,
    qr: await QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    summary: sessionSummary(code),
  };
}
