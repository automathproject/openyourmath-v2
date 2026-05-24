<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import ExercisePreview from '$lib/components/ExercisePreview.svelte';
  import EmptyState from '$lib/components/search/EmptyState.svelte';
  import BreadcrumbNav from '$lib/components/search/BreadcrumbNav.svelte';
  import ActiveFilters from '$lib/components/search/active-filters.svelte';
  import SearchPageSidebar from '$lib/components/search/SearchPageSidebar.svelte';
  import SearchSemantic from '$lib/components/search/SearchSemantic.svelte';
  import ResultsGrid from '$lib/components/search/ResultsGrid.svelte';
  import MobileExercisePreview from '$lib/components/search/MobileExercisePreview.svelte';
  import RandomExercisesCarousel from '$lib/components/search/RandomExercisesCarousel.svelte';
  import { listActions } from '$lib/stores/listStore.js';

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
    resultPathCounts
  } from '$lib/stores/searchStore.js';
  import { previewPanelOpen, uiActions } from '$lib/stores/uiStore.ts';


  let isDesktop = false;
  let filtersExpanded = true;
  let manualCardMode = 'auto'; // auto | compact | detailed

  // debouncedSearch supprimé — SearchSemantic gère son propre dispatch FTS/hybride.

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

  function toggleDesktopPreviewPanel() {
    uiActions.togglePreviewPanel();
  }

  function toggleMobilePreview() {
    if ($previewState.isOpen) {
      previewActions.closePreview();
    } else if ($previewState.selectedUuid) {
      previewActions.selectExercise($previewState.selectedUuid);
    }
  }

  $: canTogglePreview = Boolean($previewState.selectedUuid);
  // FTS expose pagination.hasMore ; hybride expose hasMore directement à la racine du méta
  $: canLoadMore = canLoadMore ?? $searchMeta?.hasMore ?? false;
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

  function isFormFieldFocused() {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return Boolean(active.isContentEditable);
  }

  function getSelectedResultIndex() {
    if (!$results.length || !$previewState.selectedUuid) return -1;
    return $results.findIndex((exercise) => exercise.uuid === $previewState.selectedUuid);
  }

  function addSelectedExerciseToList() {
    const selectedIndex = getSelectedResultIndex();
    if (selectedIndex < 0 || selectedIndex >= $results.length) return;
    const exercise = $results[selectedIndex];
    listActions.addExercise({
      uuid: exercise.uuid,
      title: exercise.title,
      chapter: exercise.chapter,
      theme: exercise.theme,
      author: exercise.author,
      difficulty: exercise.difficulty,
      level: exercise.level,
      module: exercise.module
    });
  }

  function openSelectedExercise() {
    const selectedIndex = getSelectedResultIndex();
    if (selectedIndex < 0 || selectedIndex >= $results.length) return;
    const exercise = $results[selectedIndex];
    if (typeof window !== 'undefined') {
      window.location.href = `/exercise/${exercise.uuid}`;
    }
  }

  function moveSelection(delta) {
    if (!$results.length) return;
    const currentIndex = getSelectedResultIndex();
    const startIndex = currentIndex < 0 ? (delta > 0 ? 0 : $results.length - 1) : currentIndex + delta;
    const nextIndex = Math.max(0, Math.min(startIndex, $results.length - 1));
    const next = $results[nextIndex];
    if (!next) return;
    if (next.uuid !== $previewState.selectedUuid || !$previewState.isOpen) {
      previewActions.selectExercise(next.uuid);
    }
  }

  function handleResultsKeyboardNav(event) {
    if (isFormFieldFocused()) return;
    if (!$results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      openSelectedExercise();
      return;
    }
    if (event.key === 'Escape') {
      if ($previewState.isOpen) {
        event.preventDefault();
        previewActions.closePreview();
      }
      return;
    }
    if (event.key === 'a' || event.key === 'A' || event.key === '+') {
      event.preventDefault();
      addSelectedExerciseToList();
    }
  }

</script>

<svelte:window on:keydown={handleResultsKeyboardNav} />

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="search-page">
  <!-- ── Sticky search hero band ──────────────────────────────── -->
  <div class="search-hero-band">
    <div class="search-hero-inner">
      <div class="search-hero-bc">
        <span>Recherche</span>
        {#if $searchQuery}
          <span class="search-hero-bc-sep">›</span>
          <span class="search-hero-bc-query">{$searchQuery}</span>
        {/if}
      </div>

      <SearchSemantic
        canTogglePreview={canTogglePreview && !isDesktop}
        previewToggleLabel={previewToggleLabel}
        isPreviewOpen={$previewState.isOpen}
        onTogglePreview={toggleMobilePreview}
        {filtersExpanded}
        onToggleExpanded={() => (filtersExpanded = !filtersExpanded)}
      />

      <div class="desktop-meta-shell">
        <ActiveFilters />
      </div>
    </div>
  </div>

  <!-- ── Body ─────────────────────────────────────────────────── -->
  <div class="search-body">
    <div class="search-page-grid" class:search-page-grid--preview-open={isDesktop && $previewPanelOpen}>

      <!-- Sidebar filtres (desktop uniquement) -->
      <div class="sidebar-shell" class:sidebar-shell--collapsed={!filtersExpanded}>
        <SearchPageSidebar />
      </div>

      <div class="search-page-main">

        <!-- Bloc filtres actifs (mobile uniquement) -->
        <div class="mobile-filter-block" class:mobile-filter-block--collapsed={!filtersExpanded}>
          {#if browser}
            <div class="mfb-section">
              <span class="mfb-section-label">Filtrer par</span>
              <BreadcrumbNav
                query={$searchQuery}
                filters={$filters}
                resultPathCounts={$resultPathCounts}
                on:navigate={handleChapterNavigation}
              />
            </div>
          {/if}
          <ActiveFilters />
        </div>

        <div
          class="results-section flex-1"
          style={`--layout-results-width: ${$layoutConfig.resultsWidth};`}
        >
        {#if $error}
        <div class="search-error">
          <p class="search-error-text">{$error}</p>
        </div>
      {/if}

      {#if $loading && !$hasResults}
        <div class="text-center py-10">
          <p class="text-interface-text-muted">Recherche en cours...</p>
        </div>
      {:else if $hasResults}
        <div class="results-header mb-4">
          <div class="results-header-row1">
            <h2 class="results-title">
              {#if canLoadMore}
                {$results.length} résultat{$results.length > 1 ? 's' : ''} affichés
                {#if $searchMeta?.pagination?.totalCount}
                  <span class="results-title-total">sur {$searchMeta.pagination.totalCount}</span>
                {/if}
              {:else}
                {$searchMeta?.pagination?.totalCount || $results.length}
                résultat{($searchMeta?.pagination?.totalCount || $results.length) > 1 ? 's' : ''} trouvé{($searchMeta?.pagination?.totalCount || $results.length) > 1 ? 's' : ''}
              {/if}
            </h2>
            {#if canLoadMore}
              <button
                type="button"
                class="load-more-header-btn"
                on:click={searchActions.loadMore}
                disabled={$loadingMore}
              >
                {$loadingMore ? 'Chargement…' : 'Voir plus'}
              </button>
            {/if}
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
          </div>
          <div class="sort-control">
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
          hasMore={canLoadMore}
          onLoadMore={searchActions.loadMore}
          loadingMore={$loadingMore}
        />
        <p class="results-keyboard-hint">↑↓ naviguer · Entrée ouvrir · A ajouter · Échap fermer</p>
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
</div>


{#if !isDesktop}
  <MobileExercisePreview />
{/if}

<style>
  .search-page {
    min-height: 100vh;
    background: theme('colors.interface.bg-primary');
  }

  /* ── Hero band ──────────────────────────────────────────────── */
  .search-hero-band {
    position: sticky;
    top: 0;
    z-index: 35;
    background: theme('colors.interface.bg-secondary');
    border-bottom: 1px solid theme('colors.interface.border-primary');
    box-shadow: 0 1px 4px rgba(13, 60, 77, 0.06);
  }
  .search-hero-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px 40px 14px;
  }
  .search-hero-bc {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: theme('colors.interface.text-muted');
    margin-bottom: 10px;
  }
  .search-hero-bc-sep { color: theme('colors.interface.border-secondary'); }
  .search-hero-bc-query {
    color: theme('colors.interface.text-secondary');
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Body ───────────────────────────────────────────────────── */
  .search-body {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 0 48px;
  }
  @media (max-width: 1023px) {
    .search-body { padding: 12px 16px 32px; }
  }

  .search-page-grid {
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 1024px) {
    .search-page-grid {
      flex-direction: row;
      align-items: flex-start;
      gap: 0;
    }
  }

  /* ── Sidebar filtres ─────────────────────────────────────────── */
  .sidebar-shell {
    display: none;
  }
  @media (min-width: 641px) and (max-width: 1023px) {
    .sidebar-shell {
      display: block;
      overflow: hidden;
      max-height: 52rem;
      margin-bottom: 1rem;
      border: 1px solid theme('colors.interface.border-primary');
      border-radius: 0.75rem;
      background: theme('colors.interface.bg-secondary');
      transition: max-height 250ms cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 200ms ease,
                  margin-bottom 200ms ease;
      opacity: 1;
    }

    .sidebar-shell--collapsed {
      max-height: 0;
      opacity: 0;
      margin-bottom: 0;
      pointer-events: none;
      border-width: 0;
    }
  }
  @media (min-width: 1024px) {
    .sidebar-shell {
      display: block;
      border-right: 1px solid theme('colors.interface.border-primary');
      position: sticky;
      top: var(--search-controls-height, 9rem);
      max-height: calc(100vh - var(--search-controls-height, 9rem));
      overflow-y: auto;
      align-self: start;
      background: theme('colors.interface.bg-secondary');
    }
  }

  .search-page-main {
    flex: 1;
    min-width: 0;
    padding: 20px 32px 0;
  }
  @media (max-width: 1023px) {
    .search-page-main { padding: 0; }
  }

  :root {
    --app-header-height: 4rem;
    --search-controls-height: 9rem;
  }

  /* ─── Bloc filtres mobile (pliant) ─── */

  /* Caché sur desktop */
  .mobile-filter-block {
    display: none;
  }

  @media (max-width: 640px) {
    .mobile-filter-block {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      overflow: hidden;
      max-height: 40rem; /* suffisamment grand */
      transition: max-height 250ms cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 200ms ease,
                  margin-top 200ms ease;
      opacity: 1;
      margin-top: 0.6rem;
    }

    .mobile-filter-block--collapsed {
      max-height: 0;
      opacity: 0;
      margin-top: 0;
      pointer-events: none;
    }
  }

  .mfb-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .mfb-section-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    @apply text-interface-text-muted;
  }

  .chip {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border-radius: 9999px;
    transition: background-color .2s;
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    white-space: nowrap;
    @apply border border-interface-border-primary bg-interface-bg-tertiary text-interface-text-secondary;
  }
  .chip:hover { @apply bg-interface-bg-secondary; }
  .chip--on { @apply bg-brand-50 text-brand-700 border-brand-200; }
  .chip--off { @apply bg-error-50 text-error-700 border-error-100; }

  /* ─── Desktop : ActiveFilters + BreadcrumbNav sous la toolbar ─── */

  .desktop-meta-shell {
    display: none;
  }

  @media (min-width: 641px) {
    .desktop-meta-shell {
      display: block;
      position: relative;
      overflow: visible;
      margin-top: 0.5rem;
    }
  }

  .results-section {
    width: 100%;
    min-width: 0;
  }

  .preview-shell {
    position: relative;
    overflow: visible;
    min-width: 0;
    width: 100%;
  }

  @media (min-width:1024px) {
    .preview-shell {
      display: block;
      position: sticky;
      top: var(--search-controls-height, 9rem);
      align-self: start;
      z-index: 10;
      max-height: calc(100vh - var(--search-controls-height, 9rem));
    }
  }

  .panel-edge-toggle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 1.75rem;
    height: 4.25rem;
    border-radius: 0.5rem;
    font-size: 1.15rem;
    font-weight: 700;
    z-index: 20;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary shadow-sm transition-colors;
  }
  .panel-edge-toggle:hover { @apply bg-interface-bg-tertiary text-interface-text-primary; }
  .panel-edge-toggle--preview {
    left: -0.875rem;
  }

  @media (min-width:1024px) {
    .search-page-grid {
      display: grid;
      grid-template-areas: "sidebar main preview";
      grid-template-columns: 240px minmax(0, 1fr) 2rem;
      column-gap: 0;
      align-items: start;
      transition: grid-template-columns 200ms ease;
    }

    .search-page-grid.search-page-grid--preview-open {
      grid-template-columns: 240px minmax(0, 1fr) minmax(20rem, 28rem);
    }

    .sidebar-shell {
      grid-area: sidebar;
    }

    .search-page-main {
      grid-area: main;
      min-width: 0;
    }

    .results-section {
      min-height: 20rem;
      padding-bottom: 2rem;
    }

    .preview-shell {
      grid-area: preview;
      min-width: 2rem;
    }
  }

  .preview-section {
    width: 100%;
    height: 100%;
    @apply border-l border-interface-border-primary;
  }

  @media (min-width:1024px) {
    .preview-section {
      width: 100%;
      min-width: 0;
    }
  }

  .preview-sticky {
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
    padding: 1rem;
  }

  @media (min-width:1024px) {
    .preview-sticky {
      max-height: calc(100vh - var(--search-controls-height, 9rem) - 2rem);
    }
  }

  .search-error {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    @apply bg-error-50 border border-error-100;
  }
  .search-error-text {
    font-size: 0.875rem;
    @apply text-error-700;
  }

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* Sur desktop: row1 = titre + bouton voir-plus + view-mode-toggle (poussé à droite) */
  .results-header-row1 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 auto;
  }

  .results-header-row1 .view-mode-toggle {
    margin-left: auto;
  }

  .results-title {
    font-size: 1.125rem;
    font-weight: 600;
    min-width: fit-content;
    @apply text-interface-text-primary;
  }

  .results-title-total {
    font-size: 0.9rem;
    font-weight: 400;
    @apply text-interface-text-muted;
  }

  .load-more-header-btn {
    padding: 0.3rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: 9999px;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background-color 0.15s, color 0.15s;
    @apply border border-brand-300 bg-brand-50 text-brand-700;
  }
  .load-more-header-btn:hover:not(:disabled) {
    @apply bg-brand-100;
  }
  .load-more-header-btn:disabled {
    @apply opacity-60 cursor-not-allowed;
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  /* Sur mobile, ligne 1: titre + view-mode, ligne 2: tri */
  @media (max-width: 640px) {
    .results-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .results-header-row1 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .results-title {
      font-size: 0.9rem;
    }

    .sort-control {
      width: 100%;
      justify-content: flex-end;
    }

    .view-mode-toggle {
      flex: 0 0 auto;
      margin-right: 0;
      padding-right: 0;
      border-right: none;
    }

    .sort-label {
      display: none;
    }

    .sort-select-group {
      flex: 1 1 auto;
      justify-content: flex-end;
    }

    .sort-select {
      flex: 1 1 auto;
      max-width: 160px;
      font-size: 0.8rem;
      padding: 0.4rem 0.5rem;
    }
  }

  .view-mode-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .view-mode-btn {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }

  .view-mode-btn--active {
    @apply bg-brand-600 border-brand-600 text-white;
  }

  .sort-label {
    font-size: 0.875rem;
    white-space: nowrap;
    @apply text-interface-text-secondary;
  }

  .sort-select-group {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .sort-select {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    @apply border border-interface-border-primary rounded-lg bg-interface-bg-white text-interface-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500;
  }

  .sort-direction-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    font-size: 1rem;
    border-radius: 0.75rem;
    transition: background-color .2s, color .2s;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }

  .sort-direction-button:hover:enabled {
    @apply bg-interface-bg-tertiary text-interface-text-primary;
  }

  .sort-direction-button:disabled {
    @apply opacity-60 cursor-not-allowed;
  }

  @media (min-width: 641px) {
    .results-title {
      font-size: 1.25rem;
    }
  }
  .results-keyboard-hint {
    margin-top: 0.7rem;
    font-size: 0.78rem;
    @apply text-interface-text-muted;
  }

  /* Masquer les raccourcis clavier sur mobile */
  @media (max-width: 768px) {
    .results-keyboard-hint {
      display: none;
    }
  }
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    border-radius: 1rem;
    @apply border border-dashed border-interface-border-secondary bg-interface-bg-secondary;
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
