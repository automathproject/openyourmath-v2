<script>
  import { onMount } from 'svelte';
  import ResultCard from '$lib/components/search/ResultCard.svelte';

  export let results = [];
  export let activeFilters = {};
  export let cardMode = 'detailed';
  export let compactColumns = 'auto'; // auto | force
  export let selectedUuid = null;
  export let isPreviewOpen = false;
  export let onSelect = () => {};
  export let hasMore = false;
  export let onLoadMore = () => {};
  export let loadingMore = false;

  const AUTO_COMPACT_TWO_COLUMN_MIN_WIDTH = 680;
  const FORCED_COMPACT_TWO_COLUMN_MIN_WIDTH = 480;
  let gridEl;
  let compactCanAutoSplit = false;
  let compactCanForceSplit = false;

  function handleSelect(event) {
    onSelect(event.detail.exercise);
  }

  function updateCompactLayout() {
    if (!gridEl) return;
    compactCanAutoSplit = gridEl.clientWidth >= AUTO_COMPACT_TWO_COLUMN_MIN_WIDTH;
    compactCanForceSplit = gridEl.clientWidth >= FORCED_COMPACT_TWO_COLUMN_MIN_WIDTH;
  }

  $: compactCanSplit = compactColumns === 'force' ? compactCanForceSplit : compactCanAutoSplit;

  onMount(() => {
    updateCompactLayout();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateCompactLayout);
      observer.observe(gridEl);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateCompactLayout);
    return () => window.removeEventListener('resize', updateCompactLayout);
  });
</script>

{#if results.length > 0}
  <div
    bind:this={gridEl}
    class="results-grid {cardMode === 'compact' ? 'results-grid--compact' : ''} {cardMode === 'compact' && compactCanSplit ? 'results-grid--compact-split' : ''}"
    role="listbox"
    aria-label="Liste des résultats"
  >
    {#each results as exercise (exercise.uuid)}
      <ResultCard
        {exercise}
        {activeFilters}
        {cardMode}
        isSelected={isPreviewOpen && selectedUuid === exercise.uuid}
        on:select={handleSelect}
      />
    {/each}
  </div>
{/if}

{#if hasMore}
  <div class="results-pagination text-center mt-4">
    <button class="btn btn-secondary" on:click={onLoadMore} disabled={loadingMore}>
      {loadingMore ? 'Chargement…' : 'Afficher plus de résultats'}
    </button>
  </div>
{/if}

<style>
  .results-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(0, 1fr);
  }
  .results-grid--compact {
    gap: 0.625rem;
  }
  .results-grid--compact-split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
</style>
