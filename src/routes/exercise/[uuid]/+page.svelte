<!-- src/routes/exercise/[uuid]/+page.svelte -->
<script>
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import LectureSidebar from '$lib/components/LectureSidebar.svelte';
  import LectureSubheader from '$lib/components/LectureSubheader.svelte';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { immersiveMode } from '$lib/stores/uiStore.ts';

  export let data;

  let showHint = false;
  let showSolution = false;
  let readingMode = 'classic';

  function getQuestionCount(content = []) {
    return content.filter((block) => (block?.type || 'text') === 'question').length;
  }

  $: content = data.exercise?.content || [];
  $: questionCount = getQuestionCount(content);
  $: isImmersive = readingMode === 'immersive';
  $: immersiveMode.set(isImmersive);

  function handleKeydown(e) {
    if (e.key === 'Escape' && isImmersive) readingMode = 'classic';
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  onDestroy(() => immersiveMode.set(false));
</script>

<svelte:head>
  <title>{data.exercise?.title || 'Exercice'} - OpenYourMath v2</title>
  <meta name="description" content="Exercice de mathématiques : {data.exercise?.title || 'Non trouvé'}" />
</svelte:head>

{#if data.exercise}
  <div class="exercise-page-shell" class:exercise-page-shell--immersive={isImmersive}>
    <LectureSubheader
      exercise={data.exercise}
      bind:mode={readingMode}
      bind:showHint
      bind:showSolution
      {questionCount}
    />

    <div class="exercise-reading-layout">
      <article class="exercise-reading-column">
        <div class="exercise-block">
          <ExerciseContent
            exercise={data.exercise}
            variant="full"
            showHeader={false}
            content={content}
            bind:showHint
            bind:showSolution
          />
        </div>
      </article>

      {#if !isImmersive}
        <LectureSidebar
          exercise={data.exercise}
          similar={data.similar || []}
          bind:showHint
          bind:showSolution
        />
      {/if}
    </div>
  </div>

{:else}
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-title">Exercice non trouvé</h1>
      <p class="error-description">
        L'exercice demandé n'existe pas ou a été supprimé.
      </p>
      <div class="error-actions">
        <a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Retour à la recherche
        </a>
        <div class="error-uuid">
          UUID recherché : <code>{$page.params.uuid}</code>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @media (max-width: 640px) {
  /* réduit marge/padding gauche des questions */
  :global(.exercise-content .question),
  :global(.exercise-content .question-block) {
    margin-left: -1rem !important;
    padding-left: 0.25rem !important;
  }
  :global(.exercise-header) {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    margin-bottom: 0.75rem !important;
  }
  }

  /* Page layout */
  .exercise-page-shell {
    background: #fbf8ef;
    min-height: calc(100vh - theme('spacing.header'));
  }

  .exercise-reading-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 0;
    align-items: stretch;
    max-width: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid theme('colors.interface.border-primary');
  }

  .exercise-reading-column {
    background: #fffdf8;
    padding: 32px 48px 72px 32px;
  }

  .exercise-page-shell--immersive .exercise-reading-layout {
    display: block;
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 24px 72px;
    border-top: 0;
  }

  .exercise-page-shell--immersive .exercise-reading-column {
    padding: 0;
    background: transparent;
  }

  .exercise-block {
    max-width: 880px;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
  }

  .exercise-block :global(.exercise-content) {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }

  .exercise-block :global(.question-response-pair) {
    border-left: 0;
    padding-left: 0 !important;
  }

  .exercise-block :global(.question-block) {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }

  @media (max-width: 900px) {
    .exercise-reading-layout {
      display: block;
      padding: 0;
      border-top: 1px solid theme('colors.interface.border-primary');
    }

    .exercise-reading-column {
      padding: 24px 16px 40px;
    }

    .exercise-block {
      border-radius: 0;
      border-left: 0;
      border-right: 0;
    }
  }
</style>
