// src/routes/exercise/[uuid]/+page.server.js
import { error } from '@sveltejs/kit';
import { getExerciseByUuid, getSimilarExercises } from '$lib/db/queries.js';
import { getExerciseCpge } from '$lib/db/cpge.js';
import { fournisseursDisponibles } from '$lib/server/signalement/fournisseurs.js';

export async function load({ params, locals }) {
  try {
    const { uuid } = params;
    
    // Validation de l'UUID
    if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
      throw error(400, 'UUID invalide');
    }
    
    // Récupérer l'exercice principal
    const exercise = await getExerciseByUuid(uuid);
    
    if (!exercise) {
      throw error(404, 'Exercice non trouvé');
    }
    
    // Récupérer des exercices similaires (en parallèle)
    const similar = await getSimilarExercises(uuid, 5);
    // Rattachements aux programmes de CPGE, groupés par programme.
    const cpge = await getExerciseCpge(uuid);

    // Signalement d'erreur : comptes de connexion proposés, et identité
    // déjà vérifiée le cas échéant (sans les identifiants internes).
    const auteur = locals.auteur;
    const signalement = {
      fournisseurs: fournisseursDisponibles(),
      auteur: auteur ? { fournisseur: auteur.fournisseur, login: auteur.login, profil: auteur.profil } : null
    };

    return {
      exercise,
      similar: similar || [],
      cpge,
      signalement
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