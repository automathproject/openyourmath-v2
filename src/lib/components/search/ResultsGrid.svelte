<script>
  import ResultCard from '$lib/components/search/ResultCard.svelte';

  export let results = [];
  export let selectedUuid = null;
  export let isPreviewOpen = false;
  export let onSelect = () => {};
  export let hasMore = false;
  export let onLoadMore = () => {};
  export let loadingMore = false;

  function handleSelect(event) {
    onSelect(event.detail.exercise);
  }
</script>

{#if results.length > 0}
  <div class="results-grid">
    {#each results as exercise (exercise.uuid)}
      <ResultCard
        {exercise}
        isSelected={isPreviewOpen && selectedUuid === exercise.uuid}
        on:select={handleSelect}
      />
    {/each}
  </div>
{/if}

{#if hasMore}
  <div class="results-pagination text-center mt-4">
    <button class="btn btn-secondary" on:click={onLoadMore} disabled={loadingMore}>
      {loadingMore ? 'Chargement…' : 'Voir plus'}
    </button>
  </div>
{/if}

<style>
  .results-grid { display: grid; gap: 1rem; }
</style>
