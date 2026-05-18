<!-- src/routes/+page.svelte — Recherche Hi-Fi -->
<script>
  import { onMount } from 'svelte';
  import SearchSemantic from '$lib/components/search/SearchSemantic.svelte';
  import ResultsGrid from '$lib/components/search/ResultsGrid.svelte';
  import EmptyState from '$lib/components/search/EmptyState.svelte';
  import RandomExercisesCarousel from '$lib/components/search/RandomExercisesCarousel.svelte';
  import ExercisePreview from '$lib/components/ExercisePreview.svelte';
  import SearchPageSidebar from '$lib/components/search/SearchPageSidebar.svelte';
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
  } from '$lib/stores/searchStore.js';
  import { previewPanelOpen, uiActions } from '$lib/stores/uiStore.ts';

  let isDesktop = false;

  onMount(() => {
    suggestionActions.loadSuggestions();

    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 1024px)');
      isDesktop = mq.matches;
      const onChange = (e) => { isDesktop = e.matches; };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  });

  function selectExercise(exercise) {
    previewActions.selectExercise(exercise.uuid);
    if (!$previewPanelOpen) uiActions.togglePreviewPanel();
  }

  function isFormFieldFocused() {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return Boolean(active.isContentEditable);
  }

  function getSelectedIndex() {
    if (!$results.length || !$previewState.selectedUuid) return -1;
    return $results.findIndex((e) => e.uuid === $previewState.selectedUuid);
  }

  function moveSelection(delta) {
    if (!$results.length) return;
    const cur = getSelectedIndex();
    const next = Math.max(0, Math.min((cur < 0 ? (delta > 0 ? 0 : $results.length - 1) : cur + delta), $results.length - 1));
    const exo = $results[next];
    if (exo) previewActions.selectExercise(exo.uuid);
  }

  function openSelected() {
    const idx = getSelectedIndex();
    if (idx < 0) return;
    const exo = $results[idx];
    if (exo && typeof window !== 'undefined') window.location.href = `/exercise/${exo.uuid}`;
  }

  function addSelectedToList() {
    const idx = getSelectedIndex();
    if (idx < 0) return;
    const exo = $results[idx];
    if (exo) listActions.addExercise({ uuid: exo.uuid, title: exo.title, chapter: exo.chapter, theme: exo.theme, author: exo.author, difficulty: exo.difficulty, level: exo.level, module: exo.module });
  }

  function handleKeydown(event) {
    if (isFormFieldFocused()) return;
    if (!$results.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); openSelected(); }
    else if (event.key === 'Escape' && $previewState.isOpen) { event.preventDefault(); previewActions.closePreview(); }
    else if (event.key === 'a' || event.key === 'A' || event.key === '+') { event.preventDefault(); addSelectedToList(); }
  }

  // Sort
  const sortOptions = [
    { value: 'relevance', label: 'Pertinence' },
    { value: 'updated',   label: 'Date de mise à jour' },
    { value: 'difficulty', label: 'Difficulté' },
  ];

  $: currentSort = $filters.sort ?? 'relevance';

  function handleSortChange(event) {
    const next = event.target.value;
    if (next === currentSort) return;
    searchActions.updateFilter('sort', next);
    searchActions.updateFilter('sortDirection', next === 'relevance' ? 'desc' : 'asc');
    searchActions.search();
  }

  function removeFilter(key) {
    searchActions.updateFilter(key, '');
    searchActions.search();
  }

  // Active filter chips derived from the filter store
  $: activeChips = [
    $filters.level      && { key: 'level',      label: `Niveau · ${$filters.level}` },
    $filters.module     && { key: 'module',     label: `Module · ${$filters.module}` },
    $filters.chapter    && { key: 'chapter',    label: $filters.chapter },
    $filters.hasSolution === '1'   && { key: 'hasSolution',   label: 'Avec solution' },
    $filters.hasIndication === '1' && { key: 'hasIndication', label: 'Avec indication' },
    $filters.hasVideo === '1'      && { key: 'hasVideo',      label: 'Avec vidéo' },
    $filters.author     && { key: 'author',     label: `Auteur · ${$filters.author}` },
    $filters.difficulty && { key: 'difficulty', label: `Diff. ≤ ${'★'.repeat(Number($filters.difficulty))}` },
  ].filter(Boolean);

  function clearAllFilters() {
    searchActions.clearAllFilters();
    searchActions.search();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="search-page">

  <!-- ── Search hero ────────────────────────────────────── -->
  <section class="search-hero">
    <div class="hero-inner">
      <!-- Search bar via SearchSemantic (handles FTS/hybrid/stores) -->
      <div class="hero-input-row">
        <SearchSemantic
          advancedFiltersOpen={false}
          onToggleFilters={() => {}}
          onCloseAdvancedFilters={() => {}}
          filtersExpanded={true}
          onToggleExpanded={() => {}}
          hasSolution={$filters.hasSolution}
          hasIndication={$filters.hasIndication}
          onToggleSolution={() => {}}
          onToggleIndication={() => {}}
        />
      </div>

      <!-- Active filter chips + sort -->
      {#if activeChips.length > 0}
        <div class="hero-chips-row">
          <span class="chips-label">Filtres actifs :</span>
          {#each activeChips as chip}
            <span class="filter-chip">
              {chip.label}
              <button class="chip-remove" aria-label="Retirer {chip.label}" on:click={() => removeFilter(chip.key)}>×</button>
            </span>
          {/each}
          <button class="clear-all-btn" on:click={clearAllFilters}>tout effacer</button>
          <span class="spacer"></span>
          <span class="sort-label">Tri :</span>
          <select class="sort-select" value={currentSort} on:change={handleSortChange}>
            {#each sortOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      {:else if $hasResults}
        <div class="hero-chips-row">
          <span class="spacer"></span>
          <span class="sort-label">Tri :</span>
          <select class="sort-select" value={currentSort} on:change={handleSortChange}>
            {#each sortOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      {/if}
    </div>
  </section>

  <!-- ── 3-column body ──────────────────────────────────── -->
  <div class="search-body">

    <!-- Left: filter sidebar -->
    <SearchPageSidebar />

    <!-- Center: results -->
    <main class="results-pane">
      {#if $error}
        <div class="results-error">
          <p>{$error}</p>
        </div>
      {/if}

      {#if $loading && !$hasResults}
        <div class="results-loading">Recherche en cours…</div>
      {:else if $hasResults}
        <!-- Results header -->
        <div class="results-header">
          <h2 class="results-count">
            {$searchMeta?.pagination?.totalCount || $results.length}
            <span class="results-count-label">
              résultat{$results.length > 1 ? 's' : ''}
              {#if $searchQuery}· pour « {$searchQuery} »{/if}
            </span>
          </h2>
        </div>

        <ResultsGrid
          results={$results}
          activeFilters={$filters}
          cardMode="detailed"
          selectedUuid={$previewState.selectedUuid}
          isPreviewOpen={$previewState.isOpen}
          onSelect={selectExercise}
          hasMore={$searchMeta?.pagination?.hasMore}
          onLoadMore={searchActions.loadMore}
          loadingMore={$loadingMore}
        />

        <p class="keyboard-hint">↑↓ naviguer · Entrée ouvrir · A ajouter · Échap fermer</p>

      {:else if $hasSearched}
        <EmptyState
          title="Aucun exercice trouvé"
          subtitle="Essayez d'ajuster les filtres ou votre requête."
        >
          <button slot="action" on:click={clearAllFilters} class="btn-clear-slot">
            Effacer tous les filtres
          </button>
        </EmptyState>
      {:else}
        <section class="random-section">
          <RandomExercisesCarousel
            selectedUuid={$previewState.selectedUuid}
            isPreviewOpen={$previewState.isOpen}
            on:select={(e) => selectExercise(e.detail.exercise)}
          />
        </section>
      {/if}
    </main>

    <!-- Right: preview panel -->
    {#if isDesktop && $previewPanelOpen}
      <aside class="preview-pane">
        <ExercisePreview />
      </aside>
    {/if}

    <!-- Preview edge toggle (desktop) -->
    {#if isDesktop}
      <button
        class="preview-edge-toggle"
        aria-label={$previewPanelOpen ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation'}
        on:click={() => uiActions.togglePreviewPanel()}
      >
        {$previewPanelOpen ? '›' : '‹'}
      </button>
    {/if}

  </div>

</div>

<!-- Mobile preview overlay -->
{#if !isDesktop && $previewState.isOpen}
  <div class="mobile-preview-overlay">
    <div class="mobile-preview-header">
      <h3 class="mobile-preview-title">{$previewState.exercise?.title ?? 'Exercice'}</h3>
      <button class="mobile-preview-close" on:click={() => previewActions.closePreview()}>✕</button>
    </div>
    <div class="mobile-preview-body">
      <ExercisePreview />
    </div>
  </div>
{/if}

<style>
  /* ─── Page shell ─────────────────────────────────── */
  .search-page {
    display: flex;
    flex-direction: column;
    /* fill the viewport below the sticky header (4rem) */
    height: calc(100vh - 4rem);
    background: var(--oym-bg);
    font-family: var(--oym-font-sans);
    /* Override the main-content max-width for a full-bleed layout */
    width: 100%;
    max-width: 100%;
    margin: 0;
  }

  /* ─── Search hero ────────────────────────────────── */
  .search-hero {
    flex-shrink: 0;
    padding: 16px 24px 12px;
    border-bottom: 1px solid var(--oym-hairline);
    background: var(--oym-bg);
  }

  .hero-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Override SearchSemantic / SearchToolbar internals for the hi-fi design */
  .hero-input-row :global(.toolbar) {
    background: transparent;
    border: none;
    padding: 0;
    box-shadow: none;
  }

  .hero-input-row :global(.toolbar-top) {
    gap: 12px;
  }

  .hero-input-row :global(.toolbar-search) {
    flex: 1;
    height: 50px;
    border: 1px solid var(--oym-line);
    border-radius: 8px;
    background: var(--oym-bg);
    font-size: 16px;
    padding: 0 16px;
    gap: 10px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .hero-input-row :global(.toolbar-search:focus-within) {
    border-color: var(--oym-teal);
    box-shadow: var(--oym-sh-focus);
  }

  .hero-input-row :global(.search-input) {
    font-family: var(--oym-font-sans);
    font-size: 16px;
    color: var(--oym-ink);
  }

  .hero-input-row :global(.search-input::placeholder) {
    color: var(--oym-ink-3);
  }

  /* Hide the toolbar-actions row (solution chips etc. moved to sidebar) */
  .hero-input-row :global(.toolbar-actions) {
    display: none;
  }

  /* Hide mobile collapse toggle */
  .hero-input-row :global(.collapse-toggle) {
    display: none;
  }

  /* Keep the submit/search button from SearchSemantic (if any) */
  .hero-input-row :global(.toolbar-submit) {
    background: var(--oym-ink);
    color: var(--oym-bg);
    border: none;
    border-radius: 8px;
    font-family: var(--oym-font-sans);
    font-size: 14px;
    font-weight: 600;
    padding: 0 20px;
    height: 50px;
    cursor: pointer;
    white-space: nowrap;
  }

  /* Active filter chips row */
  .hero-chips-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .chips-label {
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-ink-3);
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px 4px 11px;
    border-radius: 999px;
    border: 1px solid var(--oym-ink);
    background: var(--oym-ink);
    color: var(--oym-bg);
    font-family: var(--oym-font-sans);
    font-size: 12px;
    font-weight: 500;
  }

  .chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
    opacity: 0.7;
    padding: 0;
    line-height: 1;
  }

  .chip-remove:hover { opacity: 1; background: rgba(255,255,255,0.15); }

  .clear-all-btn {
    background: none;
    border: none;
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-ink-3);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
  }

  .clear-all-btn:hover { color: var(--oym-ink); }

  .spacer { flex: 1; }

  .sort-label {
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-ink-3);
    white-space: nowrap;
  }

  .sort-select {
    font-family: var(--oym-font-sans);
    font-size: 13px;
    color: var(--oym-ink);
    border: 1px solid var(--oym-line-2);
    border-radius: 6px;
    background: var(--oym-bg);
    padding: 5px 10px;
    cursor: pointer;
  }

  /* ─── 3-column body ──────────────────────────────── */
  .search-body {
    flex: 1;
    min-height: 0;
    display: flex;
    position: relative;
  }

  /* Results pane */
  .results-pane {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: 20px 24px 40px;
    background: var(--oym-bg);
  }

  .results-header {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
    gap: 12px;
  }

  .results-count {
    font-family: var(--oym-font-serif);
    font-size: 22px;
    font-weight: 600;
    color: var(--oym-ink);
    margin: 0;
    line-height: 1.1;
    letter-spacing: -0.3px;
  }

  .results-count-label {
    font-family: var(--oym-font-sans);
    font-size: 15px;
    font-weight: 400;
    color: var(--oym-ink-3);
    margin-left: 4px;
  }

  .results-loading {
    padding: 40px 0;
    text-align: center;
    font-family: var(--oym-font-sans);
    font-size: 14px;
    color: var(--oym-ink-3);
  }

  .results-error {
    margin-top: 8px;
    padding: 12px 14px;
    border-radius: 6px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-size: 14px;
  }

  .keyboard-hint {
    margin-top: 12px;
    font-size: 12px;
    color: var(--oym-ink-4);
    font-family: var(--oym-font-sans);
  }

  .random-section {
    padding-top: 8px;
  }

  /* Preview pane */
  .preview-pane {
    width: 360px;
    flex-shrink: 0;
    border-left: 1px solid var(--oym-hairline);
    overflow-y: auto;
    background: var(--oym-bg-elev);
    position: relative;
  }

  .preview-edge-toggle {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 56px;
    border-radius: 6px 0 0 6px;
    background: var(--oym-bg);
    border: 1px solid var(--oym-hairline);
    border-right: none;
    font-size: 14px;
    font-weight: 700;
    color: var(--oym-ink-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
    transition: background 0.15s, color 0.15s;
  }

  .preview-edge-toggle:hover {
    background: var(--oym-bg-elev);
    color: var(--oym-ink);
  }

  /* Slot action button */
  .btn-clear-slot {
    display: inline-flex;
    align-items: center;
    padding: 9px 18px;
    border-radius: 999px;
    border: 1px solid var(--oym-ink);
    background: var(--oym-ink);
    color: var(--oym-bg);
    font-family: var(--oym-font-sans);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 16px;
    transition: background 0.15s;
  }

  .btn-clear-slot:hover { background: var(--oym-teal-700); border-color: var(--oym-teal-700); }

  /* ─── Mobile preview overlay ─────────────────────── */
  .mobile-preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    background: var(--oym-bg-elev);
  }

  .mobile-preview-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--oym-hairline);
    background: var(--oym-bg);
    flex-shrink: 0;
  }

  .mobile-preview-title {
    flex: 1;
    font-family: var(--oym-font-serif);
    font-size: 16px;
    font-weight: 600;
    color: var(--oym-ink);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-preview-close {
    background: none;
    border: none;
    color: var(--oym-ink-3);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    flex-shrink: 0;
  }

  .mobile-preview-body {
    flex: 1;
    overflow-y: auto;
  }

  /* ─── Responsive ─────────────────────────────────── */
  @media (max-width: 1023px) {
    .search-page {
      height: auto;
      min-height: calc(100vh - 4rem);
    }

    .search-body {
      flex-direction: column;
    }

    /* On tablet/mobile, hide the filter sidebar and preview */
    .preview-edge-toggle { display: none; }
  }

  @media (max-width: 640px) {
    .search-hero {
      padding: 12px 14px 10px;
    }

    .results-pane {
      padding: 14px 14px 40px;
    }
  }
</style>
