<!-- src/lib/components/Dashboard.svelte -->
<script>
  import { onMount } from 'svelte';
  
  let stats = null;
  let trending = [];
  let loading = true;
  let error = null;
  
  onMount(async () => {
    await loadDashboardData();
  });
  
  async function loadDashboardData() {
    try {
      loading = true;
      
      // Charger les stats globales et les exercices tendances en parallèle
      const [statsResponse, trendingResponse] = await Promise.all([
        fetch('/api/stats?type=global'),
        fetch('/api/stats?type=trending&limit=10')
      ]);
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        stats = statsData.stats;
      }
      
      if (trendingResponse.ok) {
        const trendingData = await trendingResponse.json();
        trending = trendingData.trending || [];
      }
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      error = 'Impossible de charger les données du tableau de bord';
    } finally {
      loading = false;
    }
  }
  
  function getDifficultyColor(level) {
    const colors = {
      1: 'bg-green-100 text-green-800',
      2: 'bg-blue-100 text-blue-800', 
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-orange-100 text-orange-800',
      5: 'bg-red-100 text-red-800'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  }
</script>

<div class="dashboard">
  {#if loading}
    <div class="dashboard-loading">
      <div class="loading-spinner"></div>
      <p>Chargement du tableau de bord...</p>
    </div>
    
  {:else if error}
    <div class="dashboard-error">
      <p>{error}</p>
      <button on:click={loadDashboardData} class="retry-button">
        Réessayer
      </button>
    </div>
    
  {:else if stats}
    <div class="dashboard-content">
      <!-- Statistiques générales -->
      <div class="stats-overview">
        <h2 class="section-title">Vue d'ensemble</h2>
        
        <div class="stats-grid">
          <!-- Total d'exercices -->
          <div class="stat-card stat-card--primary">
            <div class="stat-icon">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 17H9m6-8V9a6 6 0 10-12 0v6c0 3.314 2.686 6 6h6a6 6 0 000-12z" />
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats.total.toLocaleString()}</div>
              <div class="stat-label">Exercices disponibles</div>
            </div>
          </div>
          
          <!-- Exercices récents -->
          <div class="stat-card stat-card--success">
            <div class="stat-icon">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats.recentCount}</div>
              <div class="stat-label">Ajoutés ce mois</div>
            </div>
          </div>
          
          <!-- Nombre de chapitres -->
          <div class="stat-card stat-card--info">
            <div class="stat-icon">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-5v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats.topChapters.length}</div>
              <div class="stat-label">Chapitres</div>
            </div>
          </div>
          
          <!-- Nombre d'auteurs -->
          <div class="stat-card stat-card--warning">
            <div class="stat-icon">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="stat-content">
              <div class="stat-value">{stats.topAuthors.length}</div>
              <div class="stat-label">Auteurs contributeurs</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Répartition par difficulté -->
      {#if stats.difficulty.length > 0}
        <div class="difficulty-distribution">
          <h3 class="subsection-title">Répartition par difficulté</h3>
          
          <div class="difficulty-chart">
            {#each stats.difficulty as diff}
              <div class="difficulty-bar-container">
                <div class="difficulty-level">
                  <span class="difficulty-badge {getDifficultyColor(diff.difficulty)}">
                    Niveau {diff.difficulty}
                  </span>
                </div>
                <div class="difficulty-bar-wrapper">
                  <div 
                    class="difficulty-bar"
                    style="width: {(diff.count / stats.total) * 100}%"
                  ></div>
                  <span class="difficulty-count">{diff.count} exercices</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <div class="dashboard-grid">
        <!-- Top chapitres -->
        {#if stats.topChapters.length > 0}
          <div class="dashboard-card">
            <h3 class="card-title">Chapitres les plus fournis</h3>
            <div class="top-list">
              {#each stats.topChapters.slice(0, 8) as chapter}
                <div class="top-item">
                  <div class="top-item-content">
                    <span class="top-item-name">{chapter.chapter}</span>
                    <span class="top-item-count">{chapter.count} exercices</span>
                  </div>
                  <div class="top-item-bar">
                    <div 
                      class="top-item-progress"
                      style="width: {(chapter.count / stats.topChapters[0].count) * 100}%"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- Top auteurs -->
        {#if stats.topAuthors.length > 0}
          <div class="dashboard-card">
            <h3 class="card-title">Auteurs les plus actifs</h3>
            <div class="top-list">
              {#each stats.topAuthors.slice(0, 8) as author}
                <div class="top-item">
                  <div class="top-item-content">
                    <span class="top-item-name">{author.author}</span>
                    <span class="top-item-count">{author.count} exercices</span>
                  </div>
                  <div class="top-item-bar">
                    <div 
                      class="top-item-progress top-item-progress--author"
                      style="width: {(author.count / stats.topAuthors[0].count) * 100}%"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Exercices tendances -->
      {#if trending.length > 0}
        <div class="trending-section">
          <h3 class="subsection-title">
            🔥 Exercices tendances
          </h3>
          
          <div class="trending-grid">
            {#each trending.slice(0, 6) as exercise}
              <div class="trending-card">
                <div class="trending-card-header">
                  <div class="trending-rank">
                    #{trending.indexOf(exercise) + 1}
                  </div>
                  {#if exercise.difficulty}
                    <div class="trending-difficulty">
                      <div class="difficulty-dots">
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
                
                <div class="trending-content">
                  <h4 class="trending-title">
                    <a href="/exercise/{exercise.uuid}">
                      {exercise.title}
                    </a>
                  </h4>
                  
                  <div class="trending-meta">
                    <span class="trending-chapter">{exercise.chapter}</span>
                    {#if exercise.author}
                      <span class="trending-author">par {exercise.author}</span>
                    {/if}
                  </div>
                </div>
                
                <div class="trending-score">
                  <div class="score-indicator">
                    <div class="score-bar">
                      <div 
                        class="score-fill"
                        style="width: {(exercise.popularity_score / 4) * 100}%"
                      ></div>
                    </div>
                    <span class="score-label">Score: {exercise.popularity_score}/4</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    @apply space-y-8;
  }
  
  .dashboard-loading, .dashboard-error {
    @apply text-center py-16;
  }
  
  .loading-spinner {
    @apply w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4;
  }
  
  .retry-button {
    @apply mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  }
  
  .dashboard-content {
    @apply space-y-8;
  }
  
  .section-title {
    @apply text-2xl font-bold text-gray-900 mb-6;
  }
  
  .subsection-title {
    @apply text-xl font-semibold text-gray-800 mb-4;
  }
  
  /* Stats overview */
  .stats-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6;
  }
  
  .stat-card {
    @apply bg-white rounded-xl shadow-sm border p-6 flex items-center gap-4;
  }
  
  .stat-card--primary {
    @apply border-blue-200 bg-gradient-to-br from-blue-50 to-white;
  }
  
  .stat-card--success {
    @apply border-green-200 bg-gradient-to-br from-green-50 to-white;
  }
  
  .stat-card--info {
    @apply border-purple-200 bg-gradient-to-br from-purple-50 to-white;
  }
  
  .stat-card--warning {
    @apply border-orange-200 bg-gradient-to-br from-orange-50 to-white;
  }
  
  .stat-icon {
    @apply flex-shrink-0;
  }
  
  .stat-card--primary .stat-icon {
    @apply text-blue-600;
  }
  
  .stat-card--success .stat-icon {
    @apply text-green-600;
  }
  
  .stat-card--info .stat-icon {
    @apply text-purple-600;
  }
  
  .stat-card--warning .stat-icon {
    @apply text-orange-600;
  }
  
  .stat-content {
    @apply flex-1;
  }
  
  .stat-value {
    @apply text-3xl font-bold text-gray-900 leading-none;
  }
  
  .stat-label {
    @apply text-sm text-gray-600 mt-1;
  }
  
  /* Difficulty distribution */
  .difficulty-distribution {
    @apply bg-white rounded-xl shadow-sm border p-6;
  }
  
  .difficulty-chart {
    @apply space-y-4;
  }
  
  .difficulty-bar-container {
    @apply flex items-center gap-4;
  }
  
  .difficulty-level {
    @apply flex-shrink-0 w-24;
  }
  
  .difficulty-badge {
    @apply px-2 py-1 rounded-full text-xs font-medium;
  }
  
  .difficulty-bar-wrapper {
    @apply flex-1 flex items-center gap-3;
  }
  
  .difficulty-bar {
    @apply h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500;
  }
  
  .difficulty-count {
    @apply text-sm text-gray-600 font-medium min-w-24;
  }
  
  /* Dashboard grid */
  .dashboard-grid {
    @apply grid grid-cols-1 lg:grid-cols-2 gap-8;
  }
  
  .dashboard-card {
    @apply bg-white rounded-xl shadow-sm border p-6;
  }
  
  .card-title {
    @apply text-lg font-semibold text-gray-900 mb-4;
  }
  
  .top-list {
    @apply space-y-3;
  }
  
  .top-item {
    @apply space-y-2;
  }
  
  .top-item-content {
    @apply flex items-center justify-between;
  }
  
  .top-item-name {
    @apply font-medium text-gray-900 truncate flex-1 mr-3;
  }
  
  .top-item-count {
    @apply text-sm text-gray-600 flex-shrink-0;
  }
  
  .top-item-bar {
    @apply w-full bg-gray-200 rounded-full h-2;
  }
  
  .top-item-progress {
    @apply h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500;
  }
  
  .top-item-progress--author {
    @apply from-green-500 to-green-600;
  }
  
  /* Trending section */
  .trending-section {
    @apply bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200;
  }
  
  .trending-grid {
    @apply grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4;
  }
  
  .trending-card {
    @apply bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow;
  }
  
  .trending-card-header {
    @apply flex items-center justify-between mb-3;
  }
  
  .trending-rank {
    @apply w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold;
  }
  
  .trending-difficulty {
    @apply flex items-center;
  }
  
  .difficulty-dots {
    @apply flex gap-1;
  }
  
  .difficulty-dot {
    @apply w-2 h-2 rounded-full bg-gray-300;
  }
  
  .difficulty-dot--active {
    @apply bg-orange-400;
  }
  
  .trending-content {
    @apply mb-3;
  }
  
  .trending-title a {
    @apply font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2;
  }
  
  .trending-meta {
    @apply flex flex-col gap-1 mt-2 text-sm text-gray-600;
  }
  
  .trending-chapter {
    @apply px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs inline-block;
  }
  
  .trending-author {
    @apply text-xs;
  }
  
  .trending-score {
    @apply pt-3 border-t border-gray-100;
  }
  
  .score-indicator {
    @apply space-y-1;
  }
  
  .score-bar {
    @apply w-full h-1.5 bg-gray-200 rounded-full overflow-hidden;
  }
  
  .score-fill {
    @apply h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-700;
  }
  
  .score-label {
    @apply text-xs text-gray-500;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .stats-grid {
      @apply grid-cols-1 sm:grid-cols-2;
    }
    
    .dashboard-grid {
      @apply grid-cols-1;
    }
    
    .trending-grid {
      @apply grid-cols-1;
    }
    
    .difficulty-bar-container {
      @apply flex-col items-start gap-2;
    }
    
    .difficulty-level {
      @apply w-auto;
    }
    
    .difficulty-bar-wrapper {
      @apply w-full;
    }
  }
  
  /* Utilitaires pour le texte tronqué */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>