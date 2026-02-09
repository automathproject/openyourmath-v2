<script>
  import { slide } from 'svelte/transition';

  export let title = '';
  export let open = false;
  export let tone = 'default';

  function toggle() {
    open = !open;
  }
</script>

<section class={`collapsible collapsible--${tone}`}>
  <button
    type="button"
    class="collapsible-trigger"
    on:click={toggle}
    aria-expanded={open}
  >
    <span class="collapsible-title">{title}</span>
    <span class="collapsible-chevron" class:collapsible-chevron--open={open}>▾</span>
  </button>

  {#if open}
    <div class="collapsible-content" transition:slide={{ duration: 180 }}>
      <slot />
    </div>
  {/if}
</section>

<style>
  .collapsible {
    border-radius: 0.75rem;
    @apply border border-gray-200 bg-white;
  }
  .collapsible--hint { @apply border-amber-200 bg-amber-50; }
  .collapsible--solution { @apply border-emerald-200 bg-emerald-50; }

  .collapsible-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.65rem 0.8rem;
    font-weight: 600;
    text-align: left;
    @apply text-gray-800;
  }
  .collapsible-chevron {
    transition: transform 0.18s ease;
    @apply text-gray-600;
  }
  .collapsible-chevron--open {
    transform: rotate(180deg);
  }
  .collapsible-content {
    padding: 0.2rem 0.8rem 0.8rem 0.8rem;
  }
</style>
