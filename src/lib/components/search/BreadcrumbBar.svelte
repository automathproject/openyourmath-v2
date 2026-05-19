<script>
  export let breadcrumb;
  export let onClear;
</script>

<div class="breadcrumb-bar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
  <div class="breadcrumb-path">
    <span class="breadcrumb-icon">📍</span>
    <span>{breadcrumb?.label || 'Tous les exercices'}</span>
  </div>
  <div class="breadcrumb-actions">
    {#if breadcrumb && !breadcrumb.isEmpty}
      <button type="button" class="btn btn-text text-sm text-brand-primary" on:click={onClear}>
        Effacer
      </button>
    {/if}
  </div>
</div>

<style>
  .breadcrumb-bar {
    border-radius:0.75rem;
    padding:0.75rem 1rem;
    @apply bg-interface-bg-secondary border border-interface-border-primary;
  }
  .breadcrumb-path {
    display:flex;
    align-items:center;
    gap:0.5rem;
    font-size:0.95rem;
    @apply text-interface-text-secondary;
  }
  .breadcrumb-actions { display:flex; gap:0.75rem; align-items:center; justify-content:flex-end; }
  .breadcrumb-icon { font-size:1rem; }
</style>
