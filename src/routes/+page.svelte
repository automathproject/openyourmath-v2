<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  
  let searchQuery = '';
  let results = [];
  let loading = false;
  let error = null;
  let searchMeta = null;
  
  async function search() {
    if (!searchQuery.trim()) {
      results = [];
      searchMeta = null;
      error = null;
      return;
    }
    
    loading = true;
    error = null;
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // ✅ Extraire les résultats correctement
        results = data.results || [];
        searchMeta = data.meta || null;
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        error = errorData.error || 'Erreur de recherche';
        results = [];
      }
      
    } catch (err) {
      console.error('Erreur recherche:', err);
      error = 'Erreur de connexion';
      results = [];
    } finally {
      loading = false;
    }
  }
  
  // Debounce pour éviter trop de requêtes
  let searchTimeout;
  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(search, 300);
  }
</script>

<svelte:head>
  <title>OpenYourMath - Recherche d'exercices</title>
</svelte:head>

<div class="space-y-8">
  <!-- Hero section -->
  <div class="text-center py-12">
    <h1 class="text-4xl font-bold text-gray-900 mb-4">
      Recherchez parmi des milliers d'exercices de mathématiques
    </h1>
  </div>

  <!-- Search interface -->
  <div class="max-w-2xl mx-auto">
    <div class="relative">
      <input
        bind:value={searchQuery}
        on:input={debouncedSearch}
        type="text"
        placeholder="Rechercher des exercices..."
        class="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {#if loading}
        <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      {/if}
    </div>
    
    <!-- Error message -->
    {#if error}
      <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-red-600 text-sm">{error}</p>
      </div>
    {/if}
  </div>

  <!-- Results -->
  {#if results.length > 0}
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">
          {results.length} résultat{results.length > 1 ? 's' : ''}
          {#if searchMeta?.pagination?.totalCount}
            sur {searchMeta.pagination.totalCount}
          {/if}
        </h2>
        
        {#if searchMeta?.pagination?.hasMore}
          <button class="text-blue-600 hover:text-blue-800 text-sm">
            Voir plus de résultats
          </button>
        {/if}
      </div>
      
      <div class="grid gap-4">
        {#each results as exercise (exercise.uuid)}
          <div class="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="text-lg font-medium text-gray-900 mb-2">
                  <a href="/exercise/{exercise.uuid}" class="hover:text-blue-600 transition-colors">
                    {exercise.title}
                  </a>
                </h3>
                
                <div class="flex items-center gap-4 text-sm text-gray-600 mb-2">
                  <span class="bg-gray-100 px-2 py-1 rounded">{exercise.chapter}</span>
                  {#if exercise.theme}
                    <span class="text-blue-600">{exercise.theme}</span>
                  {/if}
                  {#if exercise.author}
                    <span class="text-gray-500">par {exercise.author}</span>
                  {/if}
                </div>
              </div>
              
              {#if exercise.difficulty}
                <div class="text-sm text-gray-500 flex items-center">
                  <span>Niveau {exercise.difficulty}/5</span>
                  <!-- Visual difficulty indicator -->
                  <div class="ml-2 flex gap-1">
                    {#each Array(5) as _, i}
                      <div class="w-2 h-2 rounded-full {i < exercise.difficulty ? 'bg-blue-400' : 'bg-gray-200'}"></div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if searchQuery && !loading && !error}
    <div class="text-center py-12">
      <div class="text-gray-400 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17H9m6-8V9a6 6 0 10-12 0v6c0 3.314 2.686 6 6 6h6a6 6 0 000-12z" />
        </svg>
      </div>
      <p class="text-gray-600 text-lg">Aucun exercice trouvé pour "{searchQuery}"</p>
      <p class="text-gray-500 text-sm mt-2">Essayez avec d'autres mots-clés</p>
    </div>
  {:else if !searchQuery}
    <div class="text-center py-12">
      <div class="text-gray-400 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <p class="text-gray-500">Tapez quelques mots pour commencer votre recherche</p>
    </div>
  {/if}
</div>