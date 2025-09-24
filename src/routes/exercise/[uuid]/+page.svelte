<!-- src/routes/exercise/[uuid]/+page.svelte -->
<script>
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
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
<div class="container max-w-4xl mx-auto px-3 sm:px-6 py-2 sm:py-6">    <article class="exercise">
      <main class="px-3 py-1 sm:px-6 sm:py-3">
        <ExerciseContent 
          exercise={data.exercise}
          variant="full"
          showGlobalToggles={true}
          content={data.exercise.content || []}
          bind:showHint
          bind:showSolution
        />
      </main>
    </article>
    
    <!-- Exercices similaires -->
    {#if data.similar && data.similar.length > 0}
      <section class="similar-exercises print-hidden">
        <h2 class="similar-exercises-title">Exercices similaires</h2>
        <div class="similar-exercises-grid">
          {#each data.similar as exercise}
            <a 
              href="/exercise/{exercise.uuid}"
              class="similar-exercise-card"
            >
              <h3 class="similar-exercise-title">
                <MathRenderer content={exercise.title} inline={true} />
              </h3>
              <div class="similar-exercise-metadata">
                <span class="similar-exercise-badge">
                  {exercise.chapter}
                </span>
                {#if exercise.difficulty}
                  <div class="flex gap-1">
                    {#each Array(5) as _, i}
                      <div class="w-2 h-2 rounded-full {i < exercise.difficulty ? 'bg-orange-300' : 'bg-gray-200'}"></div>
                    {/each}
                  </div>
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

  /* Similar exercises */
  .similar-exercises { margin-top: 3rem; }
  .similar-exercises-title { font-size: 1.5rem; font-weight: 700; color:#111827; margin-bottom: 1.5rem; }
  .similar-exercises-grid { display:grid; gap:1rem; grid-template-columns: repeat(1,minmax(0,1fr)); }
  @media (min-width: 768px) { .similar-exercises-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media (min-width: 1024px) { .similar-exercises-grid { grid-template-columns: repeat(3,minmax(0,1fr)); } }
  .similar-exercise-card { display:block; background:#fff; border-radius:0.5rem; border:1px solid #e5e7eb; box-shadow:0 1px 2px rgba(0,0,0,0.05); padding:1rem; }
  .similar-exercise-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .similar-exercise-title { font-weight:600; color:#111827; margin-bottom:0.5rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .similar-exercise-metadata { display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; color:#4b5563; }
  .similar-exercise-badge { background:#f3f4f6; padding:0.25rem 0.5rem; border-radius:0.25rem; font-size:0.75rem; }

</style>
