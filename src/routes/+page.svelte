<script>
  import { onMount } from 'svelte';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '../lib/components/MobileChapterNav.svelte';
  
  let searchQuery = '';
  let selectedFilters = {
    chapter: '',
    subchapter: '',
    difficulty: '',
    module: '',
    author: ''
  };
  
  let results = [];
  let loading = false;
  let error = null;
  let searchMeta = null;
  let showAdvancedFilters = false;
  
  let authorSuggestions = [];
  let moduleSuggestions = [];
  let levelSuggestions = [];
  let showAuthorSuggestions = false;
  let showModuleSuggestions = false;
  
  $: selectedPath = {
    level: selectedFilters.difficulty,
    module: selectedFilters.module,
    chapter: selectedFilters.chapter,
    subchapter: selectedFilters.subchapter
  };

  async function loadSuggestions() {
    try {
      const [authorsResponse, modulesResponse, levelsResponse] = await Promise.all([
        fetch('/api/chapters?type=suggestions&for=authors&limit=20'),
        fetch('/api/chapters?type=suggestions&for=modules&limit=15'),
        fetch('/api/chapters?type=suggestions&for=levels&limit=10')
      ]);
      
      if (authorsResponse.ok) authorSuggestions = (await authorsResponse.json()).suggestions || [];
      if (modulesResponse.ok) moduleSuggestions = (await modulesResponse.json()).suggestions || [];
      if (levelsResponse.ok) levelSuggestions = (await levelsResponse.json()).suggestions || [];

    } catch (err) {
      console.warn('Failed to load suggestions:', err);
    }
  }
  
  onMount(() => {
    loadSuggestions();
  });
  
  async function search() {
    if (!searchQuery.trim() && !selectedFilters.chapter && !selectedFilters.difficulty && !selectedFilters.module && !selectedFilters.author) {
      results = [];
      searchMeta = null;
      error = null;
      return;
    }
    
    loading = true;
    error = null;
    
    try {
      const searchParams = new URLSearchParams();
      if (searchQuery.trim()) searchParams.set('q', searchQuery);
      if (selectedFilters.subchapter) {
        searchParams.set('subchapter', selectedFilters.subchapter);
        searchParams.set('chapter', selectedFilters.chapter);
      } else if (selectedFilters.chapter) {
        searchParams.set('chapter', selectedFilters.chapter);
      }
      if (selectedFilters.difficulty) searchParams.set('difficulty', selectedFilters.difficulty);
      if (selectedFilters.module) searchParams.set('module', selectedFilters.module);
      if (selectedFilters.author) searchParams.set('author', selectedFilters.author);
      searchParams.set('limit', '100');
      
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        results = data.results || [];
        searchMeta = data.meta || null;
      } else {
        const errorData = await response.json().catch(() => ({}));
        error = errorData.message || 'Erreur de recherche';
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
  
  function handleChapterNavigation(event) {
    const { level, module, chapter, subchapter } = event.detail;
    selectedFilters.difficulty = level || '';
    selectedFilters.module = module || '';
    selectedFilters.chapter = chapter || '';
    selectedFilters.subchapter = subchapter || '';
    selectedFilters = { ...selectedFilters };
    search();
  }
  
  let searchTimeout;
  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(search, 300);
  }
  
  function clearAllFilters() {
    searchQuery = '';
    selectedFilters = { chapter: '', subchapter: '', difficulty: '', module: '', author: '' };
    results = [];
    searchMeta = null;
    error = null;
  }
  
  function selectAuthor(author) {
    selectedFilters.author = author;
    showAuthorSuggestions = false;
    search();
  }
  
  function selectModule(module) {
    selectedFilters.module = module;
    showModuleSuggestions = false;
    search();
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
      <input type="search" bind:value={searchQuery} on:input={debouncedSearch} placeholder="Ex: intégrale, matrice, probabilité..." class="search-input pr-12" />
      {#if loading && !results.length}
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
    bind:selectedLevel={selectedFilters.difficulty}
    bind:selectedModule={selectedFilters.module}
    bind:selectedChapter={selectedFilters.chapter}
    bind:selectedSubchapter={selectedFilters.subchapter}
    on:navigate={handleChapterNavigation}
  />
</div>

<!-- Version mobile (masquée sur desktop) -->
<div class="block lg:hidden mb-6">
  <MobileChapterNav 
    bind:selectedLevel={selectedFilters.difficulty}
    bind:selectedModule={selectedFilters.module}
    bind:selectedChapter={selectedFilters.chapter}
    bind:selectedSubchapter={selectedFilters.subchapter}
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
          {#if searchQuery || selectedFilters.chapter || selectedFilters.difficulty || selectedFilters.module || selectedFilters.author}
            <button on:click={clearAllFilters} class="btn btn-text text-sm text-blue-600">Effacer tout</button>
          {/if}
        </div>

        {#if showAdvancedFilters}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
            <div>
              <label for="module-filter" class="block text-sm font-medium text-gray-700 mb-1">Module</label>
              <input id="module-filter" type="text" bind:value={selectedFilters.module} on:input={() => showModuleSuggestions = true} on:blur={() => setTimeout(() => showModuleSuggestions = false, 150)} placeholder="Ex: Algèbre..." class="form-input" />
              {#if showModuleSuggestions && moduleSuggestions.length > 0}
                <div class="relative">
                  <div class="absolute w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                    {#each moduleSuggestions.filter(s => s.value.toLowerCase().includes(selectedFilters.module.toLowerCase())) as suggestion}
                      <button on:click={() => selectModule(suggestion.value)} class="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100">{suggestion.value} ({suggestion.count})</button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            <div>
              <label for="level-filter" class="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
              <select id="level-filter" bind:value={selectedFilters.difficulty} on:change={search} class="form-input">
                  <option value="">Tous les niveaux</option>
                  {#each levelSuggestions as level}
                    <option value={level.value}>{level.value} ({level.count})</option>
                  {/each}
              </select>
            </div>
            <div>
              <label for="author-filter" class="block text-sm font-medium text-gray-700 mb-1">Auteur</label>
              <input id="author-filter" type="text" bind:value={selectedFilters.author} on:input={() => showAuthorSuggestions = true} on:blur={() => setTimeout(() => showAuthorSuggestions = false, 150)} placeholder="Nom de l'auteur..." class="form-input" />
               {#if showAuthorSuggestions && authorSuggestions.length > 0}
                <div class="relative">
                  <div class="absolute w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                    {#each authorSuggestions.filter(s => s.value.toLowerCase().includes(selectedFilters.author.toLowerCase())) as suggestion}
                      <button on:click={() => selectAuthor(suggestion.value)} class="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100">{suggestion.value} ({suggestion.count})</button>
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
        {#if error}
          <div class="search-error"><p class="search-error-text">{error}</p></div>
        {/if}

        {#if loading && !results.length}
          <div class="text-center py-10"><p class="text-gray-500">Recherche en cours...</p></div>
        {:else if results.length > 0}
          <div class="results-header mb-4">
            <h2 class="results-title">{searchMeta?.pagination?.totalCount || results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}</h2>
          </div>
          <div class="results-grid">
            {#each results as exercise (exercise.uuid)}
              <a href="/exercise/{exercise.uuid}" class="result-card">
                <div class="result-header">
                  <div>
                    <h3 class="result-title">{exercise.title}</h3>
                    <div class="result-metadata">
                      {#if exercise.chapter}<span class="result-badge">📚 {exercise.chapter}</span>{/if}
                      {#if exercise.module}<span class="result-badge">📖 {exercise.module}</span>{/if}
                    </div>
                  </div>
                  {#if exercise.difficulty}<div class="result-difficulty">{exercise.difficulty}</div>{/if}
                </div>
              </a>
            {/each}
          </div>
        {:else if !loading && (searchQuery || selectedFilters.module || selectedFilters.difficulty || selectedFilters.author || selectedFilters.chapter)}
          <div class="empty-state">
            <h3 class="empty-state-title">Aucun exercice trouvé</h3>
            <p class="empty-state-subtitle">Essayez d'ajuster vos filtres ou vos termes de recherche.</p>
            <button on:click={clearAllFilters} class="btn btn-primary mt-4">Effacer tous les filtres</button>
          </div>
        {:else if !loading}
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