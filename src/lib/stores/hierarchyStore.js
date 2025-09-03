// src/lib/stores/hierarchyStore.js
import { writable, derived } from 'svelte/store';

// État de base de la hiérarchie
export const hierarchyStructure = writable([]);
export const hierarchyLoading = writable(true);
export const hierarchyError = writable(null);

// États d'expansion (pour les composants de navigation)
export const expandedLevels = writable(new Set());
export const expandedModules = writable(new Set());
export const expandedChapters = writable(new Set());

// Sélection actuelle dans la hiérarchie
export const selectedPath = writable({
  level: null,
  module: null,
  chapter: null,
  subchapter: null
});

// États dérivés utiles
export const levelCount = derived(
  hierarchyStructure,
  ($structure) => $structure.length
);

export const moduleCount = derived(
  hierarchyStructure,
  ($structure) => $structure.reduce((total, level) => total + level.modules.length, 0)
);

export const chapterCount = derived(
  hierarchyStructure,
  ($structure) => $structure.reduce((total, level) => 
    total + level.modules.reduce((moduleTotal, module) => 
      moduleTotal + module.chapters.length, 0
    ), 0)
);

export const totalExerciseCount = derived(
  hierarchyStructure,
  ($structure) => $structure.reduce((total, level) => total + (level.exerciseCount || 0), 0)
);

// Breadcrumb de la sélection actuelle
export const selectionBreadcrumb = derived(
  selectedPath,
  ($path) => {
    const breadcrumb = [];
    
    if ($path.level) {
      breadcrumb.push({ type: 'level', name: $path.level, icon: '🎓' });
    }
    
    if ($path.module) {
      breadcrumb.push({ type: 'module', name: $path.module, icon: '📖' });
    }
    
    if ($path.chapter) {
      breadcrumb.push({ type: 'chapter', name: $path.chapter, icon: '📚' });
    }
    
    if ($path.subchapter) {
      breadcrumb.push({ type: 'subchapter', name: $path.subchapter, icon: '📄' });
    }
    
    return breadcrumb;
  }
);

// Actions pour gérer la hiérarchie
export const hierarchyActions = {
  // Charger la structure hiérarchique
  async loadHierarchy() {
    hierarchyLoading.set(true);
    hierarchyError.set(null);

    try {
      const response = await fetch('/api/chapters?type=structure');
      
      if (response.ok) {
        const data = await response.json();
        hierarchyStructure.set(data.structure || []);
      } else {
        hierarchyError.set('Impossible de charger la structure');
      }
    } catch (err) {
      hierarchyError.set('Erreur de connexion');
      console.error('Failed to load hierarchy:', err);
    } finally {
      hierarchyLoading.set(false);
    }
  },

  // Basculer l'expansion d'un niveau
  toggleLevel(levelName) {
    expandedLevels.update(current => {
      const newSet = new Set(current);
      if (newSet.has(levelName)) {
        newSet.delete(levelName);
      } else {
        newSet.add(levelName);
      }
      return newSet;
    });
  },

  // Basculer l'expansion d'un module
  toggleModule(levelName, moduleName) {
    const key = `${levelName}-${moduleName}`;
    expandedModules.update(current => {
      const newSet = new Set(current);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  },

  // Basculer l'expansion d'un chapitre
  toggleChapter(levelName, moduleName, chapterName) {
    const key = `${levelName}-${moduleName}-${chapterName}`;
    expandedChapters.update(current => {
      const newSet = new Set(current);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  },

  // Sélectionner un chemin dans la hiérarchie
  selectPath(level = null, module = null, chapter = null, subchapter = null) {
    selectedPath.set({ level, module, chapter, subchapter });
    
    // Auto-expand basé sur la sélection
    if (level) {
      expandedLevels.update(current => new Set([...current, level]));
    }
    if (module) {
      expandedModules.update(current => new Set([...current, `${level}-${module}`]));
    }
    if (chapter) {
      expandedChapters.update(current => new Set([...current, `${level}-${module}-${chapter}`]));
    }
  },

  // Effacer la sélection
  clearSelection() {
    selectedPath.set({ level: null, module: null, chapter: null, subchapter: null });
  },

  // Développer tout
  expandAll() {
    let currentStructure;
    const unsubscribe = hierarchyStructure.subscribe(value => currentStructure = value);
    unsubscribe();

    const levels = new Set();
    const modules = new Set();
    const chapters = new Set();

    currentStructure.forEach(level => {
      levels.add(level.name);
      level.modules.forEach(module => {
        modules.add(`${level.name}-${module.name}`);
        module.chapters.forEach(chapter => {
          chapters.add(`${level.name}-${module.name}-${chapter.name}`);
        });
      });
    });

    expandedLevels.set(levels);
    expandedModules.set(modules);
    expandedChapters.set(chapters);
  },

  // Réduire tout
  collapseAll() {
    expandedLevels.set(new Set());
    expandedModules.set(new Set());
    expandedChapters.set(new Set());
  },

  // Synchroniser avec une sélection externe (ex: depuis des props)
  syncSelection({ level, module, chapter, subchapter }) {
    selectedPath.set({ level, module, chapter, subchapter });
    
    // Auto-expand
    if (level) expandedLevels.update(current => new Set([...current, level]));
    if (module) expandedModules.update(current => new Set([...current, `${level}-${module}`]));
    if (chapter) expandedChapters.update(current => new Set([...current, `${level}-${module}-${chapter}`]));
  }
};

// Utilitaires pour la hiérarchie
export const hierarchyUtils = {
  // Trouver un élément dans la hiérarchie
  findInHierarchy(structure, predicate) {
    for (const level of structure) {
      if (predicate(level, 'level')) return { level, type: 'level' };
      
      for (const module of level.modules) {
        if (predicate(module, 'module')) return { level, module, type: 'module' };
        
        for (const chapter of module.chapters) {
          if (predicate(chapter, 'chapter')) return { level, module, chapter, type: 'chapter' };
          
          for (const subchapter of chapter.subchapters || []) {
            if (predicate(subchapter, 'subchapter')) {
              return { level, module, chapter, subchapter, type: 'subchapter' };
            }
          }
        }
      }
    }
    return null;
  },

  // Obtenir le chemin complet vers un élément
  getPathTo(structure, targetName, targetType) {
    const result = hierarchyUtils.findInHierarchy(structure, (item, type) => 
      type === targetType && item.name === targetName
    );
    
    if (result) {
      return {
        level: result.level?.name,
        module: result.module?.name,
        chapter: result.chapter?.name,
        subchapter: result.subchapter?.name
      };
    }
    
    return null;
  },

  // Obtenir tous les chapitres dans une liste plate
  getFlatChapterList(structure) {
    const chapters = [];
    
    structure.forEach(level => {
      level.modules.forEach(module => {
        module.chapters.forEach(chapter => {
          chapters.push({
            ...chapter,
            levelName: level.name,
            moduleName: module.name,
            fullPath: `${level.name} › ${module.name} › ${chapter.name}`
          });
        });
      });
    });
    
    return chapters;
  },

  // Obtenir les statistiques de la hiérarchie
  getHierarchyStats(structure) {
    let totalLevels = structure.length;
    let totalModules = 0;
    let totalChapters = 0;
    let totalSubchapters = 0;
    let totalExercises = 0;

    structure.forEach(level => {
      totalModules += level.modules.length;
      totalExercises += level.exerciseCount || 0;
      
      level.modules.forEach(module => {
        totalChapters += module.chapters.length;
        
        module.chapters.forEach(chapter => {
          totalSubchapters += (chapter.subchapters || []).length;
        });
      });
    });

    return {
      levels: totalLevels,
      modules: totalModules,
      chapters: totalChapters,
      subchapters: totalSubchapters,
      exercises: totalExercises
    };
  }
};