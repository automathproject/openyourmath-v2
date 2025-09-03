// src/lib/db/queries.js - Version corrigée avec recherche insensible à la casse ET preview
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data/exercises.sqlite');

function prepareSearchQuery(query) {
  if (!query || query.trim() === '') {
    return '';
  }
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length <= 2) {
    return null; 
  }
  return `"${cleanQuery}"*`;
}

/**
 * Recherche d'exercices avec filtres (version améliorée avec level/difficulty + preview)
 */
export async function searchExercises(query = '', filters = {}, options = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const { limit = 20, offset = 0 } = options;
    const searchQuery = prepareSearchQuery(query);
    
    let sql, params = [];
    
    if (query.trim() && searchQuery === null) {
      sql = `
        SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.level, e.difficulty, e.module, e.author, e.created_at, e.preview
        FROM exercises e
        WHERE (UPPER(e.title) LIKE UPPER(?) OR UPPER(e.chapter) LIKE UPPER(?) OR UPPER(e.theme) LIKE UPPER(?) OR UPPER(e.module) LIKE UPPER(?))
      `;
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    } else if (searchQuery) {
      sql = `
        SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.level, e.difficulty, e.module, e.author, e.created_at, e.preview, bm25(fts_exercises) as rank
        FROM exercises e JOIN fts_exercises fts ON e.uuid = fts.uuid
        WHERE fts_exercises MATCH ?
      `;
      params.push(searchQuery);
    } else {
      sql = `
        SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.level, e.difficulty, e.module, e.author, e.created_at, e.preview
        FROM exercises e WHERE 1=1
      `;
    }
    
    // Filtres avec insensibilité à la casse
    if (filters.subchapter) {
      sql += ' AND UPPER(e.subchapter) = UPPER(?)';
      params.push(filters.subchapter);
      
      if (filters.chapter) {
        sql += ' AND UPPER(e.chapter) = UPPER(?)';
        params.push(filters.chapter);
      }
    } else if (filters.chapter) {
      sql += ' AND UPPER(e.chapter) = UPPER(?)';
      params.push(filters.chapter);
    }
    
    if (filters.module) {
      sql += ' AND UPPER(e.module) = UPPER(?)';
      params.push(filters.module);
    }
    
    // MODIFIÉ : Filtre sur level au lieu de difficulty (pour le texte)
    if (filters.level) {
      sql += ' AND UPPER(e.level) = UPPER(?)';
      params.push(filters.level);
    }
    
    // NOUVEAU : Filtre sur difficulty numérique
    if (filters.difficulty !== undefined && filters.difficulty !== null) {
      if (filters.difficulty === 'null' || filters.difficulty === '') {
        sql += ' AND e.difficulty IS NULL';
      } else {
        sql += ' AND e.difficulty = ?';
        params.push(parseInt(filters.difficulty, 10));
      }
    }
    
    if (filters.author) {
      sql += ' AND UPPER(e.author) = UPPER(?)';
      params.push(filters.author);
    }
    
    // Ordre et Pagination
    if (searchQuery) {
      sql += ' ORDER BY rank';
    } else if (query.trim() && searchQuery === null) {
      sql += ' ORDER BY e.title';
    } else {
      sql += ' ORDER BY e.created_at DESC';
    }
    
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    console.log('Search SQL:', sql);
    console.log('Search params:', params);
    
    const results = db.prepare(sql).all(...params);
    return results;
    
  } catch (error) {
    console.error('Database error in searchExercises:', error);
    throw new Error('Erreur de recherche');
  } finally {
    if (db) db.close();
  }
}

/**
 * Compte le nombre total d'exercices pour une recherche (version améliorée)
 */
export async function getExerciseCount(query = '', filters = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const searchQuery = prepareSearchQuery(query);
    let sql, params = [];
    
    if (query.trim() && searchQuery === null) {
      sql = `
        SELECT COUNT(*) as count FROM exercises e
        WHERE (UPPER(e.title) LIKE UPPER(?) OR UPPER(e.chapter) LIKE UPPER(?) OR UPPER(e.theme) LIKE UPPER(?) OR UPPER(e.module) LIKE UPPER(?))
      `;
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery, likeQuery);
    } else if (searchQuery) {
      sql = `
        SELECT COUNT(*) as count FROM exercises e JOIN fts_exercises fts ON e.uuid = fts.uuid
        WHERE fts_exercises MATCH ?
      `;
      params.push(searchQuery);
    } else {
      sql = 'SELECT COUNT(*) as count FROM exercises e WHERE 1=1';
    }
    
    // Mêmes filtres que dans searchExercises
    if (filters.subchapter) {
      sql += ' AND UPPER(e.subchapter) = UPPER(?)';
      params.push(filters.subchapter);
      
      if (filters.chapter) {
        sql += ' AND UPPER(e.chapter) = UPPER(?)';
        params.push(filters.chapter);
      }
    } else if (filters.chapter) {
      sql += ' AND UPPER(e.chapter) = UPPER(?)';
      params.push(filters.chapter);
    }
    
    if (filters.module) {
      sql += ' AND UPPER(e.module) = UPPER(?)';
      params.push(filters.module);
    }
    
    // MODIFIÉ : Filtre sur level au lieu de difficulty
    if (filters.level) {
      sql += ' AND UPPER(e.level) = UPPER(?)';
      params.push(filters.level);
    }
    
    // NOUVEAU : Filtre sur difficulty numérique
    if (filters.difficulty !== undefined && filters.difficulty !== null) {
      if (filters.difficulty === 'null' || filters.difficulty === '') {
        sql += ' AND e.difficulty IS NULL';
      } else {
        sql += ' AND e.difficulty = ?';
        params.push(parseInt(filters.difficulty, 10));
      }
    }
    
    if (filters.author) {
      sql += ' AND UPPER(e.author) = UPPER(?)';
      params.push(filters.author);
    }
    
    const result = db.prepare(sql).get(...params);
    return result.count;
    
  } catch (error) {
    console.error('Database error in getExerciseCount:', error);
    return 0;
  } finally {
    if (db) db.close();
  }
}

export async function getExerciseByUuid(uuid) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const exercise = db.prepare(`
      SELECT 
        uuid, title, chapter, subchapter, theme, level, difficulty, module,
        author, organization, video_id, created_at, updated_at, preview,
        content_json
      FROM exercises 
      WHERE uuid = ?
    `).get(uuid);
    
    if (!exercise) {
      return null;
    }
    
    if (exercise.content_json) {
      try {
        exercise.content = JSON.parse(exercise.content_json);
        delete exercise.content_json;
      } catch (err) {
        console.error('Failed to parse content JSON:', err);
        exercise.content = [];
      }
    }
    
    return exercise;
    
  } catch (error) {
    console.error('Database error in getExerciseByUuid:', error);
    throw new Error('Erreur de base de données');
  } finally {
    if (db) db.close();
  }
}

export async function getSimilarExercises(uuid, limit = 5) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    const reference = db.prepare('SELECT chapter, theme, level, difficulty, module FROM exercises WHERE uuid = ?').get(uuid);
    
    if (!reference) {
      return [];
    }
    
    const similar = db.prepare(`
      SELECT 
        uuid, title, chapter, theme, level, difficulty, module, author, preview
      FROM exercises 
      WHERE uuid != ? 
        AND (
          chapter = ? 
          OR theme = ? 
          OR level = ?
          OR difficulty = ?
          OR module = ?
        )
      ORDER BY 
        CASE 
          WHEN module = ? AND chapter = ? THEN 1
          WHEN chapter = ? AND theme = ? THEN 2
          WHEN module = ? THEN 3
          WHEN chapter = ? THEN 4
          WHEN level = ? THEN 5
          WHEN difficulty = ? THEN 6
          WHEN theme = ? THEN 7
          ELSE 8
        END,
        RANDOM()
      LIMIT ?
    `).all(
      uuid,
      reference.chapter, reference.theme, reference.level, reference.difficulty, reference.module,
      reference.module, reference.chapter,
      reference.chapter, reference.theme,
      reference.module,
      reference.chapter,
      reference.level,
      reference.difficulty,
      reference.theme,
      limit
    );
    
    return similar;
    
  } catch (error) {
    console.error('Database error in getSimilarExercises:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}

/**
 * FONCTION CORRIGÉE : Retourne la structure hiérarchique Level > Module > Chapitre > Sous-chapitre
 */
export async function getChapterStructure() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    // MODIFIÉ : Requête pour obtenir tous les groupements avec level au lieu de difficulty
    const query = `
      SELECT 
        level,
        module,
        chapter,
        subchapter,
        COUNT(*) as exerciseCount
      FROM exercises 
      WHERE 
        level IS NOT NULL 
        AND module IS NOT NULL 
        AND chapter IS NOT NULL
      GROUP BY level, module, chapter, subchapter
      ORDER BY 
        CASE 
          WHEN level LIKE 'L%' THEN CAST(SUBSTR(level, 2) AS INTEGER)
          WHEN level LIKE 'M%' THEN 100 + CAST(SUBSTR(level, 2) AS INTEGER)
          ELSE 1000 
        END,
        module,
        chapter,
        subchapter
    `;
    
    const rows = db.prepare(query).all();
    
    // Construire la hiérarchie
    const hierarchy = new Map();
    
    rows.forEach(row => {
      const level = row.level; // MODIFIÉ : level au lieu de difficulty
      const module = row.module;
      const chapter = row.chapter;
      const subchapter = row.subchapter;
      const count = row.exerciseCount;
      
      // Niveau (level)
      if (!hierarchy.has(level)) {
        hierarchy.set(level, {
          name: level,
          exerciseCount: 0,
          modules: new Map()
        });
      }
      
      const levelObj = hierarchy.get(level);
      levelObj.exerciseCount += count;
      
      // Module dans le niveau
      if (!levelObj.modules.has(module)) {
        levelObj.modules.set(module, {
          name: module,
          exerciseCount: 0,
          chapters: new Map()
        });
      }
      
      const moduleObj = levelObj.modules.get(module);
      moduleObj.exerciseCount += count;
      
      // Chapitre dans le module
      if (!moduleObj.chapters.has(chapter)) {
        moduleObj.chapters.set(chapter, {
          name: chapter,
          exerciseCount: 0,
          subchapters: new Map()
        });
      }
      
      const chapterObj = moduleObj.chapters.get(chapter);
      chapterObj.exerciseCount += count;
      
      // Sous-chapitre dans le chapitre (si existe)
      if (subchapter) {
        if (!chapterObj.subchapters.has(subchapter)) {
          chapterObj.subchapters.set(subchapter, {
            name: subchapter,
            exerciseCount: 0
          });
        }
        chapterObj.subchapters.get(subchapter).exerciseCount += count;
      }
    });
    
    // Convertir en arrays et trier
    const result = Array.from(hierarchy.entries()).map(([levelName, levelData]) => ({
      name: levelName,
      exerciseCount: levelData.exerciseCount,
      modules: Array.from(levelData.modules.entries()).map(([moduleName, moduleData]) => ({
        name: moduleName,
        exerciseCount: moduleData.exerciseCount,
        chapters: Array.from(moduleData.chapters.entries()).map(([chapterName, chapterData]) => ({
          name: chapterName,
          exerciseCount: chapterData.exerciseCount,
          subchapters: Array.from(chapterData.subchapters.entries()).map(([subName, subData]) => ({
            name: subName,
            exerciseCount: subData.exerciseCount
          })).sort((a, b) => a.name.localeCompare(b.name))
        })).sort((a, b) => a.name.localeCompare(b.name))
      })).sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => {
      // Tri intelligent des niveaux
      const getOrder = (level) => {
        if (level.startsWith('L')) return parseInt(level.substring(1)) || 0;
        if (level.startsWith('M')) return 100 + (parseInt(level.substring(1)) || 0);
        return 1000;
      };
      return getOrder(a.name) - getOrder(b.name);
    });
    
    console.log(`Chapter structure built: ${result.length} levels, ${rows.length} total combinations`);
    return result;
    
  } catch (error) {
    console.error('Error building chapter structure:', error);
    throw error;
  } finally {
    if (db) db.close();
  }
}

export async function getSuggestions(type = 'all', limit = 10) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    let query = '';
    
    switch (type) {
      case 'chapters':
        query = `
          SELECT DISTINCT chapter as value, COUNT(*) as count
          FROM exercises 
          WHERE chapter IS NOT NULL
          GROUP BY chapter 
          ORDER BY count DESC, chapter
          LIMIT ?
        `;
        break;
        
      case 'themes':
        query = `
          SELECT DISTINCT theme as value, COUNT(*) as count
          FROM exercises 
          WHERE theme IS NOT NULL
          GROUP BY theme 
          ORDER BY count DESC, theme
          LIMIT ?
        `;
        break;
        
      case 'authors':
        query = `
          SELECT DISTINCT author as value, COUNT(*) as count
          FROM exercises 
          WHERE author IS NOT NULL
          GROUP BY author 
          ORDER BY count DESC, author
          LIMIT ?
        `;
        break;
        
      case 'modules':
        query = `
          SELECT DISTINCT module as value, COUNT(*) as count
          FROM exercises 
          WHERE module IS NOT NULL AND TRIM(module) != ''
          GROUP BY module 
          ORDER BY count DESC, module
          LIMIT ?
        `;
        break;
        
      // MODIFIÉ : 'levels' utilise maintenant le champ 'level' au lieu de 'difficulty'
      case 'levels':
        query = `
          SELECT DISTINCT level as value, COUNT(*) as count
          FROM exercises 
          WHERE level IS NOT NULL AND TRIM(level) != ''
          GROUP BY level 
          ORDER BY 
            CASE 
              WHEN level LIKE 'L%' THEN 1
              WHEN level LIKE 'M%' THEN 2
              WHEN level LIKE 'D%' THEN 3
              ELSE 4
            END,
            level
          LIMIT ?
        `;
        break;
        
      // NOUVEAU : 'difficulties' pour les difficultés numériques 1-5
      case 'difficulties':
        query = `
          SELECT difficulty as value, COUNT(*) as count
          FROM exercises 
          WHERE difficulty IS NOT NULL
          GROUP BY difficulty 
          ORDER BY difficulty
          LIMIT ?
        `;
        break;
        
      default:
        query = `
          SELECT 'chapter' as type, chapter as value, COUNT(*) as count
          FROM exercises 
          WHERE chapter IS NOT NULL
          GROUP BY chapter 
          UNION ALL
          SELECT 'theme' as type, theme as value, COUNT(*) as count
          FROM exercises 
          WHERE theme IS NOT NULL
          GROUP BY theme 
          UNION ALL
          SELECT 'module' as type, module as value, COUNT(*) as count
          FROM exercises 
          WHERE module IS NOT NULL AND TRIM(module) != ''
          GROUP BY module
          UNION ALL
          SELECT 'level' as type, level as value, COUNT(*) as count
          FROM exercises 
          WHERE level IS NOT NULL AND TRIM(level) != ''
          GROUP BY level
          ORDER BY count DESC
          LIMIT ?
        `;
        break;
    }
    
    const results = db.prepare(query).all(limit);
    return results;
    
  } catch (error) {
    console.error('Database error in getSuggestions:', error);
    return [];
  } finally {
    if (db) db.close();
  }
}