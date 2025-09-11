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

<style></style>
