// src/lib/db/stats.js - Requêtes pour les statistiques et analyses
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data/exercises.sqlite');

/**
 * Obtient des statistiques globales sur la base d'exercices
 */
export async function getGlobalStats() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // Stats générales
    const totalExercises = db.prepare('SELECT COUNT(*) as count FROM exercises').get().count;
    
    // Distribution par difficulté
    const difficultyStats = db.prepare(`
      SELECT difficulty, COUNT(*) as count 
      FROM exercises 
      WHERE difficulty IS NOT NULL 
      GROUP BY difficulty 
      ORDER BY difficulty
    `).all();
    
    // Top chapitres
    const topChapters = db.prepare(`
      SELECT chapter, COUNT(*) as count 
      FROM exercises 
      WHERE chapter IS NOT NULL 
      GROUP BY chapter 
      ORDER BY count DESC 
      LIMIT 10
    `).all();
    
    // Top auteurs
    const topAuthors = db.prepare(`
      SELECT author, COUNT(*) as count 
      FROM exercises 
      WHERE author IS NOT NULL 
      GROUP BY author 
      ORDER BY count DESC 
      LIMIT 10
    `).all();
    
    // Exercices récents
    const recentCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM exercises 
      WHERE created_at > datetime('now', '-30 days')
    `).get().count;
    
    return {
      total: totalExercises,
      difficulty: difficultyStats,
      topChapters,
      topAuthors,
      recentCount
    };
    
  } catch (error) {
    console.error('Database error in getGlobalStats:', error);
    throw new Error('Erreur lors de la récupération des statistiques');
  } finally {
    if (db) db.close();
  }
}

/**
 * Obtient les statistiques détaillées d'un chapitre
 */
export async function getChapterDetailedStats(chapterName, subchapterName = null) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    let whereClause = 'WHERE chapter = ?';
    let params = [chapterName];
    
    if (subchapterName) {
      whereClause += ' AND subchapter = ?';
      params.push(subchapterName);
    }
    
    // Nombre total d'exercices
    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM exercises ${whereClause}
    `).get(...params).count;
    
    // Distribution par difficulté
    const difficultyDistribution = db.prepare(`
      SELECT 
        difficulty, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / ${totalCount}, 1) as percentage
      FROM exercises 
      ${whereClause} AND difficulty IS NOT NULL
      GROUP BY difficulty 
      ORDER BY difficulty
    `).all(...params);
    
    // Auteurs contributeurs
    const authors = db.prepare(`
      SELECT 
        author, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / ${totalCount}, 1) as percentage
      FROM exercises 
      ${whereClause} AND author IS NOT NULL
      GROUP BY author 
      ORDER BY count DESC
    `).all(...params);
    
    // Répartition par thème (si pas de sous-chapitre spécifié)
    let themes = [];
    if (!subchapterName) {
      themes = db.prepare(`
        SELECT 
          theme, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / ${totalCount}, 1) as percentage
        FROM exercises 
        ${whereClause} AND theme IS NOT NULL
        GROUP BY theme 
        ORDER BY count DESC
        LIMIT 15
      `).all(...params);
    }
    
    // Sous-chapitres (si chapitre principal)
    let subchapters = [];
    if (!subchapterName) {
      subchapters = db.prepare(`
        SELECT 
          subchapter, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / ${totalCount}, 1) as percentage
        FROM exercises 
        WHERE chapter = ? AND subchapter IS NOT NULL
        GROUP BY subchapter 
        ORDER BY count DESC
      `).all(chapterName);
    }
    
    // Exercices récents dans ce chapitre
    const recentExercises = db.prepare(`
      SELECT uuid, title, created_at, difficulty, author
      FROM exercises 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(...params);
    
    return {
      total: totalCount,
      difficulty: difficultyDistribution,
      authors,
      themes,
      subchapters,
      recent: recentExercises
    };
    
  } catch (error) {
    console.error('Database error in getChapterDetailedStats:', error);
    throw new Error('Erreur lors de la récupération des statistiques du chapitre');
  } finally {
    if (db) db.close();
  }
}

/**
 * Recherche avec agrégations et facettes
 */
export async function searchWithFacets(query = '', filters = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // Construction de la requête de base
    let baseWhere = '1=1';
    let params = [];
    
    if (query.trim()) {
      // Utiliser FTS5 si disponible
      baseWhere += ` AND uuid IN (
        SELECT uuid FROM fts_exercises WHERE fts_exercises MATCH ?
      )`;
      params.push(`"${query.trim()}"*`);
    }
    
    if (filters.chapter) {
      baseWhere += ' AND chapter = ?';
      params.push(filters.chapter);
    }
    
    if (filters.difficulty) {
      baseWhere += ' AND difficulty = ?';
      params.push(filters.difficulty);
    }
    
    if (filters.author) {
      baseWhere += ' AND author = ?';
      params.push(filters.author);
    }
    
    // Facettes : chapitres disponibles
    const chapterFacets = db.prepare(`
      SELECT chapter, COUNT(*) as count 
      FROM exercises 
      WHERE ${baseWhere} AND chapter IS NOT NULL
      GROUP BY chapter 
      ORDER BY count DESC 
      LIMIT 20
    `).all(...params);
    
    // Facettes : difficultés disponibles
    const difficultyFacets = db.prepare(`
      SELECT difficulty, COUNT(*) as count 
      FROM exercises 
      WHERE ${baseWhere} AND difficulty IS NOT NULL
      GROUP BY difficulty 
      ORDER BY difficulty
    `).all(...params);
    
    // Facettes : auteurs disponibles
    const authorFacets = db.prepare(`
      SELECT author, COUNT(*) as count 
      FROM exercises 
      WHERE ${baseWhere} AND author IS NOT NULL
      GROUP BY author 
      ORDER BY count DESC 
      LIMIT 15
    `).all(...params);
    
    return {
      facets: {
        chapters: chapterFacets,
        difficulties: difficultyFacets,
        authors: authorFacets
      }
    };
    
  } catch (error) {
    console.error('Database error in searchWithFacets:', error);
    throw new Error('Erreur lors de la recherche avec facettes');
  } finally {
    if (db) db.close();
  }
}

/**
 * Obtient des recommandations basées sur l'historique (simulation)
 */
export async function getRecommendations(basedOnChapters = [], limit = 10) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    if (basedOnChapters.length === 0) {
      // Recommandations générales : exercices populaires et récents
      return db.prepare(`
        SELECT 
          e.uuid, e.title, e.chapter, e.difficulty, e.author,
          'popular' as reason
        FROM exercises e
        WHERE e.difficulty IN (2, 3) -- Difficulté moyenne
        ORDER BY RANDOM()
        LIMIT ?
      `).all(limit);
    }
    
    // Recommandations basées sur les chapitres d'intérêt
    const placeholders = basedOnChapters.map(() => '?').join(',');
    
    const recommendations = db.prepare(`
      SELECT 
        e.uuid, e.title, e.chapter, e.difficulty, e.author,
        CASE 
          WHEN e.chapter IN (${placeholders}) THEN 'same_chapter'
          ELSE 'related_topic'
        END as reason
      FROM exercises e
      WHERE (
        e.chapter IN (${placeholders})
        OR e.theme IN (
          SELECT DISTINCT theme 
          FROM exercises 
          WHERE chapter IN (${placeholders}) 
          AND theme IS NOT NULL
        )
      )
      ORDER BY 
        CASE WHEN e.chapter IN (${placeholders}) THEN 1 ELSE 2 END,
        RANDOM()
      LIMIT ?
    `).all(...basedOnChapters, ...basedOnChapters, limit);
    
    return recommendations;
    
  } catch (error) {
    console.error('Database error in getRecommendations:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}

/**
 * Analyse de tendances (exercices les plus consultés, etc.)
 * Simulation basée sur la structure existante
 */
export async function getTrendingExercises(limit = 20) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // Simulation de popularité basée sur critères heuristiques
    const trending = db.prepare(`
      SELECT 
        e.uuid, e.title, e.chapter, e.difficulty, e.author,
        e.created_at,
        (
          CASE 
            WHEN e.difficulty IN (2, 3) THEN 2
            WHEN e.difficulty IN (1, 4) THEN 1
            ELSE 0
          END +
          CASE 
            WHEN e.created_at > datetime('now', '-90 days') THEN 1
            ELSE 0
          END +
          CASE 
            WHEN e.author IN (
              SELECT author FROM exercises 
              GROUP BY author 
              HAVING COUNT(*) > 5
            ) THEN 1
            ELSE 0
          END
        ) as popularity_score
      FROM exercises e
      WHERE e.title IS NOT NULL
      ORDER BY popularity_score DESC, RANDOM()
      LIMIT ?
    `).all(limit);
    
    return trending;
    
  } catch (error) {
    console.error('Database error in getTrendingExercises:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}

/**
 * Recherche d'exercices similaires avancée
 */
export async function getAdvancedSimilarExercises(uuid, options = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const { 
      includeTheme = true, 
      includeDifficulty = true, 
      includeAuthor = false,
      limit = 10 
    } = options;
    
    // Récupérer l'exercice de référence
    const reference = db.prepare(`
      SELECT chapter, subchapter, theme, difficulty, author 
      FROM exercises 
      WHERE uuid = ?
    `).get(uuid);
    
    if (!reference) {
      return [];
    }
    
    // Construire la requête de similarité avec scoring
    let scoreConditions = [];
    let params = [uuid];
    
    scoreConditions.push('CASE WHEN chapter = ? THEN 5 ELSE 0 END');
    params.push(reference.chapter);
    
    if (reference.subchapter) {
      scoreConditions.push('CASE WHEN subchapter = ? THEN 3 ELSE 0 END');
      params.push(reference.subchapter);
    }
    
    if (includeTheme && reference.theme) {
      scoreConditions.push('CASE WHEN theme = ? THEN 4 ELSE 0 END');
      params.push(reference.theme);
    }
    
    if (includeDifficulty && reference.difficulty) {
      scoreConditions.push('CASE WHEN difficulty = ? THEN 2 ELSE 0 END');
      params.push(reference.difficulty);
    }
    
    if (includeAuthor && reference.author) {
      scoreConditions.push('CASE WHEN author = ? THEN 1 ELSE 0 END');
      params.push(reference.author);
    }
    
    const scoreExpression = scoreConditions.join(' + ');
    params.push(limit);
    
    const similar = db.prepare(`
      SELECT 
        uuid, title, chapter, subchapter, theme, difficulty, author,
        (${scoreExpression}) as similarity_score
      FROM exercises 
      WHERE uuid != ?
        AND (${scoreExpression}) > 0
      ORDER BY similarity_score DESC, RANDOM()
      LIMIT ?
    `).all(uuid, ...params);
    
    return similar;
    
  } catch (error) {
    console.error('Database error in getAdvancedSimilarExercises:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}