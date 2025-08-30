<!-- src/routes/browse/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  let chapterStructure = [];
  let selectedChapter = null;
  let selectedSubchapter = null;
  let exercises = [];
  let loading = true;
  let exercisesLoading = false;
  let error = null;
  let sortBy = 'title'; // 'title', 'difficulty', 'date'
  let sortOrder = 'asc';
  
  // Stats pour le chapitre sélectionné
  let chapterStats = {
    total: 0,
    byDifficulty: {},
    authors: []
  };
  
  onMount(async () => {
    await loadChapterStructure();
    
    // Récupérer les paramètres URL pour la navigation directe
    const urlParams = $page.url.searchParams;
    const chapter = urlParams.get('chapter');
    const subchapter = urlParams.get('subchapter');
    
    if (chapter) {
      selectChapter(chapter, subchapter);
    }
  });
  
  async function loadChapterStructure() {
    try {
      const response = await fetch('/api/chapters?type=structure');
      if (response.ok) {
        const data = await response.json();
        chapterStructure = data.structure || [];
      } else {
        error = 'Impossible de charger les chapitres';
      }
    } catch (err) {
      error = 'Erreur de connexion';
      console.error('Failed to load chapters:', err);
    } finally {
      loading = false;
    }
  }
  
  async function selectChapter(chapterName, subchapterName = null) {
    selectedChapter = chapterName;
    selectedSubchapter = subchapterName;
    exercisesLoading = true;
    
    // Mettre à jour l'URL
    const params = new URLSearchParams();
    params.set('chapter', chapterName);
    if (subchapterName) {
      params.set('subchapter', subchapterName);
    }
    goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
    
    try {
      // Construire les paramètres de recherche
      const searchParams = new URLSearchParams();
      searchParams.set('chapter', chapterName);
      if (subchapterName) {
        searchParams.set('subchapter', subchapterName);
      }
      searchParams.set('limit', '50'); // Plus de résultats pour la navigation
      
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        exercises = data.results || [];
        
        // Calculer les stats
        calculateChapterStats(exercises);
        
        // Appliquer le tri
        sortExercises();
      } else {
        exercises = [];
        chapterStats = { total: 0, byDifficulty: {}, authors: [] };
      }
    } catch (err) {
      console.error('Failed to load exercises:', err);
      exercises = [];
    } finally {
      exercisesLoading = false;
    }
  }
  
  function calculateChapterStats(exerciseList) {
    chapterStats = {
      total: exerciseList.length,
      byDifficulty: {},
      authors: []
    };
    
    // Grouper par difficulté
    exerciseList.forEach(ex => {
      if (ex.difficulty) {
        chapterStats.byDifficulty[ex.difficulty] = (chapterStats.byDifficulty[ex.difficulty] || 0) + 1;
      }
    });
    
    // Compter les auteurs uniques
    const authorCounts = {};
    exerciseList.forEach(ex => {
      if (ex.author) {
        authorCounts[ex.author] = (authorCounts[ex.author] || 0) + 1;
      }
    });
    
    chapterStats.authors = Object.entries(authorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 auteurs
  }
  
  function changeSorting(newSortBy) {
    if (sortBy === newSortBy) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = newSortBy;
      sortOrder = 'asc';
    }
    sortExercises();
  }
  
  function sortExercises() {
    exercises.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'difficulty':
          comparison = (a.difficulty || 0) - (b.difficulty || 0);
          break;
        case 'date':
          comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
          break;
        case 'author':
          comparison = (a.author || '').localeCompare(b.author || '');
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    exercises = exercises; // Réactiver la réactivité
  }
  
  function clearSelection() {
    selectedChapter = null;
    selectedSubchapter = null;
    exercises = [];
    chapterStats = { total: 0, byDifficulty: {}, authors: [] };
    goto('/browse', { replaceState: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>
    {selectedChapter ? `${selectedChapter} - ` : ''}Parcourir les exercices - OpenYourMath
  </title>
</svelte:head>

<div class="browse-page">
  <!-- En-tête -->
  <div class="browse-header">
    <div class="browse-title-section">
      <h1 class="browse-title">Parcourir les exercices</h1>
      <p class="browse-subtitle">Explorez les exercices organisés par chapitres et sous-chapitres</p>
    </div>
    
    {#if selectedChapter}
      <button on:click={clearSelection} class="browse-clear-btn">
        ← Retour à la liste des chapitres
      </button>
    {/if}
  </div>
  
  <div class="browse-layout">
    <!-- Sidebar : Structure des chapitres -->
    <aside class="browse-sidebar">
      <div class="chapter-tree-container">
        <h2 class="chapter-tree-title">Chapitres</h2>
        
        {#if loading}
          <div class="chapter-loading">
            <div class="loading-spinner"></div>
            <p>Chargement...</p>
          </div>
        {:else if error}
          <div class="chapter-error">
            <p>{error}</p>
            <button on:click={loadChapterStructure}>Réessayer</button>
          </div>
        {:else}
          <div class="chapter-tree">
            {#each chapterStructure as chapter}
              <div class="chapter-group">
                <!-- Titre du chapitre -->
                <button
                  class="chapter-button"
                  class:chapter-button--selected={selectedChapter === chapter.name && !selectedSubchapter}
                  on:click={() => selectChapter(chapter.name)}
                >
                  <div class="chapter-info">
                    <span class="chapter-name">{chapter.name}</span>
                    <span class="chapter-count">({chapter.exerciseCount})</span>
                  </div>
                  
                  {#if chapter.subchapters && chapter.subchapters.length > 0}
                    <svg 
                      class="chapter-arrow"
                      class:chapter-arrow--expanded={selectedChapter === chapter.name}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  {/if}
                </button>
                
                <!-- Sous-chapitres -->
                {#if chapter.subchapters && selectedChapter === chapter.name}
                  <div class="subchapter-list">
                    {#each chapter.subchapters as subchapter}
                      <button
                        class="subchapter-button"
                        class:subchapter-button--selected={selectedSubchapter === subchapter.name}
                        on:click={() => selectChapter(chapter.name, subchapter.name)}
                      >
                        <span class="subchapter-name">{subchapter.name}</span>
                        <span class="subchapter-count">({subchapter.exerciseCount})</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </aside>
    
    <!-- Contenu principal -->
    <main class="browse-main">
      {#if !selectedChapter}
        <!-- Vue d'ensemble des chapitres -->
        <div class="chapters-overview">
          <h2 class="overview-title">Vue d'ensemble des chapitres</h2>
          
          <div class="chapters-grid">
            {#each chapterStructure as chapter}
              <div class="chapter-card">
                <div class="chapter-card-header">
                  <h3 class="chapter-card-title">{chapter.name}</h3>
                  <span class="chapter-card-count">{chapter.exerciseCount} exercices</span>
                </div>
                
                {#if chapter.subchapters && chapter.subchapters.length > 0}
                  <div class="chapter-card-content">
                    <p class="chapter-card-subcount">
                      {chapter.subchapters.length} sous-chapitre{chapter.subchapters.length > 1 ? 's' : ''}
                    </p>
                    <div class="chapter-card-sublist">
                      {#each chapter.subchapters.slice(0, 3) as sub}
                        <span class="chapter-card-sub">{sub.name}</span>
                      {/each}
                      {#if chapter.subchapters.length > 3}
                        <span class="chapter-card-more">+{chapter.subchapters.length - 3} autres</span>
                      {/if}
                    </div>
                  </div>
                {/if}
                
                <div class="chapter-card-actions">
                  <button 
                    on:click={() => selectChapter(chapter.name)}
                    class="chapter-card-btn"
                  >
                    Explorer
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
        
      {:else}
        <!-- Vue détaillée d'un chapitre -->
        <div class="chapter-detail">
          <!-- En-tête du chapitre -->
          <div class="chapter-detail-header">
            <div class="chapter-detail-title-section">
              <h2 class="chapter-detail-title">
                {selectedChapter}
                {#if selectedSubchapter}
                  <span class="chapter-detail-separator">›</span>
                  <span class="chapter-detail-subtitle">{selectedSubchapter}</span>
                {/if}
              </h2>
            </div>
            
            <!-- Stats du chapitre -->
            <div class="chapter-stats">
              <div class="stat-item">
                <span class="stat-value">{chapterStats.total}</span>
                <span class="stat-label">exercices</span>
              </div>
              
              {#if Object.keys(chapterStats.byDifficulty).length > 0}
                <div class="stat-item stat-item--difficulty">
                  <span class="stat-label">Niveaux :</span>
                  <div class="difficulty-distribution">
                    {#each Object.entries(chapterStats.byDifficulty) as [level, count]}
                      <span class="difficulty-item">
                        {level}: {count}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
              
              {#if chapterStats.authors.length > 0}
                <div class="stat-item">
                  <span class="stat-label">Auteurs principaux :</span>
                  <div class="authors-list">
                    {#each chapterStats.authors.slice(0, 3) as author}
                      <span class="author-item">{author.name} ({author.count})</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
          
          <!-- Contrôles de tri -->
          <div class="exercises-controls">
            <div class="sort-controls">
              <span class="sort-label">Trier par :</span>
              <div class="sort-buttons">
                <button
                  class="sort-btn"
                  class:sort-btn--active={sortBy === 'title'}
                  on:click={() => changeSorting('title')}
                >
                  Titre
                  {#if sortBy === 'title'}
                    <span class="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </button>
                
                <button
                  class="sort-btn"
                  class:sort-btn--active={sortBy === 'difficulty'}
                  on:click={() => changeSorting('difficulty')}
                >
                  Difficulté
                  {#if sortBy === 'difficulty'}
                    <span class="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </button>
                
                <button
                  class="sort-btn"
                  class:sort-btn--active={sortBy === 'author'}
                  on:click={() => changeSorting('author')}
                >
                  Auteur
                  {#if sortBy === 'author'}
                    <span class="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </button>
              </div>
            </div>
            
            <div class="view-controls">
              <span class="exercises-count">{exercises.length} exercice{exercises.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          
          <!-- Liste des exercices -->
          {#if exercisesLoading}
            <div class="exercises-loading">
              <div class="loading-spinner"></div>
              <p>Chargement des exercices...</p>
            </div>
          {:else if exercises.length === 0}
            <div class="exercises-empty">
              <div class="empty-icon">📚</div>
              <h3 class="empty-title">Aucun exercice trouvé</h3>
              <p class="empty-description">
                Ce chapitre ne contient pas encore d'exercices.
              </p>
            </div>
          {:else}
            <div class="exercises-list">
              {#each exercises as exercise (exercise.uuid)}
                <article class="exercise-card">
                  <div class="exercise-card-header">
                    <div class="exercise-card-content">
                      <h3 class="exercise-card-title">
                        <a href="/exercise/{exercise.uuid}">
                          {exercise.title}
                        </a>
                      </h3>
                      
                      <div class="exercise-card-meta">
                        {#if exercise.theme && exercise.theme !== selectedChapter}
                          <span class="exercise-theme">{exercise.theme}</span>
                        {/if}
                        
                        {#if exercise.author}
                          <span class="exercise-author">par {exercise.author}</span>
                        {/if}
                        
                        {#if exercise.created_at}
                          <span class="exercise-date">
                            {new Date(exercise.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        {/if}
                      </div>
                    </div>
                    
                    <div class="exercise-card-sidebar">
                      {#if exercise.difficulty}
                        <div class="exercise-difficulty">
                          <span class="difficulty-label">Niveau {exercise.difficulty}</span>
                          <div class="difficulty-visual">
                            {#each Array(5) as _, i}
                              <div 
                                class="difficulty-dot"
                                class:difficulty-dot--active={i < exercise.difficulty}
                              ></div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                  
                  <div class="exercise-card-actions">
                    <a 
                      href="/exercise/{exercise.uuid}" 
                      class="exercise-action exercise-action--primary"
                    >
                      Voir l'exercice
                    </a>
                    
                    <button class="exercise-action exercise-action--secondary">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      Marquer
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .browse-page {
    @apply space-y-6;
  }
  
  .browse-header {
    @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4;
  }
  
  .browse-title-section {
    @apply flex-1;
  }
  
  .browse-title {
    @apply text-3xl font-bold text-gray-900 mb-2;
  }
  
  .browse-subtitle {
    @apply text-gray-600;
  }
  
  .browse-clear-btn {
    @apply px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2;
  }
  
  .browse-layout {
    @apply grid grid-cols-1 lg:grid-cols-4 gap-8;
  }
  
  .browse-sidebar {
    @apply lg:col-span-1;
  }
  
  .browse-main {
    @apply lg:col-span-3;
  }
  
  /* Sidebar styles */
  .chapter-tree-container {
    @apply bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-8;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }
  
  .chapter-tree-title {
    @apply text-lg font-semibold text-gray-900 mb-4;
  }
  
  .chapter-loading, .chapter-error {
    @apply text-center py-8;
  }
  
  .loading-spinner {
    @apply w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3;
  }
  
  .chapter-tree {
    @apply space-y-1;
  }
  
  .chapter-group {
    @apply border-b border-gray-100 last:border-b-0 pb-2 last:pb-0;
  }
  
  .chapter-button {
    @apply w-full flex items-center justify-between p-3 text-left rounded-lg hover:bg-gray-50 transition-colors;
  }
  
  .chapter-button--selected {
    @apply bg-blue-50 text-blue-700;
  }
  
  .chapter-info {
    @apply flex items-center gap-2;
  }
  
  .chapter-name {
    @apply font-medium text-gray-900;
  }
  
  .chapter-button--selected .chapter-name {
    @apply text-blue-700;
  }
  
  .chapter-count {
    @apply text-sm text-gray-500;
  }
  
  .chapter-arrow {
    @apply w-4 h-4 transform transition-transform text-gray-400;
  }
  
  .chapter-arrow--expanded {
    @apply rotate-90;
  }
  
  .subchapter-list {
    @apply ml-4 mt-2 space-y-1;
  }
  
  .subchapter-button {
    @apply w-full flex items-center justify-between p-2 text-left rounded-lg hover:bg-gray-50 transition-colors text-sm;
  }
  
  .subchapter-button--selected {
    @apply bg-blue-50 text-blue-700;
  }
  
  .subchapter-name {
    @apply text-gray-700;
  }
  
  .subchapter-button--selected .subchapter-name {
    @apply text-blue-700 font-medium;
  }
  
  .subchapter-count {
    @apply text-xs text-gray-500;
  }
  
  /* Vue d'ensemble des chapitres */
  .chapters-overview {
    @apply space-y-6;
  }
  
  .overview-title {
    @apply text-2xl font-bold text-gray-900;
  }
  
  .chapters-grid {
    @apply grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6;
  }
  
  .chapter-card {
    @apply bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow;
  }
  
  .chapter-card-header {
    @apply flex items-start justify-between mb-4;
  }
  
  .chapter-card-title {
    @apply text-lg font-semibold text-gray-900;
  }
  
  .chapter-card-count {
    @apply text-sm text-gray-500;
  }
  
  .chapter-card-content {
    @apply space-y-3 mb-4;
  }
  
  .chapter-card-subcount {
    @apply text-sm text-gray-600;
  }
  
  .chapter-card-sublist {
    @apply flex flex-wrap gap-2;
  }
  
  .chapter-card-sub {
    @apply px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs;
  }
  
  .chapter-card-more {
    @apply px-2 py-1 bg-gray-200 text-gray-500 rounded text-xs;
  }
  
  .chapter-card-actions {
    @apply pt-4 border-t border-gray-100;
  }
  
  .chapter-card-btn {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full;
  }
  
  /* Vue détaillée d'un chapitre */
  .chapter-detail {
    @apply space-y-6;
  }
  
  .chapter-detail-header {
    @apply bg-white rounded-lg border border-gray-200 p-6;
  }
  
  .chapter-detail-title-section {
    @apply mb-6;
  }
  
  .chapter-detail-title {
    @apply text-2xl font-bold text-gray-900 flex items-center gap-2;
  }
  
  .chapter-detail-separator {
    @apply text-gray-400;
  }
  
  .chapter-detail-subtitle {
    @apply text-blue-600;
  }
  
  .chapter-stats {
    @apply flex flex-wrap gap-6;
  }
  
  .stat-item {
    @apply flex flex-col sm:flex-row sm:items-center gap-2;
  }
  
  .stat-item--difficulty {
    @apply flex-col items-start;
  }
  
  .stat-value {
    @apply text-2xl font-bold text-blue-600;
  }
  
  .stat-label {
    @apply text-sm text-gray-600 font-medium;
  }
  
  .difficulty-distribution, .authors-list {
    @apply flex flex-wrap gap-2;
  }
  
  .difficulty-item, .author-item {
    @apply px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm;
  }
  
  /* Contrôles des exercices */
  .exercises-controls {
    @apply bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4;
  }
  
  .sort-controls {
    @apply flex items-center gap-3;
  }
  
  .sort-label {
    @apply text-sm font-medium text-gray-700;
  }
  
  .sort-buttons {
    @apply flex gap-2;
  }
  
  .sort-btn {
    @apply px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1;
  }
  
  .sort-btn--active {
    @apply bg-blue-50 border-blue-300 text-blue-700;
  }
  
  .sort-arrow {
    @apply text-xs;
  }
  
  .view-controls {
    @apply flex items-center gap-3;
  }
  
  .exercises-count {
    @apply text-sm text-gray-600;
  }
  
  /* Liste des exercices */
  .exercises-loading, .exercises-empty {
    @apply text-center py-16;
  }
  
  .empty-icon {
    @apply text-4xl mb-4;
  }
  
  .empty-title {
    @apply text-xl font-semibold text-gray-900 mb-2;
  }
  
  .empty-description {
    @apply text-gray-600;
  }
  
  .exercises-list {
    @apply space-y-4;
  }
  
  .exercise-card {
    @apply bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow;
  }
  
  .exercise-card-header {
    @apply flex items-start justify-between mb-4;
  }
  
  .exercise-card-content {
    @apply flex-1;
  }
  
  .exercise-card-title a {
    @apply text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors;
  }
  
  .exercise-card-meta {
    @apply flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600;
  }
  
  .exercise-theme {
    @apply px-2 py-1 bg-green-100 text-green-800 rounded;
  }
  
  .exercise-author {
    @apply text-gray-600;
  }
  
  .exercise-date {
    @apply text-gray-500;
  }
  
  .exercise-card-sidebar {
    @apply flex flex-col items-end;
  }
  
  .exercise-difficulty {
    @apply flex flex-col items-end gap-1;
  }
  
  .difficulty-label {
    @apply text-sm text-gray-600;
  }
  
  .difficulty-visual {
    @apply flex gap-1;
  }
  
  .difficulty-dot {
    @apply w-3 h-3 rounded-full bg-gray-200;
  }
  
  .difficulty-dot--active {
    @apply bg-orange-400;
  }
  
  .exercise-card-actions {
    @apply flex items-center gap-3 pt-4 border-t border-gray-100;
  }
  
  .exercise-action {
    @apply px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2;
  }
  
  .exercise-action--primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }
  
  .exercise-action--secondary {
    @apply bg-gray-100 text-gray-700 hover:bg-gray-200;
  }
  
  /* Responsive */
  @media (max-width: 1024px) {
    .browse-layout {
      @apply grid-cols-1;
    }
    
    .chapter-tree-container {
      @apply static;
      max-height: none;
    }
    
    .browse-sidebar {
      @apply order-2;
    }
    
    .browse-main {
      @apply order-1;
    }
  }
  
  @media (max-width: 640px) {
    .exercises-controls {
      @apply flex-col items-stretch;
    }
    
    .sort-controls {
      @apply flex-col items-start;
    }
    
    .sort-buttons {
      @apply flex-wrap;
    }
    
    .exercise-card-header {
      @apply flex-col gap-3;
    }
    
    .exercise-card-actions {
      @apply flex-col;
    }
  }
</style>