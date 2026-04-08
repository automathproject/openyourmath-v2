<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { filterCounts, filters, searchActions, suggestions } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';

  export let open = false;

  const dispatch = createEventDispatcher();

  let panelEl;
  let draft = {};

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
      <label class="advanced-field">
        <span>Auteur</span>
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

      <label class="advanced-field">
        <span>Organisation</span>
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
    border-radius: 0.85rem;
    padding: 0.8rem;
    z-index: 50;
    @apply border border-gray-200 bg-white shadow-xl;
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
    @apply text-gray-800;
  }
  .advanced-popover__close {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    @apply text-gray-500;
  }
  .advanced-popover__close:hover { @apply bg-gray-100 text-gray-700; }

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
  .advanced-field span {
    font-size: 0.78rem;
    font-weight: 600;
    @apply text-gray-600;
  }
  .advanced-field input,
  .advanced-field select {
    width: 100%;
    padding: 0.45rem 0.55rem;
    border-radius: 0.55rem;
    font-size: 0.86rem;
    @apply border border-gray-300 bg-white text-gray-800;
  }
  .advanced-popover__actions {
    margin-top: 0.85rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
