<!-- src/lib/components/ExerciseHeader.svelte -->
<script>
  import Breadcrumb from './Breadcrumb.svelte';

  export let exercise = {};
  export let variant = 'full'; // 'full' | 'preview' | 'simple'
  export let position = null; // { current, total }
  export let showGlobalToggles = false;
  export let showHint = false;
  export let showSolution = false;
  export let breadcrumbItems = []; // optional custom items [{label, href?}]
  export let showBreadcrumb = true;

  function toggleHint() {
    showHint = !showHint;
    const e = new CustomEvent('toggleHint', { detail: { showHint } });
    dispatchEvent(e);
  }

  function toggleSolution() {
    showSolution = !showSolution;
    const e = new CustomEvent('toggleSolution', { detail: { showSolution } });
    dispatchEvent(e);
  }

  // Compute default breadcrumb when not provided
  $: computedBreadcrumb = (() => {
    if (!showBreadcrumb) return [];
    if (breadcrumbItems && breadcrumbItems.length > 0) return breadcrumbItems;
    const items = [];
    if (variant === 'full' && position) {
      items.push({ label: `Exercice ${position.current}` });
      if (exercise?.chapter) items.push({ label: exercise.chapter });
      return items;
    }
    // preview/simple: use Accueil > level > module > chapter
    if (exercise) {
      items.push({ label: 'Accueil', href: '/' });
      if (exercise.level) items.push({ label: exercise.level });
      if (exercise.module) items.push({ label: exercise.module });
      if (exercise.chapter) items.push({ label: exercise.chapter });
    }
    return items;
  })();
</script>

<header class="exercise-header">
  {#if showBreadcrumb}
    <Breadcrumb items={computedBreadcrumb} />
  {/if}
  <div class="flex items-baseline justify-between">
    <h1 class="exercise-title {variant !== 'full' ? 'text-2xl mb-3' : ''}">
      {exercise?.title || 'Exercice'}
    </h1>
    {#if exercise?.uuid}
      <span class="exercise-uuid text-xs text-gray-400 font-mono" style="opacity:0.8">{exercise.uuid}</span>
    {/if}
  </div>

  <div class="exercise-metadata">
    {#if exercise.chapter && variant !== 'full'}
      <span class="exercise-badge exercise-badge--chapter">{exercise.chapter}</span>
    {/if}
    {#if exercise.theme}
      <span class="exercise-badge exercise-badge--theme">{exercise.theme}</span>
    {/if}
    {#if exercise.difficulty}
      <div class="exercise-difficulty">
        <div class="flex gap-1">
          {#each Array(5) as _, i}
            <div class="w-2 h-2 rounded-full {i < exercise.difficulty ? 'bg-orange-400' : 'bg-gray-200'}"></div>
          {/each}
        </div>
        {#if variant === 'full'}
          <span class="text-sm text-gray-500">({exercise.difficulty}/5)</span>
        {/if}
      </div>
    {/if}
    {#if exercise.author}
      <span class="text-sm text-gray-600">Par <strong>{exercise.author}</strong></span>
    {/if}
  </div>

  {#if showGlobalToggles}
    <div class="exercise-actions">
      <button
        on:click={() => showHint = !showHint}
        class="action-button action-button--hint"
        aria-pressed={showHint}
      >
        💡 {showHint ? 'Masquer' : 'Voir'} les indications
      </button>
      <button
        on:click={() => showSolution = !showSolution}
        class="action-button action-button--solution"
        aria-pressed={showSolution}
      >
        ✅ {showSolution ? 'Masquer' : 'Voir'} les solutions
      </button>
    </div>
  {/if}
</header>

<style>
  .exercise-header {
    border-bottom: 1px solid rgb(229 231 235);
    padding: 1.5rem;
  }
  .exercise-title {
    color: rgb(17 24 39);
    font-weight: 700;
    margin-bottom: 1rem;
  }
  .exercise-breadcrumb {
    color: rgb(107 114 128);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .exercise-breadcrumb a { text-decoration: none; }
  .exercise-breadcrumb a:hover { color: rgb(37 99 235); }
  .exercise-metadata {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .exercise-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .exercise-badge--chapter { background: rgb(219 234 254); color: rgb(30 64 175); }
  .exercise-badge--theme { background: rgb(237 233 254); color: rgb(91 33 182); }
  .exercise-difficulty { display: flex; align-items: center; gap: 0.5rem; }

  .exercise-actions { display: flex; gap: 0.75rem; }
  .action-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border-radius: 0.5rem;
    transition: background-color .2s ease;
  }
  .action-button--hint { background: rgb(254 252 232); color: rgb(133 77 14); }
  .action-button--hint:hover { background: rgb(253 246 178); }
  .action-button--solution { background: rgb(240 253 244); color: rgb(22 101 52); }
  .action-button--solution:hover { background: rgb(187 247 208); }
</style>
