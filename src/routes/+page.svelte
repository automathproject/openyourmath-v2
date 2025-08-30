<!-- src/routes/+page.svelte - Version améliorée -->
<script>
  import { onMount } from 'svelte';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '$lib/components/MobileChapterNav.svelte';
  
  let searchQuery = '';
  let selectedFilters = {
    chapter: '',
    subchapter: '',
    difficulty: null,
    author: ''
  };
  
  let results = [];
  let loading = false;
  let error = null;
  let searchMeta = null;
  let showAdvancedFilters = false;
  let viewMode = 'both'; // 'search', 'browse', 'both'
  
  // Suggestions pour l'autocomplétion
  let authorSuggestions = [];
  let showAuthorSuggestions = false;
  
  async function loadSuggestions() {
    try {
      const response = await fetch('/api/chapters?type=suggestions&for=authors&limit=20');
      if (response.ok) {
        const data = await response.json();
        authorSuggestions = data.suggestions || [];
      }
    } catch (err) {
      console.warn('Failed to load suggestions:', err);
    }
  }
  
  onMount(() => {
    loadSuggestions();
  });
  
  async function search() {
    console.log('🔍 Search triggered with filters:', selectedFilters);
    
    if (!searchQuery.trim() && !selectedFilters.chapter && !selectedFilters.difficulty && !selectedFilters.author) {
      results = [];
      searchMeta = null;
      error = null;
      return;
    }
    
    loading = true;
    error = null;
    
    try {
      // Construire l'URL de recherche
      const searchParams = new URLSearchParams();
      
      if (searchQuery.trim()) {
        searchParams.set('q', searchQuery);
      }
      
      // Si on a un sous-chapitre, on ne filtre QUE sur le sous-chapitre
      // Sinon on filtre sur le chapitre principal
      if (selectedFilters.subchapter) {
        searchParams.set('subchapter', selectedFilters.subchapter);
        // On garde aussi le chapitre pour l'affichage contextuel
        searchParams.set('chapter', selectedFilters.chapter);
      } else if (selectedFilters.chapter) {
        searchParams.set('chapter', selectedFilters.chapter);
      }
      
      if (selectedFilters.difficulty !== null) {
        searchParams.set('difficulty', selectedFilters.difficulty.toString());
      }
      
      if (selectedFilters.author) {
        searchParams.set('author', selectedFilters.author);
      }
      
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
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
  
  // Gestion de la navigation par chapitres
  function handleChapterNavigation(event) {
    const { chapter, subchapter } = event.detail;
    
    console.log('Navigation event:', { chapter, subchapter });
    
    selectedFilters.chapter = chapter || '';
    selectedFilters.subchapter = subchapter || '';
    
    // Forcer la réactivité en créant un nouvel objet
    selectedFilters = { ...selectedFilters };
    
    console.log('Updated filters:', selectedFilters);
    
    // FORCER le déclenchement de la recherche
    console.log('Triggering search after navigation...');
    search();
    
    // Passer en mode navigation si pas de recherche textuelle
    if (!searchQuery.trim() && chapter) {
      viewMode = 'browse';
    } else if (searchQuery.trim()) {
      viewMode = 'search';
    } else {
      viewMode = 'both';
    }
  }
  
  // Debounce pour la recherche textuelle
  let searchTimeout;
  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(search, 300);
  }
  
  // Gestion des filtres de difficulté
  function toggleDifficulty(level) {
    selectedFilters.difficulty = selectedFilters.difficulty === level ? null : level;
    search();
  }
  
  function clearAllFilters() {
    searchQuery = '';
    selectedFilters = {
      chapter: '',
      subchapter: '',
      difficulty: null,
      author: ''
    };
    results = [];
    searchMeta = null;
    error = null;
    viewMode = 'both';
    
    // Forcer la réactivité pour synchroniser avec les composants de navigation
    selectedFilters = { ...selectedFilters };
  }
  
  // Gestion de l'autocomplétion des auteurs
  function handleAuthorInput() {
    showAuthorSuggestions = selectedFilters.author.length > 0;
  }
  
  function selectAuthor(author) {
    selectedFilters.author = author;
    showAuthorSuggestions = false;
    search();
  }
</script>

<svelte:head>
  <title>OpenYourMath - Recherche d'exercices</title>
</svelte:head>

<div class="search-page">
  <!-- Hero section -->
  <div class="search-hero">
    <h1 class="search-hero-title">
      Recherchez parmi des milliers d'exercices de mathématiques
    </h1>
    <p class="search-hero-subtitle">
      Utilisez la recherche textuelle ou naviguez par chapitres
    </p>
  </div>

  <!-- Interface principale -->
  <div class="search-layout">
    <!-- Navigation mobile (visible uniquement sur mobile) -->
    <div class="mobile-nav-container">
      <MobileChapterNav 
        on:navigate={handleChapterNavigation}
        bind:selectedChapter={selectedFilters.chapter}
        bind:selectedSubchapter={selectedFilters.subchapter}
      />
    </div>
    
    <!-- Sidebar de navigation (desktop uniquement) -->
    <aside class="search-sidebar">
      <ChapterNavigation 
        on:navigate={handleChapterNavigation}
        selectedChapter={selectedFilters.chapter}
        selectedSubchapter={selectedFilters.subchapter}
      />
    </aside>
    
    <!-- Contenu principal -->
    <main class="search-main">
      <!-- Barre de recherche et filtres -->
      <div class="search-controls">
        <!-- Recherche textuelle -->
        <div class="search-input-container">
          <div class="search-input-wrapper">
            <input
              bind:value={searchQuery}
              on:input={debouncedSearch}
              type="text"
              placeholder="Rechercher des exercices..."
              class="search-input"
            />
            {#if loading}
              <div class="search-loading-indicator">
                <div class="search-spinner"></div>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- Toggle filtres avancés -->
        <button 
          on:click={() => showAdvancedFilters = !showAdvancedFilters}
          class="filters-toggle"
          class:filters-toggle--active={showAdvancedFilters}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
          Filtres
        </button>
        
        <!-- Clear filters -->
        {#if searchQuery || selectedFilters.chapter || selectedFilters.difficulty !== null || selectedFilters.author}
          <button on:click={clearAllFilters} class="clear-filters-btn">
            Effacer tout
          </button>
        {/if}
      </div>
      
      <!-- Filtres avancés -->
      {#if showAdvancedFilters}
        <div class="advanced-filters">
          <!-- Filtres de difficulté -->
          <div class="filter-group">
            <label class="filter-label">Difficulté</label>
            <div class="difficulty-filters">
              {#each Array(5) as _, i}
                <button
                  class="difficulty-filter"
                  class:difficulty-filter--active={selectedFilters.difficulty === i + 1}
                  on:click={() => toggleDifficulty(i + 1)}
                >
                  {i + 1}
                </button>
              {/each}
            </div>
          </div>
          
          <!-- Filtre par auteur avec autocomplétion -->
          <div class="filter-group">
            <label class="filter-label">Auteur</label>
            <div class="author-filter-container">
              <input
                bind:value={selectedFilters.author}
                on:input={handleAuthorInput}
                on:focus={() => showAuthorSuggestions = selectedFilters.author.length > 0}
                placeholder="Nom de l'auteur..."
                class="author-filter-input"
              />
              
              {#if showAuthorSuggestions && authorSuggestions.length > 0}
                <div class="author-suggestions">
                  {#each authorSuggestions.filter(s => s.value.toLowerCase().includes(selectedFilters.author.toLowerCase())) as suggestion}
                    <button
                      class="author-suggestion"
                      on:click={() => selectAuthor(suggestion.value)}
                    >
                      {suggestion.value} <span class="author-suggestion-count">({suggestion.count})</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Filtres actifs -->
      {#if selectedFilters.chapter || selectedFilters.difficulty !== null || selectedFilters.author}
        <div class="active-filters">
          <span class="active-filters-label">Filtres actifs :</span>
          
                    {#if selectedFilters.chapter}
            <span class="active-filter-tag">
              📚 {selectedFilters.chapter}
              {#if selectedFilters.subchapter}
                › {selectedFilters.subchapter}
              {/if}
              <button on:click={() => {selectedFilters.chapter = ''; selectedFilters.subchapter = ''; search()}}>×</button>
            </span>
          {/if}
          
          {#if selectedFilters.difficulty !== null}
            <span class="active-filter-tag">
              🎯 Niveau {selectedFilters.difficulty}
              <button on:click={() => {selectedFilters.difficulty = null; search()}}>×</button>
            </span>
          {/if}
          
          {#if selectedFilters.author}
            <span class="active-filter-tag">
              👤 {selectedFilters.author}
              <button on:click={() => {selectedFilters.author = ''; search()}}>×</button>
            </span>
          {/if}
        </div>
      {/if}
      
      <!-- Messages d'erreur -->
      {#if error}
        <div class="search-error">
          <p class="search-error-text">{error}</p>
        </div>
      {/if}
      
      <!-- Résultats -->
      {#if results.length > 0}
        <div class="search-results">
          <!-- En-tête des résultats -->
          <div class="results-header">
            <h2 class="results-title">
              {results.length} résultat{results.length > 1 ? 's' : ''}
              {#if searchMeta?.pagination?.totalCount && searchMeta.pagination.totalCount !== results.length}
                sur {searchMeta.pagination.totalCount}
              {/if}
            </h2>
            
            <div class="results-meta">
              {#if viewMode === 'browse' && selectedFilters.chapter}
                <span class="results-context">dans "{selectedFilters.chapter}"</span>
              {:else if searchQuery}
                <span class="results-context">pour "{searchQuery}"</span>
              {/if}
              
              {#if searchMeta?.pagination?.hasMore}
                <button class="load-more-btn">
                  Voir plus de résultats
                </button>
              {/if}
            </div>
          </div>
          
          <!-- Grille de résultats -->
          <div class="results-grid">
            {#each results as exercise (exercise.uuid)}
              <article class="result-card">
                <div class="result-header">
                  <div class="result-content">
                    <h3 class="result-title">
                      <a href="/exercise/{exercise.uuid}">
                        {exercise.title}
                      </a>
                    </h3>
                    
                    <div class="result-metadata">
                      <span class="result-badge result-badge--chapter">
                        {exercise.chapter}
                      </span>
                      
                      {#if exercise.theme && exercise.theme !== exercise.chapter}
                        <span class="result-badge result-badge--theme">
                          {exercise.theme}
                        </span>
                      {/if}
                      
                      {#if exercise.author}
                        <span class="result-author">
                          par {exercise.author}
                        </span>
                      {/if}
                    </div>
                  </div>
                  
                  {#if exercise.difficulty}
                    <div class="result-difficulty">
                      <span class="result-difficulty-label">
                        Niveau {exercise.difficulty}/5
                      </span>
                      <div class="result-difficulty-visual">
                        {#each Array(5) as _, i}
                          <div 
                            class="result-difficulty-dot" 
                            class:result-difficulty-dot--active={i < exercise.difficulty}
                          ></div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
                
                <!-- Actions rapides -->
                <div class="result-actions">
                  <a 
                    href="/exercise/{exercise.uuid}" 
                    class="result-action result-action--primary"
                  >
                    Voir l'exercice
                  </a>
                  
                  <button class="result-action result-action--secondary">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </article>
            {/each}
          </div>
        </div>
        
      {:else if searchQuery || selectedFilters.chapter || selectedFilters.difficulty !== null || selectedFilters.author}
        <!-- État vide avec filtres/recherche -->
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17H9m6-8V9a6 6 0 10-12 0v6c0 3.314 2.686 6h6a6 6 0 000-12z" />
            </svg>
          </div>
          <h3 class="empty-state-title">Aucun exercice trouvé</h3>
          <p class="empty-state-description">
            {#if searchQuery}
              Aucun exercice ne correspond à votre recherche "{searchQuery}"
            {:else}
              Aucun exercice ne correspond aux filtres sélectionnés
            {/if}
          </p>
          <div class="empty-state-actions">
            <button on:click={clearAllFilters} class="empty-state-action">
              Effacer tous les filtres
            </button>
          </div>
        </div>
        
      {:else}
        <!-- État initial -->
        <div class="welcome-state">
          <div class="welcome-state-icon">
            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 class="welcome-state-title">Prêt à explorer ?</h3>
          <p class="welcome-state-description">
            Tapez quelques mots dans la recherche ou naviguez par chapitres dans la sidebar
          </p>
          <div class="welcome-state-examples">
            <p class="welcome-examples-title">Exemples de recherche :</p>
            <div class="welcome-examples-list">
              <button 
                on:click={() => {searchQuery = 'dérivée'; search();}}
                class="welcome-example-btn"
              >
                dérivée
              </button>
              <button 
                on:click={() => {searchQuery = 'intégrale'; search();}}
                class="welcome-example-btn"
              >
                intégrale
              </button>
              <button 
                on:click={() => {searchQuery = 'limite'; search();}}
                class="welcome-example-btn"
              >
                limite
              </button>
            </div>
          </div>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .search-page {
    @apply space-y-8;
  }
  
  .search-hero {
    @apply text-center py-12;
  }
  
  .search-hero-title {
    @apply text-4xl font-bold text-gray-900 mb-4;
  }
  
  .search-hero-subtitle {
    @apply text-lg text-gray-600 max-w-2xl mx-auto;
  }
  
  .search-layout {
    @apply grid grid-cols-1 lg:grid-cols-4 gap-8;
  }
  
  .mobile-nav-container {
    @apply lg:hidden mb-6;
  }
  
  .search-sidebar {
    @apply hidden lg:block lg:col-span-1;
  }
  
  .search-main {
    @apply lg:col-span-3 space-y-6;
  }
  
  .search-controls {
    @apply flex flex-col sm:flex-row gap-4;
  }
  
  .search-input-container {
    @apply flex-1;
  }
  
  .search-input-wrapper {
    @apply relative;
  }
  
  .search-input {
    @apply w-full px-4 py-3 pr-12 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  }
  
  .search-loading-indicator {
    @apply absolute right-3 top-1/2 transform -translate-y-1/2;
  }
  
  .search-spinner {
    @apply w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin;
  }
  
  .filters-toggle {
    @apply px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors;
  }
  
  .filters-toggle--active {
    @apply bg-blue-50 border-blue-300 text-blue-700;
  }
  
  .clear-filters-btn {
    @apply px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors;
  }
  
  .advanced-filters {
    @apply p-6 bg-gray-50 rounded-lg border border-gray-200 space-y-4;
  }
  
  .filter-group {
    @apply space-y-2;
  }
  
  .filter-label {
    @apply block text-sm font-medium text-gray-700;
  }
  
  .difficulty-filters {
    @apply flex gap-2;
  }
  
  .difficulty-filter {
    @apply w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center justify-center font-medium transition-colors;
  }
  
  .difficulty-filter--active {
    @apply bg-blue-500 text-white border-blue-500;
  }
  
  .author-filter-container {
    @apply relative;
  }
  
  .author-filter-input {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  }
  
  .author-suggestions {
    @apply absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10;
  }
  
  .author-suggestion {
    @apply w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between;
  }
  
  .author-suggestion-count {
    @apply text-sm text-gray-500;
  }
  
  .active-filters {
    @apply flex flex-wrap items-center gap-2;
  }
  
  .active-filters-label {
    @apply text-sm font-medium text-gray-700;
  }
  
  .active-filter-tag {
    @apply inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm;
  }
  
  .active-filter-tag button {
    @apply ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center text-xs;
  }
  
  .subchapter-separator {
    @apply mx-1 text-blue-600;
  }
  
  .subchapter-name {
    @apply font-semibold;
  }
  
  .search-error {
    @apply p-4 bg-red-50 border border-red-200 rounded-lg;
  }
  
  .search-error-text {
    @apply text-red-700;
  }
  
  .search-results {
    @apply space-y-6;
  }
  
  .results-header {
    @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4;
  }
  
  .results-title {
    @apply text-xl font-semibold text-gray-900;
  }
  
  .results-meta {
    @apply flex items-center gap-4 text-sm text-gray-600;
  }
  
  .results-context {
    @apply italic;
  }
  
  .load-more-btn {
    @apply text-blue-600 hover:text-blue-800 font-medium;
  }
  
  .results-grid {
    @apply grid gap-4;
  }
  
  .result-card {
    @apply bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow;
  }
  
  .result-header {
    @apply flex items-start justify-between mb-4;
  }
  
  .result-content {
    @apply flex-1;
  }
  
  .result-title a {
    @apply text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors;
  }
  
  .result-metadata {
    @apply flex flex-wrap items-center gap-2 mt-2;
  }
  
  .result-badge {
    @apply px-2 py-1 rounded text-sm font-medium;
  }
  
  .result-badge--chapter {
    @apply bg-blue-100 text-blue-800;
  }
  
  .result-badge--theme {
    @apply bg-green-100 text-green-800;
  }
  
  .result-author {
    @apply text-sm text-gray-600;
  }
  
  .result-difficulty {
    @apply flex flex-col items-end gap-1;
  }
  
  .result-difficulty-label {
    @apply text-sm text-gray-600;
  }
  
  .result-difficulty-visual {
    @apply flex gap-1;
  }
  
  .result-difficulty-dot {
    @apply w-3 h-3 rounded-full bg-gray-200;
  }
  
  .result-difficulty-dot--active {
    @apply bg-orange-400;
  }
  
  .result-actions {
    @apply flex items-center gap-2 pt-4 border-t border-gray-100;
  }
  
  .result-action {
    @apply px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2;
  }
  
  .result-action--primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }
  
  .result-action--secondary {
    @apply bg-gray-100 text-gray-700 hover:bg-gray-200;
  }
  
  .empty-state, .welcome-state {
    @apply text-center py-16 space-y-4;
  }
  
  .empty-state-icon, .welcome-state-icon {
    @apply text-gray-400;
  }
  
  .empty-state-title, .welcome-state-title {
    @apply text-xl font-semibold text-gray-900;
  }
  
  .empty-state-description, .welcome-state-description {
    @apply text-gray-600 max-w-md mx-auto;
  }
  
  .empty-state-actions {
    @apply pt-4;
  }
  
  .empty-state-action {
    @apply px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  }
  
  .welcome-state-examples {
    @apply pt-6;
  }
  
  .welcome-examples-title {
    @apply text-sm text-gray-500 mb-3;
  }
  
  .welcome-examples-list {
    @apply flex flex-wrap justify-center gap-2;
  }
  
  .welcome-example-btn {
    @apply px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors;
  }
  
  /* Responsive */
  @media (max-width: 1024px) {
    .search-layout {
      @apply grid-cols-1;
    }
    
    .search-sidebar {
      @apply order-2;
    }
    
    .search-main {
      @apply order-1;
    }
  }
</style>