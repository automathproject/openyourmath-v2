<!-- src/routes/exercise/[uuid]/+page.svelte -->
<script>
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import LectureSubheader from '$lib/components/LectureSubheader.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import { page } from '$app/stores';
  
  export let data;
  
  let showHint = false;
  let showSolution = false;
  let readingMode = 'classic';

  const answerTypes = new Set(['hint', 'indication', 'reponse', 'solution', 'answer']);

  function sortedContent(content = []) {
    return [...content].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getQuestionCount(content = []) {
    return content.filter((block) => (block?.type || 'text') === 'question').length;
  }

  function getEstimatedTime(questionCount) {
    const minutes = Math.max(8, questionCount * 4 + 4);
    return `≈ ${minutes} min`;
  }

  function buildToc(content = []) {
    const items = [];
    let questionIndex = 0;
    let blockIndex = 0;
    let currentQuestionGroup = false;
    let hasIntro = false;

    for (const block of sortedContent(content)) {
      const type = block?.type || 'text';

      if (type === 'question') {
        if (currentQuestionGroup) blockIndex += 1;
        questionIndex += 1;
        currentQuestionGroup = true;
        items.push({
          href: `#question-${questionIndex}`,
          label: `Question ${questionIndex}`
        });
        continue;
      }

      if (answerTypes.has(type)) {
        if (!currentQuestionGroup) blockIndex += 1;
        continue;
      }

      if (currentQuestionGroup) {
        blockIndex += 1;
        currentQuestionGroup = false;
      }

      blockIndex += 1;
      if (!hasIntro) {
        hasIntro = true;
        items.unshift({
          href: `#section-${blockIndex}`,
          label: 'Énoncé'
        });
      }
    }

    return items;
  }

  $: content = data.exercise?.content || [];
  $: questionCount = getQuestionCount(content);
  $: estimatedTime = getEstimatedTime(questionCount);
  $: tocItems = buildToc(content);
  $: isImmersive = readingMode === 'immersive';
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
      {estimatedTime}
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

      {#if !isImmersive && tocItems.length > 0}
        <aside class="exercise-sidebar print-hidden" aria-label="Table des matières de l'exercice">
          <div class="toc-panel">
            <div class="t-overline toc-heading">Dans l'exercice</div>
            <nav class="toc-nav">
              {#each tocItems as item}
                <a href={item.href}>{item.label}</a>
              {/each}
            </nav>
          </div>
        </aside>
      {/if}
    </div>

    <!-- Exercices similaires -->
    {#if data.similar && data.similar.length > 0}
      <section class="similar-exercises print-hidden">
        <div class="t-overline mb-4">Exercices reliés</div>
        <div class="similar-exercises-grid">
          {#each data.similar as exercise}
            <a
              href="/exercise/{exercise.uuid}"
              class="card card-hover"
              style="padding: 14px;"
            >
              <h3 class="similar-exercise-title">
                <MathRenderer content={exercise.title} inline={true} />
              </h3>
              <div class="similar-exercise-metadata">
                {#if exercise.chapter}
                  <span class="chip chip-teal">{exercise.chapter}</span>
                {/if}
                {#if exercise.difficulty}
                  <StarsRating n={exercise.difficulty} total={5} />
                {/if}
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/if}
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
    background: theme('colors.interface.bg-primary');
    min-height: calc(100vh - theme('spacing.header'));
  }

  .exercise-reading-layout {
    display: grid;
    grid-template-columns: minmax(0, 720px) minmax(210px, 260px);
    gap: 42px;
    align-items: start;
    max-width: 1080px;
    margin: 0 auto;
    padding: 32px 24px 48px;
  }

  .exercise-page-shell--immersive .exercise-reading-layout {
    display: block;
    max-width: 720px;
  }

  .exercise-block {
    background: theme('colors.interface.bg-white');
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    padding: 30px 34px;
    box-shadow: theme('boxShadow.card');
  }

  .exercise-sidebar {
    position: sticky;
    top: calc(theme('spacing.header') + 24px);
  }

  .toc-panel {
    border-left: 1px solid theme('colors.interface.border-primary');
    padding-left: 18px;
  }

  .toc-heading {
    margin-bottom: 12px;
  }

  .toc-nav {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .toc-nav a {
    display: block;
    padding: 6px 0;
    color: theme('colors.interface.text-muted');
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
    text-decoration: none;
  }

  .toc-nav a:hover {
    color: theme('colors.interface.text-primary');
  }

  @media (max-width: 640px) {
    .exercise-block {
      padding: 18px 14px;
      border-radius: 0;
      border-left: 0;
      border-right: 0;
    }
    .exercise-reading-layout {
      display: block;
      padding: 0 0 28px;
    }
    .exercise-sidebar {
      display: none;
    }
  }

  /* Similar exercises */
  .similar-exercises {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 24px 48px;
  }

  .exercise-page-shell--immersive .similar-exercises {
    max-width: 720px;
  }

  .similar-exercises-grid { display:grid; gap:0.75rem; grid-template-columns: repeat(1,minmax(0,1fr)); }
  @media (min-width: 640px) { .similar-exercises-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media (min-width: 1024px) { .similar-exercises-grid { grid-template-columns: repeat(3,minmax(0,1fr)); } }
  .similar-exercise-title {
    font-family: theme('fontFamily.heading');
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 0.5rem;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
    color: theme('colors.interface.text-primary');
  }
  .similar-exercise-metadata { display:flex; align-items:center; gap:0.5rem; flex-wrap: wrap; }

</style>
