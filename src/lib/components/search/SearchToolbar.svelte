<script>
  import AdvancedFiltersPopover from '$lib/components/search/AdvancedFiltersPopover.svelte';

  export let searchQueryStore;
  export let onSearchInput = () => {};
  export let loading = false;
  export let hasResults = false;
  export let filtersButtonLabel = 'Filtres';
  export let showFiltersButton = true;
  export let onToggleFilters = () => {};
  export let hasSolution = '';
  export let hasIndication = '';
  export let onToggleSolution = () => {};
  export let onToggleIndication = () => {};
  export let canTogglePreview = false;
  export let previewToggleLabel = '';
  export let isPreviewOpen = false;
  export let onTogglePreview = () => {};
  export let advancedFiltersOpen = false;
  export let onCloseAdvancedFilters = () => {};
  export let filtersExpanded = true;
  export let onToggleExpanded = () => {};

  let inputEl;

  function clearSearch() {
    searchQueryStore.set('');
    onSearchInput();
    if (inputEl) inputEl.focus();
  }

  function handleSubmitKey(event) {
    const key = event.key;
    if (key === 'Enter' || key === 'Go' || key === 'Search') {
      event.preventDefault();
      onSearchInput();
      if (inputEl) inputEl.blur();
    }
  }
</script>

<!-- position:relative pour ancrer le popover desktop -->
<div class="toolbar">
  <!-- Ligne de recherche : toujours visible -->
  <div class="toolbar-top">
    <div class="toolbar-search">
      <span class="search-icon" aria-hidden="true">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input
        type="search"
        bind:value={$searchQueryStore}
        on:input={onSearchInput}
        on:keydown={handleSubmitKey}
        placeholder="Ex: intégrale, matrice, probabilité..."
        class="search-input"
        bind:this={inputEl}
      />
      {#if $searchQueryStore}
        <button type="button" class="search-clear" on:click={clearSearch} aria-label="Effacer la recherche">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      {/if}
      {#if loading && !hasResults}
        <div class="search-loading" class:search-loading--offset={$searchQueryStore}><div class="search-spinner"></div></div>
      {/if}
    </div>

    <!-- Chevron collapse (mobile uniquement) -->
    <button
      type="button"
      class="collapse-toggle"
      on:click={onToggleExpanded}
      aria-expanded={filtersExpanded}
      aria-label={filtersExpanded ? 'Réduire les filtres' : 'Afficher les filtres'}
      title={filtersExpanded ? 'Réduire les filtres' : 'Afficher les filtres'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class:rotated={!filtersExpanded}>
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  </div>

  <!-- Actions (filtres + chips + preview) : desktop uniquement -->
  <div class="toolbar-actions">
    {#if showFiltersButton}
      <button
        type="button"
        class="btn btn-secondary toolbar-button filters-btn"
        class:toolbar-button--active={advancedFiltersOpen}
        on:click={onToggleFilters}
        aria-expanded={advancedFiltersOpen}
      >
        <svg class="filters-btn__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" />
        </svg>
        <span>{filtersButtonLabel}</span>
      </button>
    {/if}
    <div class="toolbar-chips">
      <button
        type="button"
        class="chip {hasSolution === '1' ? 'chip--on' : hasSolution === '0' ? 'chip--off' : ''}"
        title="Filtrer par solution (clic pour basculer)"
        on:click={onToggleSolution}
        disabled={loading}
      >
        ✅ Solution<span class="chip-state">{hasSolution === '1' ? ' • oui' : hasSolution === '0' ? ' • non' : ''}</span>
      </button>
      <button
        type="button"
        class="chip {hasIndication === '1' ? 'chip--on' : hasIndication === '0' ? 'chip--off' : ''}"
        title="Filtrer par indication (clic pour basculer)"
        on:click={onToggleIndication}
        disabled={loading}
      >
        💡 Indication<span class="chip-state">{hasIndication === '1' ? ' • oui' : hasIndication === '0' ? ' • non' : ''}</span>
      </button>
    </div>
    {#if canTogglePreview}
      <button
        type="button"
        class="btn btn-secondary toolbar-button preview-toggle-btn"
        on:click={onTogglePreview}
        aria-label={previewToggleLabel}
        title={previewToggleLabel}
      >
        {#if isPreviewOpen}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {/if}
      </button>
    {/if}
  </div>

  <!--
    Le popover est ancré ici (hors de .toolbar-actions) pour rester visible
    même quand .toolbar-actions est display:none sur mobile.
    Desktop : position:absolute relative à .toolbar (position:relative).
    Mobile : position:fixed bottom:0 → indépendant du flux.
  -->
  {#if showFiltersButton}
    <AdvancedFiltersPopover open={advancedFiltersOpen} on:close={onCloseAdvancedFilters} />
  {/if}
</div>

<style>
  .toolbar {
    position: relative; /* ancre le popover desktop */
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (min-width: 641px) {
    .toolbar {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
  }

  /* Ligne du haut : input + chevron */
  .toolbar-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .toolbar-search {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
  }

  .search-icon {
    pointer-events: none;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0.75rem;
    display: flex;
    align-items: center;
    color: #9ca3af;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3.75rem 0.75rem 2.5rem;
    font-size: 1rem;
    transition: all .2s ease;
    @apply border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent;
  }

  @media (min-width: 640px) {
    .search-input { font-size: 1.125rem; }
  }

  .search-clear {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    border: none;
    background: rgba(148, 163, 184, 0.2);
    color: #475569;
    transition: background-color .2s, color .2s;
  }
  .search-clear:hover { background: rgba(37, 99, 235, 0.2); color: #1d4ed8; }
  .search-clear svg { width: 1.1rem; height: 1.1rem; }

  .search-loading { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); }
  .search-loading--offset { right: 3.25rem; }
  .search-spinner {
    border-radius: 9999px;
    width: 1.25rem;
    height: 1.25rem;
    animation: toolbarSpin 1s linear infinite;
    border: 2px solid transparent;
    border-bottom-color: theme('colors.brand.600');
  }
  @keyframes toolbarSpin { to { transform: rotate(360deg); } }

  /* Bouton chevron collapse — mobile only */
  .collapse-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    transition: background-color .15s;
    @apply border border-gray-300 bg-white text-gray-600;
  }
  .collapse-toggle:hover { @apply bg-gray-100 text-gray-900; }
  .collapse-toggle svg {
    width: 1.1rem;
    height: 1.1rem;
    transition: transform 200ms ease;
  }
  .collapse-toggle svg.rotated { transform: rotate(180deg); }

  @media (min-width: 641px) {
    .collapse-toggle { display: none; }
  }

  /* toolbar-actions : desktop only */
  .toolbar-actions {
    display: none;
  }
  @media (min-width: 641px) {
    .toolbar-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      justify-content: flex-end;
    }
    .toolbar-actions .btn { min-height: 2.5rem; }
  }

  .toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }
  .toolbar-button--active {
    @apply bg-brand-100 border-brand-300 text-brand-700;
  }

  .filters-btn__icon { width: 1rem; height: 1rem; flex-shrink: 0; }

  .toolbar-chips {
    display: flex;
    gap: 0.5rem;
  }

  .preview-toggle-btn { padding: 0.5rem; flex-shrink: 0; }
  .preview-toggle-btn svg { width: 1.25rem; height: 1.25rem; display: block; }

  .chip {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border-radius: 9999px;
    transition: background-color .2s;
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    white-space: nowrap;
    min-height: 2.25rem;
    @apply border border-gray-200 bg-gray-100 text-gray-700;
  }
  .chip:hover { @apply bg-gray-200; }
  .chip--on { @apply bg-green-100 text-green-700 border-green-200; }
  .chip--off { @apply bg-red-100 text-red-800 border-red-200; }
</style>
