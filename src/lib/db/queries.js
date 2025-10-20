// src/lib/db/queries.js - Version corrigée avec recherche insensible à la casse ET preview
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve('data/exercises.sqlite');

function prepareSearchQuery(query) {
  if (!query || query.trim() === '') return '';

  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/["']/g, ''))
    // Nettoyer les caractères spéciaux qui cassent la syntaxe MATCH (parenthèses, etc.)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean);

  // Garder uniquement les tokens significatifs (≥3) pour FTS
  const longTokens = tokens.filter((t) => t.length >= 3);
  if (longTokens.length === 0) return null;

  // Construire une requête FTS en AND (ordre libre), préfixe sur TOUS les mots
  // En FTS5, les espaces équivalent à AND
  const parts = longTokens.map((t) => `${t}*`);
  return parts.join(' ');
}

function escapeLikePattern(value) {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function buildAuthorFilterClause(authorValue, tableAlias = 'e', includeLeadingAnd = true) {
  const trimmed = (authorValue ?? '').trim();
  if (!trimmed) {
    return { clause: '', params: [] };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const directLike = `%${escapeLikePattern(trimmed)}%`;
  const tokenLikes = tokens.map((token) => `%${escapeLikePattern(token)}%`);

  const buildColumnClause = (column) => {
    const clauses = [`UPPER(${column}) LIKE UPPER(?) ESCAPE '\\'`];
    const params = [directLike];

    if (tokens.length > 1) {
      const tokenClause = tokens
        .map(() => `UPPER(${column}) LIKE UPPER(?) ESCAPE '\\'`)
        .join(' AND ');
      clauses.push(`(${tokenClause})`);
      params.push(...tokenLikes);
    }

    return {
      clause: clauses.length > 1 ? `(${clauses.join(' OR ')})` : clauses[0],
      params
    };
  };

  const conditions = [];
  const params = [];

  const displayMatch = buildColumnClause('ea.author_display');
  if (displayMatch.clause) {
    conditions.push(`(ea.author_display IS NOT NULL AND ${displayMatch.clause})`);
    params.push(...displayMatch.params);
  }

  const pseudoMatch = buildColumnClause('ea.author_pseudo');
  if (pseudoMatch.clause) {
    conditions.push(`(ea.author_pseudo IS NOT NULL AND ${pseudoMatch.clause})`);
    params.push(...pseudoMatch.params);
  }

  if (conditions.length === 0) {
    return { clause: '', params: [] };
  }

  const clauseBody = `EXISTS (
    SELECT 1 FROM exercise_authors ea
    WHERE ea.uuid = ${tableAlias}.uuid
      AND (${conditions.join(' OR ')})
  )`;

  const clause = includeLeadingAnd ? ` AND ${clauseBody}` : clauseBody;

  return { clause, params };
}

function buildSearchContext(query = '', filters = {}, sortOption = null) {
  const trimmedQuery = (query || '').trim();
  const ftsQuery = prepareSearchQuery(trimmedQuery);
  const useFts = Boolean(ftsQuery);
  const useFallback = Boolean(trimmedQuery) && ftsQuery === null;

  const safeFilters = filters || {};
  const requestedSort = sortOption ?? safeFilters.sort ?? '';
  const normalizedSort = typeof requestedSort === 'string' ? requestedSort.trim() : '';
  const allowedSorts = new Set([
    'updated_desc',
    'updated_asc',
    'created_desc',
    'created_asc',
    'difficulty_asc',
    'difficulty_desc'
  ]);
  const effectiveSort = allowedSorts.has(normalizedSort) ? normalizedSort : '';

  const filterValues = { ...safeFilters };
  delete filterValues.sort;
  delete filterValues.sortDirection;

  let fromClause = 'FROM exercises e';
  const whereClauses = [];
  const params = [];

  if (useFts) {
    fromClause = 'FROM exercises e JOIN fts_exercises fts ON e.uuid = fts.uuid';
    whereClauses.push('fts_exercises MATCH ?');
    params.push(ftsQuery);
  } else {
    whereClauses.push('1=1');
  }

  if (useFallback) {
    const words = trimmedQuery.split(/\s+/).filter(Boolean);
    words.forEach((word) => {
      whereClauses.push(`(
        UPPER(e.title) LIKE UPPER(?) OR 
        UPPER(e.chapter) LIKE UPPER(?) OR 
        UPPER(e.theme) LIKE UPPER(?) OR 
        UPPER(e.module) LIKE UPPER(?) OR 
        UPPER(e.uuid) LIKE UPPER(?)
      )`);
      const like = `%${word}%`;
      params.push(like, like, like, like, like);
    });
  }

  if (filterValues.subchapter) {
    whereClauses.push('UPPER(e.subchapter) = UPPER(?)');
    params.push(filterValues.subchapter);

    if (filterValues.chapter) {
      whereClauses.push('UPPER(e.chapter) = UPPER(?)');
      params.push(filterValues.chapter);
    }
  } else if (filterValues.chapter) {
    whereClauses.push('UPPER(e.chapter) = UPPER(?)');
    params.push(filterValues.chapter);
  }

  if (filterValues.module) {
    whereClauses.push('UPPER(e.module) = UPPER(?)');
    params.push(filterValues.module);
  }

  if (filterValues.level) {
    whereClauses.push('UPPER(e.level) = UPPER(?)');
    params.push(filterValues.level);
  }

  if (filterValues.difficulty !== undefined && filterValues.difficulty !== null && filterValues.difficulty !== '') {
    if (filterValues.difficulty === 'null' || filterValues.difficulty === 'NULL') {
      whereClauses.push('e.difficulty IS NULL');
    } else {
      whereClauses.push('e.difficulty = ?');
      params.push(parseInt(filterValues.difficulty, 10));
    }
  }

  if (filterValues.author) {
    const { clause, params: authorParams } = buildAuthorFilterClause(filterValues.author, 'e', false);
    if (clause) {
      whereClauses.push(clause);
      params.push(...authorParams);
    }
  }

  if (typeof filterValues.hasSolution === 'boolean') {
    whereClauses.push('e.hasSolution = ?');
    params.push(filterValues.hasSolution ? 1 : 0);
  }

  if (typeof filterValues.hasIndication === 'boolean') {
    whereClauses.push('e.hasIndication = ?');
    params.push(filterValues.hasIndication ? 1 : 0);
  }

  if (filterValues.hasVideo !== undefined && filterValues.hasVideo !== null && filterValues.hasVideo !== '') {
    let wantsVideo = filterValues.hasVideo;
    if (typeof wantsVideo !== 'boolean') {
      const normalized = String(wantsVideo).toLowerCase();
      wantsVideo = normalized === '1' || normalized === 'true';
    }

    if (wantsVideo) {
      whereClauses.push("(e.video_id IS NOT NULL AND TRIM(e.video_id) != '')");
    } else {
      whereClauses.push("(e.video_id IS NULL OR TRIM(e.video_id) = '')");
    }
  }

  const selectBase = `SELECT e.uuid, e.title, e.chapter, e.subchapter, e.theme, e.level, e.difficulty, e.module, e.author, e.organization, e.license_code, e.license_url, e.video_id, e.created_at, e.updated_at, e.preview,
                e.hasIndication, e.hasSolution`;

  const selectClause = useFts
    ? `${selectBase},
                bm25(fts_exercises) as rank`
    : selectBase;

  let orderClause;
  if (effectiveSort === 'updated_desc') {
    orderClause = 'ORDER BY e.updated_at DESC, e.created_at DESC';
  } else if (effectiveSort === 'updated_asc') {
    orderClause = 'ORDER BY e.updated_at ASC, e.created_at ASC';
  } else if (effectiveSort === 'created_desc') {
    orderClause = 'ORDER BY e.created_at DESC';
  } else if (effectiveSort === 'created_asc') {
    orderClause = 'ORDER BY e.created_at ASC';
  } else if (effectiveSort === 'difficulty_asc') {
    orderClause = 'ORDER BY (e.difficulty IS NULL) ASC, e.difficulty ASC, e.created_at DESC';
  } else if (effectiveSort === 'difficulty_desc') {
    orderClause = 'ORDER BY (e.difficulty IS NULL) ASC, e.difficulty DESC, e.created_at DESC';
  } else if (useFts) {
    orderClause = 'ORDER BY rank';
  } else if (useFallback) {
    orderClause = 'ORDER BY e.title';
  } else {
    orderClause = 'ORDER BY e.created_at DESC';
  }

  if (useFts && effectiveSort) {
    orderClause = `${orderClause}, rank`;
  }

  return {
    selectClause,
    fromClause,
    whereClause: whereClauses.join('\n  AND '),
    params,
    orderClause,
    useFts,
    useFallback
  };
}

/**
 * Recherche d'exercices avec filtres (version améliorée avec level/difficulty + preview)
 */
export async function searchExercises(query = '', filters = {}, options = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });

    const { limit = 20, offset = 0, sort = '' } = options;
    const context = buildSearchContext(query, filters, sort);

    const sql = `
      ${context.selectClause}
      ${context.fromClause}
      WHERE ${context.whereClause}
      ${context.orderClause}
      LIMIT ? OFFSET ?
    `;
    const params = [...context.params, limit, offset];

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

    const context = buildSearchContext(query, filters);
    const sql = `
      SELECT COUNT(*) as count
      ${context.fromClause}
      WHERE ${context.whereClause}
    `;

    const result = db.prepare(sql).get(...context.params);
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
        author, organization, license_code, license_url,
        video_id, created_at, updated_at, preview,
        hasIndication, hasSolution,
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
        uuid, title, chapter, theme, level, difficulty, module, author, preview,
        hasIndication, hasSolution
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
        if (!level) return 1000;
        if (level === 'PCSI') return -1;
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

/**
 * Version filtrée: construit la hiérarchie en appliquant une requête texte et des filtres.
 */
export async function getChapterStructureFiltered(query = '', filters = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });

    // Construire les clauses WHERE en reprenant la logique de recherche
    let baseWhere = '1=1';
    let params = [];

    // Gestion de la requête texte: FTS si dispo (même logique que searchExercises), sinon LIKE multi-mots
    if ((query || '').trim()) {
      let hasFts = false;
      try {
        const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fts_exercises'").get();
        hasFts = !!row;
      } catch (_) { hasFts = false; }

      const sq = prepareSearchQuery(query);
      if (sq && hasFts) {
        baseWhere += ` AND e.uuid IN (SELECT uuid FROM fts_exercises WHERE fts_exercises MATCH ?)`;
        params.push(sq);
      } else {
        const words = query.trim().split(/\s+/).filter(Boolean);
        words.forEach((w) => {
          baseWhere += ` AND (
            UPPER(e.title) LIKE UPPER(?) OR 
            UPPER(e.chapter) LIKE UPPER(?) OR 
            UPPER(e.theme) LIKE UPPER(?) OR 
            UPPER(e.module) LIKE UPPER(?) OR 
            UPPER(e.uuid) LIKE UPPER(?)
          )`;
          const like = `%${w}%`;
          params.push(like, like, like, like, like);
        });
      }
    }

    // Filtres exacts optionnels (insensibles à la casse sur texte)
    if (filters.subchapter) {
      baseWhere += ' AND UPPER(e.subchapter) = UPPER(?)';
      params.push(filters.subchapter);
      if (filters.chapter) {
        baseWhere += ' AND UPPER(e.chapter) = UPPER(?)';
        params.push(filters.chapter);
      }
    } else if (filters.chapter) {
      baseWhere += ' AND UPPER(e.chapter) = UPPER(?)';
      params.push(filters.chapter);
    }
    if (filters.module) {
      baseWhere += ' AND UPPER(e.module) = UPPER(?)';
      params.push(filters.module);
    }
    if (filters.level) {
      baseWhere += ' AND UPPER(e.level) = UPPER(?)';
      params.push(filters.level);
    }
    if (filters.difficulty !== undefined && filters.difficulty !== null && filters.difficulty !== '') {
      if (filters.difficulty === 'null' || filters.difficulty === 'NULL') {
        baseWhere += ' AND e.difficulty IS NULL';
      } else {
        baseWhere += ' AND e.difficulty = ?';
        params.push(parseInt(filters.difficulty, 10));
      }
    }
    if (filters.author) {
      const { clause, params: authorParams } = buildAuthorFilterClause(filters.author, 'e');
      baseWhere += clause;
      params.push(...authorParams);
    }
    if (filters.hasSolution === '1' || filters.hasSolution === 1 || filters.hasSolution === true) {
      baseWhere += ' AND e.hasSolution = 1';
    } else if (filters.hasSolution === '0' || filters.hasSolution === 0 || filters.hasSolution === false) {
      baseWhere += ' AND e.hasSolution = 0';
    }
    if (filters.hasIndication === '1' || filters.hasIndication === 1 || filters.hasIndication === true) {
      baseWhere += ' AND e.hasIndication = 1';
    } else if (filters.hasIndication === '0' || filters.hasIndication === 0 || filters.hasIndication === false) {
      baseWhere += ' AND e.hasIndication = 0';
    }
    if (filters.hasVideo !== undefined && filters.hasVideo !== null && filters.hasVideo !== '') {
      let wantsVideo = filters.hasVideo;
      if (typeof wantsVideo !== 'boolean') {
        const normalized = String(wantsVideo).toLowerCase();
        wantsVideo = normalized === '1' || normalized === 'true';
      }

      if (wantsVideo) {
        baseWhere += " AND (e.video_id IS NOT NULL AND TRIM(e.video_id) != '')";
      } else {
        baseWhere += " AND (e.video_id IS NULL OR TRIM(e.video_id) = '')";
      }
    }

    const sql = `
      SELECT 
        e.level,
        e.module,
        e.chapter,
        e.subchapter,
        COUNT(*) as exerciseCount
      FROM exercises e
      WHERE ${baseWhere}
        AND e.level IS NOT NULL 
        AND e.module IS NOT NULL 
        AND e.chapter IS NOT NULL
      GROUP BY e.level, e.module, e.chapter, e.subchapter
    `;

    const rows = db.prepare(sql).all(...params);

    // Reprise de la construction hiérarchique depuis getChapterStructure
    const hierarchy = new Map();
    rows.forEach((row) => {
      const level = row.level;
      const module = row.module;
      const chapter = row.chapter;
      const subchapter = row.subchapter;
      const count = row.exerciseCount;

      if (!hierarchy.has(level)) {
        hierarchy.set(level, { name: level, exerciseCount: 0, modules: new Map() });
      }
      const levelObj = hierarchy.get(level);
      levelObj.exerciseCount += count;

      if (!levelObj.modules.has(module)) {
        levelObj.modules.set(module, { name: module, exerciseCount: 0, chapters: new Map() });
      }
      const moduleObj = levelObj.modules.get(module);
      moduleObj.exerciseCount += count;

      if (!moduleObj.chapters.has(chapter)) {
        moduleObj.chapters.set(chapter, { name: chapter, exerciseCount: 0, subchapters: new Map() });
      }
      const chapterObj = moduleObj.chapters.get(chapter);
      chapterObj.exerciseCount += count;

      if (subchapter) {
        if (!chapterObj.subchapters.has(subchapter)) {
          chapterObj.subchapters.set(subchapter, { name: subchapter, exerciseCount: 0 });
        }
        chapterObj.subchapters.get(subchapter).exerciseCount += count;
      }
    });

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
      const getOrder = (level) => {
        if (!level) return 1000;
        if (level === 'PCSI') return -1;
        if (level.startsWith('L')) return parseInt(level.substring(1)) || 0;
        if (level.startsWith('M')) return 100 + (parseInt(level.substring(1)) || 0);
        return 1000;
      };
      return getOrder(a.name) - getOrder(b.name);
    });

    return result;
  } catch (error) {
    console.error('Error building filtered chapter structure:', error);
    throw error;
  } finally {
    if (db) db.close();
  }
}

export async function getFilterCounts(query = '', filters = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });

    const context = buildSearchContext(query, filters);

    const baseFromWhere = `
      ${context.fromClause}
      WHERE ${context.whereClause}
    `;

    const moduleRows = db.prepare(`
      SELECT e.module as value, COUNT(*) as count
      ${baseFromWhere}
        AND e.module IS NOT NULL AND TRIM(e.module) != ''
      GROUP BY e.module
    `).all(...context.params);

    const levelRows = db.prepare(`
      SELECT e.level as value, COUNT(*) as count
      ${baseFromWhere}
        AND e.level IS NOT NULL AND TRIM(e.level) != ''
      GROUP BY e.level
    `).all(...context.params);

    const difficultyRows = db.prepare(`
      SELECT e.difficulty as value, COUNT(*) as count
      ${baseFromWhere}
      GROUP BY e.difficulty
    `).all(...context.params);

    const authorRows = db.prepare(`
      SELECT e.author as value, COUNT(*) as count
      ${baseFromWhere}
        AND e.author IS NOT NULL AND TRIM(e.author) != ''
      GROUP BY e.author
    `).all(...context.params);

    const toMap = (rows, transformValue = (v) => v) => {
      const map = {};
      rows.forEach(({ value, count }) => {
        const key = transformValue(value);
        if (key === null || key === undefined) return;
        if (String(key).trim() === '') return;
        map[key] = count;
      });
      return map;
    };

    return {
      module: toMap(moduleRows, (v) => v),
      level: toMap(levelRows, (v) => v),
      difficulty: toMap(difficultyRows, (v) => (v === null || v === undefined ? 'null' : String(v))),
      author: toMap(authorRows, (v) => v)
    };

  } catch (error) {
    console.error('Database error in getFilterCounts:', error);
    return {
      module: {},
      level: {},
      difficulty: {},
      author: {}
    };
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
          SELECT author_display as value, COUNT(*) as count
          FROM exercise_authors 
          WHERE author_display IS NOT NULL AND TRIM(author_display) != ''
          GROUP BY author_display 
          ORDER BY count DESC, author_display
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
              WHEN level = 'PCSI' THEN 0
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

// Fonction à ajouter dans src/lib/db/queries.js

/**
 * Récupère uniquement les métadonnées d'un exercice (sans le contenu complet)
 * Optimisé pour les listes et prévisualisations
 */
export async function getExerciseMetadata(uuid) {
  let db;
  try {
    db = openDatabase();
    
    // Requête optimisée : sélectionner uniquement les champs métadonnées
    const stmt = db.prepare(`
      SELECT 
        uuid,
        title,
        chapter,
        theme,
        author,
        difficulty,
        level,
        module,
        -- Vérifier si l'exercice a du contenu sans le charger
        CASE 
          WHEN content IS NOT NULL AND content != '' AND content != '[]' 
          THEN 1 
          ELSE 0 
        END as has_content,
        created_at,
        updated_at
      FROM exercises 
      WHERE uuid = ?
      LIMIT 1
    `);
    
    const exercise = stmt.get(uuid);
    
    if (!exercise) {
      return null;
    }
    
    // Formater la réponse
    return {
      uuid: exercise.uuid,
      title: exercise.title || `Exercice ${exercise.uuid.slice(0, 8)}...`,
      chapter: exercise.chapter,
      theme: exercise.theme,
      author: exercise.author,
      difficulty: exercise.difficulty,
      level: exercise.level,
      module: exercise.module,
      hasContent: !!exercise.has_content,
      createdAt: exercise.created_at,
      updatedAt: exercise.updated_at
    };
    
  } catch (error) {
    console.error('Database error in getExerciseMetadata:', error);
    throw error;
  } finally {
    if (db) {
      try {
        db.close();
      } catch (closeError) {
        console.warn('Error closing database:', closeError);
      }
    }
  }
}

// Ajout dans queries.js

/**
 * Calcule les comptages contextuels pour chaque filtre
 * Chaque filtre montre combien d'exercices sont disponibles en tenant compte des autres filtres actifs
 */
export async function getContextualFilterCounts(query = '', filters = {}) {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });

    const results = {
      module: {},
      level: {},
      difficulty: {},
      author: {}
    };

    // Pour chaque type de filtre, on calcule les comptages en excluant ce filtre spécifique
    const filterTypes = ['module', 'level', 'difficulty', 'author'];

    for (const excludeFilter of filterTypes) {
      // Créer une copie des filtres en excluant le filtre actuel
      const contextFilters = { ...filters };
      delete contextFilters[excludeFilter];

      // Construire le contexte de recherche sans ce filtre
      const context = buildSearchContext(query, contextFilters);

      let countQuery = '';
      let groupBy = '';
      let additionalWhere = '';

      switch (excludeFilter) {
        case 'module':
          countQuery = 'e.module as value';
          groupBy = 'e.module';
          additionalWhere = 'AND e.module IS NOT NULL AND TRIM(e.module) != \'\'';
          break;

        case 'level':
          countQuery = 'e.level as value';
          groupBy = 'e.level';
          additionalWhere = 'AND e.level IS NOT NULL AND TRIM(e.level) != \'\'';
          break;

        case 'difficulty':
          countQuery = 'e.difficulty as value';
          groupBy = 'e.difficulty';
          additionalWhere = ''; // On inclut les NULL
          break;

        case 'author':
          // Pour les auteurs, on doit joindre avec exercise_authors
          countQuery = 'ea.author_display as value';
          groupBy = 'ea.author_display';
          additionalWhere = 'AND ea.author_display IS NOT NULL AND TRIM(ea.author_display) != \'\'';
          break;
      }

      // Construire la requête SQL
      let sql;
      let params = [...context.params];

      if (excludeFilter === 'author') {
        // Cas spécial pour les auteurs avec jointure
        sql = `
          SELECT ${countQuery}, COUNT(DISTINCT e.uuid) as count
          ${context.fromClause}
          LEFT JOIN exercise_authors ea ON ea.uuid = e.uuid
          WHERE ${context.whereClause}
            ${additionalWhere}
          GROUP BY ${groupBy}
        `;
      } else {
        sql = `
          SELECT ${countQuery}, COUNT(*) as count
          ${context.fromClause}
          WHERE ${context.whereClause}
            ${additionalWhere}
          GROUP BY ${groupBy}
        `;
      }

      try {
        const rows = db.prepare(sql).all(...params);
        
        // Transformer les résultats
        rows.forEach(({ value, count }) => {
          let key = value;
          
          // Traitement spécial pour difficulty
          if (excludeFilter === 'difficulty') {
            key = (value === null || value === undefined) ? 'null' : String(value);
          }
          
          if (key !== null && key !== undefined && String(key).trim() !== '') {
            results[excludeFilter][key] = count;
          }
        });

      } catch (err) {
        console.warn(`Error counting ${excludeFilter}:`, err);
        results[excludeFilter] = {};
      }
    }

    return results;

  } catch (error) {
    console.error('Database error in getContextualFilterCounts:', error);
    return {
      module: {},
      level: {},
      difficulty: {},
      author: {}
    };
  } finally {
    if (db) db.close();
  }
}
