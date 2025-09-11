<!-- src/lib/components/Breadcrumb.svelte -->
<script>
  export let items = []; // [{ label, href? }]
  export let rightText = '';
</script>

<nav class="exercise-breadcrumb">
  <div class="breadcrumb-left">
    {#each items as item, i}
      {#if item.href}
        <a href={item.href}>{item.label}</a>
      {:else}
        <span>{item.label}</span>
      {/if}
      {#if i < items.length - 1}
        <span class="mx-1 text-gray-400">›</span>
      {/if}
    {/each}
  </div>
  <div>
    <slot name="right">
      {#if rightText}
        <span class="exercise-uuid text-xs text-gray-400 font-mono" style="opacity:0.8">{rightText}</span>
      {/if}
    </slot>
  </div>
  
</nav>

<style></style>
