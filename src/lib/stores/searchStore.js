// src/lib/stores/searchStore.js
import { writable, derived } from 'svelte/store';

// État de base de la recherche
export const searchQuery = writable('');
export const results = writable([]);
export const loading = writable(false);
export const error = writable(null);
export const searchMeta = writable(null);

// Filtres de recherche
export const filters = writable({
  chapter: '',
  subchapter: '',
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
      difficulty: level || '',
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
      
      if (currentFilters.difficulty) {
        searchParams.set('difficulty', currentFilters.difficulty);
      }
      
      if (currentFilters.module) {
        searchParams.set('module', currentFilters.module);
      }
      
      if (currentFilters.author) {
        searchParams.set('author', currentFilters.author);
      }
      
      searchParams.set('limit', '100');

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
  }
};

// Store pour les suggestions (autocomplete)
export const suggestions = writable({
  authors: [],
  modules: [],
  levels: [],
  loading: false
});

export const suggestionActions = {
  async loadSuggestions() {
    suggestions.update(current => ({ ...current, loading: true }));

    try {
      const [authorsResponse, modulesResponse, levelsResponse] = await Promise.all([
        fetch('/api/chapters?type=suggestions&for=authors&limit=20'),
        fetch('/api/chapters?type=suggestions&for=modules&limit=15'),
        fetch('/api/chapters?type=suggestions&for=levels&limit=10')
      ]);

      const authorsData = authorsResponse.ok ? await authorsResponse.json() : { suggestions: [] };
      const modulesData = modulesResponse.ok ? await modulesResponse.json() : { suggestions: [] };
      const levelsData = levelsResponse.ok ? await levelsResponse.json() : { suggestions: [] };

      suggestions.set({
        authors: authorsData.suggestions || [],
        modules: modulesData.suggestions || [],
        levels: levelsData.suggestions || [],
        loading: false
      });
    } catch (err) {
      console.warn('Failed to load suggestions:', err);
      suggestions.update(current => ({ ...current, loading: false }));
    }
  }
};