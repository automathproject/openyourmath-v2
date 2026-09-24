<script>
  import { onMount } from 'svelte';
  import ResultCard from '$lib/components/search/ResultCard.svelte';

  export let results = [];
  export let activeFilters = {};
  export let cardMode = 'detailed';
  export let selectedUuid = null;
  export let isPreviewOpen = false;
  export let onSelect = () => {};
  export let hasMore = false;
  export let onLoadMore = () => {};
  export let loadingMore = false;

  // Le compact se répartit tout seul en CSS (voir .results-grid--compact).
  // En détaillé la carte porte un énoncé avec des formules et un pied chargé :
  // en dessous de ~430 px de colonne elle devient illisible, et on plafonne à
  // deux colonnes — d'où un seuil mesuré plutôt qu'une répartition libre.
  const DETAILED_TWO_COLUMN_MIN_WIDTH = 880;
  let gridEl;
  let detailedCanSplit = false;

  function handleSelect(event) {
    onSelect(event.detail.exercise);
  }

  function updateDetailedLayout() {
    if (!gridEl) return;
    detailedCanSplit = gridEl.clientWidth >= DETAILED_TWO_COLUMN_MIN_WIDTH;
  }

  $: detailedSplit = cardMode !== 'compact' && detailedCanSplit;

  onMount(() => {
    updateDetailedLayout();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateDetailedLayout);
      observer.observe(gridEl);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateDetailedLayout);
    return () => window.removeEventListener('resize', updateDetailedLayout);
  });
</script>

{#if results.length > 0}
  <div
    bind:this={gridEl}
    class="results-grid {cardMode === 'compact' ? 'results-grid--compact' : ''} {detailedSplit ? 'results-grid--detailed-split' : ''}"
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
    /* Les cartes gardent leur hauteur propre au lieu d'être étirées sur celle
       de leur voisine de rangée. */
    align-items: start;
  }
  /* Une seule colonne sur un écran large laissait 1150 px de large pour un
     titre et deux lignes d'extrait, avec trois résultats visibles à la fois. */
  .results-grid--detailed-split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  /* Le compact se répartit seul : « une carte ne descend pas sous 280 px, le
     navigateur en met autant que ça rentre ». Des seuils en pixels codés en dur
     ratatient de peu la configuration la plus courante — colonne de 673 px face
     à un seuil de 680 — et le mode n'apportait alors presque rien. */
  .results-grid--compact {
    gap: 0.625rem;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
</style>
