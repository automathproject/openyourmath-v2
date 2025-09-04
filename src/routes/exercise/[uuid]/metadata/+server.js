// src/routes/api/exercise/[uuid]/metadata/+server.js
import { json } from '@sveltejs/kit';
import { getExerciseMetadata } from '$lib/db/queries.js';

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
    
    // Récupérer uniquement les métadonnées de l'exercice (sans le contenu complet)
    const metadata = await getExerciseMetadata(uuid.trim());
    
    if (!metadata) {
      return json(
        { error: 'Exercise not found' },
        { status: 404 }
      );
    }
    
    // Formater la réponse avec uniquement les métadonnées essentielles
    const response = {
      exercise: {
        uuid: metadata.uuid,
        title: metadata.title,
        chapter: metadata.chapter,
        theme: metadata.theme,
        author: metadata.author,
        difficulty: metadata.difficulty,
        level: metadata.level,
        module: metadata.module,
        // Pas de contenu pour alléger la réponse
        hasContent: !!(metadata.content && metadata.content.length > 0)
      },
      meta: {
        timestamp: new Date().toISOString(),
        uuid: uuid.trim(),
        type: 'metadata'
      }
    };
    
    return json(response);
    
  } catch (error) {
    console.error('Exercise metadata API error:', error);
    return json(
      { 
        error: 'Failed to get exercise metadata', 
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}