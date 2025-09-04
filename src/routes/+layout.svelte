<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import { 
    listCount, 
    listActions,
    exerciseList
  } from '$lib/stores/listStore.js';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  
  let listUrl = '/exercise/list';
  
  // Réactivité pour détecter si on est sur la page de liste
  $: isListPage = $page.route.id === '/exercise/list';
  
  // Mettre à jour l'URL de la liste de manière réactive
  $: if ($exerciseList && $exerciseList.length > 0) {
    const uuids = $exerciseList.map(ex => ex.uuid).join(',');
    listUrl = `/exercise/list?list=${encodeURIComponent(uuids)}`;
  } else {
    listUrl = '/exercise/list';
  }
  
  // Description de la liste pour le tooltip
  $: listDescription = (() => {
    if ($listCount === 0) return 'Aucun exercice dans votre liste';
    if ($listCount === 1) return '1 exercice dans votre liste';
    return `${$listCount} exercices dans votre liste`;
  })();
</script>

<div class="min-h-screen">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <div class="flex items-center">
          <h1 class="text-2xl font-bold text-gray-900">
            <a href="/" class="hover:text-blue-600 transition-colors">OpenYourMath</a>
          </h1>
        </div>
        
        <nav class="flex items-center space-x-6">
          <a 
            href="/" 
            class="text-gray-600 hover:text-gray-900 transition-colors"
            class:text-blue-600={$page.route.id === '/'}
          >
            Recherche
          </a>
          
          <a 
            href="/browse" 
            class="text-gray-600 hover:text-gray-900 transition-colors"
            class:text-blue-600={$page.route.id === '/browse'}
          >
            Parcourir
          </a>
          
          <!-- Lien vers la liste d'exercices -->
          <a 
            href={listUrl}
            class="relative flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            class:text-blue-600={isListPage}
            title={listDescription}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            
            <span class="hidden sm:inline">Ma liste</span>
            
            <!-- Compteur d'exercices -->
            {#if $listCount > 0}
              <span class="list-counter">
                {$listCount}
              </span>
            {/if}
          </a>
        </nav>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print-full-width">
    <slot />
  </main>

  <footer class="mt-16 bg-gray-100 border-t print-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <p class="text-center text-gray-600">OpenYourMath V2 - Exercices de mathématiques</p>
    </div>
  </footer>
</div>

<style></style>
