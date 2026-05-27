// src/lib/stores/searchStore.js
import { writable, derived } from 'svelte/store';
import { previewPanelOpen, uiActions } from '$lib/stores/uiStore.ts';

// État de base de la recherche
export const searchQuery = writable('');
export const results = writable([]);
export const loading = writable(false);
export const error = writable(null);
export const searchMeta = writable(null);
export const loadingMore = writable(false);

// État pour la prévisualisation
export const previewState = writable({
  selectedUuid: null,
  exercise: null,
  loading: false,
  error: null,
  isOpen: false
});

// Gestion de la mise en page (largeurs / visibilité)
export const layoutState = writable({
  previewPanelVisible: true,
  previewPanelWidth: 400
});

export const layoutConfig = derived(
  [previewPanelOpen, layoutState],
  ([$previewPanelOpen, $layout]) => {
    const width = Number($layout.previewPanelWidth) || 400;
    const clampedWidth = Math.max(280, Math.min(width, 640));
    const previewWidth = `${clampedWidth}px`;
    const showPreviewPanel = $previewPanelOpen;
    const resultsWidth = showPreviewPanel ? `calc(100% - ${previewWidth})` : '100%';

    return {
      showPreviewPanel,
      previewWidth,
      resultsWidth
    };
  }
);

previewPanelOpen.subscribe((isOpen) => {
  layoutState.update((current) => ({
    ...current,
    previewPanelVisible: isOpen
  }));
});

// Filtres de recherche
export const filters = writable({
  chapter: '',
  subchapter: '',
  level: '',
  difficulty: '',
  module: '',
  author: '',
  organization: '',
  createdFrom: '',
  createdTo: '',
  updatedFrom: '',
  updatedTo: '',
  hasSolution: '',
  hasIndication: '',
  hasVideo: '',
  sort: 'relevance',
  sortDirection: 'desc'
});

const DEFAULT_SORT_DIRECTIONS = {
  relevance: 'desc',
  updated: 'desc',
  created: 'desc',
  difficulty: 'asc'
};

export const breadcrumb = derived(filters, ($filters) => {
  const segments = [];

  if ($filters.level) segments.push($filters.level);
  if ($filters.module) segments.push($filters.module);
  if ($filters.chapter) segments.push($filters.chapter);
  if ($filters.subchapter) segments.push($filters.subchapter);

  return {
    segments,
    label: segments.join(' > '),
    isEmpty: segments.length === 0
  };
});

// États dérivés (calculés automatiquement)
export const hasActiveFilters = derived(
  [searchQuery, filters],
  ([$searchQuery, $filters]) => {
    const hasSortOverride = $filters.sort && $filters.sort !== 'relevance';
    return !!(
      $searchQuery || 
      $filters.chapter || 
      $filters.subchapter ||
      $filters.level || 
      $filters.difficulty ||
      $filters.module || 
      $filters.author ||
      $filters.organization ||
      $filters.createdFrom ||
      $filters.createdTo ||
      $filters.updatedFrom ||
      $filters.updatedTo ||
      ($filters.hasSolution !== '' && $filters.hasSolution !== null && $filters.hasSolution !== undefined) ||
      ($filters.hasIndication !== '' && $filters.hasIndication !== null && $filters.hasIndication !== undefined) ||
      ($filters.hasVideo !== '' && $filters.hasVideo !== null && $filters.hasVideo !== undefined) ||
      hasSortOverride
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

// État dérivé pour la prévisualisation
export const hasPreview = derived(
  previewState,
  ($previewState) => $previewState.isOpen && $previewState.exercise
);

function createEmptyFilterCounts() {
  return {
    module: {},
    level: {},
    difficulty: {},
    author: {},
    organization: {}
  };
}

function resolveSortParam(currentFilters = {}) {
  let baseSort = currentFilters.sort || 'relevance';
  let direction = currentFilters.sortDirection === 'asc'
    ? 'asc'
    : currentFilters.sortDirection === 'desc'
      ? 'desc'
      : DEFAULT_SORT_DIRECTIONS[baseSort] ?? 'desc';

  if (baseSort && baseSort.includes('_')) {
    const [rawBase, rawDir] = baseSort.split('_');
    if (['updated', 'created', 'difficulty'].includes(rawBase) && (rawDir === 'asc' || rawDir === 'desc')) {
      baseSort = rawBase;
      direction = rawDir;
    }
  }

  if (baseSort === 'relevance') {
    return null;
  }

  switch (baseSort) {
    case 'updated':
      return direction === 'asc' ? 'updated_asc' : 'updated_desc';
    case 'created':
      return direction === 'asc' ? 'created_asc' : 'created_desc';
    case 'difficulty':
      return direction === 'asc' ? 'difficulty_asc' : 'difficulty_desc';
    default:
      return null;
  }
}

export const filterCounts = writable(createEmptyFilterCounts());

function resetPreviewState() {
  previewState.set({
    selectedUuid: null,
    exercise: null,
    loading: false,
    error: null,
    isOpen: false
  });
  uiActions.setPreviewPanelOpen(false);
}

function clearSearchUrl() {
  if (typeof window === 'undefined') return;

  const nextUrl = `${window.location.pathname}${window.location.hash || ''}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

// Comptages hiérarchiques dérivés des résultats courants (compatibles hybride et FTS).
// Clés composées "level|module|chapter|subchapter" pour distinguer les homonymes inter-niveaux.
export const resultPathCounts = derived(results, ($results) => {
  if (!$results || $results.length === 0) return null;
  const levels = {}, modules = {}, chapters = {}, subchapters = {};
  for (const r of $results) {
    const lv = r.level || '';
    const mo = r.module || '';
    const ch = r.chapter || '';
    const sc = r.subchapter || '';
    if (lv) {
      levels[lv] = (levels[lv] || 0) + 1;
      if (mo) {
        const mk = `${lv}|${mo}`;
        modules[mk] = (modules[mk] || 0) + 1;
        if (ch) {
          const ck = `${lv}|${mo}|${ch}`;
          chapters[ck] = (chapters[ck] || 0) + 1;
          if (sc) {
            const sk = `${lv}|${mo}|${ch}|${sc}`;
            subchapters[sk] = (subchapters[sk] || 0) + 1;
          }
        }
      }
    }
  }
  return { levels, modules, chapters, subchapters };
});

// Actions pour gérer la recherche
export const searchActions = {
  // Mettre à jour un filtre spécifique
  updateFilter(filterKey, value) {
    filters.update(currentFilters => {
      if (filterKey === 'sort') {
        const prevSort = currentFilters.sort || 'relevance';
        const rawValue = typeof value === 'string' && value ? value : 'relevance';
        let nextSort = rawValue;
        let nextDirection = currentFilters.sortDirection ?? DEFAULT_SORT_DIRECTIONS[prevSort] ?? 'desc';

        if (rawValue.includes('_')) {
          const [base, dir] = rawValue.split('_');
          if (['relevance', 'updated', 'created', 'difficulty'].includes(base)) {
            nextSort = base;
            if (dir === 'asc' || dir === 'desc') {
              nextDirection = dir;
            } else {
              nextDirection = DEFAULT_SORT_DIRECTIONS[base] ?? 'desc';
            }
          } else {
            nextSort = 'relevance';
            nextDirection = DEFAULT_SORT_DIRECTIONS.relevance;
          }
        } else if (!DEFAULT_SORT_DIRECTIONS[nextSort]) {
          nextSort = 'relevance';
          nextDirection = DEFAULT_SORT_DIRECTIONS.relevance;
        } else if (nextSort !== prevSort) {
          nextDirection = DEFAULT_SORT_DIRECTIONS[nextSort];
        }

        if (nextSort === 'relevance') {
          nextDirection = DEFAULT_SORT_DIRECTIONS.relevance;
        }

        return {
          ...currentFilters,
          sort: nextSort,
          sortDirection: nextDirection
        };
      }

      if (filterKey === 'sortDirection') {
        const sanitized = value === 'asc' ? 'asc' : 'desc';
        if ((currentFilters.sort || 'relevance') === 'relevance') {
          return {
            ...currentFilters,
            sortDirection: DEFAULT_SORT_DIRECTIONS.relevance
          };
        }
        return {
          ...currentFilters,
          sortDirection: sanitized
        };
      }

      return {
        ...currentFilters,
        [filterKey]: value
      };
    });
  },

  // Effacer un filtre spécifique
  clearFilter(filterKey) {
    filters.update(currentFilters => {
      if (filterKey === 'sort') {
        return {
          ...currentFilters,
          sort: 'relevance',
          sortDirection: DEFAULT_SORT_DIRECTIONS.relevance
        };
      }

      if (filterKey === 'sortDirection') {
        return {
          ...currentFilters,
          sortDirection: DEFAULT_SORT_DIRECTIONS[currentFilters.sort || 'relevance'] ?? 'desc'
        };
      }

      return {
        ...currentFilters,
        [filterKey]: ''
      };
    });
  },

  // Effacer tous les filtres
  clearAllFilters() {
    clearSearchUrl();
    searchQuery.set('');
    filters.set({
      chapter: '',
      subchapter: '',
      level: '',
      difficulty: '',
      module: '',
      author: '',
      organization: '',
      createdFrom: '',
      createdTo: '',
      updatedFrom: '',
      updatedTo: '',
      hasSolution: '',
      hasIndication: '',
      hasVideo: '',
      sort: 'relevance',
      sortDirection: 'desc'
    });
    results.set([]);
    searchMeta.set(null);
    error.set(null);
    filterCounts.set(createEmptyFilterCounts());
    resetPreviewState();
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
    const hasEffectiveFilters = Object.entries(currentFilters).some(([key, value]) => {
      if (key === 'sort') {
        return value && value !== 'relevance';
      }
      if (key === 'sortDirection') {
        return false;
      }
      return Boolean(value);
    });

    if (!currentQuery && !hasEffectiveFilters) {
      results.set([]);
      searchMeta.set(null);
      error.set(null);
      filterCounts.set(createEmptyFilterCounts());
      resetPreviewState();
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
      if (currentFilters.organization) {
        searchParams.set('organization', currentFilters.organization);
      }
      if (currentFilters.createdFrom) {
        searchParams.set('createdFrom', currentFilters.createdFrom);
      }
      if (currentFilters.createdTo) {
        searchParams.set('createdTo', currentFilters.createdTo);
      }
      if (currentFilters.updatedFrom) {
        searchParams.set('updatedFrom', currentFilters.updatedFrom);
      }
      if (currentFilters.updatedTo) {
        searchParams.set('updatedTo', currentFilters.updatedTo);
      }
      
      if (currentFilters.hasSolution !== '' && currentFilters.hasSolution !== null && currentFilters.hasSolution !== undefined) {
        searchParams.set('hasSolution', String(currentFilters.hasSolution));
      }
      if (currentFilters.hasIndication !== '' && currentFilters.hasIndication !== null && currentFilters.hasIndication !== undefined) {
        searchParams.set('hasIndication', String(currentFilters.hasIndication));
      }
      if (currentFilters.hasVideo !== '' && currentFilters.hasVideo !== null && currentFilters.hasVideo !== undefined) {
        searchParams.set('hasVideo', String(currentFilters.hasVideo));
      }

      const sortParam = resolveSortParam(currentFilters);
      if (sortParam) {
        searchParams.set('sort', sortParam);
      }
      
      // Limite par page (afficher 20 résultats puis "voir plus")
      searchParams.set('limit', '20');
      searchParams.set('offset', '0');

      const response = await fetch(`/api/search?${searchParams.toString()}`);

      if (response.ok) {
        const data = await response.json();
        const nextResults = data.results || [];
        results.set(nextResults);
        searchMeta.set(data.meta || null);
        
        // Utiliser les filterCounts du serveur (contextuels) ou vide
        if (data.meta?.filterCounts) {
          filterCounts.set(data.meta.filterCounts);
        } else {
          filterCounts.set(createEmptyFilterCounts());
        }
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
      if (currentFilters.organization) {
        searchParams.set('organization', currentFilters.organization);
      }
      if (currentFilters.createdFrom) {
        searchParams.set('createdFrom', currentFilters.createdFrom);
      }
      if (currentFilters.createdTo) {
        searchParams.set('createdTo', currentFilters.createdTo);
      }
      if (currentFilters.updatedFrom) {
        searchParams.set('updatedFrom', currentFilters.updatedFrom);
      }
      if (currentFilters.updatedTo) {
        searchParams.set('updatedTo', currentFilters.updatedTo);
      }
      if (currentFilters.hasSolution !== '' && currentFilters.hasSolution !== null && currentFilters.hasSolution !== undefined) {
        searchParams.set('hasSolution', String(currentFilters.hasSolution));
      }
      if (currentFilters.hasIndication !== '' && currentFilters.hasIndication !== null && currentFilters.hasIndication !== undefined) {
        searchParams.set('hasIndication', String(currentFilters.hasIndication));
      }
      if (currentFilters.hasVideo !== '' && currentFilters.hasVideo !== null && currentFilters.hasVideo !== undefined) {
        searchParams.set('hasVideo', String(currentFilters.hasVideo));
      }

      const sortParam = resolveSortParam(currentFilters);
      if (sortParam) {
        searchParams.set('sort', sortParam);
      }

      searchParams.set('limit', String(limit));
      searchParams.set('offset', String(offset));

      const response = await fetch(`/api/search?${searchParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const newResults = data.results || [];
        
        // Pour loadMore, on garde les filterCounts existants du premier appel
        // car les comptages contextuels ne changent pas avec la pagination
        if (data.meta?.filterCounts) {
          filterCounts.set(data.meta.filterCounts);
        }

        let appendedSnapshot = [];
        results.update((prev) => {
          appendedSnapshot = [...prev, ...newResults];
          return appendedSnapshot;
        });

        // Préserver totalCount du premier appel si non renvoyé ensuite
        searchMeta.update((prev) => {
          const prevTotal = prev?.pagination?.totalCount;
          const prevFilterCounts = prev?.filterCounts ?? null;
          const next = data.meta || null;
          if (!next) return prev;
          return {
            ...next,
            filterCounts: next.filterCounts ?? prevFilterCounts,
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

// Actions pour gérer la prévisualisation
export const previewActions = {
  // Sélectionner un exercice pour prévisualisation
  async selectExercise(uuid, options = {}) {
    const revealPanel = options?.revealPanel !== false;

    // Si c'est le même exercice, on ferme/ouvre la preview
    let panelVisible = true;
    const unsubscribeLayout = previewPanelOpen.subscribe((value) => (panelVisible = value));
    unsubscribeLayout();

    let closedExisting = false;
    let reopenedHidden = false;
    previewState.update(current => {
      if (current.selectedUuid === uuid && current.isOpen) {
        if (!panelVisible) {
          reopenedHidden = revealPanel;
          return current;
        }
        closedExisting = true;
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

    if (reopenedHidden) {
      uiActions.setPreviewPanelOpen(true);
      return;
    }

    if (closedExisting) {
      uiActions.setPreviewPanelOpen(false);
      return;
    }

    if (revealPanel) {
      uiActions.setPreviewPanelOpen(true);
    }

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
        previewState.update(current => (
          current.selectedUuid === uuid
            ? {
                ...current,
                exercise: data.exercise,
                loading: false,
                error: null
              }
            : current
        ));
      } else {
        const errorData = await response.json().catch(() => ({}));
        previewState.update(current => (
          current.selectedUuid === uuid
            ? {
                ...current,
                exercise: null,
                loading: false,
                error: errorData.error || 'Erreur de chargement'
              }
            : current
        ));
      }
    } catch (err) {
      console.error('Erreur chargement exercice:', err);
      previewState.update(current => (
        current.selectedUuid === uuid
          ? {
              ...current,
              exercise: null,
              loading: false,
              error: 'Erreur de connexion'
            }
          : current
      ));
    }
  },

  // Fermer la prévisualisation
  closePreview() {
    previewState.update(current => ({
      ...current,
      isOpen: false
    }));
    uiActions.setPreviewPanelOpen(false);
  },

  // Effacer complètement la prévisualisation
  clearPreview() {
    resetPreviewState();
  }
};

export const layoutActions = {
  togglePreviewPanel() {
    uiActions.togglePreviewPanel();
  },

  setPreviewPanelVisible(visible) {
    uiActions.setPreviewPanelOpen(Boolean(visible));
  },

  setPreviewPanelWidth(width) {
    layoutState.update(current => ({
      ...current,
      previewPanelWidth: Number(width) || current.previewPanelWidth
    }));
  }
};

// Store pour les suggestions (autocomplete)
export const suggestions = writable({
  authors: [],
  organizations: [],
  modules: [],
  levels: [],
  difficulties: [],
  loading: false
});

export const suggestionActions = {
  async loadSuggestions(context = {}) {
    const { query = '', filters: currentFilters = {} } = context;

    const sharedParams = (forType) => {
      const params = new URLSearchParams();
      params.set('type', 'suggestions');
      params.set('for', forType);

      if (query && query.trim()) params.set('q', query.trim());

      if (currentFilters.subchapter) {
        params.set('subchapter', currentFilters.subchapter);
        if (currentFilters.chapter) params.set('chapter', currentFilters.chapter);
      } else if (currentFilters.chapter) {
        params.set('chapter', currentFilters.chapter);
      }

      if (currentFilters.level) params.set('level', currentFilters.level);
      if (currentFilters.module) params.set('module', currentFilters.module);
      if (currentFilters.difficulty) params.set('difficulty', currentFilters.difficulty);
      if (currentFilters.author && forType !== 'authors') params.set('author', currentFilters.author);
      if (currentFilters.organization && forType !== 'organizations') params.set('organization', currentFilters.organization);
      if (currentFilters.createdFrom) params.set('createdFrom', currentFilters.createdFrom);
      if (currentFilters.createdTo) params.set('createdTo', currentFilters.createdTo);
      if (currentFilters.updatedFrom) params.set('updatedFrom', currentFilters.updatedFrom);
      if (currentFilters.updatedTo) params.set('updatedTo', currentFilters.updatedTo);

      if (currentFilters.hasSolution !== '' && currentFilters.hasSolution !== undefined && currentFilters.hasSolution !== null) {
        params.set('hasSolution', String(currentFilters.hasSolution));
      }
      if (currentFilters.hasIndication !== '' && currentFilters.hasIndication !== undefined && currentFilters.hasIndication !== null) {
        params.set('hasIndication', String(currentFilters.hasIndication));
      }
      if (currentFilters.hasVideo !== '' && currentFilters.hasVideo !== undefined && currentFilters.hasVideo !== null) {
        params.set('hasVideo', String(currentFilters.hasVideo));
      }

      return params;
    };

    suggestions.update(current => ({ ...current, loading: true }));

    try {
      const [authorsResponse, organizationsResponse, modulesResponse, levelsResponse, difficultiesResponse] = await Promise.all([
        fetch(`/api/chapters?${sharedParams('authors').toString()}&limit=200`),
        fetch(`/api/chapters?${sharedParams('organizations').toString()}&limit=100`),
        fetch(`/api/chapters?${sharedParams('modules').toString()}&limit=15`),
        fetch(`/api/chapters?${sharedParams('levels').toString()}&limit=10`),
        fetch(`/api/chapters?${sharedParams('difficulties').toString()}&limit=10`)
      ]);

      const authorsData = authorsResponse.ok ? await authorsResponse.json() : { suggestions: [] };
      const organizationsData = organizationsResponse.ok ? await organizationsResponse.json() : { suggestions: [] };
      const modulesData = modulesResponse.ok ? await modulesResponse.json() : { suggestions: [] };
      const levelsData = levelsResponse.ok ? await levelsResponse.json() : { suggestions: [] };
      const difficultiesData = difficultiesResponse.ok ? await difficultiesResponse.json() : { suggestions: [] };

      suggestions.set({
        authors: authorsData.suggestions || [],
        organizations: organizationsData.suggestions || [],
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
