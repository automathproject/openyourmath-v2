<script>
  import { onMount } from 'svelte';

  export let searchQueryStore;
  export let onSearchInput = () => {};
  export let loading = false;
  export let hasResults = false;
  export let canTogglePreview = false;
  export let previewToggleLabel = '';
  export let isPreviewOpen = false;
  export let onTogglePreview = () => {};
  export let filtersExpanded = true;
  export let onToggleExpanded = () => {};

  let inputEl;

  onMount(() => inputEl?.focus());

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
    <div class="search-input" style="flex:1;min-width:0;font-size:1rem;">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" class="search-icon-svg">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="search"
        bind:value={$searchQueryStore}
        on:input={onSearchInput}
        on:keydown={handleSubmitKey}
        placeholder="Ex: intégrale, matrice, probabilité..."
        aria-label="Rechercher"
        bind:this={inputEl}
      />
      {#if loading && !hasResults}
        <div class="search-spinner-wrap"><div class="search-spinner"></div></div>
      {/if}
      {#if $searchQueryStore}
        <button type="button" class="search-clear-btn" on:click={clearSearch} aria-label="Effacer la recherche">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
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

  <!-- Actions (preview toggle desktop uniquement) -->
  <div class="toolbar-actions">
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

  .search-icon-svg {
    flex-shrink: 0;
    color: theme('colors.interface.text-muted');
  }

  .search-spinner-wrap {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .search-spinner {
    border-radius: 9999px;
    width: 1.1rem;
    height: 1.1rem;
    animation: toolbarSpin 1s linear infinite;
    border: 2px solid transparent;
    border-bottom-color: theme('colors.brand.600');
  }
  @keyframes toolbarSpin { to { transform: rotate(360deg); } }

  .search-clear-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-muted');
    cursor: pointer;
    transition: background .15s, color .15s;
  }
  .search-clear-btn:hover {
    background: theme('colors.interface.border-primary');
    color: theme('colors.interface.text-primary');
  }

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
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }
  .collapse-toggle:hover { @apply bg-interface-bg-tertiary text-interface-text-primary; }
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
  }

  .preview-toggle-btn { padding: 0.5rem; flex-shrink: 0; }
  .preview-toggle-btn svg { width: 1.25rem; height: 1.25rem; display: block; }
</style>
