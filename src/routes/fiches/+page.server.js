// src/routes/fiches/+page.server.js
import { error } from '@sveltejs/kit';
import { getFiches, getFicheFacets } from '$lib/db/fiches.js';

export async function load({ url }) {
  try {
    const organization = url.searchParams.get('organisation')?.trim() || '';
    const author = url.searchParams.get('auteur')?.trim() || '';
    const query = url.searchParams.get('q')?.trim() || '';

    const [{ fiches, total }, facets] = await Promise.all([
      getFiches({ organization, author, query }),
      getFicheFacets()
    ]);

    return { fiches, total, facets, filters: { organization, author, query } };
  } catch (err) {
    console.error('Failed to load fiches:', err);
    throw error(500, 'Erreur lors du chargement des fiches');
  }
}
