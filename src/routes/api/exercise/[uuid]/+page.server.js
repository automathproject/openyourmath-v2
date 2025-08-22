// src/routes/exercise/[uuid]/+page.server.js
import { error } from '@sveltejs/kit';
import { getExerciseByUuid, getSimilarExercises } from '$lib/db/queries.js';

export async function load({ params }) {
  try {
    const { uuid } = params;
    
    // Validation de l'UUID
    if (!uuid || typeof uuid !== 'string' || uuid.length < 10) {
      throw error(400, 'UUID invalide');
    }
    
    // Récupérer l'exercice principal
    const exercise = await getExerciseByUuid(uuid);
    
    if (!exercise) {
      throw error(404, 'Exercice non trouvé');
    }
    
    // Récupérer des exercices similaires (en parallèle)
    const similar = await getSimilarExercises(uuid, 5);
    
    return {
      exercise,
      similar: similar || []
    };
    
  } catch (err) {
    console.error('Failed to load exercise:', err);
    
    // Re-throw SvelteKit errors avec leur status
    if (err.status) {
      throw err;
    }
    
    // Erreur générique pour les autres cas
    throw error(500, 'Erreur lors du chargement de l\'exercice');
  }
}