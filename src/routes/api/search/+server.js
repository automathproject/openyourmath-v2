// src/routes/api/search/+server.js
import { json } from '@sveltejs/kit';
import { searchExercises, getExerciseCount } from '$lib/db/queries.js';

export async function GET({ url }) {
  try {
    // Extraction et validation des paramètres
    const query = url.searchParams.get('q')?.trim() || '';
    const chapter = url.searchParams.get('chapter')?.trim() || '';
    const difficulty = url.searchParams.get('difficulty');
    const author = url.searchParams.get('author')?.trim() || '';
    
    // Validation et parsing des paramètres de pagination
    let limit = parseInt(url.searchParams.get('limit') || '20');
    let offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Limites de sécurité
    limit = Math.max(1, Math.min(limit, 100)); // Entre 1 et 100
    offset = Math.max(0, offset);
    
    // Construire les filtres
    const filters = {};
    if (chapter) filters.chapter = chapter;
    if (difficulty && !isNaN(parseInt(difficulty))) {
      filters.difficulty = parseInt(difficulty);
    }
    if (author) filters.author = author;
    
    // Options de pagination
    const options = { limit: limit + 1, offset }; // +1 pour détecter hasMore
    
    // Effectuer la recherche
    const results = await searchExercises(query, filters, options);
    
    // Déterminer s'il y a plus de résultats
    const hasMore = results.length > limit;
    const finalResults = hasMore ? results.slice(0, limit) : results;
    
    // Obtenir le nombre total (optionnel, pour de meilleures infos de pagination)
    let totalCount = null;
    if (offset === 0) {
      try {
        totalCount = await getExerciseCount(query, filters);
      } catch (err) {
        console.warn('Could not get total count:', err.message);
      }
    }
    
    // Formater la réponse
    const response = {
      results: finalResults,
      meta: {
        query,
        filters,
        pagination: {
          limit,
          offset,
          count: finalResults.length,
          hasMore,
          totalCount
        },
        timestamp: new Date().toISOString()
      }
    };
    
    return json(response);
    
  } catch (error) {
    console.error('Search API error:', error);
    return json(
      { 
        error: 'Search failed', 
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}