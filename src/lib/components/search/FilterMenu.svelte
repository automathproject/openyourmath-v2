<script>
  import FilterMenuContent from '$lib/components/search/FilterMenuContent.svelte';

  export let isOpen = false;
  export let categories = [];
  export let activeCategory = null;
  export let onClose = () => {};
  export let onSelectCategory = () => {};
  export let moduleOptions = [];
  export let levelOptions = [];
  export let difficultyOptions = [];
  export let activeMenuFilters = {};
  export let filteredAuthors = [];
  export let authorSearch = '';
  export let onModuleSelect = () => {};
  export let onLevelSelect = () => {};
  export let onDifficultySelect = () => {};
  export let onPropertySelect = () => {};
  export let onAuthorSelect = () => {};
  export let onAuthorSearchInput = () => {};
  export let onAuthorSearchSubmit = () => {};

  const getCategoryLabel = (id) => {
    const match = categories.find((item) => item.id === id);
    return match ? match.label : 'Ajouter un filtre';
  };
</script>

{#if isOpen}
  <div
    class="filters-menu-overlay md:hidden"
    role="button"
    tabindex="0"
    aria-label="Fermer l'ajout de filtre"
    on:click={onClose}
    on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && onClose()}
  >
    <div
      class="filters-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter un filtre"
      tabindex="0"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="filters-menu-header">
        {#if activeCategory}
          <button type="button" class="filters-menu-back" on:click={() => onSelectCategory(null)}>
            ← Catégories
          </button>
          <h4>{getCategoryLabel(activeCategory)}</h4>
        {:else}
          <h4>Ajouter un filtre</h4>
        {/if}
        <button type="button" class="filters-menu-close" on:click={onClose} aria-label="Fermer">✕</button>
      </div>

      <div class="filters-menu-body">
        {#if !activeCategory}
          {#each categories as category}
            <button type="button" class="filters-menu-category" on:click={() => onSelectCategory(category.id)}>
              <div class="filters-menu-category-label">
                <span class="filters-menu-category-icon">{category.icon}</span>
                <span>{category.label}</span>
              </div>
              <span class="filters-menu-category-arrow">›</span>
            </button>
          {/each}
        {:else}
          <FilterMenuContent
            category={activeCategory}
            {moduleOptions}
            {levelOptions}
            {difficultyOptions}
            {activeMenuFilters}
            {filteredAuthors}
            {authorSearch}
            onModuleSelect={onModuleSelect}
            onLevelSelect={onLevelSelect}
            onDifficultySelect={onDifficultySelect}
            onPropertySelect={onPropertySelect}
            onAuthorSelect={onAuthorSelect}
            onAuthorSearchInput={onAuthorSearchInput}
            onAuthorSearchSubmit={onAuthorSearchSubmit}
          />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .filters-menu-overlay {
    position:fixed;
    inset:0;
    background:rgba(17,24,39,0.45);
    z-index:70;
    display:flex;
    align-items:flex-end;
    justify-content:center;
  }
  @media (min-width:768px) {
    .filters-menu-overlay {
      display:none;
    }
  }
  .filters-menu {
    width:100%;
    max-width:480px;
    max-height:80vh;
    border-radius:1rem 1rem 0 0;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    @apply bg-interface-bg-primary;
  }
  .filters-menu-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:1rem 1.25rem;
    @apply border-b border-gray-200;
  }
  .filters-menu-header h4 {
    font-size:1rem;
    font-weight:600;
    @apply text-interface-text-primary;
  }
  .filters-menu-close,
  .filters-menu-back {
    font-size:0.95rem;
    font-weight:500;
    @apply text-brand-primary;
  }
  .filters-menu-body {
    padding:1rem;
    overflow-y:auto;
    display:flex;
    flex-direction:column;
    gap:1rem;
  }
  .filters-menu-category {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0.75rem 1rem;
    border-radius:0.75rem;
    cursor:pointer;
    @apply bg-gray-100 text-gray-800;
  }
  .filters-menu-category:hover { @apply bg-gray-200; }
  .filters-menu-category-label { display:flex; align-items:center; gap:0.75rem; }
  .filters-menu-category-icon { font-size:1.25rem; }
  .filters-menu-category-arrow { font-size:1rem; @apply text-gray-400; }
</style>
