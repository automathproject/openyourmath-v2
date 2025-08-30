// src/routes/api/stats/+server.js
import { json } from '@sveltejs/kit';
import { 
  getGlobalStats, 
  getChapterDetailedStats, 
  searchWithFacets,
  getTrendingExercises 
} from '$lib/db/stats.js';

export async function GET({ url }) {
  try {
    const type = url.searchParams.get('type') || 'global';
    
    switch (type) {
      case 'global':
        const globalStats = await getGlobalStats();
        return json({ stats: globalStats });
        
      case 'chapter':
        const chapter = url.searchParams.get('chapter');
        const subchapter = url.searchParams.get('subchapter');
        
        if (!chapter) {
          return json(
            { error: 'Chapter parameter required for chapter stats' },
            { status: 400 }
          );
        }
        
        const chapterStats = await getChapterDetailedStats(chapter, subchapter);
        return json({ stats: chapterStats });
        
      case 'facets':
        const query = url.searchParams.get('q') || '';
        const filters = {
          chapter: url.searchParams.get('chapter'),
          difficulty: url.searchParams.get('difficulty'),
          author: url.searchParams.get('author')
        };
        
        const facets = await searchWithFacets(query, filters);
        return json({ facets: facets.facets });
        
      case 'trending':
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const trending = await getTrendingExercises(limit);
        return json({ trending });
        
      default:
        return json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('Stats API error:', error);
    return json(
      { error: 'Failed to get statistics', message: error.message },
      { status: 500 }
    );
  }
}