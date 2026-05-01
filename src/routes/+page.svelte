<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import ExercisePreview from '$lib/components/ExercisePreview.svelte';
  import EmptyState from '$lib/components/search/EmptyState.svelte';
  import BreadcrumbNav from '$lib/components/search/BreadcrumbNav.svelte';
  import ActiveFilters from '$lib/components/search/active-filters.svelte';
  import SearchSemantic from '$lib/components/search/SearchSemantic.svelte';
  import ResultsGrid from '$lib/components/search/ResultsGrid.svelte';
  import MobileExercisePreview from '$lib/components/search/MobileExercisePreview.svelte';
  import RandomExercisesCarousel from '$lib/components/search/RandomExercisesCarousel.svelte';
  import { cycleTri } from '$lib/utils/filterUtils.js';
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

  import { useDebounce } from '$lib/hooks/useDebounce.js';

  let isDesktop = false;
  let advancedFiltersOpen = false;
  let filtersExpanded = true;
  let manualCardMode = 'auto'; // auto | compact | detailed
  let isHeaderCollapsed = false;
  let resultsScrollEl;
  const HEADER_COLLAPSE_THRESHOLD = 24;

  // debouncedSearch supprimé — SearchSemantic gère son propre dispatch FTS/hybride.

  onMount(() => {
    suggestionActions.loadSuggestions();

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(min-width: 1024px)');

      const applyViewportState = (matches) => {
        isDesktop = matches;
        syncHeaderCollapsedFromScroll();
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

  function toggleMobilePreview() {
    if ($previewState.isOpen) {
      previewActions.closePreview();
    } else if ($previewState.selectedUuid) {
      previewActions.selectExercise($previewState.selectedUuid);
    }
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

  function handleResultsScroll() {
    // Not used anymore - keeping for compatibility
  }

  function handleWindowScroll() {
    if (typeof window === 'undefined') return;
    syncHeaderCollapsedFromScroll();
  }

  function syncHeaderCollapsedFromScroll() {
    if (typeof window === 'undefined') return;
    const pageScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    isHeaderCollapsed = pageScrollTop > HEADER_COLLAPSE_THRESHOLD;
  }
</script>

<svelte:window on:keydown={handleResultsKeyboardNav} on:scroll={handleWindowScroll} />

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="search-page container mx-auto px-3 py-3 sm:px-4 sm:py-4 lg:py-8" class:search-page--scrolled={isHeaderCollapsed}>
  <div class="hero-block text-center lg:text-left mb-4 sm:mb-6 lg:mb-10" class:hero-block--collapsed={isHeaderCollapsed}>
    <div class="hero-inner">
      <img src="/img/logo1.png" alt="OpenYourMath" class="hidden lg:block w-24 h-auto" loading="eager" />
      <div>
        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Recherchez votre exercice</h1>
        <p class="text-gray-600 text-sm sm:text-base">Explorez par mots-clés, puis affinez via les filtres.</p>
      </div>
    </div>
  </div>

  <div class="search-page-grid" class:search-page-grid--preview-open={isDesktop && $previewPanelOpen}>
    <div class="search-page-main">
      <div class="search-controls-sticky" class:search-controls-sticky--scrolled={isHeaderCollapsed}>

        <!-- Barre de recherche + mode sémantique (drop-in de SearchToolbar) -->
        <SearchSemantic
          onToggleFilters={toggleFiltersPanel}
          hasSolution={$filters.hasSolution}
          hasIndication={$filters.hasIndication}
          onToggleSolution={toggleSolutionChip}
          onToggleIndication={toggleIndicationChip}
          canTogglePreview={canTogglePreview && !isDesktop}
          previewToggleLabel={previewToggleLabel}
          isPreviewOpen={$previewState.isOpen}
          onTogglePreview={toggleMobilePreview}
          {advancedFiltersOpen}
          onCloseAdvancedFilters={() => (advancedFiltersOpen = false)}
          {filtersExpanded}
          onToggleExpanded={() => (filtersExpanded = !filtersExpanded)}
        />

        <!-- Bloc pliant mobile : filtres rapides + hiérarchie -->
        <div class="mobile-filter-block" class:mobile-filter-block--collapsed={!filtersExpanded}>
          <!-- Section "Contenu disponible" -->
          <div class="mfb-section">
            <span class="mfb-section-label">Contenu disponible</span>
            <div class="mfb-chips">
              <button
                type="button"
                class="chip {$filters.hasSolution === '1' ? 'chip--on' : $filters.hasSolution === '0' ? 'chip--off' : ''}"
                on:click={toggleSolutionChip}
                disabled={$loading}
              >
                ✅ Solution{$filters.hasSolution === '1' ? ' • oui' : $filters.hasSolution === '0' ? ' • non' : ''}
              </button>
              <button
                type="button"
                class="chip {$filters.hasIndication === '1' ? 'chip--on' : $filters.hasIndication === '0' ? 'chip--off' : ''}"
                on:click={toggleIndicationChip}
                disabled={$loading}
              >
                💡 Indication{$filters.hasIndication === '1' ? ' • oui' : $filters.hasIndication === '0' ? ' • non' : ''}
              </button>
            </div>
          </div>

          <!-- Section "Filtrer par" : hiérarchie en cascade -->
          <div class="mfb-section">
            <span class="mfb-section-label">Filtrer par</span>
            {#if browser}
              <BreadcrumbNav
                query={$searchQuery}
                filters={$filters}
                resultPathCounts={$resultPathCounts}
                on:navigate={handleChapterNavigation}
              />
            {/if}
          </div>

          <!-- Filtres actifs (auteur, difficulté, etc.) -->
          <ActiveFilters />

          <!-- Bouton filtres avancés -->
          <button
            type="button"
            class="mfb-advanced-btn"
            class:mfb-advanced-btn--active={advancedFiltersOpen}
            on:click={toggleFiltersPanel}
            aria-expanded={advancedFiltersOpen}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" />
            </svg>
            Filtres avancés
          </button>
        </div>

        <!-- Sur desktop : ActiveFilters + BreadcrumbNav restent sous la toolbar -->
        <div class="desktop-meta-shell">
          <ActiveFilters />
          {#if browser}
            <BreadcrumbNav
              query={$searchQuery}
              filters={$filters}
              resultPathCounts={$resultPathCounts}
              on:navigate={handleChapterNavigation}
            />
          {/if}
        </div>

      </div>

      <div
        class="results-section flex-1"
        style={`--layout-results-width: ${$layoutConfig.resultsWidth};`}
        bind:this={resultsScrollEl}
        on:scroll={handleResultsScroll}
      >
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
          <div class="results-header-row1">
            <h2 class="results-title">
              {$searchMeta?.pagination?.totalCount || $results.length}
              résultat{$results.length > 1 ? 's' : ''} trouvé{$results.length > 1 ? 's' : ''}
            </h2>
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
          hasMore={$searchMeta?.pagination?.hasMore}
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


{#if !isDesktop}
  <MobileExercisePreview />
{/if}

<style>
  .search-page {
    --results-scroll-height: auto;
  }
  .hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .hero-block {
    max-height: 18rem;
    opacity: 1;
    overflow: hidden;
    transition: max-height 250ms cubic-bezier(0.4, 0, 0.2, 1),
                opacity 200ms cubic-bezier(0.4, 0, 0.2, 1),
                margin 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Sur mobile, on garde le hero plus longtemps avant collapse */
  @media (max-width: 1023px) {
    .hero-inner {
      padding: 0.5rem 0;
    }
    .hero-block h1 {
      font-size: 1.5rem;
    }
    .hero-block p {
      font-size: 0.875rem;
    }
  }

  .hero-block.hero-block--collapsed {
    max-height: 0;
    opacity: 0;
    margin-bottom: 0;
    pointer-events: none;
  }

  @media (min-width:1024px) {
    .hero-inner {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 1.5rem;
    }
    .search-page {
      --results-scroll-height: calc(100vh - 19rem);
    }
    .search-page.search-page--scrolled {
      --results-scroll-height: calc(100vh - 11rem);
    }
  }

  .search-page-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .search-page-main {
    width: 100%;
    min-width: 0;
  }

  :root {
    --app-header-height: 4rem;
    --search-controls-height: 6.5rem;
  }

  .search-controls-sticky {
    position: sticky;
    top: var(--app-header-height, 4rem);
    z-index: 35;
    padding: 0.75rem;
    transition: box-shadow 200ms ease, background-color 200ms ease, backdrop-filter 200ms ease, border-color 200ms ease;
    background: transparent;
    @apply border border-gray-200 rounded-lg;
  }

  /* Sur mobile, réduire le padding */
  @media (max-width: 640px) {
    .search-controls-sticky {
      padding: 0.5rem;
      border-radius: 0.5rem;
    }
  }

  .search-controls-sticky--scrolled {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
    @apply text-gray-500;
  }

  .mfb-chips {
    display: flex;
    gap: 0.5rem;
  }

  .mfb-chips .chip {
    flex: 1 1 0;
    justify-content: center;
    min-height: 2.25rem;
    font-size: 0.85rem;
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
    @apply border border-gray-200 bg-gray-100 text-gray-700;
  }
  .chip:hover { @apply bg-gray-200; }
  .chip--on { @apply bg-green-100 text-green-700 border-green-200; }
  .chip--off { @apply bg-red-100 text-red-800 border-red-200; }

  .mfb-advanced-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 0.85rem;
    border-radius: 0.6rem;
    font-size: 0.85rem;
    font-weight: 600;
    width: 100%;
    justify-content: center;
    transition: background-color .15s;
    @apply border border-gray-300 bg-gray-50 text-gray-700;
  }
  .mfb-advanced-btn svg { width: 0.9rem; height: 0.9rem; flex-shrink: 0; }
  .mfb-advanced-btn:hover { @apply bg-gray-100; }
  .mfb-advanced-btn--active { @apply bg-brand-50 border-brand-300 text-brand-700; }

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
      top: calc(var(--app-header-height, 4rem) + var(--search-controls-height, 6.5rem));
      align-self: start;
      z-index: 10;
      max-height: calc(100vh - var(--app-header-height, 4rem) - var(--search-controls-height, 6.5rem));
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
    @apply border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors;
  }
  .panel-edge-toggle:hover { @apply bg-gray-100 text-gray-900; }
  .panel-edge-toggle--preview {
    left: -0.875rem;
  }

  @media (min-width:1024px) {
    .search-page-grid {
      display: grid;
      grid-template-areas: "main preview";
      grid-template-columns: minmax(0, 1fr) 2rem;
      column-gap: 0;
      align-items: start;
      transition: grid-template-columns 200ms ease;
    }

    .search-page-grid.search-page-grid--preview-open {
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 28rem);
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
    @apply border-l border-gray-200;
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
      max-height: calc(100vh - var(--app-header-height, 4rem) - var(--search-controls-height, 6.5rem) - 2rem);
    }
  }

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

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* Sur desktop: row1 = titre (flex) + view-mode-toggle, sort-control à droite */
  .results-header-row1 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 auto;
  }

  .results-title {
    font-size: 1.125rem;
    font-weight: 600;
    flex: 1 1 auto;
    min-width: fit-content;
    @apply text-gray-900;
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
    @apply border border-gray-300 bg-white text-gray-600;
  }

  .view-mode-btn--active {
    @apply bg-brand-600 border-brand-600 text-white;
  }

  .sort-label {
    font-size: 0.875rem;
    white-space: nowrap;
    @apply text-gray-600;
  }

  .sort-select-group {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .sort-select {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    @apply border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500;
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
    @apply border border-gray-300 bg-white text-gray-600;
  }

  .sort-direction-button:hover:enabled {
    @apply bg-gray-100 text-gray-800;
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
    @apply text-gray-500;
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
