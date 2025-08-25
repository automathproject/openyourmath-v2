<!-- src/routes/exercise/[uuid]/+page.svelte -->
<script>
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import { page } from '$app/stores';
  
  export let data;
  
  let showHint = false;
  let showSolution = false;
  
  // Fonction pour partager l'exercice
  function shareExercise() {
    if (navigator.share) {
      navigator.share({
        title: data.exercise.title,
        text: `Exercice de mathématiques : ${data.exercise.title}`,
        url: window.location.href
      });
    } else {
      // Fallback : copier l'URL
      navigator.clipboard.writeText(window.location.href);
      alert('Lien copié dans le presse-papier !');
    }
  }
  
  // Fonction pour imprimer
  function printExercise() {
    window.print();
  }
</script>

<svelte:head>
  <title>{data.exercise?.title || 'Exercice'} - OpenYourMath</title>
  <meta name="description" content="Exercice de mathématiques : {data.exercise?.title || 'Non trouvé'}" />
</svelte:head>

{#if data.exercise}
  <div class="container mx-auto px-4 py-8">
    <article class="exercise">
      <!-- Header de l'exercice -->
      <header class="exercise-header">
        <!-- Breadcrumb -->
        <nav class="exercise-breadcrumb">
          <a href="/">Accueil</a>
          <span class="mx-2">›</span>
          <span>{data.exercise.chapter}</span>
          {#if data.exercise.theme}
            <span class="mx-2">›</span>
            <span>{data.exercise.theme}</span>
          {/if}
        </nav>
        
        <!-- Titre principal -->
        <h1 class="exercise-title">
          {data.exercise.title}
        </h1>
        
        <!-- Métadonnées -->
        <div class="exercise-metadata">
          <span class="exercise-badge exercise-badge--chapter">
            {data.exercise.chapter}
          </span>
          
          {#if data.exercise.theme}
            <span class="exercise-badge exercise-badge--theme">
              {data.exercise.theme}
            </span>
          {/if}
          
          {#if data.exercise.difficulty}
            <div class="exercise-difficulty">
              <span class="text-sm text-gray-600">Difficulté :</span>
              <div class="flex gap-1">
                {#each Array(5) as _, i}
                  <div class="difficulty-dot {i < data.exercise.difficulty ? 'difficulty-dot--active' : 'difficulty-dot--inactive'}"></div>
                {/each}
              </div>
              <span class="text-sm text-gray-500">({data.exercise.difficulty}/5)</span>
            </div>
          {/if}
          
          {#if data.exercise.author}
            <span class="text-sm text-gray-600">
              Par <strong>{data.exercise.author}</strong>
            </span>
          {/if}
        </div>
        
        <!-- Actions -->
        <div class="exercise-actions">
          <button 
            on:click={shareExercise}
            class="action-button action-button--primary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Partager
          </button>
          
          <button 
            on:click={printExercise}
            class="action-button action-button--secondary print-hidden"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer
          </button>
          
          <div class="flex gap-2">
            <button 
              on:click={() => showHint = !showHint}
              class="action-button action-button--hint {showHint ? 'action-button--active' : ''} print-hidden"
            >
              💡 {showHint ? 'Masquer' : 'Voir'} les indications
            </button>
            
            <button 
              on:click={() => showSolution = !showSolution}
              class="action-button action-button--solution {showSolution ? 'action-button--active' : ''} print-hidden"
            >
              ✅ {showSolution ? 'Masquer' : 'Voir'} les solutions
            </button>
          </div>
        </div>
      </header>
      
      <!-- Contenu de l'exercice -->
      <main class="p-6">
        <ExerciseContent 
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
                {exercise.title}
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
      <div class="error-icon">
        <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17H9m6-8V9a6 6 0 10-12 0v6c0 3.314 2.686 6 6h6a6 6 0 000-12z" />
        </svg>
      </div>
      
      <h1 class="error-title">Exercice non trouvé</h1>
      <p class="error-description">
        L'exercice demandé n'existe pas ou a été supprimé.
      </p>
      
      <div class="error-actions">
        <a 
          href="/" 
          class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Retour à la recherche
        </a>
        
        <div class="error-uuid">
          UUID recherché : <code>{$page.params.uuid}</code>
        </div>
      </div>
    </div>
  </div>
{/if}