<script>
  export let searchQueryStore;
  export let onSearchInput = () => {};
  export let loading = false;
  export let hasResults = false;
  export let filtersButtonLabel = 'Filtres';
  export let isFilterPanelOpen = false;
  export let onToggleFilters = () => {};
  export let hasSolution = '';
  export let hasIndication = '';
  export let onToggleSolution = () => {};
  export let onToggleIndication = () => {};
  export let canTogglePreview = false;
  export let previewToggleLabel = '';
  export let onTogglePreview = () => {};

  let inputEl;

  function clearSearch() {
    searchQueryStore.set('');
    onSearchInput();
    if (inputEl) {
      inputEl.focus();
    }
  }

  function handleSubmitKey(event) {
    const key = event.key;
    if (key === 'Enter' || key === 'Go' || key === 'Search') {
      event.preventDefault();
      onSearchInput();
      if (inputEl) {
        inputEl.blur();
      }
    }
  }
</script>

<div class="toolbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
  <div class="toolbar-search relative flex-1">
    <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400" aria-hidden="true">
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
      class="search-input pl-10 pr-16"
      bind:this={inputEl}
    />
    {#if $searchQueryStore}
      <button
        type="button"
        class="search-clear"
        on:click={clearSearch}
        aria-label="Effacer la recherche"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
    {#if loading && !hasResults}
      <div class="search-loading" class:search-loading--offset={$searchQueryStore}><div class="search-spinner"></div></div>
    {/if}
  </div>
  <div class="toolbar-actions flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">
    <button
      type="button"
      class="btn btn-secondary toolbar-button"
      on:click={onToggleFilters}
      aria-expanded={isFilterPanelOpen}
    >
      🔧 {filtersButtonLabel}
    </button>
    <div class="toolbar-chips flex gap-2">
      <button
        type="button"
        class="chip {(hasSolution==='1') ? 'chip--on' : (hasSolution==='0' ? 'chip--off' : '')}"
        title="Filtrer par solution (clic pour basculer)"
        on:click={onToggleSolution}
        disabled={loading}
      >
        ✅ Solution { hasSolution==='1' ? '• oui' : hasSolution==='0' ? '• non' : '' }
      </button>
      <button
        type="button"
        class="chip {(hasIndication==='1') ? 'chip--on' : (hasIndication==='0' ? 'chip--off' : '')}"
        title="Filtrer par indication (clic pour basculer)"
        on:click={onToggleIndication}
        disabled={loading}
      >
        💡 Indication { hasIndication==='1' ? '• oui' : hasIndication==='0' ? '• non' : '' }
      </button>
    </div>
    {#if canTogglePreview}
      <button
        type="button"
        class="btn btn-text toolbar-button"
        on:click={onTogglePreview}
      >
        {previewToggleLabel}
      </button>
    {/if}
  </div>
</div>

<style>
  .toolbar-search { min-width:0; }
  .toolbar-actions { justify-content:flex-start; }
  @media (min-width:640px) {
    .toolbar-actions { justify-content:flex-end; }
  }
  .toolbar-button { display:inline-flex; align-items:center; gap:0.5rem; white-space:nowrap; }
  .toolbar-actions .btn { min-height:2.5rem; }
  .toolbar-chips .chip { min-height:2.25rem; }

  .search-input {
    width: 100%;
    padding: 0.75rem 3.75rem 0.75rem 2.5rem;
    font-size: 1.125rem;
    transition: all .2s ease;
    @apply border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent;
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
  .search-clear:hover {
    background: rgba(37, 99, 235, 0.2);
    color: #1d4ed8;
  }
  .search-clear svg {
    width: 1.1rem;
    height: 1.1rem;
  }
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
  @keyframes toolbarSpin { to { transform: rotate(360deg);} }

  .chip {
    padding: 0.5rem 0.75rem;
    font-size:0.875rem;
    border-radius: 9999px;
    transition: background-color .2s;
    @apply border border-gray-200 bg-gray-100 text-gray-700;
  }
  .chip:hover { @apply bg-gray-200; }
  .chip--on { @apply bg-green-100 text-green-700 border-green-200; }
  .chip--off { @apply bg-red-100 text-red-800 border-red-200; }
</style>
