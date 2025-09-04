// src/lib/stores/listStore.js
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// État de base de la liste
export const exerciseList = writable([]);
export const listLoading = writable(false);
export const listError = writable(null);

// Navigation dans la liste (exercice actuellement sélectionné)
export const selectedExerciseIndex = writable(0);
export const selectedExercise = writable(null);

// État de chargement de l'exercice sélectionné
export const exerciseLoading = writable(false);
export const exerciseError = writable(null);

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
      const promises = validUuids.map(async (uuid) => {
        try {
          const response = await fetch(`/api/exercise/${uuid.trim()}/metadata`);
          if (response.ok) {
            const data = await response.json();
            return { uuid: uuid.trim(), ...data.exercise };
          } else {
            console.warn(`Failed to load metadata for ${uuid}`);
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

  // Sélectionner un exercice par son index
  async selectExercise(index) {
    let currentList;
    const unsubscribe = exerciseList.subscribe(value => currentList = value);
    unsubscribe();

    if (index < 0 || index >= currentList.length) {
      console.warn('Invalid exercise index:', index);
      return;
    }

    selectedExerciseIndex.set(index);
    exerciseLoading.set(true);
    exerciseError.set(null);

    try {
      const exercise = currentList[index];
      const response = await fetch(`/api/exercise/${exercise.uuid}`);
      
      if (response.ok) {
        const data = await response.json();
        selectedExercise.set(data.exercise);
      } else {
        const errorData = await response.json().catch(() => ({}));
        exerciseError.set(errorData.error || 'Erreur de chargement');
        selectedExercise.set(null);
      }
    } catch (err) {
      console.error('Failed to load exercise:', err);
      exerciseError.set('Erreur de connexion');
      selectedExercise.set(null);
    } finally {
      exerciseLoading.set(false);
    }
  },

  // Naviguer vers l'exercice suivant
  async nextExercise() {
    let currentIndex;
    let currentList;
    
    const unsubscribeIndex = selectedExerciseIndex.subscribe(value => currentIndex = value);
    const unsubscribeList = exerciseList.subscribe(value => currentList = value);
    unsubscribeIndex();
    unsubscribeList();

    if (currentIndex < currentList.length - 1) {
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

  // Ajouter un exercice à la liste (pour intégration future avec la recherche)
  async addExercise(uuid) {
    if (!uuid || uuid.trim() === '') return;

    let currentList;
    const unsubscribe = exerciseList.subscribe(value => currentList = value);
    unsubscribe();

    // Vérifier si l'exercice n'est pas déjà dans la liste
    if (currentList.some(ex => ex.uuid === uuid.trim())) {
      console.warn('Exercise already in list:', uuid);
      return;
    }

    try {
      // Charger les métadonnées de l'exercice
      // Utiliser l'API complète pour l'instant
      const response = await fetch(`/api/exercise/${uuid.trim()}`);
      let exerciseData;
      
      if (response.ok) {
        const data = await response.json();
        exerciseData = { 
          uuid: uuid.trim(), 
          title: data.exercise.title,
          chapter: data.exercise.chapter,
          theme: data.exercise.theme,
          author: data.exercise.author,
          difficulty: data.exercise.difficulty,
          level: data.exercise.level,
          module: data.exercise.module
        };
      } else {
        exerciseData = { uuid: uuid.trim(), title: `Exercice ${uuid.slice(0, 8)}...`, error: true };
      }

      // Ajouter à la liste
      exerciseList.update(list => [...list, exerciseData]);

    } catch (err) {
      console.error('Failed to add exercise to list:', err);
    }
  },

  // Supprimer un exercice de la liste
  removeExercise(index) {
    let currentList;
    let currentIndex;
    
    const unsubscribeList = exerciseList.subscribe(value => currentList = value);
    const unsubscribeIndex = selectedExerciseIndex.subscribe(value => currentIndex = value);
    unsubscribeList();
    unsubscribeIndex();

    if (index < 0 || index >= currentList.length) return;

    // Supprimer l'exercice
    const newList = currentList.filter((_, i) => i !== index);
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
    let currentList;
    const unsubscribe = exerciseList.subscribe(value => currentList = value);
    unsubscribe();

    if (currentList.length === 0) return '/exercise/list';

    const uuids = currentList.map(ex => ex.uuid).join(',');
    return `/exercise/list?list=${encodeURIComponent(uuids)}`;
  },

  // Synchroniser avec l'URL (pour la navigation du navigateur)
  syncWithUrl(uuidString) {
    if (!uuidString || uuidString.trim() === '') {
      listActions.clearList();
      return;
    }

    const uuids = uuidString.split(',').map(uuid => uuid.trim()).filter(uuid => uuid !== '');
    listActions.loadFromUuids(uuids);
  }
};

// Utilitaires pour la liste
export const listUtils = {
  // Générer une URL partageable
  getShareableUrl(baseUrl = '') {
    let currentList;
    const unsubscribe = exerciseList.subscribe(value => currentList = value);
    unsubscribe();

    if (currentList.length === 0) return `${baseUrl}/exercise/list`;

    const uuids = currentList.map(ex => ex.uuid).join(',');
    return `${baseUrl}/exercise/list?list=${encodeURIComponent(uuids)}`;
  },

  // Exporter la liste en format simple
  exportList() {
    let currentList;
    const unsubscribe = exerciseList.subscribe(value => currentList = value);
    unsubscribe();

    return currentList.map(ex => ({
      uuid: ex.uuid,
      title: ex.title,
      chapter: ex.chapter,
      theme: ex.theme,
      difficulty: ex.difficulty
    }));
  },

  // Statistiques de la liste
  getListStats() {
    let currentList;
    const unsubscribe = exerciseList.subscribe(value => currentList = value);
    unsubscribe();

    const stats = {
      total: currentList.length,
      byChapter: {},
      byDifficulty: {},
      hasErrors: 0
    };

    currentList.forEach(ex => {
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