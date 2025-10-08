// src/routes/api/search/+server.js
import { json } from '@sveltejs/kit';
import { searchExercises, getExerciseCount, getContextualFilterCounts } from '$lib/db/queries.js';

export async function GET({ url }) {
  try {
    // Extraction et validation des paramètres
    const query = url.searchParams.get('q')?.trim() || '';
    const chapter = url.searchParams.get('chapter')?.trim() || '';
    const subchapter = url.searchParams.get('subchapter')?.trim() || '';
    const level = url.searchParams.get('level')?.trim() || '';          // NOUVEAU : niveau textuel (L1, L2, M1...)
    const difficulty = url.searchParams.get('difficulty')?.trim() || ''; // NOUVEAU : difficulté numérique (1-5)
    const module = url.searchParams.get('module')?.trim() || '';
    const author = url.searchParams.get('author')?.trim() || '';
    const hasSolutionParam = url.searchParams.get('hasSolution');
    const hasIndicationParam = url.searchParams.get('hasIndication');
    const sortParam = url.searchParams.get('sort')?.trim() || '';
    const allowedSorts = new Set([
      'updated_desc',
      'updated_asc',
      'created_desc',
      'created_asc',
      'difficulty_asc',
      'difficulty_desc'
    ]);
    const sort = allowedSorts.has(sortParam) ? sortParam : '';
    
    // Validation et parsing des paramètres de pagination
    let limit = parseInt(url.searchParams.get('limit') || '20');
    let offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Limites de sécurité
    limit = Math.max(1, Math.min(limit, 100)); // Entre 1 et 100
    offset = Math.max(0, offset);
    
    // Construire les filtres
    const filters = {};
    if (chapter) filters.chapter = chapter;
    if (subchapter) filters.subchapter = subchapter;
    if (level) filters.level = level;                                   // NOUVEAU : Filtre level (texte)
    
    // MODIFIÉ : Traitement spécial pour difficulty (numérique)
    if (difficulty) {
      if (difficulty === 'null' || difficulty === '') {
        filters.difficulty = 'null'; // Exercices sans difficulté
      } else {
        const difficultyNum = parseInt(difficulty, 10);
        if (!isNaN(difficultyNum) && difficultyNum >= 1 && difficultyNum <= 5) {
          filters.difficulty = difficultyNum; // Difficulté valide 1-5
        }
      }
    }
    
    if (module) filters.module = module;
    if (author) filters.author = author;
    if (hasSolutionParam !== null && hasSolutionParam !== undefined && hasSolutionParam !== '') {
      const v = hasSolutionParam.toString().toLowerCase();
      if (v === '1' || v === 'true') filters.hasSolution = true;
      else if (v === '0' || v === 'false') filters.hasSolution = false;
    }
    if (hasIndicationParam !== null && hasIndicationParam !== undefined && hasIndicationParam !== '') {
      const v2 = hasIndicationParam.toString().toLowerCase();
      if (v2 === '1' || v2 === 'true') filters.hasIndication = true;
      else if (v2 === '0' || v2 === 'false') filters.hasIndication = false;
    }

    if (sort) {
      filters.sort = sort;
      if (sort.endsWith('_asc')) {
        filters.sortDirection = 'asc';
      } else if (sort.endsWith('_desc')) {
        filters.sortDirection = 'desc';
      }
    }
    
    // Options de pagination
    const options = { limit: limit + 1, offset, sort }; // +1 pour détecter hasMore
    
    console.log('Search API - Filters:', filters);  // Debug
    
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

    let filterCounts = null;
    if (offset === 0) {
      try {
        filterCounts = await getContextualFilterCounts(query, filters);
      } catch (err) {
        console.warn('Could not get filter counts:', err.message);
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
        filterCounts,
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
