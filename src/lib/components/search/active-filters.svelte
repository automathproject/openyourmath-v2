<script>
  import { filters, searchActions } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';

  function removeFilterChip(key) {
    switch (key) {
      case 'difficulty':
      case 'hasSolution':
      case 'hasIndication':
      case 'hasVideo':
      case 'author':
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
    searchActions.updateFilter('createdFrom', '');
    searchActions.updateFilter('createdTo', '');
    searchActions.updateFilter('updatedFrom', '');
    searchActions.updateFilter('updatedTo', '');
    searchActions.search();
  }

  $: chips = (() => {
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
    if ($filters.author) entries.push({ key: 'author', label: $filters.author });
    if ($filters.createdFrom) entries.push({ key: 'createdFrom', label: `Créé ≥ ${$filters.createdFrom}` });
    if ($filters.createdTo) entries.push({ key: 'createdTo', label: `Créé ≤ ${$filters.createdTo}` });
    if ($filters.updatedFrom) entries.push({ key: 'updatedFrom', label: `MAJ ≥ ${$filters.updatedFrom}` });
    if ($filters.updatedTo) entries.push({ key: 'updatedTo', label: `MAJ ≤ ${$filters.updatedTo}` });

    return entries;
  })();
</script>

{#if chips.length > 0}
  <div class="active-filters" aria-live="polite">
    <div class="active-filters-scroll">
      {#each chips as chip}
        <span class="active-chip">
          <span class="active-chip-label">{chip.label}</span>
          <button
            type="button"
            class="active-chip-remove"
            aria-label={`Retirer ${chip.label}`}
            on:click={() => removeFilterChip(chip.key)}
          >
            ×
          </button>
        </span>
      {/each}
      <button type="button" class="active-filters-clear" on:click={clearAllFilterChips}>
        Tout effacer
      </button>
    </div>
  </div>
{/if}

<style>
  .active-filters {
    margin-bottom: 1rem;
    border-radius: 0.75rem;
    padding: 0.65rem 0.75rem;
    @apply border border-gray-200 bg-gray-50;
  }
  .active-filters-scroll {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: thin;
  }
  .active-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.82rem;
    @apply border border-gray-300 bg-white text-gray-800;
  }
  .active-chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 9999px;
    line-height: 1;
    @apply bg-gray-200 text-gray-700;
  }
  .active-chip-remove:hover { @apply bg-gray-300; }
  .active-filters-clear {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.82rem;
    font-weight: 600;
    @apply border border-transparent bg-brand-600 text-white;
  }
  .active-filters-clear:hover { @apply bg-brand-700; }
</style>
