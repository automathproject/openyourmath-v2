<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '../lib/components/MobileChapterNav.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import ExercisePreview from '$lib/components/ExercisePreview.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';
  
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
    suggestionActions,
    previewState,
    previewActions,
    hasPreview,
    loadingMore
  } from '$lib/stores/searchStore.js';
  
  import { useDebounce } from '$lib/hooks/useDebounce.js';
  
  // Variables locales pour l'UI
  let showAdvancedFilters = false;
  let showAuthorSuggestions = false;
  let showModuleSuggestions = false;
  let licenseOpenFor = null; // uuid de la carte dont on affiche la licence
  
  // Créer la fonction de recherche débouncée
  const debouncedSearch = useDebounce(searchActions.search, 300);
  
  // États dérivés réactifs utilisant les stores
  $: selectedPath = {
    level: $filters.level,
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
  
  // NOUVEAU : Fonction pour sélectionner un exercice
  function selectExercise(exercise) {
    previewActions.selectExercise(exercise.uuid);
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

  function toggleLicense(exercise) {
    licenseOpenFor = licenseOpenFor === exercise.uuid ? null : exercise.uuid;
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
  
  function handleLevelChange() {
    searchActions.search();
  }

  function handleDifficultyChange() {
    searchActions.search();
  }

  function formatDifficulty(difficulty) {
    if (difficulty === null || difficulty === undefined) {
      return null;
    }
    return `★${difficulty}`;
  }

  // Chips de filtre rapides (tri-état: '', '1', '0')
  function cycleTri(value) {
    if (value === '' || value === undefined || value === null) return '1';
    if (value === '1' || value === true) return '0';
    return '';
  }

  function toggleSolutionChip() {
    const next = cycleTri($filters.hasSolution);
    searchActions.updateFilter('hasSolution', next);
    searchActions.search();
  }

  function toggleIndicationChip() {
    const next = cycleTri($filters.hasIndication);
    searchActions.updateFilter('hasIndication', next);
    searchActions.search();
  }
</script>

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="container mx-auto px-4 py-4 sm:py-8">
  <!-- Section d'en-tête et barre de recherche -->
  <div class="search-container text-center mb-6 sm:mb-12">
    <div class="lg:flex lg:items-center lg:justify-center lg:gap-6">
      <img src="/img/logo1.png" alt="OpenYourMath" class="hidden lg:block w-24 h-auto" loading="eager" />
      <div class="lg:text-left">
        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Recherchez votre exercice</h1>
        <p class="hidden sm:block text-gray-600 text-sm sm:text-base mb-4 sm:mb-6">Utilisez la recherche textuelle ou naviguez par chapitres, modules et niveaux.</p>
      </div>
    </div>
    <div class="relative">
      <!-- Icône loupe à gauche -->
      <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400" aria-hidden="true">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input 
        type="search" 
        bind:value={$searchQuery} 
        on:input={debouncedSearch} 
        placeholder="Ex: intégrale, matrice, probabilité..." 
        class="search-input pl-10 pr-12" 
      />
      {#if $loading && !$hasResults}
        <div class="search-loading"><div class="search-spinner"></div></div>
      {/if}
    </div>
  </div>

  <!-- MODIFIÉ : Mise en page principale adaptative selon la prévisualisation -->
  <div class="grid gap-8 transition-all duration-300 {$hasPreview ? 'grid-cols-1 lg:grid-cols-6' : 'grid-cols-1 lg:grid-cols-4'}">
    
    <!-- COLONNE DE GAUCHE : Filtres + Navigation -->
    <aside class="lg:col-span-2">
      <!-- Filtres avancés (désormais au-dessus de la navigation) -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <button on:click={() => showAdvancedFilters = !showAdvancedFilters} class="btn btn-secondary">
            Filtres avancés {showAdvancedFilters ? '▲' : '▼'}
          </button>
          {#if $hasActiveFilters}
            <button on:click={searchActions.clearAllFilters} class="btn btn-text text-sm text-blue-600">
              Effacer tout
            </button>
          {/if}
        </div>

        {#if showAdvancedFilters}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
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
                bind:value={$filters.level} 
                on:change={handleLevelChange} 
                class="form-input"
              >
                <option value="">Tous les niveaux</option>
                {#each $suggestions.levels as level}
                  <option value={level.value}>{level.value} ({level.count})</option>
                {/each}
              </select>
            </div>

            <!-- Difficulté numérique -->
            <div>
              <label for="difficulty-filter" class="block text-sm font-medium text-gray-700 mb-1">Difficulté</label>
              <select 
                id="difficulty-filter" 
                bind:value={$filters.difficulty} 
                on:change={handleDifficultyChange} 
                class="form-input"
              >
                <option value="">Toutes difficultés</option>
                <option value="null">Sans difficulté</option>
                {#each $suggestions.difficulties || [] as diff}
                  <option value={diff.value}>★{diff.value} ({diff.count})</option>
                {/each}
              </select>
            </div>

            <!-- Solution -->
            <div>
              <label for="solution-filter" class="block text-sm font-medium text-gray-700 mb-1">Solution</label>
              <select 
                id="solution-filter"
                bind:value={$filters.hasSolution}
                on:change={handleDifficultyChange}
                class="form-input"
              >
                <option value="">Tous</option>
                <option value="1">Avec solution</option>
                <option value="0">Sans solution</option>
              </select>
            </div>

            <!-- Indication -->
            <div>
              <label for="indication-filter" class="block text-sm font-medium text-gray-700 mb-1">Indication</label>
              <select 
                id="indication-filter"
                bind:value={$filters.hasIndication}
                on:change={handleDifficultyChange}
                class="form-input"
              >
                <option value="">Tous</option>
                <option value="1">Avec indication</option>
                <option value="0">Sans indication</option>
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
      <!-- Navigation desktop (masquée sur mobile) -->
      <div class="hidden lg:block sticky top-4">
        <ChapterNavigation 
          bind:selectedLevel={$filters.level}
          bind:selectedModule={$filters.module}
          bind:selectedChapter={$filters.chapter}
          bind:selectedSubchapter={$filters.subchapter}
          query={$searchQuery}
          activeFilters={$filters}
          on:navigate={handleChapterNavigation}
        />
      </div>

      <!-- Navigation mobile (masquée sur desktop) -->
      <div class="block lg:hidden mb-6">
        <MobileChapterNav 
          bind:selectedLevel={$filters.level}
          bind:selectedModule={$filters.module}
          bind:selectedChapter={$filters.chapter}
          bind:selectedSubchapter={$filters.subchapter}
          query={$searchQuery}
          activeFilters={$filters}
          on:navigate={handleChapterNavigation}
        />
      </div>
    </aside>

    <!-- COLONNE DU MILIEU : Résultats -->
    <main class="lg:col-span-2">
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
            <div class="filter-chips">
              <button 
                type="button" 
                class="chip {($filters.hasSolution==='1') ? 'chip--on' : ($filters.hasSolution==='0' ? 'chip--off' : '')}"
                title="Filtrer par solution (clic pour basculer)"
                on:click={toggleSolutionChip}
                disabled={$loading}
              >
                ✅ Solution { $filters.hasSolution==='1' ? '• oui' : $filters.hasSolution==='0' ? '• non' : '' }
              </button>
              <button 
                type="button" 
                class="chip {($filters.hasIndication==='1') ? 'chip--on' : ($filters.hasIndication==='0' ? 'chip--off' : '')}"
                title="Filtrer par indication (clic pour basculer)"
                on:click={toggleIndicationChip}
                disabled={$loading}
              >
                💡 Indication { $filters.hasIndication==='1' ? '• oui' : $filters.hasIndication==='0' ? '• non' : '' }
              </button>
            </div>
          </div>
          <div class="results-grid">
            {#each $results as exercise (exercise.uuid)}
              <!-- MODIFIÉ : Carte avec bouton d'ajout à la liste -->
              <div 
                class="result-card cursor-pointer transition-all duration-200 {$previewState.selectedUuid === exercise.uuid && $previewState.isOpen ? 'result-card--selected' : ''}"
                on:click={() => selectExercise(exercise)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectExercise(exercise)}
              >
                <!-- En-tête avec badges et actions -->
                <div class="flex justify-between items-start mb-2">
                  <div class="flex gap-2 items-center">
                    {#if exercise.level}
                      <div class="result-badge">{exercise.level}</div>
                    {/if}
                    {#if exercise.difficulty}
                      <div class="flex items-center gap-1">
                        {#each Array(5) as _, i}
                          <div class="w-2 h-2 rounded-full {i < exercise.difficulty ? 'bg-orange-400' : 'bg-gray-200'}"></div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2">
                    <!-- NOUVEAU : Bouton d'ajout à la liste -->
                    <button 
                      type="button" 
                      on:click|stopPropagation 
                      aria-label="Ajouter à la liste"
                      class="bg-transparent border-none p-0 m-0"
                    >
                      <AddToListButton 
                        {exercise} 
                        size="small" 
                        variant="icon"
                      />
                    </button>
                    
                    <!-- Indicateur de sélection -->
                    {#if $previewState.selectedUuid === exercise.uuid && $previewState.isOpen}
                      <div class="selection-indicator">
                        <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    {/if}
                    
                    <span class="text-xs text-gray-400 font-mono">{exercise.uuid}</span>
                    
                    <!-- Ouvrir la page complète dans un nouvel onglet (comme la prévisualisation) -->
                    <button 
                      type="button"
                      class="external-link-btn"
                      title="Ouvrir dans un nouvel onglet"
                      aria-label="Ouvrir dans un nouvel onglet"
                      on:click|stopPropagation={() => window.open(`/exercise/${exercise.uuid}`, '_blank')}
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="result-header">
                  <div>
                    <h3 class="result-title">{exercise.title}</h3>
                    <div class="result-metadata">
                      {#if exercise.module}
                        <span class="result-badge">📖 {exercise.module} - </span>
                      {/if}
                      {#if exercise.chapter}
                        <span class="result-badge"> {exercise.chapter}</span>
                      {/if}
                      {#if exercise.author}
                        <span class="result-metadata-sep">•</span>
                        <button 
                          type="button" 
                          class="result-author-inline"
                          title="Voir la licence"
                          on:click|stopPropagation={() => toggleLicense(exercise)}
                        >
                          👤 {exercise.author}
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
                
                <!-- Section preview -->
                {#if exercise.preview}
                  <div class="result-preview mt-3">
                    <div class="text-gray-600 text-sm line-clamp-3">
                      <MathRenderer content={exercise.preview} />
                    </div>
                  </div>
                {/if}

                <!-- Footer auteur / organisation -->
                {#if exercise.author || exercise.organization}
                  <div class="result-footer">
                    {#if exercise.author}
                      <button 
                        type="button"
                        class="result-footer-item result-author"
                        title="Voir la licence"
                        on:click|stopPropagation={() => toggleLicense(exercise)}
                      >
                        👤 {exercise.author}
                      </button>
                    {/if}
                    {#if exercise.organization}
                      <span class="result-footer-sep">•</span>
                      <span class="result-footer-item">🏛️ {exercise.organization}</span>
                    {/if}
                  </div>
                  {#if licenseOpenFor === exercise.uuid}
                    <div class="result-license-pop" on:click|stopPropagation>
                      {#if exercise.license_code}
                        <span class="license-badge">🔖 {exercise.license_code}</span>
                        {#if exercise.license_url}
                          <a class="license-link" href={exercise.license_url} target="_blank" rel="noopener">Détails</a>
                        {/if}
                      {:else}
                        <span class="text-gray-500">Licence non renseignée</span>
                      {/if}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
          {#if $searchMeta?.pagination?.hasMore}
            <div class="text-center mt-4">
              <button class="btn btn-secondary" on:click={searchActions.loadMore} disabled={$loadingMore}>
                {$loadingMore ? 'Chargement…' : 'Voir plus'}
              </button>
            </div>
          {/if}
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

    <!-- NOUVEAU : COLONNE DE DROITE : Prévisualisation -->
    {#if $hasPreview}
      <aside class="lg:col-span-2 hidden lg:block">
        <div class="sticky top-8 h-[calc(100vh-8rem)]">
          <ExercisePreview />
        </div>
      </aside>
    {/if}
  </div>

  <!-- NOUVEAU : Modal de prévisualisation pour mobile -->
  {#if $hasPreview}
    <button
      type="button"
      class="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50"
      aria-label="Fermer la prévisualisation"
      on:click={previewActions.closePreview}
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && previewActions.closePreview()}
      tabindex="0"
      style="width:100%;height:100%;border:none;padding:0;background:transparent;"
    >
      <div
        class="absolute inset-x-0 bottom-0 bg-white rounded-t-xl max-h-[80vh] overflow-hidden"
        on:click|stopPropagation
        role="presentation"
      >
        <ExercisePreview />
      </div>
    </button>
  {/if}
</div>

<style>
  /* Search interface */
  .search-container { max-width: 42rem; margin-left: auto; margin-right: auto; }
  .search-input { width: 100%; padding: 0.75rem 3rem 0.75rem 2.5rem; font-size: 1.125rem; border: 1px solid rgb(209 213 219); border-radius: 0.5rem; }
  .search-input:focus { outline: none; box-shadow: 0 0 0 2px rgb(59 130 246 / 0.5); border-color: transparent; }
  .search-loading { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); }
  .search-spinner { border-bottom: 2px solid rgb(37 99 235); border-radius: 9999px; width: 1.25rem; height: 1.25rem; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg);} }
  .search-error { margin-top: 0.5rem; padding: 0.75rem; background: rgb(254 242 242); border: 1px solid rgb(254 202 202); border-radius: 0.5rem; }
  .search-error-text { color: rgb(220 38 38); font-size: 0.875rem; }

  /* Results */
  .results-header { display: flex; align-items: center; justify-content: space-between; }
  .results-title { font-size: 1.25rem; font-weight: 600; color: rgb(17 24 39); }
  .results-grid { display: grid; gap: 1rem; }
  .filter-chips { display:flex; gap:0.5rem; align-items:center; }
  .chip { padding: 0.25rem 0.5rem; font-size:0.875rem; border-radius: 9999px; background:#f3f4f6; color:#374151; border:1px solid #e5e7eb; transition: background-color .2s; }
  .chip:hover { background:#e5e7eb; }
  .chip--on { background:#dcfce7; color:#166534; border-color:#bbf7d0; }
  .chip--off { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
  .result-card { background: white; border-radius: 0.5rem; border: 1px solid rgb(229 231 235); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); padding: 1.5rem; transition: box-shadow .2s; }
  .result-card:hover { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06); }
  .result-header { display: flex; align-items: start; justify-content: space-between; }
  .result-title { font-size: 1.125rem; font-weight: 500; color: rgb(17 24 39); margin-bottom: 0.5rem; }
  .result-title a { text-decoration: none; }
  .result-title a:hover { color: rgb(37 99 235); }
  .result-metadata { display: flex; align-items: center; gap: 1rem; font-size: 0.875rem; color: rgb(75 85 99); margin-bottom: 0.5rem; }
  .result-badge { background: rgb(243 244 246); padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
  .result-preview div { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .result-preview .katex { font-size: 0.875rem !important; }
  .result-preview .katex-display { margin: 0.25rem 0 !important; }

  /* Result footer */
  .result-footer { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f3f4f6; display:flex; gap:0.5rem; flex-wrap:wrap; color:#6b7280; font-size:0.875rem; }
  .result-footer-item { white-space: nowrap; }
  .result-footer-sep { color:#d1d5db; }
  .result-author { cursor: pointer; padding: 0 0.125rem; border-radius: 0.25rem; background: transparent; border: none; color: inherit; }
  .result-author:hover { background: #f3f4f6; color:#374151; }
  .result-license-pop { margin-top: 0.25rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:0.375rem; padding:0.5rem 0.625rem; display:flex; align-items:center; gap:0.5rem; color:#374151; font-size:0.875rem; }
  .license-badge { font-weight:600; }
  .license-link { color:#2563eb; text-decoration: underline; }

  /* Result header author (inline) */
  .result-metadata-sep { color:#d1d5db; margin: 0 0.25rem; }
  .result-author-inline { cursor: pointer; padding: 0 0.125rem; border-radius: 0.25rem; background: transparent; border: none; color: #6b7280; font-size: 0.875rem; }
  .result-author-inline:hover { background:#f3f4f6; color:#374151; }
  .result-card--selected { border-color: rgb(59 130 246); background: rgb(239 246 255); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
  .selection-indicator { width: 1.5rem; height: 1.5rem; background: rgb(219 234 254); border-radius: 9999px; display: flex; align-items: center; justify-content: center; }
  .external-link-btn { color: rgb(156 163 175); transition: color .2s, background-color .2s; padding: 0.25rem; border-radius: 0.25rem; }
  .external-link-btn:hover { color: rgb(37 99 235); background: rgb(239 246 255); }
</style>
