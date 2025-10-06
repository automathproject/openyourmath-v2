<script>
  export let title = '';
  export let subtitle = '';
</script>

<div class="empty-state">
  {#if title}
    <h3 class="empty-state-title">{title}</h3>
  {/if}
  {#if subtitle}
    <p class="empty-state-subtitle">{subtitle}</p>
  {/if}
  <slot name="action" />
</div>
