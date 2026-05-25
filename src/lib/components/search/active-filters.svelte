<script>
  import { filters, searchActions, hasActiveFilters } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';
  import Chip from '$lib/components/Chip.svelte';

  function removeFilterChip(key) {
    switch (key) {
      case 'level':
        searchActions.updateFilter('level', '');
        searchActions.updateFilter('module', '');
        searchActions.updateFilter('chapter', '');
        searchActions.updateFilter('subchapter', '');
        break;
      case 'module':
        searchActions.updateFilter('module', '');
        searchActions.updateFilter('chapter', '');
        searchActions.updateFilter('subchapter', '');
        break;
      case 'chapter':
        searchActions.updateFilter('chapter', '');
        searchActions.updateFilter('subchapter', '');
        break;
      case 'subchapter':
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

  $: pathChips = (() => {
    const entries = [];
    if ($filters.level) entries.push({ key: 'level', label: `Niveau : ${$filters.level}` });
    if ($filters.module) entries.push({ key: 'module', label: `Module : ${$filters.module}` });
    if ($filters.chapter) entries.push({ key: 'chapter', label: `Chapitre : ${$filters.chapter}` });
    if ($filters.subchapter) entries.push({ key: 'subchapter', label: `Sous-chapitre : ${$filters.subchapter}` });
    return entries;
  })();

  // Chips "structurels" : chemin, difficulté, solution, indication, vidéo, dates
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
  $: hasAny = pathChips.length > 0 || structuralChips.length > 0 || hasAuthor || hasOrganization;
</script>

{#if $hasActiveFilters}
  <div class="active-filters" aria-live="polite">
    {#if hasAny}
      <div class="active-filters-scroll">
        {#if hasAuthor}
          <Chip variant="teal" removable onremove={() => removeFilterChip('author')}>Auteur : {$filters.author}</Chip>
        {/if}
        {#if hasOrganization}
          <Chip variant="info" removable onremove={() => removeFilterChip('organization')}>Organisation : {$filters.organization}</Chip>
        {/if}
        {#each pathChips as chip}
          <Chip variant="info" removable onremove={() => removeFilterChip(chip.key)}>{chip.label}</Chip>
        {/each}
        {#each structuralChips as chip}
          <Chip variant="teal" removable onremove={() => removeFilterChip(chip.key)}>{chip.label}</Chip>
        {/each}
      </div>
    {/if}

    <button
      type="button"
      class="reset-all-button"
      on:click={() => searchActions.clearAllFilters()}
      aria-label="Réinitialiser la recherche"
      title="Réinitialiser la recherche"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      Réinitialiser
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

  .reset-all-button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex: 0 0 auto;
    padding: 0.25rem 0.6rem;
    border-radius: 0.45rem;
    border: 1px solid transparent;
    font-size: 0.78rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    @apply text-interface-text-muted bg-transparent;
  }

  .reset-all-button:hover {
    @apply border-interface-border-secondary bg-interface-bg-tertiary text-interface-text-primary;
  }

  .reset-all-button svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }
</style>
