// src/routes/fiches/[slug]/+page.server.js
import { error } from '@sveltejs/kit';
import { getFicheByUuid } from '$lib/db/fiches.js';

export async function load({ params }) {
  let loaded;
  try {
    loaded = await getFicheByUuid(params.slug);
  } catch (err) {
    console.error('Failed to load fiche:', err);
    throw error(500, 'Erreur lors du chargement de la fiche');
  }

  if (!loaded) throw error(404, `Fiche introuvable : ${params.slug}`);

  // Regroupement par sections contiguës, comme le fait `listSections` côté
  // client : la page de fiche et la liste montrent alors la même structure.
  const groups = [];
  for (const exercise of loaded.exercises) {
    const key = exercise.sectionPath.join(' › ');
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(exercise);
    else groups.push({ key, path: exercise.sectionPath, items: [exercise] });
  }

  return { ...loaded, groups };
}
