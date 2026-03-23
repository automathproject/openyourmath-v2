// src/lib/stores/listStore.js
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Store persistant pour la liste d'exercices (utilise une variable globale côté client)
let globalExerciseList = [];

// Fonction pour initialiser le store avec la liste globale
function createExerciseList() {
  const { subscribe, set, update } = writable(globalExerciseList);
  
  return {
    subscribe,
    set: (value) => {
      globalExerciseList = [...value];
      set(value);
    },
    update: (fn) => {
      const newValue = fn(globalExerciseList);
      globalExerciseList = [...newValue];
      set(newValue);
      return newValue;
    }
  };
}

// État de base de la liste (maintenant persistant)
export const exerciseList = createExerciseList();
export const listLoading = writable(false);
export const listError = writable(null);

// Navigation dans la liste (exercice actuellement sélectionné)
export const selectedExerciseIndex = writable(0);
export const selectedExercise = writable(null);

// État de chargement de l'exercice sélectionné
export const exerciseLoading = writable(false);
export const exerciseError = writable(null);

let activeSelectionRequest = 0;

function cacheFullExercise(index, fullExercise) {
  if (!fullExercise || index < 0 || index >= globalExerciseList.length) {
    return;
  }

  exerciseList.update((list) => {
    if (index < 0 || index >= list.length) {
      return list;
    }

    const nextList = [...list];
    nextList[index] = {
      ...nextList[index],
      title: fullExercise.title ?? nextList[index].title,
      chapter: fullExercise.chapter ?? nextList[index].chapter,
      theme: fullExercise.theme ?? nextList[index].theme,
      author: fullExercise.author ?? nextList[index].author,
      difficulty: fullExercise.difficulty ?? nextList[index].difficulty,
      level: fullExercise.level ?? nextList[index].level,
      module: fullExercise.module ?? nextList[index].module,
      content: fullExercise.content ?? nextList[index].content,
      fullExercise
    };
    return nextList;
  });
}

// États dérivés
export const hasExercises = derived(
  exerciseList,
  ($list) => $list.length > 0
);

export const listCount = derived(
  exerciseList,
  ($list) => $list.length
);

export const currentPosition = derived(
  [selectedExerciseIndex, exerciseList],
  ([$index, $list]) => ({
    current: $index + 1,
    total: $list.length,
    hasNext: $index < $list.length - 1,
    hasPrevious: $index > 0
  })
);

// Obtenir l'UUID de l'exercice sélectionné
export const selectedUuid = derived(
  [exerciseList, selectedExerciseIndex],
  ([$list, $index]) => {
    if ($list.length > 0 && $index >= 0 && $index < $list.length) {
      return $list[$index].uuid;
    }
    return null;
  }
);

// Utilitaires pour la liste
export const listUtils = {
  // Parser une chaîne d'UUIDs séparés par des virgules
  parseUuidString(uuidString) {
    if (!uuidString || typeof uuidString !== 'string') {
      return [];
    }
    
    return uuidString
      // Accepter virgules OU espaces comme séparateurs
      .split(/[\s,]+/)
      .map(uuid => uuid.trim())
      .filter(uuid => uuid !== '' && this.isValidUuid(uuid));
  },

  // Formater la liste actuelle en chaîne d'UUIDs
  formatCurrentList() {
    // Sortie normalisée sans espaces: uuid1,uuid2,uuid3
    return globalExerciseList.map(ex => ex.uuid).join(',');
  },

// Validation d'UUID (accepte les formats courts ET standards)
isValidUuid(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  
  // Nettoyer l'UUID
  const cleanUuid = uuid.trim();
  
  // Accepter les UUIDs courts (au moins 3 caractères alphanumériques)
  const shortUuidRegex = /^[a-zA-Z0-9]{3,}$/;
  
  // Accepter les UUIDs standards (format classique avec tirets)
  const standardUuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  
  const isShortValid = shortUuidRegex.test(cleanUuid);
  const isStandardValid = standardUuidRegex.test(cleanUuid);
  
  return isShortValid || isStandardValid;
},

  // Compter les UUIDs valides dans une chaîne
  countValidUuids(uuidString) {
    const parsed = this.parseUuidString(uuidString);
    const tokens = (uuidString && typeof uuidString === 'string')
      ? uuidString.trim().split(/[\s,]+/).filter(Boolean)
      : [];
    return {
      total: tokens.length,
      valid: parsed.length,
      invalid: Math.max(0, tokens.length - parsed.length)
    };
  },

  // Générer une URL partageable
  getShareableUrl(baseUrl = '') {
    if (globalExerciseList.length === 0) return `${baseUrl}/exercise/list`;

    const uuids = globalExerciseList.map(ex => ex.uuid).join(',');
    // Laisser les virgules non encodées pour une URL lisible
    return `${baseUrl}/exercise/list?list=${uuids}`;
  },

  // Exporter la liste en format simple
  exportList() {
    return globalExerciseList.map(ex => ({
      uuid: ex.uuid,
      title: ex.title,
      chapter: ex.chapter,
      theme: ex.theme,
      difficulty: ex.difficulty
    }));
  },

  // Statistiques de la liste
  getListStats() {
    const stats = {
      total: globalExerciseList.length,
      byChapter: {},
      byDifficulty: {},
      hasErrors: 0
    };

    globalExerciseList.forEach(ex => {
      if (ex.error) {
        stats.hasErrors++;
      }
      
      if (ex.chapter) {
        stats.byChapter[ex.chapter] = (stats.byChapter[ex.chapter] || 0) + 1;
      }
      
      if (ex.difficulty) {
        stats.byDifficulty[ex.difficulty] = (stats.byDifficulty[ex.difficulty] || 0) + 1;
      }
    });

    return stats;
  }
};

// Actions pour gérer la liste
export const listActions = {
  // Charger une liste d'exercices à partir d'UUIDs
  async loadFromUuids(uuidList) {
    if (!Array.isArray(uuidList) || uuidList.length === 0) {
      exerciseList.set([]);
      selectedExerciseIndex.set(0);
      selectedExercise.set(null);
      listError.set(null);
      return;
    }

    listLoading.set(true);
    listError.set(null);

    try {
      // Filtrer les UUIDs valides (non vides)
      const validUuids = uuidList.filter(uuid => uuid && uuid.trim() !== '');
      
      if (validUuids.length === 0) {
        exerciseList.set([]);
        selectedExerciseIndex.set(0);
        selectedExercise.set(null);
        return;
      }

      // Charger les métadonnées des exercices (titre, chapitre, etc.)
      console.log('Loading metadata for UUIDs:', validUuids);
      
      const promises = validUuids.map(async (uuid) => {
        try {
          // Utiliser l'API complète pour l'instant (on optimisera plus tard)
          const response = await fetch(`/api/exercise/${uuid.trim()}`);
          if (response.ok) {
            const data = await response.json();
            console.log(`Metadata loaded for ${uuid}:`, !!data.exercise);
            return { 
              uuid: uuid.trim(), 
              title: data.exercise.title,
              chapter: data.exercise.chapter,
              theme: data.exercise.theme,
              author: data.exercise.author,
              difficulty: data.exercise.difficulty,
              level: data.exercise.level,
              module: data.exercise.module,
              content: data.exercise.content,
              fullExercise: data.exercise
            };
          } else {
            console.warn(`Failed to load metadata for ${uuid}: ${response.status}`);
            return { uuid: uuid.trim(), title: `Exercice ${uuid.slice(0, 8)}...`, error: true };
          }
        } catch (err) {
          console.warn(`Error loading metadata for ${uuid}:`, err);
          return { uuid: uuid.trim(), title: `Exercice ${uuid.slice(0, 8)}...`, error: true };
        }
      });

      const exercises = await Promise.all(promises);
      
      exerciseList.set(exercises);
      
      // Sélectionner le premier exercice par défaut
      if (exercises.length > 0) {
        selectedExerciseIndex.set(0);
        await listActions.selectExercise(0);
      } else {
        selectedExerciseIndex.set(0);
        selectedExercise.set(null);
      }

    } catch (err) {
      console.error('Failed to load exercise list:', err);
      listError.set('Erreur lors du chargement de la liste');
      exerciseList.set([]);
    } finally {
      listLoading.set(false);
    }
  },

  // Charger depuis une chaîne d'UUIDs (CORRIGÉ)
  async loadFromUuidString(uuidString) {
    const uuids = listUtils.parseUuidString(uuidString);
    await listActions.loadFromUuids(uuids);
  },

  // Sélectionner un exercice par son index
  async selectExercise(index) {
    if (index < 0 || index >= globalExerciseList.length) {
      console.warn('Invalid exercise index:', index);
      return;
    }

    const exercise = globalExerciseList[index];
    const cachedExercise = exercise?.fullExercise;

    if (cachedExercise) {
      selectedExerciseIndex.set(index);
      selectedExercise.set(cachedExercise);
      exerciseError.set(null);
      exerciseLoading.set(false);
      return;
    }

    const requestId = ++activeSelectionRequest;
    selectedExerciseIndex.set(index);
    exerciseLoading.set(true);
    exerciseError.set(null);

    try {
      const response = await fetch(`/api/exercise/${exercise.uuid}`);
      
      if (response.ok) {
        const data = await response.json();
        if (requestId !== activeSelectionRequest) {
          return;
        }
        cacheFullExercise(index, data.exercise);
        selectedExercise.set(data.exercise);
      } else {
        if (requestId !== activeSelectionRequest) {
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        exerciseError.set(errorData.error || 'Erreur de chargement');
        selectedExercise.set(null);
      }
    } catch (err) {
      if (requestId !== activeSelectionRequest) {
        return;
      }
      console.error('Failed to load exercise:', err);
      exerciseError.set('Erreur de connexion');
      selectedExercise.set(null);
    } finally {
      if (requestId == activeSelectionRequest) {
        exerciseLoading.set(false);
      }
    }
  },

  // Naviguer vers l'exercice suivant
  async nextExercise() {
    let currentIndex;
    const unsubscribe = selectedExerciseIndex.subscribe(value => currentIndex = value);
    unsubscribe();

    if (currentIndex < globalExerciseList.length - 1) {
      await listActions.selectExercise(currentIndex + 1);
    }
  },

  // Naviguer vers l'exercice précédent
  async previousExercise() {
    let currentIndex;
    const unsubscribe = selectedExerciseIndex.subscribe(value => currentIndex = value);
    unsubscribe();

    if (currentIndex > 0) {
      await listActions.selectExercise(currentIndex - 1);
    }
  },

  // Ajouter un exercice à la liste (pour intégration avec la recherche)
  async addExercise(exerciseData) {
    if (!exerciseData || !exerciseData.uuid) {
      console.warn('Invalid exercise data provided to addExercise');
      return;
    }

    // Vérifier si l'exercice n'est pas déjà dans la liste
    if (globalExerciseList.some(ex => ex.uuid === exerciseData.uuid)) {
      console.warn('Exercise already in list:', exerciseData.uuid);
      return;
    }

    // Ajouter l'exercice avec les métadonnées complètes
    const newExercise = {
      uuid: exerciseData.uuid,
      title: exerciseData.title || `Exercice ${exerciseData.uuid.slice(0, 8)}...`,
      chapter: exerciseData.chapter,
      theme: exerciseData.theme,
      author: exerciseData.author,
      difficulty: exerciseData.difficulty,
      level: exerciseData.level,
      module: exerciseData.module
    };

    console.log('Adding exercise to list:', newExercise);
    exerciseList.update(list => [...list, newExercise]);
    console.log('New list length:', globalExerciseList.length);
  },

  // Vérifier si un exercice est dans la liste
  isInList(uuid) {
    return globalExerciseList.some(ex => ex.uuid === uuid);
  },

  // Supprimer un exercice de la liste
  removeExercise(index) {
    let currentIndex;
    const unsubscribe = selectedExerciseIndex.subscribe(value => currentIndex = value);
    unsubscribe();

    if (index < 0 || index >= globalExerciseList.length) return;

    // Supprimer l'exercice
    const newList = globalExerciseList.filter((_, i) => i !== index);
    exerciseList.set(newList);

    // Ajuster la sélection
    if (newList.length === 0) {
      selectedExerciseIndex.set(0);
      selectedExercise.set(null);
    } else if (currentIndex >= newList.length) {
      // Si on était sur le dernier élément, sélectionner le nouveau dernier
      listActions.selectExercise(newList.length - 1);
    } else if (currentIndex === index) {
      // Si on supprime l'exercice sélectionné, rester au même index (nouvel exercice)
      listActions.selectExercise(currentIndex);
    } else if (index < currentIndex) {
      // Si on supprime un exercice avant celui sélectionné, ajuster l'index
      selectedExerciseIndex.set(currentIndex - 1);
    }
    // Sinon, garder le même index (l'exercice sélectionné n'a pas bougé)
  },

  // Effacer complètement la liste
  clearList() {
    exerciseList.set([]);
    selectedExerciseIndex.set(0);
    selectedExercise.set(null);
    listError.set(null);
    exerciseError.set(null);
  },

  // Obtenir l'URL de la liste actuelle
  getCurrentListUrl() {
    if (globalExerciseList.length === 0) return '/exercise/list';

    const uuids = globalExerciseList.map(ex => ex.uuid).join(',');
    // Laisser les virgules non encodées pour une URL lisible
    return `/exercise/list?list=${uuids}`;
  },

  // Synchroniser avec l'URL (pour la navigation du navigateur)
  syncWithUrl(uuidString) {
    if (!uuidString || uuidString.trim() === '') {
      listActions.clearList();
      return;
    }

    // Accepter virgules OU espaces comme séparateurs
    const uuids = uuidString
      .trim()
      .split(/[\s,]+/)
      .map(uuid => uuid.trim())
      .filter(uuid => uuid !== '');
    listActions.loadFromUuids(uuids);
  },

  // Réorganiser la liste d'exercices
reorderExercises(newExercises, newSelectedIndex) {
  exerciseList.set(newExercises);
  if (newSelectedIndex !== undefined) {
    selectedExerciseIndex.set(newSelectedIndex);
  }
},

// Supprimer plusieurs exercices par leurs indices
removeMultipleExercises(indices) {
  if (!Array.isArray(indices) || indices.length === 0) return;

  let currentIndex;
  const unsubscribe = selectedExerciseIndex.subscribe(value => currentIndex = value);
  unsubscribe();

  // Trier les indices en ordre décroissant pour éviter les problèmes d'index
  const sortedIndices = [...indices].sort((a, b) => b - a);
  
  let newList = [...globalExerciseList];
  
  // Supprimer les exercices
  sortedIndices.forEach(index => {
    if (index >= 0 && index < newList.length) {
      newList.splice(index, 1);
    }
  });

  exerciseList.set(newList);

  // Ajuster la sélection
  if (newList.length === 0) {
    selectedExerciseIndex.set(0);
    selectedExercise.set(null);
  } else {
    // Calculer le nouvel index sélectionné
    const removedBeforeSelected = indices.filter(i => i < currentIndex).length;
    let newSelectedIndex = currentIndex - removedBeforeSelected;
    
    // Si l'exercice sélectionné a été supprimé
    if (indices.includes(currentIndex)) {
      newSelectedIndex = Math.min(newSelectedIndex, newList.length - 1);
    }
    
    newSelectedIndex = Math.max(0, Math.min(newSelectedIndex, newList.length - 1));
    
    if (newSelectedIndex !== currentIndex) {
      listActions.selectExercise(newSelectedIndex);
    }
  }
},
};
