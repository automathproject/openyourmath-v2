// src/routes/api/fiches/[slug]/+server.js
//
// Une fiche et ses entrées, sous la forme que charge /exercise/list?fiche=… :
// sert à « Ajouter à la suite » depuis le panneau Fiches, sans quitter la liste.
import { json, error } from '@sveltejs/kit';
import { getFicheByUuid } from '$lib/db/fiches.js';

export async function GET({ params }) {
  const loaded = await getFicheByUuid(params.slug.trim());
  if (!loaded) throw error(404, `Fiche introuvable : ${params.slug}`);
  return json({ fiche: loaded.fiche, exercises: loaded.exercises });
}
