// src/routes/browse/+page.server.js
import { getChapterStructure, searchExercises } from '$lib/db/queries.js';
import { getChapterMeta, getModuleMeta } from '$lib/browse-config.js';

// Transform level-first hierarchy → module-first hierarchy
// Input:  [{name: 'L1', modules: [{name: 'Analyse', chapters: [...]}]}]
// Output: [{name: 'Analyse', count, chapters: [{name, count, levels: {L1:n}, subchapters}]}]
function buildModuleHierarchy(structure) {
  const moduleMap = new Map();

  for (const levelNode of structure) {
    const levelName = levelNode.name;
    for (const mod of levelNode.modules) {
      if (!moduleMap.has(mod.name)) {
        moduleMap.set(mod.name, { name: mod.name, chapters: new Map() });
      }
      const moduleEntry = moduleMap.get(mod.name);

      for (const ch of mod.chapters) {
        if (!moduleEntry.chapters.has(ch.name)) {
          moduleEntry.chapters.set(ch.name, {
            name: ch.name,
            count: 0,
            levels: {},
            subchapters: [],
          });
        }
        const chEntry = moduleEntry.chapters.get(ch.name);
        chEntry.count += ch.exerciseCount;
        chEntry.levels[levelName] = (chEntry.levels[levelName] || 0) + ch.exerciseCount;

        for (const sub of ch.subchapters) {
          const existing = chEntry.subchapters.find((s) => s.name === sub.name);
          if (existing) {
            existing.exerciseCount += sub.exerciseCount;
          } else {
            chEntry.subchapters.push({ name: sub.name, exerciseCount: sub.exerciseCount });
          }
        }
      }
    }
  }

  return Array.from(moduleMap.entries())
    .map(([name, data]) => {
      const chapters = Array.from(data.chapters.values())
        .sort((a, b) => b.count - a.count)
        .map((ch) => ({
          ...ch,
          ...getChapterMeta(ch.name),
          subchapters: ch.subchapters.sort((a, b) => b.exerciseCount - a.exerciseCount),
        }));

      return {
        name,
        count: chapters.reduce((s, c) => s + c.count, 0),
        chapters,
        ...getModuleMeta(name),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export async function load({ url }) {
  const chapterParam = url.searchParams.get('chapter') ?? '';

  let programme = [];
  let exercises = [];
  let currentChapterData = null;

  try {
    const structure = await getChapterStructure();
    programme = buildModuleHierarchy(structure);
  } catch (err) {
    console.error('[browse] Failed to load chapter structure:', err);
  }

  if (chapterParam) {
    // Find chapter metadata from programme
    for (const mod of programme) {
      const found = mod.chapters.find(
        (c) => c.name.toLowerCase() === chapterParam.toLowerCase()
      );
      if (found) {
        currentChapterData = { ...found, moduleName: mod.name };
        break;
      }
    }

    // Fetch exercises for this chapter
    try {
      exercises = await searchExercises('', { chapter: chapterParam }, { limit: 100 });
    } catch (err) {
      console.error('[browse] Failed to load exercises for chapter:', chapterParam, err);
    }
  }

  return {
    programme,
    chapter: chapterParam || null,
    currentChapterData,
    exercises,
  };
}
