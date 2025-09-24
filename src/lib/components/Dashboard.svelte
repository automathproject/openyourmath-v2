<!-- src/lib/components/Dashboard.svelte -->
<script>
  import { onMount } from 'svelte';
  import MathRenderer from './MathRenderer.svelte';
  
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
                      <MathRenderer content={exercise.title} inline={true} />
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

<style></style>
