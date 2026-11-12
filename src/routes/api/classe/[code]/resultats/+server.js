// src/routes/api/classe/[code]/resultats/+server.js
// Bilan d'une session en cours, pour l'enseignant : JSON, ou CSV avec ?format=csv.
import { json } from '@sveltejs/kit';
import { resultsFor } from '$lib/server/classe/sessions.js';
import { errorResponse, hostToken } from '$lib/server/classe/http.js';
import { resultsToCsv } from '$lib/qcm/results.js';

export function GET({ params, cookies, url }) {
  try {
    const results = resultsFor(params.code, hostToken(cookies, params.code));
    if (url.searchParams.get('format') !== 'csv') return json(results);
    return new Response(resultsToCsv(results), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qcm-${params.code}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
