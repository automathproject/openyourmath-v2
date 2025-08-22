// src/routes/api/exercise/[uuid]/+server.js
import { json, error } from '@sveltejs/kit';
import { getExerciseByUuid, getSimilarExercises } from '$lib/db/queries.js';

export async function GET({ params }) {
  try {
    const { uuid } = params;
    
    // Validation de l'UUID
    if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
      return json(
        { error: 'UUID required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    // Récupérer l'exercice principal
    const exercise = await getExerciseByUuid(uuid.trim());
    
    if (!exercise) {
      return json(
        { error: 'Exercise not found' },
        { status: 404 }
      );
    }
    
    // Récupérer des exercices similaires
    const similarExercises = await getSimilarExercises(uuid.trim(), 5);
    
    // Formater la réponse
    const response = {
      exercise,
      similar: similarExercises || [],
      meta: {
        timestamp: new Date().toISOString(),
        uuid: uuid.trim()
      }
    };
    
    return json(response);
    
  } catch (error) {
    console.error('Exercise API error:', error);
    return json(
      { 
        error: 'Failed to get exercise', 
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}