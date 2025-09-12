// src/lib/stores/searchStore.js
import { writable, derived } from 'svelte/store';

// État de base de la recherche
export const searchQuery = writable('');
export const results = writable([]);
export const loading = writable(false);
export const error = writable(null);
export const searchMeta = writable(null);
export const loadingMore = writable(false);

// NOUVEAU : État pour la prévisualisation
export const previewState = writable({
  selectedUuid: null,
  exercise: null,
  loading: false,
  error: null,
  isOpen: false
});

// Filtres de recherche
export const filters = writable({
  chapter: '',
  subchapter: '',
  level: '',
  difficulty: '',
  module: '',
  author: ''
});

// États dérivés (calculés automatiquement)
export const hasActiveFilters = derived(
  [searchQuery, filters],
  ([$searchQuery, $filters]) => {
    return !!(
      $searchQuery || 
      $filters.chapter || 
      $filters.level || 
      $filters.difficulty ||
      $filters.module || 
      $filters.author
    );
  }
);

export const hasResults = derived(
  results,
  ($results) => $results.length > 0
);

export const hasSearched = derived(
  hasActiveFilters,
  ($hasActiveFilters) => $hasActiveFilters
);

// NOUVEAU : État dérivé pour la prévisualisation
export const hasPreview = derived(
  previewState,
  ($previewState) => $previewState.isOpen && $previewState.exercise
);

// Actions pour gérer la recherche
export const searchActions = {
  // Mettre à jour un filtre spécifique
  updateFilter(filterKey, value) {
    filters.update(currentFilters => ({
      ...currentFilters,
      [filterKey]: value
    }));
  },

  // Effacer un filtre spécifique
  clearFilter(filterKey) {
    filters.update(currentFilters => ({
      ...currentFilters,
      [filterKey]: ''
    }));
  },

  // Effacer tous les filtres
  clearAllFilters() {
    searchQuery.set('');
    filters.set({
      chapter: '',
      subchapter: '',
      level: '',
      difficulty: '',
      module: '',
      author: ''
    });
    results.set([]);
    searchMeta.set(null);
    error.set(null);
  },

  // Mettre à jour depuis la navigation hiérarchique
  updateFromNavigation({ level, module, chapter, subchapter }) {
    filters.update(currentFilters => ({
      ...currentFilters,
      level: level || '',
      module: module || '',
      chapter: chapter || '',
      subchapter: subchapter || ''
    }));
  },

  // Exécuter la recherche
  async search() {
    let currentQuery;
    let currentFilters;
    
    // Récupérer les valeurs actuelles
    const unsubscribeQuery = searchQuery.subscribe(value => currentQuery = value);
    const unsubscribeFilters = filters.subscribe(value => currentFilters = value);
    unsubscribeQuery();
    unsubscribeFilters();

    // Si aucun critère de recherche, vider les résultats
    if (!currentQuery && !Object.values(currentFilters).some(v => v)) {
      results.set([]);
      searchMeta.set(null);
      error.set(null);
      return;
    }

    loading.set(true);
    error.set(null);

    try {
      const searchParams = new URLSearchParams();
      
      if (currentQuery.trim()) {
        searchParams.set('q', currentQuery);
      }
      
      if (currentFilters.subchapter) {
        searchParams.set('subchapter', currentFilters.subchapter);
        searchParams.set('chapter', currentFilters.chapter);
      } else if (currentFilters.chapter) {
        searchParams.set('chapter', currentFilters.chapter);
      }
      
      if (currentFilters.level) {
        searchParams.set('level', currentFilters.level);
      }
      
      if (currentFilters.difficulty) {
        searchParams.set('difficulty', currentFilters.difficulty);
      }
      
      if (currentFilters.module) {
        searchParams.set('module', currentFilters.module);
      }
      
      if (currentFilters.author) {
        searchParams.set('author', currentFilters.author);
      }
      
      // Limite par page (afficher 20 résultats puis "voir plus")
      searchParams.set('limit', '20');
      searchParams.set('offset', '0');

      const response = await fetch(`/api/search?${searchParams.toString()}`);

      if (response.ok) {
        const data = await response.json();
        results.set(data.results || []);
        searchMeta.set(data.meta || null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        error.set(errorData.message || 'Erreur de recherche');
        results.set([]);
      }
    } catch (err) {
      console.error('Erreur recherche:', err);
      error.set('Erreur de connexion');
      results.set([]);
    } finally {
      loading.set(false);
    }
  },

  // Charger plus de résultats (pagination)
  async loadMore() {
    let currentQuery;
    let currentFilters;
    let currentMeta;
    let currentResults = [];

    const unsubQ = searchQuery.subscribe((v) => (currentQuery = v));
    const unsubF = filters.subscribe((v) => (currentFilters = v));
    const unsubM = searchMeta.subscribe((v) => (currentMeta = v));
    const unsubR = results.subscribe((v) => (currentResults = v));
    unsubQ();
    unsubF();
    unsubM();
    unsubR();

    if (!currentMeta?.pagination?.hasMore) return;

    const limit = currentMeta.pagination.limit || 20;
    const offset = (currentMeta.pagination.offset || 0) + (currentMeta.pagination.count || currentResults.length);

    loadingMore.set(true);

    try {
      const searchParams = new URLSearchParams();

      if (currentQuery?.trim()) {
        searchParams.set('q', currentQuery);
      }
      if (currentFilters.subchapter) {
        searchParams.set('subchapter', currentFilters.subchapter);
        searchParams.set('chapter', currentFilters.chapter);
      } else if (currentFilters.chapter) {
        searchParams.set('chapter', currentFilters.chapter);
      }
      if (currentFilters.level) {
        searchParams.set('level', currentFilters.level);
      }
      if (currentFilters.difficulty) {
        searchParams.set('difficulty', currentFilters.difficulty);
      }
      if (currentFilters.module) {
        searchParams.set('module', currentFilters.module);
      }
      if (currentFilters.author) {
        searchParams.set('author', currentFilters.author);
      }

      searchParams.set('limit', String(limit));
      searchParams.set('offset', String(offset));

      const response = await fetch(`/api/search?${searchParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        results.update((prev) => [...prev, ...(data.results || [])]);
        // Préserver totalCount du premier appel si non renvoyé ensuite
        searchMeta.update((prev) => {
          const prevTotal = prev?.pagination?.totalCount;
          const next = data.meta || null;
          if (!next) return prev;
          return {
            ...next,
            pagination: {
              ...next.pagination,
              totalCount: prevTotal ?? next.pagination?.totalCount ?? null
            }
          };
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        error.set(errorData.message || 'Erreur de recherche');
      }
    } catch (err) {
      console.error('Erreur pagination:', err);
      error.set('Erreur de connexion');
    } finally {
      loadingMore.set(false);
    }
  }
};

// NOUVEAU : Actions pour gérer la prévisualisation
export const previewActions = {
  // Sélectionner un exercice pour prévisualisation
  async selectExercise(uuid) {
    // Si c'est le même exercice, on ferme/ouvre la preview
    previewState.update(current => {
      if (current.selectedUuid === uuid && current.isOpen) {
        return {
          ...current,
          isOpen: false
        };
      }
      return {
        ...current,
        selectedUuid: uuid,
        loading: true,
        error: null,
        isOpen: true
      };
    });

    // Si on ferme juste la preview, pas besoin de charger
    let shouldLoad = true;
    const unsubscribe = previewState.subscribe(state => {
      if (state.selectedUuid === uuid && !state.isOpen) {
        shouldLoad = false;
      }
    });
    unsubscribe();

    if (!shouldLoad) return;

    try {
      const response = await fetch(`/api/exercise/${uuid}`);
      
      if (response.ok) {
        const data = await response.json();
        previewState.update(current => ({
          ...current,
          exercise: data.exercise,
          loading: false,
          error: null
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        previewState.update(current => ({
          ...current,
          exercise: null,
          loading: false,
          error: errorData.error || 'Erreur de chargement'
        }));
      }
    } catch (err) {
      console.error('Erreur chargement exercice:', err);
      previewState.update(current => ({
        ...current,
        exercise: null,
        loading: false,
        error: 'Erreur de connexion'
      }));
    }
  },

  // Fermer la prévisualisation
  closePreview() {
    previewState.update(current => ({
      ...current,
      isOpen: false
    }));
  },

  // Effacer complètement la prévisualisation
  clearPreview() {
    previewState.set({
      selectedUuid: null,
      exercise: null,
      loading: false,
      error: null,
      isOpen: false
    });
  }
};

// Store pour les suggestions (autocomplete)
export const suggestions = writable({
  authors: [],
  modules: [],
  levels: [],
  difficulties: [],
  loading: false
});

export const suggestionActions = {
  async loadSuggestions() {
    suggestions.update(current => ({ ...current, loading: true }));

    try {
      const [authorsResponse, modulesResponse, levelsResponse, difficultiesResponse] = await Promise.all([
        fetch('/api/chapters?type=suggestions&for=authors&limit=20'),
        fetch('/api/chapters?type=suggestions&for=modules&limit=15'),
        fetch('/api/chapters?type=suggestions&for=levels&limit=10'),
        fetch('/api/chapters?type=suggestions&for=difficulties&limit=10')
      ]);

      const authorsData = authorsResponse.ok ? await authorsResponse.json() : { suggestions: [] };
      const modulesData = modulesResponse.ok ? await modulesResponse.json() : { suggestions: [] };
      const levelsData = levelsResponse.ok ? await levelsResponse.json() : { suggestions: [] };
      const difficultiesData = difficultiesResponse.ok ? await difficultiesResponse.json() : { suggestions: [] };

      suggestions.set({
        authors: authorsData.suggestions || [],
        modules: modulesData.suggestions || [],
        levels: levelsData.suggestions || [],
        difficulties: difficultiesData.suggestions || [],
        loading: false
      });

    } catch (err) {
      console.warn('Failed to load suggestions:', err);
      suggestions.update(current => ({ ...current, loading: false }));
    }
  }
};
