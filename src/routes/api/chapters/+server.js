// src/routes/api/chapters/+server.js
import { json } from '@sveltejs/kit';
import { getChapterStructure, getChapterStructureFiltered, getSuggestions } from '$lib/db/queries.js';

export async function GET({ url }) {
  try {
    const type = url.searchParams.get('type') || 'structure';
    
    if (type === 'structure') {
      // Structure hiérarchique des chapitres
      const q = url.searchParams.get('q') || '';
      // Filtres optionnels
      const filters = {
        level: url.searchParams.get('level') || '',
        module: url.searchParams.get('module') || '',
        chapter: url.searchParams.get('chapter') || '',
        subchapter: url.searchParams.get('subchapter') || '',
        difficulty: url.searchParams.get('difficulty') || '',
        author: url.searchParams.get('author') || '',
        createdFrom: url.searchParams.get('createdFrom') || '',
        createdTo: url.searchParams.get('createdTo') || '',
        updatedFrom: url.searchParams.get('updatedFrom') || '',
        updatedTo: url.searchParams.get('updatedTo') || '',
        hasSolution: url.searchParams.get('hasSolution') || '',
        hasIndication: url.searchParams.get('hasIndication') || '',
        hasVideo: url.searchParams.get('hasVideo') || ''
      };

      const hasQueryOrFilters = q.trim() || Object.values(filters).some(v => v);
      const structure = hasQueryOrFilters
        ? await getChapterStructureFiltered(q, filters)
        : await getChapterStructure();
      return json({ structure });
    } else if (type === 'suggestions') {
      // Suggestions pour autocomplétion
      const suggestionType = url.searchParams.get('for') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      // MODIFIÉ : Ajouter 'difficulties' à la liste des types valides
      const validTypes = ['all', 'chapters', 'themes', 'authors', 'modules', 'levels', 'difficulties'];
      if (!validTypes.includes(suggestionType)) {
        return json(
          { error: `Invalid suggestion type. Valid types: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      
      const suggestions = await getSuggestions(suggestionType, limit);
      return json({ suggestions });
    } else {
      return json(
        { error: 'Invalid type parameter. Valid types: structure, suggestions' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Chapters API error:', error);
    return json(
      { error: 'Failed to get chapters data', message: error.message },
      { status: 500 }
    );
  }
}
