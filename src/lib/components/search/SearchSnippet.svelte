<script>
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  export let content = '';
  export let lines = 3;
</script>

<div class="snippet" style={`--snippet-lines:${lines};`}>
  <div class="snippet-content">
    <MathRenderer content={content} />
  </div>
</div>

<style>
  .snippet {
    overflow: hidden;
  }
  .snippet-content {
    display: -webkit-box;
    -webkit-line-clamp: var(--snippet-lines, 3);
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    @apply text-gray-600;
  }
  .snippet-content :global(p) {
    margin: 0;
  }
</style>
