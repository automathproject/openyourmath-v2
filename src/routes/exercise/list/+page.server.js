// src/routes/exercise/list/+page.server.js
import { error } from '@sveltejs/kit';
import { getExerciseByUuid } from '$lib/db/queries.js';

export async function load({ url }) {
  try {
    const listParam = url.searchParams.get('list');
    
    // Si pas de paramètre list, retourner une liste vide
    if (!listParam || listParam.trim() === '') {
      return {
        exercises: [],
        uuids: [],
        meta: {
          total: 0,
          loaded: 0,
          errors: 0
        }
      };
    }
    
    // Parser les UUIDs
    const uuids = listParam
      // Accepter virgules OU espaces comme séparateurs
      .trim()
      .split(/[\s,]+/)
      .map(uuid => uuid.trim())
      .filter(uuid => uuid !== '' && uuid.length >= 3); // Moins restrictif pour les UUIDs courts
    
    console.log('Parsed UUIDs:', uuids); // Debug
    
    if (uuids.length === 0) {
      return {
        exercises: [],
        uuids: [],
        meta: {
          total: 0,
          loaded: 0,
          errors: 0
        }
      };
    }
    
    // Limiter le nombre d'exercices pour éviter les surcharges
    const maxExercises = 50;
    const limitedUuids = uuids.slice(0, maxExercises);
    
    if (uuids.length > maxExercises) {
      console.warn(`Too many exercises requested (${uuids.length}), limited to ${maxExercises}`);
    }
    
    // Charger les exercices en parallèle
    const exercisePromises = limitedUuids.map(async (uuid) => {
      try {
        const exercise = await getExerciseByUuid(uuid);
        return {
          uuid,
          exercise,
          success: !!exercise
        };
      } catch (err) {
        console.warn(`Failed to load exercise ${uuid}:`, err.message);
        return {
          uuid,
          exercise: null,
          success: false,
          error: err.message
        };
      }
    });
    
    const results = await Promise.all(exercisePromises);
    
    // Séparer les succès et les échecs
    const successfulExercises = results
      .filter(result => result.success)
      .map(result => ({
        uuid: result.uuid,
        title: result.exercise.title,
        chapter: result.exercise.chapter,
        theme: result.exercise.theme,
        author: result.exercise.author,
        difficulty: result.exercise.difficulty,
        // Inclure le contenu complet pour le premier exercice (optimisation)
        content: result.exercise.content,
        fullExercise: result.exercise
      }));
    
    const failedUuids = results
      .filter(result => !result.success)
      .map(result => result.uuid);
    
    // Métadonnées
    const meta = {
      total: limitedUuids.length,
      loaded: successfulExercises.length,
      errors: failedUuids.length,
      failedUuids,
      originalCount: uuids.length,
      wasLimited: uuids.length > maxExercises
    };
    
    return {
      exercises: successfulExercises,
      uuids: limitedUuids,
      meta
    };
    
  } catch (err) {
    console.error('Failed to load exercise list:', err);
    throw error(500, 'Erreur lors du chargement de la liste d\'exercices');
  }
}
