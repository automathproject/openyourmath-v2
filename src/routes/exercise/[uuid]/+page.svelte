<!-- src/routes/exercise/[uuid]/+page.svelte -->
<script>
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import { page } from '$app/stores';
  
  export let data;
  
  let showHint = false;
  let showSolution = false;
</script>

<svelte:head>
  <title>{data.exercise?.title || 'Exercice'} - OpenYourMath v2</title>
  <meta name="description" content="Exercice de mathématiques : {data.exercise?.title || 'Non trouvé'}" />
</svelte:head>

{#if data.exercise}
  <div class="exercise-page-wrapper">
    <div class="exercise-block">
      <ExerciseContent
        exercise={data.exercise}
        variant="full"
        showGlobalToggles={true}
        content={data.exercise.content || []}
        bind:showHint
        bind:showSolution
      />
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
  .exercise-breadcrumb {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .breadcrumb-left {
    display: flex;
    align-items: center;
  }
  .exercise-uuid {
    font-family: monospace;
    font-size: 0.75rem;
    color: rgb(156, 163, 175);
    opacity: 0.8;
  }

  @media (max-width: 640px) {
    .exercise-title {
      margin: 0.25rem 0 0.75rem 0;
      line-height: 1.2;
      font-size: clamp(1.125rem, 4.5vw, 1.375rem);
    }


  }
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
  .exercise-page-wrapper {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem 1.5rem 3rem;
  }

  .exercise-block {
    background: theme('colors.interface.bg-white');
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    padding: 32px 40px;
    box-shadow: theme('boxShadow.card');
    margin-bottom: 2rem;
  }

  @media (max-width: 640px) {
    .exercise-block {
      padding: 20px 16px;
      border-radius: 0;
      border-left: 0;
      border-right: 0;
      margin: 0 -1.5rem;
    }
    .exercise-page-wrapper { padding: 0.5rem 1.5rem 2rem; }
  }

  /* Similar exercises */
  .similar-exercises { margin-top: 2rem; }
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
