<script>
  import { onMount } from 'svelte';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '../lib/components/MobileChapterNav.svelte';
  
  // Import des stores
  import { 
    searchQuery, 
    results, 
    loading, 
    error, 
    searchMeta, 
    filters,
    hasActiveFilters,
    hasResults,
    hasSearched,
    searchActions,
    suggestions,
    suggestionActions
  } from '$lib/stores/searchStore.js';
  
  import { useDebounce } from '$lib/hooks/useDebounce.js';
  
  // Variables locales pour l'UI
  let showAdvancedFilters = false;
  let showAuthorSuggestions = false;
  let showModuleSuggestions = false;
  
  // Créer la fonction de recherche débouncée
  const debouncedSearch = useDebounce(searchActions.search, 300);
  
  // États dérivés réactifs utilisant les stores
  $: selectedPath = {
    level: $filters.difficulty,
    module: $filters.module,
    chapter: $filters.chapter,
    subchapter: $filters.subchapter
  };

  onMount(() => {
    // Charger les suggestions au démarrage
    suggestionActions.loadSuggestions();
  });
  
  function handleChapterNavigation(event) {
    const { level, module, chapter, subchapter } = event.detail;
    
    // Utiliser l'action du store au lieu de la logique locale
    searchActions.updateFromNavigation({ level, module, chapter, subchapter });
    searchActions.search();
  }
  
  function selectAuthor(author) {
    searchActions.updateFilter('author', author);
    showAuthorSuggestions = false;
    searchActions.search();
  }
  
  function selectModule(module) {
    searchActions.updateFilter('module', module);
    showModuleSuggestions = false;
    searchActions.search();
  }
  
  function handleModuleInput() {
    showModuleSuggestions = true;
  }
  
  function handleAuthorInput() {
    showAuthorSuggestions = true;
  }
  
  function handleModuleBlur() {
    setTimeout(() => showModuleSuggestions = false, 150);
  }
  
  function handleAuthorBlur() {
    setTimeout(() => showAuthorSuggestions = false, 150);
  }
  
  function handleDifficultyChange() {
    searchActions.search();
  }
</script>

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Section d'en-tête et barre de recherche -->
  <div class="search-container text-center mb-12">
    <h1 class="text-4xl font-bold text-gray-900 mb-2">Recherchez votre exercice</h1>
    <p class="text-gray-600 mb-6">Utilisez la recherche textuelle ou naviguez par chapitres, modules et niveaux.</p>
    <div class="relative">
      <!-- Utilisation du store searchQuery avec binding réactif -->
      <input 
        type="search" 
        bind:value={$searchQuery} 
        on:input={debouncedSearch} 
        placeholder="Ex: intégrale, matrice, probabilité..." 
        class="search-input pr-12" 
      />
      {#if $loading && !$hasResults}
        <div class="search-loading"><div class="search-spinner"></div></div>
      {/if}
    </div>
  </div>

  <!-- Mise en page principale en deux colonnes -->
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
    
    <!-- COLONNE DE GAUCHE : Navigation -->
    <aside class="lg:col-span-1">
      <!-- Version desktop (masquée sur mobile) -->
      <div class="hidden lg:block sticky top-8">
        <ChapterNavigation 
          bind:selectedLevel={$filters.difficulty}
          bind:selectedModule={$filters.module}
          bind:selectedChapter={$filters.chapter}
          bind:selectedSubchapter={$filters.subchapter}
          on:navigate={handleChapterNavigation}
        />
      </div>

      <!-- Version mobile (masquée sur desktop) -->
      <div class="block lg:hidden mb-6">
        <MobileChapterNav 
          bind:selectedLevel={$filters.difficulty}
          bind:selectedModule={$filters.module}
          bind:selectedChapter={$filters.chapter}
          bind:selectedSubchapter={$filters.subchapter}
          on:navigate={handleChapterNavigation}
        />
      </div>
    </aside>

    <!-- COLONNE DE DROITE : Filtres et Résultats -->
    <main class="lg:col-span-3">
      <!-- Section des filtres avancés -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <button on:click={() => showAdvancedFilters = !showAdvancedFilters} class="btn btn-secondary">
            Filtres avancés {showAdvancedFilters ? '▲' : '▼'}
          </button>
          <!-- Utilisation du store hasActiveFilters -->
          {#if $hasActiveFilters}
            <button on:click={searchActions.clearAllFilters} class="btn btn-text text-sm text-blue-600">
              Effacer tout
            </button>
          {/if}
        </div>

        {#if showAdvancedFilters}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
            <!-- Module -->
            <div>
              <label for="module-filter" class="block text-sm font-medium text-gray-700 mb-1">Module</label>
              <input 
                id="module-filter" 
                type="text" 
                bind:value={$filters.module} 
                on:input={handleModuleInput} 
                on:blur={handleModuleBlur} 
                placeholder="Ex: Algèbre..." 
                class="form-input" 
              />
              {#if showModuleSuggestions && $suggestions.modules.length > 0}
                <div class="relative">
                  <div class="absolute w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                    {#each $suggestions.modules.filter(s => s.value.toLowerCase().includes($filters.module.toLowerCase())) as suggestion}
                      <button 
                        on:click={() => selectModule(suggestion.value)} 
                        class="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      >
                        {suggestion.value} ({suggestion.count})
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            
            <!-- Niveau -->
            <div>
              <label for="level-filter" class="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
              <select 
                id="level-filter" 
                bind:value={$filters.difficulty} 
                on:change={handleDifficultyChange} 
                class="form-input"
              >
                <option value="">Tous les niveaux</option>
                {#each $suggestions.levels as level}
                  <option value={level.value}>{level.value} ({level.count})</option>
                {/each}
              </select>
            </div>
            
            <!-- Auteur -->
            <div>
              <label for="author-filter" class="block text-sm font-medium text-gray-700 mb-1">Auteur</label>
              <input 
                id="author-filter" 
                type="text" 
                bind:value={$filters.author} 
                on:input={handleAuthorInput} 
                on:blur={handleAuthorBlur} 
                placeholder="Nom de l'auteur..." 
                class="form-input" 
              />
              {#if showAuthorSuggestions && $suggestions.authors.length > 0}
                <div class="relative">
                  <div class="absolute w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                    {#each $suggestions.authors.filter(s => s.value.toLowerCase().includes($filters.author.toLowerCase())) as suggestion}
                      <button 
                        on:click={() => selectAuthor(suggestion.value)} 
                        class="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      >
                        {suggestion.value} ({suggestion.count})
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Section des résultats -->
      <div>
        {#if $error}
          <div class="search-error">
            <p class="search-error-text">{$error}</p>
          </div>
        {/if}

        {#if $loading && !$hasResults}
          <div class="text-center py-10">
            <p class="text-gray-500">Recherche en cours...</p>
          </div>
        {:else if $hasResults}
          <div class="results-header mb-4">
            <h2 class="results-title">
              {$searchMeta?.pagination?.totalCount || $results.length} 
              résultat{$results.length > 1 ? 's' : ''} 
              trouvé{$results.length > 1 ? 's' : ''}
            </h2>
          </div>
          <div class="results-grid">
            {#each $results as exercise (exercise.uuid)}
              <a href="/exercise/{exercise.uuid}" class="result-card">
                <div class="result-header">
                  <div>
                    <h3 class="result-title">{exercise.title}</h3>
                    <div class="result-metadata">
                      {#if exercise.chapter}
                        <span class="result-badge">📚 {exercise.chapter}</span>
                      {/if}
                      {#if exercise.module}
                        <span class="result-badge">📖 {exercise.module}</span>
                      {/if}
                    </div>
                  </div>
                  {#if exercise.difficulty}
                    <div class="result-difficulty">{exercise.difficulty}</div>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        {:else if $hasSearched}
          <div class="empty-state">
            <h3 class="empty-state-title">Aucun exercice trouvé</h3>
            <p class="empty-state-subtitle">Essayez d'ajuster vos filtres ou vos termes de recherche.</p>
            <button on:click={searchActions.clearAllFilters} class="btn btn-primary mt-4">
              Effacer tous les filtres
            </button>
          </div>
        {:else}
          <div class="empty-state">
            <h3 class="empty-state-title">Prêt à explorer ?</h3>
            <p class="empty-state-subtitle">Tapez quelques mots dans la recherche ou utilisez la navigation à gauche.</p>
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>

<style>
  /* Cette section est intentionnellement vide car tous les styles 
     sont gérés par Tailwind et mutualisés dans app.css */
</style>