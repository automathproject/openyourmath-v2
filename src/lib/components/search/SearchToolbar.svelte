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
  export let activeFilterCount = 0;
  export let onToggleExpanded = () => {};
  /** Affiche un badge "↵" dans le champ pour indiquer que Enter déclenche la recherche intelligente */
  export let showEnterHint = false;
  /** Mode actuel : 'fts' | 'hybrid' */
  export let searchMode = 'fts';
  /** true pendant le chargement hybride */
  export let modeLoading = false;
  /** Appelé avec 'fts' ou 'hybrid' quand l'utilisateur bascule */
  export let onToggleMode = (_mode) => {};
  /** true quand FTS n'a trouvé aucun résultat → suggère de passer en IA */
  export let suggestIA = false;

  let inputEl;

  onMount(() => inputEl?.focus());

  function clearSearch() {
    searchQueryStore.set('');
    onSearchInput();
    if (inputEl) inputEl.focus();
  }

  function handleInputKeydown(event) {
    const key = event.key;
    if (key === 'Enter' || key === 'Go' || key === 'Search') {
      event.preventDefault();
      onSearchInput();
      // Pas de blur : l'utilisateur reste dans le champ pour affiner
    } else if (key === 'Escape') {
      event.preventDefault();
      if ($searchQueryStore) {
        clearSearch();           // Escape efface la requête
      } else {
        inputEl?.blur();         // Escape sur champ vide = quitter le focus
      }
    }
  }

  function toggleMode() {
    onToggleMode(searchMode === 'hybrid' ? 'fts' : 'hybrid');
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
        on:keydown={handleInputKeydown}
        placeholder="Ex: intégrale, matrice, probabilité…"
        aria-label="Rechercher des exercices"
        bind:this={inputEl}
      />
      {#if loading && !hasResults}
        <div class="search-spinner-wrap"><div class="search-spinner"></div></div>
      {/if}
      {#if showEnterHint && $searchQueryStore && !loading}
        <kbd class="enter-hint" aria-hidden="true" title="Appuyez sur Entrée pour la recherche intelligente">↵</kbd>
      {/if}
      {#if $searchQueryStore}
        <button type="button" class="search-clear-btn" on:click={clearSearch} aria-label="Effacer la recherche">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Toggle mode Rapide / IA -->
    <button
      type="button"
      class="mode-switch"
      class:mode-switch--hybrid={searchMode === 'hybrid'}
      class:mode-switch--loading={modeLoading}
      class:mode-switch--suggest={suggestIA && searchMode !== 'hybrid'}
      on:click={toggleMode}
      role="switch"
      aria-checked={searchMode === 'hybrid'}
      aria-label={searchMode === 'hybrid' ? 'Mode IA activé' : 'Mode rapide activé'}
      title={searchMode === 'hybrid' ? 'Recherche intelligente — IA sémantique + reranking' : 'Mode rapide — recherche textuelle'}
    >
      <span class="mode-switch-thumb" aria-hidden="true"></span>
      <span class="mode-switch-segment mode-switch-segment--fast" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span>Rapide</span>
      </span>
      <span class="mode-switch-segment mode-switch-segment--ia" aria-hidden="true">
        {#if modeLoading}
          <span class="mode-switch-spinner" aria-hidden="true"></span>
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4m2-2h-4"/>
          </svg>
        {/if}
        <span>IA</span>
      </span>
    </button>

    <!-- Chevron collapse (mobile uniquement) -->
    <button
      type="button"
      class="collapse-toggle"
      on:click={onToggleExpanded}
      aria-expanded={filtersExpanded}
      aria-label={filtersExpanded ? 'Réduire les filtres' : 'Afficher les filtres'}
      title={filtersExpanded ? 'Réduire les filtres' : 'Afficher les filtres'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="collapse-toggle-filter-icon">
        <path d="M3 5h18" />
        <path d="M6 12h12" />
        <path d="M10 19h4" />
      </svg>
      <span class="collapse-toggle-label">Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
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

  @media (max-width: 640px) {
    .toolbar-top {
      display: block;
      align-items: center;
    }

    .search-input {
      width: 100%;
    }

    .mode-switch,
    .collapse-toggle {
      display: none;
    }
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

  /* ── Switch mode Rapide / IA ──────────────────────────────────────────── */
  .mode-switch {
    position: relative;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    flex-shrink: 0;
    min-width: 8.35rem;
    height: 2.15rem;
    padding: 2px;
    border-radius: 9999px;
    isolation: isolate;
    transition: border-color 0.14s, background 0.14s;
    @apply bg-interface-bg-tertiary border border-interface-border-primary text-interface-text-muted;
  }

  .mode-switch--hybrid {
    @apply bg-brand-50 border-brand-300;
  }

  .mode-switch-thumb {
    position: absolute;
    z-index: 0;
    left: 2px;
    top: 2px;
    width: calc(50% - 2px);
    height: calc(100% - 4px);
    border-radius: 9999px;
    transform: translateX(0);
    transition: transform 0.16s ease, background 0.14s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10);
    @apply bg-interface-bg-white;
  }

  .mode-switch--hybrid .mode-switch-thumb,
  .mode-switch--loading .mode-switch-thumb {
    transform: translateX(100%);
    @apply bg-brand-600;
  }

  .mode-switch-segment {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.28rem;
    min-width: 0;
    height: 100%;
    padding: 0 0.55rem;
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1;
    transition: color 0.14s;
    white-space: nowrap;
  }

  .mode-switch-segment svg {
    flex-shrink: 0;
  }

  .mode-switch-segment--fast {
    @apply text-interface-text-primary;
  }

  .mode-switch--hybrid .mode-switch-segment--fast,
  .mode-switch--loading .mode-switch-segment--fast {
    @apply text-interface-text-muted;
  }

  .mode-switch--hybrid .mode-switch-segment--ia,
  .mode-switch--loading .mode-switch-segment--ia {
    @apply text-white;
  }

  .mode-switch--suggest:not(.mode-switch--hybrid) .mode-switch-segment--ia {
    @apply text-brand-600;
    animation: suggestPulse 2s ease-in-out infinite;
  }

  .mode-switch:hover {
    @apply border-brand-200;
  }

  @keyframes suggestPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }

  .mode-switch-spinner {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 1.5px solid transparent;
    border-bottom-color: currentColor;
    border-radius: 9999px;
    animation: btnSpin 0.75s linear infinite;
    flex-shrink: 0;
  }
  @keyframes btnSpin { to { transform: rotate(360deg); } }

  /* Masquer le bouton natif "×" des navigateurs pour type="search" */
  input[type="search"]::-webkit-search-cancel-button,
  input[type="search"]::-webkit-search-decoration {
    -webkit-appearance: none;
    appearance: none;
  }

  .enter-hint {
    flex-shrink: 0;
    font-family: ui-monospace, monospace;
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1;
    padding: 2px 5px 3px;
    border-radius: 4px;
    color: theme('colors.interface.text-muted');
    background: theme('colors.interface.bg-tertiary');
    border: 1px solid theme('colors.interface.border-primary');
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }

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

  /* Bouton chevron collapse — mobile/tablette */
  .collapse-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    flex-shrink: 0;
    min-width: 2.5rem;
    height: 2.5rem;
    padding: 0 0.7rem;
    border-radius: 0.75rem;
    font-size: 0.82rem;
    font-weight: 600;
    transition: background-color .15s;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }
  .collapse-toggle:hover { @apply bg-interface-bg-tertiary text-interface-text-primary; }
  .collapse-toggle svg {
    width: 1.1rem;
    height: 1.1rem;
    transition: transform 200ms ease;
  }
  .collapse-toggle-filter-icon {
    transform: none !important;
  }
  .collapse-toggle-label {
    white-space: nowrap;
  }
  .collapse-toggle svg.rotated { transform: rotate(180deg); }

  @media (max-width: 430px) {
    .collapse-toggle-label { display: none; }
    .collapse-toggle { padding: 0; width: 2.5rem; }
    .collapse-toggle-filter-icon { display: none; }
  }

  @media (min-width: 1024px) {
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

  @media (max-width: 640px) {
    .toolbar-top {
      display: block;
    }

    .search-input {
      width: 100%;
    }

    .mode-switch,
    .collapse-toggle {
      display: none !important;
    }
  }
</style>
