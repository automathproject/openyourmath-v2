<script>
  import { filters, searchActions } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';
  import Chip from '$lib/components/Chip.svelte';

  function removeFilterChip(key) {
    switch (key) {
      case 'difficulty':
      case 'hasSolution':
      case 'hasIndication':
      case 'hasVideo':
      case 'author':
      case 'organization':
      case 'createdFrom':
      case 'createdTo':
      case 'updatedFrom':
      case 'updatedTo':
        searchActions.updateFilter(key, '');
        break;
      default:
        return;
    }
    searchActions.search();
  }

  function clearAllFilterChips() {
    searchActions.updateFilter('difficulty', '');
    searchActions.updateFilter('hasSolution', '');
    searchActions.updateFilter('hasIndication', '');
    searchActions.updateFilter('hasVideo', '');
    searchActions.updateFilter('author', '');
    searchActions.updateFilter('organization', '');
    searchActions.updateFilter('createdFrom', '');
    searchActions.updateFilter('createdTo', '');
    searchActions.updateFilter('updatedFrom', '');
    searchActions.updateFilter('updatedTo', '');
    searchActions.search();
  }

  // Chips "structurels" : difficulté, solution, indication, vidéo, dates
  $: structuralChips = (() => {
    const entries = [];
    if ($filters.difficulty && $filters.difficulty !== '') {
      entries.push({ key: 'difficulty', label: formatDifficultyLabel($filters.difficulty) });
    }
    if ($filters.hasSolution === '1') entries.push({ key: 'hasSolution', label: 'Avec solution' });
    if ($filters.hasSolution === '0') entries.push({ key: 'hasSolution', label: 'Sans solution' });
    if ($filters.hasIndication === '1') entries.push({ key: 'hasIndication', label: 'Avec indication' });
    if ($filters.hasIndication === '0') entries.push({ key: 'hasIndication', label: 'Sans indication' });
    if ($filters.hasVideo === '1') entries.push({ key: 'hasVideo', label: 'Avec vidéo' });
    if ($filters.hasVideo === '0') entries.push({ key: 'hasVideo', label: 'Sans vidéo' });
    if ($filters.createdFrom) entries.push({ key: 'createdFrom', label: `Créé ≥ ${$filters.createdFrom}` });
    if ($filters.createdTo) entries.push({ key: 'createdTo', label: `Créé ≤ ${$filters.createdTo}` });
    if ($filters.updatedFrom) entries.push({ key: 'updatedFrom', label: `MAJ ≥ ${$filters.updatedFrom}` });
    if ($filters.updatedTo) entries.push({ key: 'updatedTo', label: `MAJ ≤ ${$filters.updatedTo}` });
    return entries;
  })();

  $: hasAuthor = Boolean($filters.author);
  $: hasOrganization = Boolean($filters.organization);
  $: hasAny = structuralChips.length > 0 || hasAuthor || hasOrganization;
</script>

{#if hasAny}
  <div class="active-filters" aria-live="polite">
    <div class="active-filters-scroll">
      {#if hasAuthor}
        <Chip variant="teal" removable onremove={() => removeFilterChip('author')}>Auteur : {$filters.author}</Chip>
      {/if}
      {#if hasOrganization}
        <Chip variant="info" removable onremove={() => removeFilterChip('organization')}>Organisation : {$filters.organization}</Chip>
      {/if}
      {#if structuralChips.length > 0}
        {#each structuralChips as chip}
          <Chip variant="teal" removable onremove={() => removeFilterChip(chip.key)}>{chip.label}</Chip>
        {/each}
      {/if}
    </div>

    <button
      type="button"
      class="clear-all-button"
      on:click={clearAllFilterChips}
      aria-label="Effacer tous les filtres"
      title="Effacer tous les filtres"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
{/if}

<style>
  .active-filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 42px;
    padding: 0.45rem 0.55rem 0.45rem 0.75rem;
    border-radius: 0.7rem;
    @apply border border-interface-border-primary bg-interface-bg-secondary;
  }

  .active-filters-scroll {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    scrollbar-width: thin;
  }

  .active-filters-scroll :global(.chip) {
    flex: 0 0 auto;
  }

  .clear-all-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: 0.45rem;
    border: 1px solid transparent;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    @apply text-interface-text-muted;
  }

  .clear-all-button:hover {
    @apply border-interface-border-secondary bg-interface-bg-tertiary text-interface-text-primary;
  }

  .clear-all-button svg {
    width: 15px;
    height: 15px;
  }
</style>
