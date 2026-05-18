<!-- src/lib/components/Breadcrumb.svelte -->
<script>
  export let items = []; // [{ label, href? }]
  export let rightText = '';
</script>

<nav class="breadcrumb" aria-label="Fil d'ariane">
  <div class="breadcrumb-left">
    {#each items as item, i}
      {#if item.href}
        <a href={item.href}>{item.label}</a>
      {:else}
        <span class="current">{item.label}</span>
      {/if}
      {#if i < items.length - 1}
        <span class="sep" aria-hidden="true">›</span>
      {/if}
    {/each}
  </div>
  <div>
    <slot name="right">
      {#if rightText}
        <span class="font-mono text-xs text-interface-text-muted" style="opacity:0.8">{rightText}</span>
      {/if}
    </slot>
  </div>
</nav>

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 13px;
    color: theme('colors.interface.text-muted');
  }
  .breadcrumb-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .breadcrumb a {
    color: theme('colors.interface.text-secondary');
    padding: 3px 8px;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .breadcrumb a:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .sep { color: theme('colors.interface.text-disabled'); user-select: none; }
  .current { color: theme('colors.interface.text-primary'); font-weight: 600; padding: 3px 8px; }
</style>
