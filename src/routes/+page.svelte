<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '../lib/components/MobileChapterNav.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import ExercisePreview from '$lib/components/ExercisePreview.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';
  import NameRenderer from '$lib/components/NameRenderer.svelte';

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
    loadingMore,
    layoutState,
    layoutConfig,
    layoutActions,
    breadcrumb
  } from '$lib/stores/searchStore.js';

  import { useDebounce } from '$lib/hooks/useDebounce.js';

  let showAuthorSuggestions = false;
  let showModuleSuggestions = false;
  let isFilterPanelOpen = false;

  const debouncedSearch = useDebounce(searchActions.search, 300);

  onMount(() => {
    suggestionActions.loadSuggestions();
  });

  function handleChapterNavigation(event) {
    const { level, module, chapter, subchapter } = event.detail;
    searchActions.updateFromNavigation({ level, module, chapter, subchapter });
    searchActions.search();
  }

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

  function handleModuleInput() {
    showModuleSuggestions = true;
  }

  function handleAuthorInput() {
    showAuthorSuggestions = true;
  }

  function handleModuleBlur() {
    setTimeout(() => (showModuleSuggestions = false), 150);
  }

  function handleAuthorBlur() {
    setTimeout(() => (showAuthorSuggestions = false), 150);
  }

  function handleLevelChange() {
    searchActions.search();
  }

  function handleDifficultyChange() {
    searchActions.search();
  }

  function clearHierarchyFilters() {
    searchActions.updateFromNavigation({ level: '', module: '', chapter: '', subchapter: '' });
    searchActions.search();
  }

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

  function openFilters() {
    isFilterPanelOpen = true;
  }

  function closeFilters() {
    isFilterPanelOpen = false;
    showAuthorSuggestions = false;
    showModuleSuggestions = false;
  }

  $: canTogglePreview = Boolean($previewState.selectedUuid);
  $: previewToggleLabel = $layoutConfig.showPreviewPanel ? 'Masquer la prévisualisation' : 'Afficher la prévisualisation';
</script>

<svelte:head>
  <title>Recherche d'exercices - OpenYourMath</title>
</svelte:head>

<div class="container mx-auto px-4 py-4 sm:py-8">
  <div class="hero-block text-center lg:text-left mb-6 sm:mb-10">
    <div class="hero-inner">
      <img src="/img/logo1.png" alt="OpenYourMath" class="hidden lg:block w-24 h-auto" loading="eager" />
      <div>
        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Recherchez votre exercice</h1>
        <p class="text-gray-600 text-sm sm:text-base">Explorez par mots-clés, puis affinez via les filtres.</p>
      </div>
    </div>
  </div>

  <div class="toolbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
    <div class="toolbar-search relative flex-1">
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
    <div class="toolbar-buttons flex gap-2 sm:flex-none">
      <button type="button" class="btn btn-secondary toolbar-button" on:click={openFilters}>
        🔧 Filtres
      </button>
      {#if canTogglePreview}
        <button
          type="button"
          class="btn btn-text toolbar-button"
          on:click={() => layoutActions.togglePreviewPanel()}
        >
          {previewToggleLabel}
        </button>
      {/if}
    </div>
  </div>

  <div class="breadcrumb-bar flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
    <div class="breadcrumb-path">
      <span class="breadcrumb-icon">📍</span>
      <span>{$breadcrumb.label || 'Tous les exercices'}</span>
    </div>
    <div class="breadcrumb-actions">
      {#if !$breadcrumb.isEmpty}
        <button type="button" class="btn btn-text text-sm text-blue-600" on:click={clearHierarchyFilters}>
          Effacer
        </button>
      {/if}
      {#if $hasActiveFilters}
        <button type="button" class="btn btn-text text-sm text-blue-600" on:click={searchActions.clearAllFilters}>
          Effacer tout
        </button>
      {/if}
    </div>
  </div>

  <div class="chips-row flex flex-wrap gap-2 mb-6">
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

  <div class="content-layout flex flex-col gap-6 lg:flex-row">
    <div class="results-section flex-1" style={`--layout-results-width: ${$layoutConfig.resultsWidth};`}>
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
            résultat{$results.length > 1 ? 's' : ''} trouvé{$results.length > 1 ? 's' : ''}
          </h2>
        </div>
        <div class="results-grid">
          {#each $results as exercise (exercise.uuid)}
            <div
              class="result-card cursor-pointer transition-all duration-200 {($previewState.selectedUuid === exercise.uuid && $previewState.isOpen) ? 'result-card--selected' : ''}"
              on:click={() => selectExercise(exercise)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectExercise(exercise)}
            >
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

                  {#if $previewState.selectedUuid === exercise.uuid && $previewState.isOpen}
                    <div class="selection-indicator">
                      <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  {/if}

                  <span class="text-xs text-gray-400 font-mono">{exercise.uuid}</span>

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
                      <span class="result-badge">📖 {exercise.module}</span>
                    {/if}
                    {#if exercise.chapter}
                      <span class="result-badge">{exercise.chapter}</span>
                    {/if}
                  </div>
                </div>
              </div>

              {#if exercise.preview}
                <div class="result-preview mt-3">
                  <div class="text-gray-600 text-sm line-clamp-3">
                    <MathRenderer content={exercise.preview} />
                  </div>
                </div>
              {/if}

              {#if exercise.author || exercise.organization}
                <div class="result-footer">
                  {#if exercise.author}
                    <NameRenderer
                      author={exercise.author}
                      licenseCode={exercise.license_code}
                      licenseUrl={exercise.license_url}
                      email={exercise.author_email || exercise.authorEmail || ''}
                      variant="footer"
                      className="result-footer-item"
                    />
                  {/if}
                  {#if exercise.organization}
                    <span class="result-footer-sep">•</span>
                    <span class="result-footer-item">🏛️ {exercise.organization}</span>
                  {/if}
                </div>
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
          <p class="empty-state-subtitle">Essayez d'ajuster les filtres ou votre requête.</p>
          <button on:click={searchActions.clearAllFilters} class="btn btn-primary mt-4">
            Effacer tous les filtres
          </button>
        </div>
      {:else}
        <div class="empty-state">
          <h3 class="empty-state-title">Prêt à explorer ?</h3>
          <p class="empty-state-subtitle">Tapez quelques mots ou ouvrez les filtres pour naviguer.</p>
        </div>
      {/if}
    </div>

    {#if $layoutConfig.showPreviewPanel}
      <aside class="preview-section hidden lg:flex" style={`--layout-preview-width: ${$layoutConfig.previewWidth};`}>
        <div class="preview-sticky">
          <ExercisePreview />
        </div>
      </aside>
    {/if}
  </div>
</div>

{#if isFilterPanelOpen}
  <div class="filters-overlay" on:click={closeFilters}>
    <div
      class="filters-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Filtres de recherche"
      on:click|stopPropagation
    >
      <div class="filters-header">
        <h2>Filtres</h2>
        <button type="button" class="filters-close" on:click={closeFilters}>
          Fermer ✕
        </button>
      </div>
      <div class="filters-body">
        <section class="filters-section">
          <div class="filters-section-header">
            <h3>Navigation hiérarchique</h3>
            {#if !$breadcrumb.isEmpty}
              <button type="button" class="btn btn-text text-sm text-blue-600" on:click={clearHierarchyFilters}>
                Réinitialiser
              </button>
            {/if}
          </div>
          <div class="filters-navigation">
            <div class="filters-navigation-desktop">
              <ChapterNavigation
                bind:selectedLevel={$filters.level}
                bind:selectedModule={$filters.module}
                bind:selectedChapter={$filters.chapter}
                bind:selectedSubchapter={$filters.subchapter}
                query={$searchQuery}
                activeFilters={$filters}
                on:navigate={handleChapterNavigation}
                compact={true}
              />
            </div>
            <div class="filters-navigation-mobile">
              <MobileChapterNav
                bind:selectedLevel={$filters.level}
                bind:selectedModule={$filters.module}
                bind:selectedChapter={$filters.chapter}
                bind:selectedSubchapter={$filters.subchapter}
                query={$searchQuery}
                activeFilters={$filters}
                on:navigate={handleChapterNavigation}
                embedded={true}
              />
            </div>
          </div>
        </section>

        <section class="filters-section">
          <div class="filters-accordion md:hidden" aria-label="Filtres détaillés">
            <details class="filters-accordion-item" open={$filters.module?.length > 0}>
              <summary>Module</summary>
              <div class="filters-field filters-field--accordion">
                <input
                  id="module-filter-mobile"
                  type="text"
                  bind:value={$filters.module}
                  on:input={handleModuleInput}
                  on:blur={handleModuleBlur}
                  placeholder="Ex: Algèbre..."
                  class="form-input"
                />
                {#if showModuleSuggestions && $suggestions.modules.length > 0}
                  <div class="filters-suggestions">
                    {#each $suggestions.modules.filter(s => s.value.toLowerCase().includes($filters.module.toLowerCase())) as suggestion}
                      <button on:click={() => selectModule(suggestion.value)}>
                        {suggestion.value} ({suggestion.count})
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </details>

            <details class="filters-accordion-item" open={$filters.level?.length > 0}>
              <summary>Niveau</summary>
              <div class="filters-field filters-field--accordion">
                <select
                  id="level-filter-mobile"
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
            </details>

            <details class="filters-accordion-item" open={$filters.difficulty?.length > 0 && $filters.difficulty !== ''}>
              <summary>Difficulté</summary>
              <div class="filters-field filters-field--accordion">
                <select
                  id="difficulty-filter-mobile"
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
            </details>

            <details class="filters-accordion-item" open={$filters.hasSolution !== '' && $filters.hasSolution !== null && $filters.hasSolution !== undefined}>
              <summary>Solution</summary>
              <div class="filters-field filters-field--accordion">
                <select
                  id="solution-filter-mobile"
                  bind:value={$filters.hasSolution}
                  on:change={handleDifficultyChange}
                  class="form-input"
                >
                  <option value="">Tous</option>
                  <option value="1">Avec solution</option>
                  <option value="0">Sans solution</option>
                </select>
              </div>
            </details>

            <details class="filters-accordion-item" open={$filters.hasIndication !== '' && $filters.hasIndication !== null && $filters.hasIndication !== undefined}>
              <summary>Indication</summary>
              <div class="filters-field filters-field--accordion">
                <select
                  id="indication-filter-mobile"
                  bind:value={$filters.hasIndication}
                  on:change={handleDifficultyChange}
                  class="form-input"
                >
                  <option value="">Tous</option>
                  <option value="1">Avec indication</option>
                  <option value="0">Sans indication</option>
                </select>
              </div>
            </details>

            <details class="filters-accordion-item" open={$filters.author?.length > 0}>
              <summary>Auteur</summary>
              <div class="filters-field filters-field--accordion">
                <input
                  id="author-filter-mobile"
                  type="text"
                  bind:value={$filters.author}
                  on:input={handleAuthorInput}
                  on:blur={handleAuthorBlur}
                  placeholder="Nom de l'auteur..."
                  class="form-input"
                />
                {#if showAuthorSuggestions && $suggestions.authors.length > 0}
                  <div class="filters-suggestions">
                    {#each $suggestions.authors.filter(s => s.value.toLowerCase().includes($filters.author.toLowerCase())) as suggestion}
                      <button on:click={() => selectAuthor(suggestion.value)}>
                        {suggestion.value} ({suggestion.count})
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </details>
          </div>

          <div class="filters-grid filters-grid--desktop hidden md:grid">
            <div class="filters-field">
              <label for="module-filter">Module</label>
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
                <div class="filters-suggestions">
                  {#each $suggestions.modules.filter(s => s.value.toLowerCase().includes($filters.module.toLowerCase())) as suggestion}
                    <button on:click={() => selectModule(suggestion.value)}>
                      {suggestion.value} ({suggestion.count})
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="filters-field">
              <label for="level-filter">Niveau</label>
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

            <div class="filters-field">
              <label for="difficulty-filter">Difficulté</label>
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

            <div class="filters-field">
              <label for="solution-filter">Solution</label>
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

            <div class="filters-field">
              <label for="indication-filter">Indication</label>
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

            <div class="filters-field">
              <label for="author-filter">Auteur</label>
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
                <div class="filters-suggestions">
                  {#each $suggestions.authors.filter(s => s.value.toLowerCase().includes($filters.author.toLowerCase())) as suggestion}
                    <button on:click={() => selectAuthor(suggestion.value)}>
                      {suggestion.value} ({suggestion.count})
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </section>
      </div>
      <div class="filters-footer">
        <button type="button" class="btn btn-text text-sm text-blue-600" on:click={searchActions.clearAllFilters}>
          Effacer tous les filtres
        </button>
        <button type="button" class="btn btn-secondary" on:click={closeFilters}>
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}

{#if $previewState.isOpen && $layoutState.previewPanelVisible}
  <button
    type="button"
    class="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50"
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

<style>
  .hero-inner { display:flex; flex-direction:column; align-items:center; gap:1.5rem; }
  @media (min-width:1024px) {
    .hero-inner { flex-direction:row; align-items:center; justify-content:flex-start; }
  }

  .toolbar-search { min-width:0; }
  .toolbar-buttons { justify-content:flex-start; }
  .toolbar-button { display:inline-flex; align-items:center; gap:0.5rem; white-space:nowrap; }

  .breadcrumb-bar { background:#f9fafb; border:1px solid #e5e7eb; border-radius:0.75rem; padding:0.75rem 1rem; }
  .breadcrumb-path { display:flex; align-items:center; gap:0.5rem; font-size:0.95rem; color:#374151; }
  .breadcrumb-actions { display:flex; gap:0.75rem; align-items:center; justify-content:flex-end; }
  .breadcrumb-icon { font-size:1rem; }

  .chips-row button { min-height:2.25rem; }

  .content-layout { align-items:stretch; }
  .results-section { width:100%; }
  @media (min-width:1024px) {
    .results-section { width: var(--layout-results-width, 100%); }
  }
  .preview-section { border-left:1px solid #e5e7eb; width:100%; }
  @media (min-width:1024px) {
    .preview-section { width: var(--layout-preview-width, 400px); }
  }
  .preview-sticky { position:sticky; top:2rem; height:calc(100vh - 4rem); }

  .filters-overlay { position:fixed; inset:0; background:rgba(17,24,39,0.5); z-index:70; display:flex; align-items:flex-start; justify-content:center; padding:1.5rem; overflow-y:auto; }
  .filters-panel { background:#fff; border-radius:1rem; max-width:960px; width:100%; box-shadow:0 20px 45px rgba(15,23,42,0.2); display:flex; flex-direction:column; gap:1.5rem; padding:1.5rem; position:relative; }
  .filters-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .filters-header h2 { font-size:1.25rem; font-weight:600; color:#111827; }
  .filters-close { color:#111827; background:#f3f4f6; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; cursor:pointer; transition:background-color .2s ease; }
  .filters-close:hover { background:#e5e7eb; }
  .filters-body { display:flex; flex-direction:column; gap:2rem; }
  .filters-section { display:flex; flex-direction:column; gap:1rem; }
  .filters-section h3 { font-size:1rem; font-weight:600; color:#1f2937; }
  .filters-section-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .filters-navigation-desktop {
    display:none;
    border:1px solid #e5e7eb;
    border-radius:0.75rem;
    padding:1rem;
    max-height:24rem;
    overflow:auto;
    background:#f9fafb;
  }

  .filters-navigation-mobile {
    display:block;
    border:1px solid #e5e7eb;
    border-radius:0.75rem;
    padding:1rem;
    background:#f9fafb;
  }

  .filters-accordion { display:flex; flex-direction:column; gap:0.75rem; }
  .filters-accordion-item { border:1px solid #e5e7eb; border-radius:0.75rem; background:#fff; overflow:hidden; }
  .filters-accordion-item summary { list-style:none; padding:0.75rem 1rem; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:space-between; color:#1f2937; }
  .filters-accordion-item summary::-webkit-details-marker { display:none; }
  .filters-accordion-item[open] summary { background:#f3f4f6; }
  .filters-accordion-item summary::after { content:'+'; font-size:1.25rem; line-height:1; color:#6b7280; transition:transform .2s ease, color .2s ease; }
  .filters-accordion-item[open] summary::after { content:'–'; color:#2563eb; }
  .filters-field--accordion { padding:0 1rem 1rem; }

  .filters-grid { grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; }

  @media (min-width:768px) {
    .filters-navigation-desktop { display:block; }
    .filters-navigation-mobile { display:none; }
    .filters-accordion { display:none; }
  }
  .filters-field { display:flex; flex-direction:column; gap:0.5rem; position:relative; }
  .filters-field label { font-size:0.875rem; font-weight:500; color:#374151; }
  .filters-suggestions { position:absolute; z-index:10; left:0; right:0; top:100%; margin-top:0.25rem; background:#fff; border:1px solid #e5e7eb; border-radius:0.5rem; box-shadow:0 10px 30px rgba(15,23,42,0.1); max-height:12rem; overflow:auto; }
  .filters-suggestions button { width:100%; text-align:left; padding:0.5rem 0.75rem; font-size:0.875rem; color:#1f2937; background:transparent; border:none; }
  .filters-suggestions button:hover { background:#eef2ff; }
  .filters-footer { display:flex; flex-direction:column; gap:1rem; align-items:flex-end; }
  @media (min-width:640px) {
    .filters-footer { flex-direction:row; justify-content:flex-end; }
  }

  .toolbar-buttons .btn { min-height:2.5rem; }

  .search-input { width: 100%; padding: 0.75rem 3rem 0.75rem 2.5rem; font-size: 1.125rem; border: 1px solid rgb(209 213 219); border-radius: 0.75rem; transition: all .2s ease; }
  .search-input:focus { outline: none; box-shadow: 0 0 0 2px rgb(59 130 246 / 0.5); border-color: transparent; }
  .search-loading { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); }
  .search-spinner { border-bottom: 2px solid rgb(37 99 235); border-radius: 9999px; width: 1.25rem; height: 1.25rem; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg);} }

  .search-error { margin-top: 0.5rem; padding: 0.75rem; background: rgb(254 242 242); border: 1px solid rgb(254 202 202); border-radius: 0.5rem; }
  .search-error-text { color: rgb(220 38 38); font-size: 0.875rem; }

  .results-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .results-title { font-size: 1.25rem; font-weight: 600; color: rgb(17 24 39); }
  .results-grid { display: grid; gap: 1rem; }
  .chip { padding: 0.5rem 0.75rem; font-size:0.875rem; border-radius: 9999px; background:#f3f4f6; color:#374151; border:1px solid #e5e7eb; transition: background-color .2s; }
  .chip:hover { background:#e5e7eb; }
  .chip--on { background:#dcfce7; color:#166534; border-color:#bbf7d0; }
  .chip--off { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
  .result-card { background: white; border-radius: 0.75rem; border: 1px solid rgb(229 231 235); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); padding: 1.5rem; transition: box-shadow .2s; }
  .result-card:hover { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06); }
  .result-card--selected { border-color: rgb(59 130 246); background: rgb(239 246 255); box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
  .result-header { display: flex; align-items: start; justify-content: space-between; }
  .result-title { font-size: 1.125rem; font-weight: 500; color: rgb(17 24 39); margin-bottom: 0.5rem; }
  .result-metadata { display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; color: rgb(75 85 99); margin-bottom: 0.5rem; flex-wrap: wrap; }
  .result-badge { background: rgb(243 244 246); padding: 0.25rem 0.5rem; border-radius: 0.375rem; }
  .result-preview div { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .result-preview .katex { font-size: 0.875rem !important; }
  .result-preview .katex-display { margin: 0.25rem 0 !important; }
  .result-footer { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f3f4f6; display:flex; gap:0.5rem; flex-wrap:wrap; color:#6b7280; font-size:0.875rem; }
  .result-footer-item { white-space: nowrap; }
  .result-footer-sep { color:#d1d5db; }
  .selection-indicator { width: 1.5rem; height: 1.5rem; background: rgb(219 234 254); border-radius: 9999px; display: flex; align-items: center; justify-content: center; }
  .external-link-btn { color: rgb(156 163 175); transition: color .2s, background-color .2s; padding: 0.25rem; border-radius: 0.25rem; }
  .external-link-btn:hover { color: rgb(37 99 235); background: rgb(239 246 255); }

  .empty-state { text-align: center; padding: 3rem 1.5rem; border: 1px dashed #d1d5db; border-radius: 1rem; background:#f9fafb; }
  .empty-state-title { font-size:1.125rem; font-weight:600; color:#111827; margin-bottom:0.5rem; }
  .empty-state-subtitle { color:#6b7280; font-size:0.95rem; }
</style>
