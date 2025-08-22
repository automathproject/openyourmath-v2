// src/routes/api/chapters/+server.js
import { json } from '@sveltejs/kit';
import { getChapterStructure, getSuggestions } from '$lib/db/queries.js';

export async function GET({ url }) {
  try {
    const type = url.searchParams.get('type') || 'structure';
    
    if (type === 'structure') {
      // Structure hiérarchique des chapitres
      const structure = await getChapterStructure();
      return json({ structure });
      
    } else if (type === 'suggestions') {
      // Suggestions pour autocomplétion
      const suggestionType = url.searchParams.get('for') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      const suggestions = await getSuggestions(suggestionType, limit);
      return json({ suggestions });
      
    } else {
      return json(
        { error: 'Invalid type parameter' },
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