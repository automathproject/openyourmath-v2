<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import ExercisePreview from '$lib/components/ExercisePreview.svelte';
  import EmptyState from '$lib/components/search/EmptyState.svelte';
  import BreadcrumbNav from '$lib/components/search/BreadcrumbNav.svelte';
  import ActiveFilters from '$lib/components/search/active-filters.svelte';
  import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
  import ResultsGrid from '$lib/components/search/ResultsGrid.svelte';
  import MobileExercisePreview from '$lib/components/search/MobileExercisePreview.svelte';
  import RandomExercisesCarousel from '$lib/components/search/RandomExercisesCarousel.svelte';
  import { cycleTri } from '$lib/utils/filterUtils.js';

  import {
    searchQuery,
    results,
    loading,
    error,
    searchMeta,
    filters,
    hasResults,
    hasSearched,
    searchActions,
    suggestionActions,
    previewState,
    previewActions,
    loadingMore,
    layoutConfig,
    layoutActions
  } from '$lib/stores/searchStore.js';
  import { previewPanelOpen, uiActions } from '$lib/stores/uiStore.ts';

  import { useDebounce } from '$lib/hooks/useDebounce.js';

  let isDesktop = false;
  let advancedFiltersOpen = false;
  let manualCardMode = 'auto'; // auto | compact | detailed

  const debouncedSearch = useDebounce(searchActions.search, 300);

  onMount(() => {
    suggestionActions.loadSuggestions();

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(min-width: 1024px)');

      const applyViewportState = (matches) => {
        isDesktop = matches;
      };

      applyViewportState(mediaQuery.matches);
      const handleChange = (event) => applyViewportState(event.matches);
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  });


  function handleChapterNavigation(event) {
    const { level, module, chapter, subchapter } = event.detail;
    searchActions.updateFromNavigation({ level, module, chapter, subchapter });
    searchActions.search();
  }

  function selectExercise(exercise) {
    previewActions.selectExercise(exercise.uuid);
  }

  function toggleSolutionChip() {
    const next = cycleTri($filters.hasSolution);
    searchActions.updateFilter('hasSolution', next);
    searchActions.search();
  }

  function toggleIndicationChip() {
    const next = cycleTri($filters.hasIndication);
    searchActions.updateFilter('hasIndication', next);
    searchActions.search();
  }

  function toggleFiltersPanel() {
    advancedFiltersOpen = !advancedFiltersOpen;
  }

  function toggleDesktopPreviewPanel() {
    uiActions.togglePreviewPanel();
  }

  $: canTogglePreview = Boolean($previewState.selectedUuid);
  $: filtersButtonLabel = 'Filtres';
  $: previewToggleLabel = $layoutConfig.showPreviewPanel ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation';
  $: autoCardMode = $previewPanelOpen ? 'compact' : 'detailed';
  $: cardMode = manualCardMode === 'auto' ? autoCardMode : manualCardMode;

  const sortOptions = [
    { value: 'relevance', label: 'Pertinence' },
    { value: 'updated', label: 'Date de mise à jour' },
    { value: 'created', label: 'Date de création' },
    { value: 'difficulty', label: 'Difficulté' }
  ];

  const defaultSortDirections = {
    relevance: 'desc',
    updated: 'desc',
    created: 'desc',
    difficulty: 'asc'
  };

  let sortSelection = 'relevance';
  let sortDirection = 'desc';

  $: sortSelection = $filters.sort ?? 'relevance';
  $: sortDirection = $filters.sortDirection ?? (defaultSortDirections[sortSelection] ?? 'desc');
  $: sortDirectionIcon = sortSelection === 'relevance'
    ? '↕'
    : sortDirection === 'asc'
      ? '↑'
      : '↓';

  function handleSortChange(event) {
    const nextSort = event.target.value;
    if (nextSort === ($filters.sort ?? 'relevance')) {
      return;
    }
    const nextDirection = defaultSortDirections[nextSort] ?? 'desc';
    searchActions.updateFilter('sort', nextSort);
    searchActions.updateFilter('sortDirection', nextSort === 'relevance' ? 'desc' : nextDirection);
    searchActions.search();
  }

  function toggleSortDirection() {
    const currentSort = $filters.sort ?? 'relevance';
    if (currentSort === 'relevance') {
      return;
    }
    const currentDirection = $filters.sortDirection === 'asc' ? 'asc' : 'desc';
    const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    searchActions.updateFilter('sortDirection', nextDirection);
    searchActions.search();
  }
</script>

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="container mx-auto px-4 py-4 sm:py-8">
  <div class="hero-block text-center lg:text-left mb-6 sm:mb-10">
    <div class="hero-inner">
      <img src="/img/logo1.png" alt="OpenYourMath" class="hidden lg:block w-24 h-auto" loading="eager" />
      <div>
        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Recherchez votre exercice</h1>
        <p class="text-gray-600 text-sm sm:text-base">Explorez par mots-clés, puis affinez via les filtres.</p>
      </div>
    </div>
  </div>

  <SearchToolbar
    searchQueryStore={searchQuery}
    onSearchInput={debouncedSearch}
    loading={$loading}
    hasResults={$hasResults}
    filtersButtonLabel={filtersButtonLabel}
    showFiltersButton={true}
    onToggleFilters={toggleFiltersPanel}
    hasSolution={$filters.hasSolution}
    hasIndication={$filters.hasIndication}
    onToggleSolution={toggleSolutionChip}
    onToggleIndication={toggleIndicationChip}
    canTogglePreview={canTogglePreview && !isDesktop}
    previewToggleLabel={previewToggleLabel}
    onTogglePreview={layoutActions.togglePreviewPanel}
    {advancedFiltersOpen}
    onCloseAdvancedFilters={() => (advancedFiltersOpen = false)}
  />

  <ActiveFilters />
  {#if browser}
    <BreadcrumbNav
      query={$searchQuery}
      filters={$filters}
      on:navigate={handleChapterNavigation}
    />
  {/if}

  <div
    class="content-layout"
    class:layout--preview-open={isDesktop && $previewPanelOpen}
  >
    <div class="results-section flex-1" style={`--layout-results-width: ${$layoutConfig.resultsWidth};`}>
      {#if $error}
        <div class="search-error">
          <p class="search-error-text">{$error}</p>
        </div>
      {/if}

      {#if $loading && !$hasResults}
        <div class="text-center py-10">
          <p class="text-gray-500">Recherche en cours...</p>
        </div>
      {:else if $hasResults}
        <div class="results-header mb-4">
          <h2 class="results-title">
            {$searchMeta?.pagination?.totalCount || $results.length}
            résultat{$results.length > 1 ? 's' : ''} trouvé{$results.length > 1 ? 's' : ''}
          </h2>
          <div class="sort-control">
            <div class="view-mode-toggle" role="group" aria-label="Mode d'affichage des cartes">
              <button
                type="button"
                class={`view-mode-btn ${manualCardMode === 'auto' ? 'view-mode-btn--active' : ''}`}
                on:click={() => (manualCardMode = 'auto')}
                title={`Mode auto (${autoCardMode === 'compact' ? 'compact' : 'détaillé'})`}
              >
                Auto
              </button>
              <button
                type="button"
                class={`view-mode-btn ${cardMode === 'compact' && manualCardMode !== 'auto' ? 'view-mode-btn--active' : ''}`}
                on:click={() => (manualCardMode = 'compact')}
                title="Mode compact"
              >
                ▦
              </button>
              <button
                type="button"
                class={`view-mode-btn ${cardMode === 'detailed' && manualCardMode !== 'auto' ? 'view-mode-btn--active' : ''}`}
                on:click={() => (manualCardMode = 'detailed')}
                title="Mode détaillé"
              >
                ☰
              </button>
            </div>
            <label class="sort-label" for="search-sort-select">Trier par</label>
            <div class="sort-select-group">
              <select
                id="search-sort-select"
                class="sort-select"
                bind:value={sortSelection}
                on:change={handleSortChange}
              >
                {#each sortOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
              <button
                type="button"
                class="sort-direction-button"
                on:click={toggleSortDirection}
                aria-label={`Basculer en ordre ${sortDirection === 'asc' ? 'décroissant' : 'croissant'}`}
                title={`Basculer en ordre ${sortDirection === 'asc' ? 'décroissant' : 'croissant'}`}
                disabled={sortSelection === 'relevance'}
              >
                {sortDirectionIcon}
              </button>
            </div>
          </div>
        </div>
        <ResultsGrid
          results={$results}
          activeFilters={$filters}
          {cardMode}
          selectedUuid={$previewState.selectedUuid}
          isPreviewOpen={$previewState.isOpen}
          onSelect={selectExercise}
          hasMore={$searchMeta?.pagination?.hasMore}
          onLoadMore={searchActions.loadMore}
          loadingMore={$loadingMore}
        />
      {:else if $hasSearched}
        <EmptyState
          title="Aucun exercice trouvé"
          subtitle="Essayez d'ajuster les filtres ou votre requête."
        >
          <button slot="action" on:click={searchActions.clearAllFilters} class="btn btn-primary mt-4">
            Effacer tous les filtres
          </button>
        </EmptyState>
      {:else}
        <section class="random-carousel">
          <RandomExercisesCarousel
            selectedUuid={$previewState.selectedUuid}
            isPreviewOpen={$previewState.isOpen}
            on:select={(event) => selectExercise(event.detail.exercise)}
          />
        </section>
      {/if}
    </div>

    <div class="preview-shell">
      {#if isDesktop && $previewPanelOpen}
        <aside class="preview-section" style={`--layout-preview-width: ${$layoutConfig.previewWidth};`}>
          <div class="preview-sticky">
            <ExercisePreview />
          </div>
        </aside>
      {/if}
      {#if isDesktop}
        <button
          type="button"
          class="panel-edge-toggle panel-edge-toggle--preview"
          aria-label={$previewPanelOpen ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation'}
          title={$previewPanelOpen ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation'}
          on:click={toggleDesktopPreviewPanel}
        >
          {$previewPanelOpen ? '›' : '‹'}
        </button>
      {/if}
    </div>
  </div>
</div>


{#if !isDesktop}
  <MobileExercisePreview />
{/if}

<style>
  .hero-inner { display:flex; flex-direction:column; align-items:center; gap:1.5rem; }
  @media (min-width:1024px) {
    .hero-inner { flex-direction:row; align-items:center; justify-content:flex-start; }
  }

  .content-layout {
    display:flex;
    flex-direction:column;
    gap:1.5rem;
    align-items:stretch;
  }
  .preview-shell {
    position:relative;
    overflow:visible;
    min-width:0;
  }
  .panel-edge-toggle {
    position:absolute;
    top:50%;
    transform:translateY(-50%);
    width:1.75rem;
    height:4.25rem;
    border-radius:0.5rem;
    font-size:1.15rem;
    font-weight:700;
    z-index:20;
    @apply border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors;
  }
  .panel-edge-toggle:hover { @apply bg-gray-100 text-gray-900; }
  .panel-edge-toggle--preview {
    left:-0.875rem;
  }
  .results-section { width:100%; flex:1 1 0%; min-width:0; }
  @media (min-width:1024px) {
    .content-layout {
      display:grid;
      grid-template-areas:"results preview";
      grid-template-columns:minmax(0, 1fr) 0;
      transition:grid-template-columns 200ms ease;
      column-gap:0;
      row-gap:1.5rem;
      align-items:start;
    }
    .content-layout.layout--preview-open {
      grid-template-columns:minmax(0, 1fr) minmax(20rem, 28rem);
    }
    .results-section { grid-area:results; }
    .preview-shell { grid-area:preview; }
  }

  .preview-section {
    width:100%;
    @apply border-l border-gray-200;
  }
  @media (min-width:1024px) {
    .preview-section { width:100%; min-width:0; }
  }
  .preview-sticky { position:sticky; top:2rem; height:calc(100vh - 4rem); }

  .search-error {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    @apply bg-red-50 border border-red-200;
  }
  .search-error-text {
    font-size: 0.875rem;
    @apply text-red-600;
  }

  .results-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .results-title {
    font-size: 1.25rem;
    font-weight: 600;
    @apply text-gray-900;
  }
  .sort-control { display:flex; align-items:center; gap:0.5rem; }
  .view-mode-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-right: 0.4rem;
    padding-right: 0.5rem;
    @apply border-r border-gray-200;
  }
  .view-mode-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    font-size: 0.82rem;
    font-weight: 600;
    @apply border border-gray-300 bg-white text-gray-600;
  }
  .view-mode-btn--active {
    @apply bg-brand-600 border-brand-600 text-white;
  }
  .sort-label {
    font-size:0.875rem;
    @apply text-gray-600;
  }
  .sort-select-group { display:flex; align-items:center; gap:0.35rem; }
  .sort-select {
    padding:0.5rem 0.75rem;
    font-size:0.9rem;
    @apply border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500;
  }
  .sort-direction-button {
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:2.25rem;
    height:2.25rem;
    font-size:1rem;
    border-radius:0.75rem;
    transition:background-color .2s, color .2s;
    @apply border border-gray-300 bg-white text-gray-600;
  }
  .sort-direction-button:hover:enabled {
    @apply bg-gray-100 text-gray-800;
  }
  .sort-direction-button:disabled {
    @apply opacity-60 cursor-not-allowed;
  }
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    border-radius: 1rem;
    @apply border border-dashed border-gray-300 bg-gray-50;
  }
  .empty-state-title {
    font-size:1.125rem;
    font-weight:600;
    margin-bottom:0.5rem;
    @apply text-interface-text-primary;
  }
  .empty-state-subtitle {
    font-size:0.95rem;
    @apply text-interface-text-secondary;
  }
</style>
