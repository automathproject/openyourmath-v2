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
  <div class="search-container">
    <div class="relative">
      <input
        bind:value={searchQuery}
        on:input={debouncedSearch}
        type="text"
        placeholder="Rechercher des exercices..."
        class="search-input"
      />
      {#if loading}
        <div class="search-loading">
          <div class="search-spinner"></div>
        </div>
      {/if}
    </div>
    
    <!-- Error message -->
    {#if error}
      <div class="search-error">
        <p class="search-error-text">{error}</p>
      </div>
    {/if}
  </div>

  <!-- Results -->
  {#if results.length > 0}
    <div class="space-y-4">
      <div class="results-header">
        <h2 class="results-title">
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
      
      <div class="results-grid">
        {#each results as exercise (exercise.uuid)}
          <div class="result-card">
            <div class="result-header">
              <div class="flex-1">
                <h3 class="result-title">
                  <a href="/exercise/{exercise.uuid}">
                    {exercise.title}
                  </a>
                </h3>
                
                <div class="result-metadata">
                  <span class="result-badge">{exercise.chapter}</span>
                  {#if exercise.theme}
                    <span class="text-blue-600">{exercise.theme}</span>
                  {/if}
                  {#if exercise.author}
                    <span class="text-gray-500">par {exercise.author}</span>
                  {/if}
                </div>
              </div>
              
              {#if exercise.difficulty}
                <div class="result-difficulty">
                  <span>Niveau {exercise.difficulty}/5</span>
                  <!-- Visual difficulty indicator -->
                  <div class="result-difficulty-dots">
                    {#each Array(5) as _, i}
                      <div class="result-difficulty-dot {i < exercise.difficulty ? 'result-difficulty-dot--active' : 'result-difficulty-dot--inactive'}"></div>
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
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17H9m6-8V9a6 6 0 10-12 0v6c0 3.314 2.686 6 6h6a6 6 0 000-12z" />
        </svg>
      </div>
      <p class="empty-state-title">Aucun exercice trouvé pour "{searchQuery}"</p>
      <p class="empty-state-subtitle">Essayez avec d'autres mots-clés</p>
    </div>
  {:else if !searchQuery}
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <p class="empty-state-title">Tapez quelques mots pour commencer votre recherche</p>
    </div>
  {/if}
</div>