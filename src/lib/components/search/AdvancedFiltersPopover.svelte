<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { filterCounts, filters, searchActions, suggestions } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';

  export let open = false;

  const dispatch = createEventDispatcher();

  let panelEl;
  let draft = {};
  let showDateFilters = false;

  $: difficultyCounts = $filterCounts?.difficulty || {};
  $: difficultyOptions = (() => {
    const entries = new Set();
    ($suggestions?.difficulties || []).forEach((entry) => entries.add(String(entry.value ?? entry)));
    Object.keys(difficultyCounts).forEach((entry) => entries.add(String(entry)));
    const values = Array.from(entries).filter((value) => value && value !== '0');
    values.sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }));
    return values;
  })();

  $: authorSuggestions = ($suggestions?.authors || []).map((entry) => entry.value ?? entry).filter(Boolean);
  $: organizationSuggestions = ($suggestions?.organizations || []).map((entry) => entry.value ?? entry).filter(Boolean);
  $: hasActiveDateFilters = Boolean(
    draft.createdFrom ||
    draft.createdTo ||
    draft.updatedFrom ||
    draft.updatedTo
  );
  $: dateFiltersSummary = [
    draft.createdFrom ? `Créé ≥ ${draft.createdFrom}` : '',
    draft.createdTo ? `Créé ≤ ${draft.createdTo}` : '',
    draft.updatedFrom ? `MAJ ≥ ${draft.updatedFrom}` : '',
    draft.updatedTo ? `MAJ ≤ ${draft.updatedTo}` : ''
  ].filter(Boolean).join(' · ');

  $: if (open) {
    draft = {
      author: $filters.author || '',
      organization: $filters.organization || '',
      difficulty: $filters.difficulty || '',
      createdFrom: $filters.createdFrom || '',
      createdTo: $filters.createdTo || '',
      updatedFrom: $filters.updatedFrom || '',
      updatedTo: $filters.updatedTo || '',
      hasSolution: $filters.hasSolution ?? '',
      hasIndication: $filters.hasIndication ?? '',
      hasVideo: $filters.hasVideo ?? ''
    };
    showDateFilters = Boolean(
      $filters.createdFrom ||
      $filters.createdTo ||
      $filters.updatedFrom ||
      $filters.updatedTo
    );
  }

  function close() {
    dispatch('close');
  }

  function handleOutsideClick(event) {
    if (!open || !panelEl) return;
    // Ignore clicks on the toggle button (has aria-expanded attribute)
    if (event.target.closest('[aria-expanded]')) return;
    if (!panelEl.contains(event.target)) close();
  }

  function handleEscape(event) {
    if (open && event.key === 'Escape') close();
  }

  function apply() {
    searchActions.updateFilter('author', (draft.author || '').trim());
    searchActions.updateFilter('organization', (draft.organization || '').trim());
    searchActions.updateFilter('difficulty', draft.difficulty || '');
    searchActions.updateFilter('createdFrom', draft.createdFrom || '');
    searchActions.updateFilter('createdTo', draft.createdTo || '');
    searchActions.updateFilter('updatedFrom', draft.updatedFrom || '');
    searchActions.updateFilter('updatedTo', draft.updatedTo || '');
    searchActions.updateFilter('hasSolution', draft.hasSolution ?? '');
    searchActions.updateFilter('hasIndication', draft.hasIndication ?? '');
    searchActions.updateFilter('hasVideo', draft.hasVideo ?? '');
    searchActions.search();
    close();
  }

  function clear() {
    draft = {
      author: '',
      organization: '',
      difficulty: '',
      createdFrom: '',
      createdTo: '',
      updatedFrom: '',
      updatedTo: '',
      hasSolution: '',
      hasIndication: '',
      hasVideo: ''
    };
  }

  onMount(() => {
    if (!browser) return;
    document.addEventListener('click', handleOutsideClick, true);
    document.addEventListener('keydown', handleEscape);
  });

  onDestroy(() => {
    if (!browser) return;
    document.removeEventListener('click', handleOutsideClick, true);
    document.removeEventListener('keydown', handleEscape);
  });
</script>

{#if open}
  <div class="advanced-popover" bind:this={panelEl}>
    <div class="advanced-popover__header">
      <h4>Filtres avancés</h4>
      <button type="button" class="advanced-popover__close" on:click={close} aria-label="Fermer">
        ✕
      </button>
    </div>

    <div class="advanced-grid">
      <label class="advanced-field" class:advanced-field--active={draft.author}>
        <span class="advanced-field__label">
          Auteur
          {#if draft.author}<em>Actif</em>{/if}
        </span>
        <input
          list="advanced-author-list"
          bind:value={draft.author}
          placeholder="Nom de l'auteur"
        />
      </label>
      <datalist id="advanced-author-list">
        {#each authorSuggestions as author}
          <option value={author}></option>
        {/each}
      </datalist>

      <label class="advanced-field" class:advanced-field--active={draft.organization}>
        <span class="advanced-field__label">
          Organisation
          {#if draft.organization}<em>Actif</em>{/if}
        </span>
        <input
          list="advanced-organization-list"
          bind:value={draft.organization}
          placeholder="Nom de l'organisation"
        />
      </label>
      <datalist id="advanced-organization-list">
        {#each organizationSuggestions as organization}
          <option value={organization}></option>
        {/each}
      </datalist>

      <label class="advanced-field">
        <span>Difficulté</span>
        <select bind:value={draft.difficulty}>
          <option value="">Toutes</option>
          <option value="null">Sans difficulté</option>
          {#each difficultyOptions as value}
            {#if value !== 'null'}
              <option value={value}>{formatDifficultyLabel(value)}</option>
            {/if}
          {/each}
        </select>
      </label>

      <label class="advanced-field">
        <span>Solution</span>
        <select bind:value={draft.hasSolution}>
          <option value="">Tous</option>
          <option value="1">Avec solution</option>
          <option value="0">Sans solution</option>
        </select>
      </label>
      <label class="advanced-field">
        <span>Indication</span>
        <select bind:value={draft.hasIndication}>
          <option value="">Tous</option>
          <option value="1">Avec indication</option>
          <option value="0">Sans indication</option>
        </select>
      </label>
      <label class="advanced-field">
        <span>Vidéo</span>
        <select bind:value={draft.hasVideo}>
          <option value="">Tous</option>
          <option value="1">Avec vidéo</option>
          <option value="0">Sans vidéo</option>
        </select>
      </label>
    </div>

    <div class="advanced-dates">
      <button
        type="button"
        class="advanced-dates__toggle"
        class:advanced-dates__toggle--active={hasActiveDateFilters}
        on:click={() => (showDateFilters = !showDateFilters)}
        aria-expanded={showDateFilters}
      >
        <span class="advanced-dates__toggle-title">Filtres de dates</span>
        <span class="advanced-dates__toggle-meta">
          {#if hasActiveDateFilters}
            {dateFiltersSummary}
          {:else}
            Optionnel
          {/if}
        </span>
        <span class="advanced-dates__toggle-icon">{showDateFilters ? '▴' : '▾'}</span>
      </button>

      {#if showDateFilters}
        <div class="advanced-grid advanced-grid--dates">
          <label class="advanced-field">
            <span>Créé après</span>
            <input type="date" bind:value={draft.createdFrom} />
          </label>
          <label class="advanced-field">
            <span>Créé avant</span>
            <input type="date" bind:value={draft.createdTo} />
          </label>

          <label class="advanced-field">
            <span>Mis à jour après</span>
            <input type="date" bind:value={draft.updatedFrom} />
          </label>
          <label class="advanced-field">
            <span>Mis à jour avant</span>
            <input type="date" bind:value={draft.updatedTo} />
          </label>
        </div>
      {/if}
    </div>

    <div class="advanced-popover__actions">
      <button type="button" class="btn btn-text" on:click={clear}>Vider</button>
      <button type="button" class="btn btn-primary" on:click={apply}>Appliquer</button>
    </div>
  </div>
{/if}

<style>
  .advanced-popover {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    width: min(36rem, 95vw);
    max-height: min(80vh, calc(100vh - 2rem));
    overflow-y: auto;
    border-radius: 0.85rem;
    padding: 0.8rem;
    z-index: 50;
    @apply border border-interface-border-primary bg-interface-bg-white shadow-xl;
  }
  @media (max-width: 640px) {
    .advanced-popover {
      position: fixed;
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      width: auto;
      max-height: min(85vh, calc(100vh - 0.5rem));
      padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
      border-radius: 1.25rem 1.25rem 0 0;
      box-shadow: 0 -12px 32px rgba(15, 23, 42, 0.18);
    }
    .advanced-popover::before {
      content: '';
      display: block;
      width: 2.75rem;
      height: 0.3rem;
      margin: 0 auto 0.85rem;
      border-radius: 9999px;
      background: rgba(148, 163, 184, 0.9);
    }
  }
  .advanced-popover__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.7rem;
  }
  .advanced-popover__header h4 {
    font-size: 0.95rem;
    font-weight: 700;
    @apply text-interface-text-primary;
  }
  .advanced-popover__close {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    @apply text-interface-text-muted;
  }
  .advanced-popover__close:hover { @apply bg-interface-bg-tertiary text-interface-text-secondary; }

  .advanced-grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 0.6rem;
  }
  @media (min-width: 768px) {
    .advanced-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .advanced-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .advanced-field > span,
  .advanced-field__label {
    font-size: 0.78rem;
    font-weight: 600;
    @apply text-interface-text-secondary;
  }
  .advanced-field__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .advanced-field__label em {
    font-style: normal;
    padding: 0.08rem 0.38rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    line-height: 1.2;
    @apply bg-brand-50 text-brand-700 border border-brand-200;
  }
  .advanced-field input,
  .advanced-field select {
    width: 100%;
    padding: 0.45rem 0.55rem;
    border-radius: 0.55rem;
    font-size: 0.86rem;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-primary;
  }
  .advanced-field--active input {
    @apply border-brand-300 bg-brand-50 text-brand-800;
  }
  .advanced-dates {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    @apply border-t border-interface-border-primary;
  }
  .advanced-dates__toggle {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.25rem 0.75rem;
    align-items: center;
    text-align: left;
    padding: 0.65rem 0.75rem;
    border-radius: 0.75rem;
    @apply bg-interface-bg-secondary text-interface-text-primary border border-interface-border-primary;
  }
  .advanced-dates__toggle:hover {
    @apply bg-interface-bg-tertiary;
  }
  .advanced-dates__toggle--active {
    @apply border-brand-200 bg-brand-50;
  }
  .advanced-dates__toggle-title {
    font-size: 0.88rem;
    font-weight: 600;
  }
  .advanced-dates__toggle-meta {
    font-size: 0.76rem;
    @apply text-interface-text-muted;
  }
  .advanced-dates__toggle-icon {
    grid-row: 1 / span 2;
    grid-column: 2;
    font-size: 0.8rem;
    @apply text-interface-text-muted;
  }
  .advanced-grid--dates {
    margin-top: 0.75rem;
  }
  .advanced-popover__actions {
    margin-top: 0.85rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
