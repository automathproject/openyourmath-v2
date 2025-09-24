<!-- src/lib/components/ExerciseHeader.svelte -->
<script>
  import Breadcrumb from './Breadcrumb.svelte';
  import NameRenderer from './NameRenderer.svelte';
  import MathRenderer from './MathRenderer.svelte';

  export let exercise = {};
  export let variant = 'full'; // 'full' | 'preview' | 'simple'
  export let position = null; // { current, total }
  export let showGlobalToggles = false;
  export let showHint = false;
  export let showSolution = false;
  export let breadcrumbItems = []; // [{label, href?}]
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

  $: showCrumb = showBreadcrumb && variant !== 'preview';
  $: computedBreadcrumb = (() => {
    if (!showCrumb) return [];
    if (breadcrumbItems && breadcrumbItems.length > 0) return breadcrumbItems;
    const items = [];
    if (variant === 'full' && position) {
      items.push({ label: `Exercice ${position.current}` });
      if (exercise?.chapter) items.push({ label: exercise.chapter });
      return items;
    }
    if (exercise) {
      items.push({ label: 'Accueil', href: '/' });
      if (exercise.level) items.push({ label: exercise.level });
      if (exercise.module) items.push({ label: exercise.module });
      if (exercise.chapter) items.push({ label: exercise.chapter });
    }
    return items;
  })();
</script>

<header class="exercise-header" class:is-preview={variant === 'preview'}>
  {#if showCrumb}
    <Breadcrumb items={computedBreadcrumb} />
  {/if}

  <!-- Top row -->
  <div class="header-top">
    <h1 class="exercise-title {variant !== 'full' ? 'text-2xl mb-6' : ''}">
      <MathRenderer content={exercise?.title || 'Exercice'} inline={true} />
    </h1>

    <!-- Absolutely positioned, removed from normal flow -->
    <div class="title-right">
      {#if exercise?.uuid}
        <span class="exercise-uuid text-xs text-gray-400 font-mono">{exercise.uuid}</span>
      {/if}

      {#if variant !== 'preview'}
        <div class="attribution-info">
          {#if exercise?.author}
            <NameRenderer
              author={exercise.author}
              licenseCode={exercise.license_code}
              licenseUrl={exercise.license_url}
              email={exercise.author_email || exercise.authorEmail || ''}
              variant="compact"
            />
          {/if}

          {#if exercise?.organization}
            <div class="attribution-item">
              <span class="attribution-icon">🏛️</span>
              <span class="attribution-text">{exercise.organization}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if variant !== 'preview'}
    <div class="exercise-metadata">
      {#if exercise.level}
        <span class="exercise-badge exercise-badge--level">{exercise.level}</span>
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
    </div>
  {/if}

  {#if showGlobalToggles}
    <div class="exercise-actions">
      {#if exercise?.hasIndication}
        <button
          on:click={() => showHint = !showHint}
          class="action-button action-button--hint"
          aria-pressed={showHint}
        >
          💡 {showHint ? 'Masquer' : 'Voir'} les indications
        </button>
      {/if}
      {#if exercise?.hasSolution}
        <button
          on:click={() => showSolution = !showSolution}
          class="action-button action-button--solution"
          aria-pressed={showSolution}
        >
          ✅ {showSolution ? 'Masquer' : 'Voir'} les solutions
        </button>
      {/if}
    </div>
  {/if}
</header>

<style>
  .exercise-header {
    position: relative; /* anchor for absolute right column */
    border-bottom: 1px solid rgb(229 231 235);
  }

  .header-top {
    position: relative;
    display: block;
    min-height: 2.25rem; /* ensures room for the absolutely positioned block */
  }

  .exercise-title {
    color: rgb(17 24 39);
    font-weight: 700;
    margin-bottom: 0.5rem; /* tighter */
    /* Reserve space on the right so the title never overlaps the pinned block */
    margin-right: clamp(10rem, 28vw, 22rem);
    line-height: 1.2;
  }

  .title-right {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.375rem;
    max-width: 40ch; /* prevent overgrowth */
  }

  .exercise-uuid {
    opacity: 0.8;
  }

  .attribution-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    align-items: flex-end;
  }

  .attribution-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: rgb(75 85 99);
    white-space: nowrap;
  }

  .attribution-icon {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .attribution-text {
    font-weight: 500;
  }

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
  .exercise-badge--module { background: rgb(243 244 246); color: rgb(55 65 81); }
  .exercise-badge--level { background: rgb(240 253 244); color: rgb(22 101 52); }
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

  /* Preview context */
  .exercise-header.is-preview { font-size: 0.9em; }
  .exercise-header.is-preview .exercise-badge,
  .exercise-header.is-preview .action-button,
  .exercise-header.is-preview .exercise-title,
  .exercise-header.is-preview .exercise-metadata { font-size: inherit !important; }

  /* In preview, allow the title to take more width */
  .exercise-header.is-preview .exercise-title {
    /* Reduce the reserved space for the right block */
    margin-right: clamp(6rem, 18vw, 14rem);
  }

  /* Responsive: on small screens, put the right block back into flow */
  @media (max-width: 640px) {
    .title-right {
      position: static;
      align-items: flex-start;
      margin-top: 0.25rem;
      max-width: 100%;
    }
    .exercise-title {
      margin-right: 0; /* no reservation needed on mobile */
      margin-bottom: 0.375rem;
    }
  }
</style>
