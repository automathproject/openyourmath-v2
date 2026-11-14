// src/routes/api/fiches/+server.js
//
// Catalogue des fiches pour Ma liste : l'état vide et le panneau « Fiches » le
// filtrent côté client. 167 fiches sans contenu, quelques kilo-octets : un seul
// appel suffit, sans pagination.
import { json, error } from '@sveltejs/kit';
import { getFiches } from '$lib/db/fiches.js';

export async function GET({ setHeaders }) {
  try {
    const { fiches, total } = await getFiches({ limit: 1000 });
    setHeaders({ 'cache-control': 'public, max-age=300' });
    return json({
      total,
      fiches: fiches.map(({ uuid, slug, title, author, organization, exercise_count, max_depth }) => ({
        uuid, slug, title, author, organization, exercise_count, max_depth
      }))
    });
  } catch (err) {
    console.error('Failed to load fiches catalogue:', err);
    throw error(500, 'Erreur lors du chargement des fiches');
  }
}
