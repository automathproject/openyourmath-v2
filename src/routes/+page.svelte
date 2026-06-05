<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import { fly } from 'svelte/transition';
  import { cubicIn, cubicOut } from 'svelte/easing';
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
  let searchInterfaceOpened = false;

  // ── Landing ────────────────────────────────────────────────────
  let localLandingQuery = '';
  $: isLanding = !$hasSearched && !searchInterfaceOpened;
  $: if (!$hasSearched) localLandingQuery = '';

  const popularQueries = [
    'intégrale par parties',
    'suites récurrentes',
    'espaces vectoriels',
    'probabilités conditionnelles',
    'séries entières'
  ];

  function handleLandingSearch() {
    const q = localLandingQuery.trim();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    searchInterfaceOpened = true;
    if (!q) return;
    searchQuery.set(q);
  }

  function handlePopularQuery(query) {
    localLandingQuery = query;
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    searchInterfaceOpened = true;
    searchQuery.set(query);
  }

  function focusInput(node) {
    node.focus();
  }

  // debouncedSearch supprimé — SearchSemantic gère son propre dispatch FTS/hybride.

  onMount(() => {
    suggestionActions.loadSuggestions();

    if (typeof window !== 'undefined') {
      const urlQuery = new URL(window.location.href).searchParams.get('q') || '';
      if (urlQuery) {
        searchQuery.set(urlQuery);
      }

      const mediaQuery = window.matchMedia('(min-width: 1024px)');

      const applyViewportState = (matches) => {
        isDesktop = matches;
        filtersExpanded = matches;
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
    searchInterfaceOpened = true;
    searchActions.updateFromNavigation({ level, module, chapter, subchapter });
    searchActions.search();
  }

  function selectExercise(exercise) {
    previewActions.selectExercise(exercise.uuid);
  }

  function handleCarouselSelect(exercise) {
    // Applique un filtre contextuel pour sortir du landing et alimenter les résultats
    if (exercise.module) {
      searchActions.updateFilter('module', exercise.module);
    } else if (exercise.level) {
      searchActions.updateFilter('level', exercise.level);
    } else {
      searchQuery.set(exercise.title || '');
    }
    searchInterfaceOpened = true;
    // Lance la recherche via le store (SearchSemantic n'est pas encore monté)
    searchActions.search();
    // Sélectionne l'exercice pour la prévisualisation
    previewActions.selectExercise(exercise.uuid);
    // Ouvre le panneau de prévisualisation sur desktop s'il est fermé
    if (isDesktop && !get(previewPanelOpen)) {
      uiActions.togglePreviewPanel();
    }
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
  // FTS expose pagination.hasMore ; hybride expose hasMore directement à la racine du méta.
  $: canLoadMore = Boolean($searchMeta?.pagination?.hasMore ?? $searchMeta?.hasMore);
  $: previewToggleLabel = $layoutConfig.showPreviewPanel ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation';
  $: autoCardMode = isDesktop && $previewPanelOpen ? 'compact' : 'detailed';
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
  $: currentSortLabel = sortOptions.find((option) => option.value === sortSelection)?.label ?? 'Pertinence';
  $: isHybridSearchMode = Boolean($searchMeta?.semantic || String($searchMeta?.mode || '').startsWith('hybrid'));
  $: activeFilterCount = [
    $filters.level,
    $filters.module,
    $filters.chapter,
    $filters.subchapter,
    $filters.difficulty,
    $filters.author,
    $filters.organization,
    $filters.createdFrom,
    $filters.createdTo,
    $filters.updatedFrom,
    $filters.updatedTo,
    $filters.hasSolution,
    $filters.hasIndication,
    $filters.hasVideo
  ].filter((value) => value !== '' && value !== null && value !== undefined).length;

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

  function toggleMobileSearchMode() {
    searchActions.search(isHybridSearchMode ? 'fts' : 'hybrid');
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

<div class="search-page" class:search-page--landing={isLanding}>
  {#if isLanding}
    <!-- ── Landing hero ──────────────────────────────────────────── -->
    <section
      class="landing-hero"
      out:fly={{ y: -60, duration: 350, easing: cubicIn }}
    >
      <div class="landing-hero-inner">
        <div class="landing-hero-layout">
          <picture class="landing-logo-picture">
            <source media="(max-width: 640px)" srcset="/img/logo_big.png" />
            <img
              class="landing-logo"
              src="/img/logo_illustration.png"
              alt="OpenYourMath"
              width="990"
              height="950"
            />
          </picture>
          <div class="landing-content">
            <div class="landing-copy">
              <h1 class="landing-title">
                <span class="sr-only">OpenYourMath.org</span>
                <img
                  class="landing-title-logo"
                  src="/img/logo_wordmark.png"
                  alt=""
                  width="1145"
                  height="220"
                  aria-hidden="true"
                />
              </h1>
              <p class="landing-subtitle">Plus de 8 000 exercices de mathématiques, librement accessibles</p>
            </div>

            <div class="landing-search-box">
              <div class="landing-input-wrap">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" class="landing-search-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  bind:value={localLandingQuery}
                  on:keydown={(e) => { if (e.key === 'Enter') handleLandingSearch(); }}
                  placeholder="Cherche un exercice, une notion, un théorème…"
                  aria-label="Rechercher des exercices"
                  use:focusInput
                />
              </div>
              <button class="landing-search-btn" on:click={handleLandingSearch}>
                <svg class="landing-search-btn-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span class="landing-search-btn-label">Rechercher</span>
              </button>
            </div>

            <div class="popular-row">
              <span class="popular-label">Populaires :</span>
              {#each popularQueries as pq}
                <button class="popular-chip" on:click={() => handlePopularQuery(pq)}>{pq}</button>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Landing carousel ───────────────────────────────────────── -->
    <div class="landing-discover">
      <RandomExercisesCarousel
        selectedUuid={$previewState.selectedUuid}
        isPreviewOpen={$previewState.isOpen}
        on:select={(event) => handleCarouselSelect(event.detail.exercise)}
      />
    </div>

  {:else}
    <!-- ── Sticky search hero band ──────────────────────────────── -->
    <div
      class="search-hero-band"
      in:fly={{ y: -30, duration: 300, easing: cubicOut }}
    >
      <div class="search-hero-inner">
        <SearchSemantic
          canTogglePreview={canTogglePreview && !isDesktop}
          previewToggleLabel={previewToggleLabel}
          isPreviewOpen={$previewState.isOpen}
          onTogglePreview={toggleMobilePreview}
          {filtersExpanded}
          {activeFilterCount}
          onToggleExpanded={() => (filtersExpanded = !filtersExpanded)}
        />

        <div class="mobile-search-chips" aria-label="Contrôles de recherche mobile">
          <button
            type="button"
            class="mobile-control-chip"
            class:mobile-control-chip--active={activeFilterCount > 0}
            on:click={() => (filtersExpanded = !filtersExpanded)}
            aria-expanded={filtersExpanded}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 5h18" />
              <path d="M6 12h12" />
              <path d="M10 19h4" />
            </svg>
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          <label class="mobile-control-chip mobile-sort-chip" aria-label="Trier les résultats">
            <span>{currentSortLabel}</span>
            <select bind:value={sortSelection} on:change={handleSortChange}>
              {#each sortOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          <button
            type="button"
            class="mobile-control-chip"
            class:mobile-control-chip--disabled={sortSelection === 'relevance'}
            on:click={toggleSortDirection}
            disabled={sortSelection === 'relevance'}
            aria-label={`Ordre ${sortDirection === 'asc' ? 'croissant' : 'décroissant'}`}
          >
            {sortDirectionIcon} {sortDirection === 'asc' ? 'Croissant' : 'Décroissant'}
          </button>

          <button
            type="button"
            class="mobile-mode-switch"
            class:mobile-mode-switch--hybrid={isHybridSearchMode}
            on:click={toggleMobileSearchMode}
            role="switch"
            aria-checked={isHybridSearchMode}
            aria-label={isHybridSearchMode ? 'Mode IA activé' : 'Mode rapide activé'}
            title={isHybridSearchMode ? 'Mode IA activé' : 'Mode rapide activé'}
          >
            <span class="mobile-mode-switch-thumb" aria-hidden="true"></span>
            <span class="mobile-mode-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </span>
            <span class="mobile-mode-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
            </span>
            <span class="mobile-mode-label">{isHybridSearchMode ? 'Mode IA' : 'Mode rapide'}</span>
          </button>
        </div>

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
            <div class="mobile-sidebar-shell">
              <SearchPageSidebar />
            </div>
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
                      {$loadingMore ? 'Chargement…' : 'Afficher plus de résultats'}
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
                compactColumns={manualCardMode === 'compact' ? 'force' : 'auto'}
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
                <div slot="action" class="empty-state-actions">
                  {#if $searchQuery}
                    <button type="button" on:click={() => searchActions.search('hybrid')} class="btn btn-primary">
                      Essayer la recherche intelligente
                    </button>
                  {/if}
                  <button type="button" on:click={searchActions.clearAllFilters} class="btn btn-secondary">
                    Effacer tous les filtres
                  </button>
                </div>
              </EmptyState>
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
  {/if}
</div>


{#if !isDesktop}
  <MobileExercisePreview />
{/if}

<style>
  .search-page {
    min-height: 100vh;
    background: theme('colors.interface.bg-white');
  }

  .search-page--landing {
    min-height: auto;
  }

  /* ── Landing hero ───────────────────────────────────────────── */
  .landing-hero {
    background: theme('colors.interface.bg-white');
    border-bottom: 1px solid theme('colors.interface.border-primary');
    padding: 72px 24px 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .landing-hero-inner {
    max-width: 860px;
    width: 100%;
  }

  .landing-hero-layout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }

  .landing-logo-picture {
    display: block;
    flex: 0 0 auto;
  }

  .landing-logo {
    display: block;
    width: clamp(9.5rem, 18vw, 14rem);
    height: auto;
    border-radius: 1.75rem;
    filter: drop-shadow(0 18px 32px rgba(13, 60, 77, 0.12));
  }

  .landing-content {
    min-width: 0;
    flex: 1 1 34rem;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1.25rem;
  }

  .landing-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    text-align: left;
  }

  .landing-title {
    width: min(100%, 34rem);
    margin: 0;
  }

  .landing-title-logo {
    display: block;
    width: 100%;
    height: auto;
  }

  .landing-subtitle {
    font-size: 1rem;
    margin: 0;
    @apply text-interface-text-secondary;
  }

  .landing-search-box {
    display: flex;
    width: 100%;
    gap: 0.5rem;
    align-items: center;
  }

  .landing-input-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0 1rem;
    height: 3rem;
    border-radius: 0.75rem;
    gap: 0.5rem;
    @apply border border-interface-border-primary bg-interface-bg-white;
  }

  .landing-search-icon {
    flex-shrink: 0;
    @apply text-interface-text-muted;
  }

  .landing-input-wrap input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.95rem;
    background: transparent;
    min-width: 0;
    @apply text-interface-text-primary;
  }

  .landing-input-wrap input:focus {
    outline: none;
    box-shadow: none;
    --tw-ring-shadow: 0 0 #0000;
  }

  .landing-input-wrap input::placeholder {
    @apply text-interface-text-muted;
  }

  .landing-search-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    height: 3rem;
    padding: 0 1.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 0.75rem;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background-color 0.15s;
    @apply bg-brand-600 text-white border border-brand-600;
  }

  .landing-search-btn:hover {
    @apply bg-brand-700 border-brand-700;
  }

  .landing-search-btn-icon {
    display: none;
    flex-shrink: 0;
  }

  .popular-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .popular-label {
    font-size: 0.875rem;
    @apply text-interface-text-secondary;
  }

  .popular-chip {
    padding: 0.35rem 0.8rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }

  .popular-chip:hover {
    @apply bg-brand-50 border-brand-200 text-brand-700;
  }

  .landing-discover {
    padding: 2rem 2rem 3rem;
  }

  @media (max-width: 640px) {
    .landing-hero {
      padding: 24px 20px 18px;
    }
    .landing-hero-layout {
      flex-direction: column;
      gap: 0.65rem;
    }
    .landing-logo {
      width: 8.25rem;
      border-radius: 1.25rem;
    }
    .landing-content {
      flex: 0 1 auto;
      width: 100%;
      gap: 0.8rem;
    }
    .landing-copy {
      gap: 0.35rem;
      text-align: center;
    }
    .landing-title {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
    .landing-title-logo {
      display: none;
    }
    .landing-subtitle {
      font-size: 0.92rem;
    }
    .landing-search-box {
      flex-direction: row;
    }
    .landing-input-wrap {
      min-width: 0;
    }
    .landing-search-btn {
      width: 3rem;
      padding: 0;
    }
    .landing-search-btn-icon { display: block; }
    .landing-search-btn-label { display: none; }
    .landing-discover {
      padding: 0.75rem 1rem 2rem;
    }
  }

  /* ── Hero band ──────────────────────────────────────────────── */
  .search-hero-band {
    position: sticky;
    top: 0;
    z-index: 35;
    background: theme('colors.interface.bg-white');
    border-bottom: 1px solid theme('colors.interface.border-primary');
    box-shadow: 0 1px 4px rgba(13, 60, 77, 0.06);
  }
  .search-hero-inner {
    padding: 12px 40px;
  }

  /* ── Body ───────────────────────────────────────────────────── */
  .search-body {
    padding: 0 0 48px;
  }
  @media (max-width: 1023px) {
    .search-body { padding: 12px 16px 32px; }
  }

  .search-page-grid {
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 641px) and (max-width: 1023px) {
    .search-page-grid {
      position: relative;
    }
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
      position: absolute;
      top: 0;
      right: 0;
      width: min(24rem, calc(100vw - 2rem));
      max-height: min(34rem, calc(100vh - var(--search-controls-height, 9rem) - 1.25rem));
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 30;
      border: 1px solid theme('colors.interface.border-primary');
      border-radius: 0.75rem;
      background: theme('colors.interface.bg-white');
      box-shadow: 0 18px 44px rgba(13, 60, 77, 0.18);
      transform: translateY(0);
      transition: transform 200ms ease, opacity 160ms ease;
      opacity: 1;
    }

    .sidebar-shell--collapsed {
      transform: translateY(-0.35rem);
      opacity: 0;
      pointer-events: none;
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
      background: theme('colors.interface.bg-white');
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
      overflow: visible;
      max-height: none;
      transition: max-height 250ms cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 200ms ease,
                  margin-top 200ms ease;
      opacity: 1;
      margin-top: 0.6rem;
    }

    .mobile-filter-block--collapsed {
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      margin-top: 0;
      pointer-events: none;
    }
  }

  .mobile-sidebar-shell {
    display: none;
  }

  @media (max-width: 640px) {
    .mobile-sidebar-shell {
      display: block;
      overflow: visible;
      border: 1px solid theme('colors.interface.border-primary');
      border-radius: 0.75rem;
      background: theme('colors.interface.bg-white');
    }

    .mobile-sidebar-shell :global(.sps) {
      padding: 14px 14px 16px;
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

  .mobile-search-chips {
    display: none;
  }

  @media (max-width: 640px) {
    .mobile-search-chips {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin-top: 0.55rem;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 0.05rem;
    }

    .mobile-search-chips::-webkit-scrollbar {
      display: none;
    }

    .mobile-control-chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      flex: 0 0 auto;
      min-height: 2.35rem;
      padding: 0 0.7rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
      @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
    }

    .mobile-control-chip svg {
      width: 0.95rem;
      height: 0.95rem;
      flex-shrink: 0;
    }

    .mobile-control-chip--active {
      @apply border-brand-300 bg-brand-50 text-brand-700;
    }

    .mobile-control-chip--ia {
      @apply text-brand-700;
    }

    .mobile-control-chip--disabled {
      opacity: 0.62;
    }

    .mobile-mode-switch {
      position: relative;
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      flex: 0 0 auto;
      width: 4.25rem;
      height: 2.35rem;
      padding: 0.16rem;
      border-radius: 9999px;
      isolation: isolate;
      transition: border-color 0.14s, background 0.14s;
      @apply border border-interface-border-primary bg-interface-bg-tertiary text-interface-text-muted;
    }

    .mobile-mode-switch--hybrid {
      @apply border-brand-300 bg-brand-50;
    }

    .mobile-mode-switch-thumb {
      position: absolute;
      z-index: 0;
      left: 0.16rem;
      top: 0.16rem;
      width: calc(50% - 0.16rem);
      height: calc(100% - 0.32rem);
      border-radius: 9999px;
      transform: translateX(0);
      transition: transform 0.16s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      @apply bg-interface-bg-white;
    }

    .mobile-mode-switch--hybrid .mobile-mode-switch-thumb {
      transform: translateX(100%);
      @apply bg-brand-600;
    }

    .mobile-mode-icon {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      transition: color 0.14s;
    }

    .mobile-mode-icon svg {
      width: 0.92rem;
      height: 0.92rem;
    }

    .mobile-mode-icon:first-of-type {
      @apply text-interface-text-primary;
    }

    .mobile-mode-switch--hybrid .mobile-mode-icon:first-of-type {
      @apply text-interface-text-muted;
    }

    .mobile-mode-switch--hybrid .mobile-mode-icon:nth-of-type(2) {
      @apply text-white;
    }

    .mobile-mode-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .mobile-sort-chip select {
      position: absolute;
      inset: 0;
      opacity: 0;
      width: 100%;
      height: 100%;
      border: 0;
      cursor: pointer;
    }
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
      display: none;
    }

    .view-mode-toggle {
      display: none;
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
    @apply border border-dashed border-interface-border-secondary bg-interface-bg-white;
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
  .empty-state-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  @media (max-width: 640px) {
    .results-header {
      margin-bottom: 0.55rem;
    }

    .results-header-row1 .view-mode-toggle,
    .sort-control {
      display: none !important;
    }

    .results-header-row1 {
      justify-content: flex-start;
    }

    .load-more-header-btn {
      display: none;
    }
  }
</style>
