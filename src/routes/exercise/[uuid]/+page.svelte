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
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <article class="exercise bg-white rounded-lg shadow-sm border">
      <!-- Header de l'exercice -->
      <header class="border-b border-gray-200 p-6">
        <!-- Breadcrumb -->
        <nav class="text-sm text-gray-500 mb-4">
          <a href="/" class="hover:text-blue-600 transition-colors">Accueil</a>
          <span class="mx-2">›</span>
          <span>{data.exercise.chapter}</span>
          {#if data.exercise.theme}
            <span class="mx-2">›</span>
            <span>{data.exercise.theme}</span>
          {/if}
        </nav>
        
        <!-- Titre principal -->
        <h1 class="text-3xl font-bold text-gray-900 mb-4">
          {data.exercise.title}
        </h1>
        
        <!-- Métadonnées -->
        <div class="flex flex-wrap items-center gap-4 mb-4">
          <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            {data.exercise.chapter}
          </span>
          
          {#if data.exercise.theme}
            <span class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              {data.exercise.theme}
            </span>
          {/if}
          
          {#if data.exercise.difficulty}
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600">Difficulté :</span>
              <div class="flex gap-1">
                {#each Array(5) as _, i}
                  <div class="w-3 h-3 rounded-full {i < data.exercise.difficulty ? 'bg-orange-400' : 'bg-gray-200'}"></div>
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
        <div class="flex gap-3">
          <button 
            on:click={shareExercise}
            class="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Partager
          </button>
          
          <button 
            on:click={printExercise}
            class="flex items-center gap-2 px-4 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer
          </button>
          
          <div class="flex gap-2">
            <button 
              on:click={() => showHint = !showHint}
              class="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
              class:bg-yellow-100={showHint}
            >
              💡 {showHint ? 'Masquer' : 'Voir'} l'indication
            </button>
            
            <button 
              on:click={() => showSolution = !showSolution}
              class="flex items-center gap-2 px-4 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              class:bg-green-100={showSolution}
            >
              ✅ {showSolution ? 'Masquer' : 'Voir'} la solution
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
      <section class="mt-12">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">Exercices similaires</h2>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each data.similar as exercise}
            <a 
              href="/exercise/{exercise.uuid}"
              class="block bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">
                {exercise.title}
              </h3>
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span class="bg-gray-100 px-2 py-1 rounded text-xs">
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
  <div class="container mx-auto px-4 py-16 text-center">
    <div class="max-w-md mx-auto">
      <div class="text-gray-400 mb-6">
        <svg class="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17H9m6-8V9a6 6 0 10-12 0v6c0 3.314 2.686 6 6h6a6 6 0 000-12z" />
        </svg>
      </div>
      
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Exercice non trouvé</h1>
      <p class="text-gray-600 mb-8">
        L'exercice demandé n'existe pas ou a été supprimé.
      </p>
      
      <div class="space-y-3">
        <a 
          href="/" 
          class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Retour à la recherche
        </a>
        
        <div class="text-sm text-gray-500">
          UUID recherché : <code class="bg-gray-100 px-2 py-1 rounded">{$page.params.uuid}</code>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Styles pour l'impression */
  @media print {
    .container {
      max-width: none;
      padding: 0;
    }
    
    header button,
    nav,
    section:last-child {
      display: none;
    }
    
    .exercise {
      box-shadow: none;
      border: none;
    }
  }
  
  /* Utilitaire pour limiter les lignes */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>