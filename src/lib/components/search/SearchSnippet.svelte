<script>
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  export let content = '';
  export let lines = 3;
</script>

<div class="snippet" style={`--snippet-lines:${lines};`}>
  <div class="snippet-content">
    <MathRenderer content={content} />
  </div>
  <div class="snippet-fade" aria-hidden="true"></div>
</div>

<style>
  .snippet {
    position: relative;
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
  .snippet-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.35rem;
    pointer-events: none;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgb(255, 255, 255));
  }
</style>
