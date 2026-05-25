import {
  getChapterStructure,
  getContextualFilterCounts,
  getExerciseCount,
  searchExercises
} from '$lib/db/queries.js';

const MAX_RESULTS = 100;

const SORTS = new Set(['title', 'level', 'module', 'author', 'difficulty', 'created', 'updated']);
const ORDERS = new Set(['asc', 'desc']);

function cleanParam(url, key) {
  return url.searchParams.get(key)?.trim() || '';
}

function getSelection(url) {
  return {
    level: cleanParam(url, 'level'),
    module: cleanParam(url, 'module'),
    chapter: cleanParam(url, 'chapter'),
    subchapter: cleanParam(url, 'subchapter')
  };
}

function hasSelection(selection) {
  return Boolean(selection.level || selection.module || selection.chapter || selection.subchapter);
}

function getLevelOrder(value) {
  if (!value) return 1000;
  const label = String(value).trim().toUpperCase();
  if (label === 'PCSI') return -1;
  if (label.startsWith('L')) return parseInt(label.slice(1), 10) || 0;
  if (label.startsWith('M')) return 100 + (parseInt(label.slice(1), 10) || 0);
  return 1000;
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'fr', {
    numeric: true,
    sensitivity: 'base'
  });
}

function compareDate(a, b) {
  const da = a ? new Date(a).getTime() : 0;
  const db = b ? new Date(b).getTime() : 0;
  return da - db;
}

function sortExercisesForBrowse(exercises, sortBy, sortOrder) {
  const direction = sortOrder === 'desc' ? -1 : 1;

  return [...exercises].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'level') {
      comparison = getLevelOrder(a.level) - getLevelOrder(b.level) || compareText(a.level, b.level);
    } else if (sortBy === 'module') {
      comparison = compareText(a.module, b.module);
    } else if (sortBy === 'author') {
      comparison = compareText(a.author, b.author);
    } else if (sortBy === 'difficulty') {
      const da = a.difficulty ?? Number.POSITIVE_INFINITY;
      const db = b.difficulty ?? Number.POSITIVE_INFINITY;
      comparison = da - db;
    } else if (sortBy === 'created') {
      comparison = compareDate(a.created_at, b.created_at);
    } else if (sortBy === 'updated') {
      comparison = compareDate(a.updated_at, b.updated_at);
    } else {
      comparison = compareText(a.title, b.title);
    }

    return direction * (comparison || compareText(a.title, b.title));
  });
}

function getStats(exercises) {
  const byDifficulty = {};
  const byLevel = {};
  const byModule = {};
  const authors = {};

  for (const exercise of exercises) {
    if (exercise.difficulty !== null && exercise.difficulty !== undefined && exercise.difficulty !== '') {
      const key = String(exercise.difficulty);
      byDifficulty[key] = (byDifficulty[key] || 0) + 1;
    }
    if (exercise.level) byLevel[exercise.level] = (byLevel[exercise.level] || 0) + 1;
    if (exercise.module) byModule[exercise.module] = (byModule[exercise.module] || 0) + 1;
    if (exercise.author) authors[exercise.author] = (authors[exercise.author] || 0) + 1;
  }

  return {
    byDifficulty,
    byLevel,
    byModule,
    authors: Object.entries(authors)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || compareText(a.name, b.name))
      .slice(0, 6)
  };
}

function getStatsFromCounts(counts = {}) {
  return {
    byDifficulty: Object.fromEntries(
      Object.entries(counts.difficulty || {}).filter(([value]) => value !== 'null' && value !== '0')
    ),
    byLevel: counts.level || {},
    byModule: counts.module || {},
    authors: Object.entries(counts.author || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || compareText(a.name, b.name))
      .slice(0, 6)
  };
}

function getDbSort(sortBy, sortOrder) {
  if (sortBy === 'created') return sortOrder === 'asc' ? 'created_asc' : 'created_desc';
  if (sortBy === 'updated') return sortOrder === 'asc' ? 'updated_asc' : 'updated_desc';
  if (sortBy === 'difficulty') return sortOrder === 'asc' ? 'difficulty_asc' : 'difficulty_desc';
  return '';
}

export async function load({ url }) {
  const selection = getSelection(url);
  const selected = hasSelection(selection);
  const requestedSort = cleanParam(url, 'sort');
  const requestedOrder = cleanParam(url, 'order');
  const sortBy = SORTS.has(requestedSort) ? requestedSort : 'title';
  const sortOrder = ORDERS.has(requestedOrder) ? requestedOrder : 'asc';

  try {
    const structure = await getChapterStructure();
    let exercises = [];
    let totalCount = 0;
    let hasMore = false;
    let stats = getStats([]);

    if (selected) {
      const filters = Object.fromEntries(
        Object.entries(selection).filter(([, value]) => Boolean(value))
      );

      const rawResults = await searchExercises('', filters, {
        limit: MAX_RESULTS + 1,
        offset: 0,
        sort: getDbSort(sortBy, sortOrder)
      });

      totalCount = await getExerciseCount('', filters);
      const filterCounts = await getContextualFilterCounts('', filters);
      hasMore = rawResults.length > MAX_RESULTS;
      exercises = sortExercisesForBrowse(rawResults.slice(0, MAX_RESULTS), sortBy, sortOrder);
      stats = getStatsFromCounts(filterCounts);
    }

    return {
      structure,
      selection,
      selected,
      exercises,
      totalCount,
      hasMore,
      maxResults: MAX_RESULTS,
      stats,
      sortBy,
      sortOrder,
      error: null
    };
  } catch (err) {
    console.error('Browse page load failed:', err);
    return {
      structure: [],
      selection,
      selected,
      exercises: [],
      totalCount: 0,
      hasMore: false,
      maxResults: MAX_RESULTS,
      stats: getStats([]),
      sortBy,
      sortOrder,
      error: 'Impossible de charger la navigation des exercices.'
    };
  }
}
