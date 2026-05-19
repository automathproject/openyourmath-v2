<script>
  import { createEventDispatcher } from 'svelte';

  export let chips = [];

  const dispatch = createEventDispatcher();

  function handleChipSelect(chip) {
    dispatch('chipSelect', { chip });
  }

  function handleChipRemove(chip) {
    dispatch('chipRemove', { chip });
  }

  function handleAddFilter() {
    dispatch('addFilter');
  }

  function handleKeyboardActivate(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }
</script>

<div class="filters-chips md:hidden" aria-live="polite">
  <div class="filters-chips-title">Filtres actifs</div>
  <div class="filters-chips-list">
    {#if chips.length === 0}
      <p class="filters-chips-empty">Aucun filtre actif</p>
    {:else}
      {#each chips as chip}
        <button type="button" class="filters-chip" on:click={() => handleChipSelect(chip)}>
          <span class="filters-chip-label">{chip.icon} {chip.label}</span>
          <span
            class="filters-chip-remove"
            role="button"
            tabindex="0"
            aria-label={`Retirer ${chip.label}`}
            on:click|stopPropagation={() => handleChipRemove(chip)}
            on:keydown|stopPropagation={(event) => handleKeyboardActivate(event, () => handleChipRemove(chip))}
          >×</span>
        </button>
      {/each}
    {/if}
  </div>
  <button type="button" class="filters-add-chip" on:click={handleAddFilter}>
    + Ajouter un filtre
  </button>
</div>

<style>
  .filters-chips {
    border-radius:0.75rem;
    padding:0.75rem;
    display:flex;
    flex-direction:column;
    gap:0.6rem;
    @apply border border-interface-border-primary bg-interface-bg-secondary;
  }
  .filters-chips-title {
    font-weight:600;
    font-size:0.9rem;
    @apply text-interface-text-primary;
  }
  .filters-chips-list { display:flex; flex-wrap:wrap; gap:0.4rem; }
  .filters-chips-empty {
    font-size:0.875rem;
    @apply text-interface-text-secondary;
  }
  .filters-chip {
    display:inline-flex;
    align-items:center;
    gap:0.5rem;
    padding:0.45rem 0.75rem;
    border-radius:9999px;
    font-size:0.85rem;
    cursor:pointer;
    box-shadow:0 1px 2px rgba(15,23,42,0.08);
    @apply border border-interface-border-primary bg-interface-bg-primary text-interface-text-secondary;
  }
  .filters-chip:hover { @apply bg-interface-bg-tertiary; }
  .filters-chip-label { display:flex; align-items:center; gap:0.35rem; }
  .filters-chip-remove {
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:1.25rem;
    height:1.25rem;
    border-radius:9999px;
    font-weight:600;
    cursor:pointer;
    @apply bg-interface-bg-tertiary text-interface-text-secondary;
  }
  .filters-chip-remove:hover { @apply bg-interface-border-primary; }
  .filters-add-chip {
    align-self:flex-start;
    display:inline-flex;
    align-items:center;
    gap:0.3rem;
    padding:0.45rem 0.8rem;
    border-radius:0.75rem;
    font-weight:500;
    cursor:pointer;
    @apply border border-dashed border-interface-border-secondary bg-interface-bg-primary text-interface-text-secondary;
  }
  .filters-add-chip:hover { @apply bg-interface-bg-secondary; }
</style>
