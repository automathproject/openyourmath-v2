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

    <!-- Auteur / Organisation : ligne séparée -->
    {#if hasAuthor || hasOrganization}
      <div class="author-row">
        <span class="author-row__label">Auteur :</span>
        <div class="author-row__chips">
          {#if hasAuthor}
            <Chip variant="teal" removable onremove={() => removeFilterChip('author')}>{$filters.author}</Chip>
          {/if}
          {#if hasOrganization}
            <Chip variant="info" removable onremove={() => removeFilterChip('organization')}>{$filters.organization}</Chip>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Chips structurels -->
    {#if structuralChips.length > 0}
      <div class="active-filters-scroll">
        {#each structuralChips as chip}
          <Chip variant="teal" removable onremove={() => removeFilterChip(chip.key)}>{chip.label}</Chip>
        {/each}
      </div>
    {/if}

    <button type="button" class="btn btn-ghost btn-sm" on:click={clearAllFilterChips}>
      Tout effacer
    </button>

  </div>
{/if}

<style>
  .active-filters {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.75rem;
    @apply border border-interface-border-primary bg-interface-bg-secondary;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .author-row__label {
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
    @apply text-interface-text-muted;
  }
  .author-row__chips {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .active-filters-scroll {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
</style>
