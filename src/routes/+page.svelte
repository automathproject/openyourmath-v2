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
    breadcrumb,
    filterCounts
  } from '$lib/stores/searchStore.js';

  import { useDebounce } from '$lib/hooks/useDebounce.js';

  let showAuthorSuggestions = false;
  let showModuleSuggestions = false;
  let isFilterPanelOpen = false;
  let isDesktop = false;
  let showFilterMenu = false;
  let filterMenuCategory = null;
  let authorSearch = '';

  const filterMenuCategories = [
    { id: 'content', icon: '📚', label: 'Contenu' },
    { id: 'level', icon: '🎓', label: 'Niveau académique' },
    { id: 'properties', icon: '✅', label: 'Propriétés' },
    { id: 'author', icon: '👤', label: 'Auteur' }
  ];

  const debouncedSearch = useDebounce(searchActions.search, 300);

  onMount(() => {
    suggestionActions.loadSuggestions();

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(min-width: 1024px)');

      const applyViewportState = (matches) => {
        isDesktop = matches;
        if (matches) {
          isFilterPanelOpen = true;
          closeFilterMenu();
          showAuthorSuggestions = false;
          showModuleSuggestions = false;
        } else {
          closeFilters();
        }
      };

      applyViewportState(mediaQuery.matches);
      const handleChange = (event) => applyViewportState(event.matches);
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
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

  function formatDifficultyLabel(value) {
    if (value === null || value === undefined || value === '') return '';
    if (value === 'null') return 'Sans difficulté';
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return '★'.repeat(Math.min(numeric, 5));
    }
    return String(value);
  }

  function getCategoryLabel(id) {
    const match = filterMenuCategories.find((item) => item.id === id);
    return match ? match.label : 'Ajouter un filtre';
  }

  function buildOptions(baseList, counts, activeValue, formatLabel, preferCountsOnly = false) {
    const options = [];
    const seen = new Set();

    (baseList || []).forEach((item) => {
      const value = item.value ?? item;
      if (!value && value !== 0) return;
      const key = String(value);
      const hasCounts = counts && Object.prototype.hasOwnProperty.call(counts, key);
      const count = preferCountsOnly
        ? (hasCounts ? counts[key] : 0)
        : (hasCounts ? counts[key] : item.count ?? 0);
      options.push({
        value: key,
        count,
        active: String(activeValue ?? '') === key,
        label: formatLabel ? formatLabel(key) : key
      });
      seen.add(key);
    });

    if (counts) {
      Object.entries(counts).forEach(([key, count]) => {
        if (!key || seen.has(key)) return;
        options.push({
          value: key,
          count,
          active: String(activeValue ?? '') === key,
          label: formatLabel ? formatLabel(key) : key
        });
      });
    }

    options.sort((a, b) => a.value.localeCompare(b.value, 'fr', { sensitivity: 'base' }));
    return options;
  }

  $: moduleCounts = $filterCounts.module || {};
  $: levelCounts = $filterCounts.level || {};
  $: difficultyCounts = $filterCounts.difficulty || {};
  $: authorCounts = $filterCounts.author || {};

  $: useResultFilterCounts = $hasActiveFilters;

  $: moduleOptions = buildOptions(
    $suggestions.modules || [],
    moduleCounts,
    $filters.module,
    undefined,
    useResultFilterCounts
  );
  $: levelOptions = buildOptions(
    $suggestions.levels || [],
    levelCounts,
    $filters.level,
    undefined,
    useResultFilterCounts
  );

  $: difficultyOptions = buildOptions(
    $suggestions.difficulties || [],
    difficultyCounts,
    $filters.difficulty,
    formatDifficultyLabel,
    useResultFilterCounts
  );

  $: authorOptions = buildOptions(
    $suggestions.authors || [],
    authorCounts,
    $filters.author,
    undefined,
    useResultFilterCounts
  );
  $: filteredAuthors = authorOptions
    .filter((entry) => {
      const term = authorSearch.trim().toLowerCase();
      if (!term) return true;
      return entry.value.toLowerCase().includes(term);
    })
    .slice(0, 25);

  $: activeFilterChips = (() => {
    const chips = [];

    if ($filters.module) {
      chips.push({ key: 'module', label: $filters.module, icon: '📖', category: 'content' });
    }
    if ($filters.chapter) {
      chips.push({ key: 'chapter', label: $filters.chapter, icon: '📚', category: 'content' });
    }
    if ($filters.subchapter) {
      chips.push({ key: 'subchapter', label: $filters.subchapter, icon: '📑', category: 'content' });
    }
    if ($filters.level) {
      chips.push({ key: 'level', label: $filters.level, icon: '🎓', category: 'level' });
    }
    if ($filters.difficulty && $filters.difficulty !== '') {
      chips.push({ key: 'difficulty', label: formatDifficultyLabel($filters.difficulty), icon: '⭐', category: 'level' });
    }
    if ($filters.hasSolution === '1') {
      chips.push({ key: 'hasSolution', label: 'Avec solution', icon: '✅', category: 'properties' });
    } else if ($filters.hasSolution === '0') {
      chips.push({ key: 'hasSolution', label: 'Sans solution', icon: '🚫', category: 'properties' });
    }
    if ($filters.hasIndication === '1') {
      chips.push({ key: 'hasIndication', label: 'Avec indication', icon: '💡', category: 'properties' });
    } else if ($filters.hasIndication === '0') {
      chips.push({ key: 'hasIndication', label: 'Sans indication', icon: '🚫', category: 'properties' });
    }
    if ($filters.author) {
      chips.push({ key: 'author', label: $filters.author, icon: '👤', category: 'author' });
    }

    return chips;
  })();

  $: activeMenuFilters = {
    difficulty: $filters.difficulty ?? '',
    hasSolution: $filters.hasSolution ?? '',
    hasIndication: $filters.hasIndication ?? ''
  };

  function openFilterMenu(category = null) {
    showFilterMenu = true;
    authorSearch = $filters.author || '';
    handleFilterMenuCategory(category);
  }

  function handleFilterMenuCategory(id) {
    filterMenuCategory = id;
    if (id === 'author') {
      authorSearch = $filters.author || '';
    }
  }

  function closeFilterMenu() {
    showFilterMenu = false;
    filterMenuCategory = null;
    authorSearch = $filters.author || '';
  }

  function handleChipClick(chip) {
    openFilterMenu(chip.category || null);
  }

  function removeFilterChip(key) {
    switch (key) {
      case 'module':
        searchActions.updateFilter('module', '');
        searchActions.updateFilter('chapter', '');
        searchActions.updateFilter('subchapter', '');
        break;
      case 'chapter':
        searchActions.updateFilter('chapter', '');
        searchActions.updateFilter('subchapter', '');
        break;
      case 'subchapter':
        searchActions.updateFilter('subchapter', '');
        break;
      case 'level':
        searchActions.updateFilter('level', '');
        break;
      case 'difficulty':
        searchActions.updateFilter('difficulty', '');
        break;
      case 'hasSolution':
        searchActions.updateFilter('hasSolution', '');
        break;
      case 'hasIndication':
        searchActions.updateFilter('hasIndication', '');
        break;
      case 'author':
        searchActions.updateFilter('author', '');
        break;
      default:
        return;
    }
    searchActions.search();
  }

  function applyModuleFilter(value) {
    selectModule(value);
    closeFilterMenu();
  }

  function applyLevelFilter(value) {
    searchActions.updateFilter('level', value);
    searchActions.search();
    closeFilterMenu();
  }

  function applyDifficultyFilter(value) {
    searchActions.updateFilter('difficulty', value);
    searchActions.search();
    closeFilterMenu();
  }

  function applyPropertyFilter(key, value) {
    searchActions.updateFilter(key, value);
    searchActions.search();
    closeFilterMenu();
  }

  function applyAuthorFilter(value) {
    selectAuthor(value);
    closeFilterMenu();
  }

  function handleAuthorSearchInput(value) {
    authorSearch = value;
  }

  function applyAuthorSearch() {
    const value = authorSearch.trim();
    if (!value) return;
    applyAuthorFilter(value);
  }

  function handleKeyboardActivate(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }

  function toggleFiltersPanel() {
    if (isDesktop) {
      if (isFilterPanelOpen) {
        closeFilters();
      } else {
        isFilterPanelOpen = true;
      }
    } else {
      isFilterPanelOpen = true;
      closeFilterMenu();
    }
  }

  function closeFilters() {
    isFilterPanelOpen = false;
    showAuthorSuggestions = false;
    showModuleSuggestions = false;
    closeFilterMenu();
  }

  $: canTogglePreview = Boolean($previewState.selectedUuid);
  $: filtersButtonLabel = isDesktop
    ? isFilterPanelOpen
      ? 'Masquer les filtres'
      : 'Afficher les filtres'
    : 'Filtres';
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
    <div class="toolbar-actions flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">
      <button
        type="button"
        class="btn btn-secondary toolbar-button"
        on:click={toggleFiltersPanel}
        aria-expanded={isFilterPanelOpen}
      >
        🔧 {filtersButtonLabel}
      </button>
      <div class="toolbar-chips flex gap-2">
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
    </div>
  </div>

  <div class="content-layout flex flex-col gap-6 lg:flex-row">
    <aside
      class="filters-sidebar"
      class:filters-sidebar--open={!isDesktop && isFilterPanelOpen}
      class:filters-sidebar--closed={isDesktop && !isFilterPanelOpen}
      aria-label="Filtres de recherche"
    >
      <div class="filters-panel" role="region" aria-label="Panneau de filtres">
        <div class="filters-header">
          <h3>Filtres</h3>
          <div class="filters-header-actions">
            {#if $hasActiveFilters || !$breadcrumb.isEmpty}
              <button type="button" class="filters-reset" on:click={searchActions.clearAllFilters}>
                Réinitialiser
              </button>
            {/if}
            <button type="button" class="filters-close lg:hidden" on:click={closeFilters}>
              Fermer ✕
            </button>
          </div>
        </div>
        <div class="filters-body">
          <section class="filters-section">
            <div class="filters-section-header">
              {#if !$breadcrumb.isEmpty}
                <button type="button" class="filters-section-reset" on:click={clearHierarchyFilters}>
                  Réinitialiser la navigation
                </button>
              {/if}
            </div>
            <div class="filters-navigation">
              <ChapterNavigation
                class="filters-navigation-desktop"
                bind:selectedLevel={$filters.level}
                bind:selectedModule={$filters.module}
                bind:selectedChapter={$filters.chapter}
                bind:selectedSubchapter={$filters.subchapter}
                query={$searchQuery}
                activeFilters={$filters}
                on:navigate={handleChapterNavigation}
                compact={true}
              />
              <MobileChapterNav
                class="filters-navigation-mobile"
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
          </section>

          <section class="filters-section">
            <div class="filters-chips md:hidden" aria-live="polite">
              <div class="filters-chips-title">Filtres actifs</div>
              <div class="filters-chips-list">
                {#if activeFilterChips.length === 0}
                  <p class="filters-chips-empty">Aucun filtre actif</p>
                {:else}
                  {#each activeFilterChips as chip}
                    <button type="button" class="filters-chip" on:click={() => handleChipClick(chip)}>
                      <span class="filters-chip-label">{chip.icon} {chip.label}</span>
                      <span
                        class="filters-chip-remove"
                        role="button"
                        tabindex="0"
                        aria-label={`Retirer ${chip.label}`}
                        on:click|stopPropagation={() => removeFilterChip(chip.key)}
                        on:keydown|stopPropagation={(event) =>
                          handleKeyboardActivate(event, () => removeFilterChip(chip.key))
                        }
                      >×</span>
                    </button>
                  {/each}
                {/if}
              </div>
              <button type="button" class="filters-add-chip" on:click={() => openFilterMenu()}>
                + Ajouter un filtre
              </button>
            </div>

            {#if showFilterMenu}
              <div
                class="filters-menu-overlay md:hidden"
                role="button"
                tabindex="0"
                aria-label="Fermer l'ajout de filtre"
                on:click={closeFilterMenu}
                on:keydown={(event) => handleKeyboardActivate(event, closeFilterMenu)}
              >
                <div
                  class="filters-menu"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Ajouter un filtre"
                  tabindex="0"
                  on:click|stopPropagation
                  on:keydown|stopPropagation
                >
                  <div class="filters-menu-header">
                    {#if filterMenuCategory}
                      <button type="button" class="filters-menu-back" on:click={() => handleFilterMenuCategory(null)}>
                        ← Catégories
                      </button>
                      <h4>{getCategoryLabel(filterMenuCategory)}</h4>
                    {:else}
                      <h4>Ajouter un filtre</h4>
                    {/if}
                    <button type="button" class="filters-menu-close" on:click={closeFilterMenu} aria-label="Fermer">✕</button>
                  </div>

                  <div class="filters-menu-body">
                    {#if !filterMenuCategory}
                      {#each filterMenuCategories as category}
                        <button type="button" class="filters-menu-category" on:click={() => handleFilterMenuCategory(category.id)}>
                          <div class="filters-menu-category-label">
                            <span class="filters-menu-category-icon">{category.icon}</span>
                            <span>{category.label}</span>
                          </div>
                          <span class="filters-menu-category-arrow">›</span>
                        </button>
                      {/each}
                    {:else if filterMenuCategory === 'content'}
                      <div class="filters-menu-section">
                        <h5>Module</h5>
                        {#if moduleOptions.length === 0}
                          <p class="filters-menu-empty">Aucun module disponible</p>
                        {:else}
                          <div class="filters-menu-options">
                            {#each moduleOptions as module (module.value)}
                              <button
                                type="button"
                                class="filters-menu-option {module.active ? 'filters-menu-option--active' : ''}"
                                on:click={() => applyModuleFilter(module.value)}
                              >
                                <span>{module.value}</span>
                                <span class="filters-menu-option-count">{module.count}</span>
                              </button>
                            {/each}
                          </div>
                        {/if}
                        <p class="filters-menu-helper">Utilisez la navigation hiérarchique pour choisir un chapitre précis.</p>
                      </div>
                    {:else if filterMenuCategory === 'level'}
                      <div class="filters-menu-section">
                        <h5>Niveau</h5>
                        {#if levelOptions.length === 0}
                          <p class="filters-menu-empty">Aucun niveau disponible</p>
                        {:else}
                          <div class="filters-menu-options">
                            {#each levelOptions as level (level.value)}
                              <button
                                type="button"
                                class="filters-menu-option {level.active ? 'filters-menu-option--active' : ''}"
                                on:click={() => applyLevelFilter(level.value)}
                              >
                                <span>{level.value}</span>
                                <span class="filters-menu-option-count">{level.count}</span>
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <div class="filters-menu-section">
                        <h5>Difficulté</h5>
                        <div class="filters-menu-options">
                          <button
                            type="button"
                            class="filters-menu-option {activeMenuFilters.difficulty === '' ? 'filters-menu-option--active' : ''}"
                            on:click={() => applyDifficultyFilter('')}
                          >
                            <span>Toutes</span>
                          </button>
                          <button
                            type="button"
                            class="filters-menu-option {activeMenuFilters.difficulty === 'null' ? 'filters-menu-option--active' : ''}"
                            on:click={() => applyDifficultyFilter('null')}
                          >
                            <span>Sans difficulté</span>
                          </button>
                          {#if difficultyOptions.length === 0}
                            <p class="filters-menu-empty">Aucune difficulté disponible</p>
                          {:else}
                            {#each difficultyOptions as diff (diff.value)}
                              <button
                                type="button"
                                class="filters-menu-option {diff.active ? 'filters-menu-option--active' : ''}"
                                on:click={() => applyDifficultyFilter(diff.value)}
                              >
                                <span>{diff.label}</span>
                                <span class="filters-menu-option-count">{diff.count}</span>
                              </button>
                            {/each}
                          {/if}
                        </div>
                      </div>
                    {:else if filterMenuCategory === 'properties'}
                      <div class="filters-menu-section">
                        <h5>Solution</h5>
                        <div class="filters-menu-options">
                          <button
                            type="button"
                            class="filters-menu-option {activeMenuFilters.hasSolution === '1' ? 'filters-menu-option--active' : ''}"
                            on:click={() => applyPropertyFilter('hasSolution', '1')}
                          >
                            <span>✅ Avec solution</span>
                          </button>
                          <button
                            type="button"
                            class="filters-menu-option {activeMenuFilters.hasSolution === '0' ? 'filters-menu-option--active' : ''}"
                            on:click={() => applyPropertyFilter('hasSolution', '0')}
                          >
                            <span>🚫 Sans solution</span>
                          </button>
                        </div>
                      </div>
                      <div class="filters-menu-section">
                        <h5>Indication</h5>
                        <div class="filters-menu-options">
                          <button
                            type="button"
                            class="filters-menu-option {activeMenuFilters.hasIndication === '1' ? 'filters-menu-option--active' : ''}"
                            on:click={() => applyPropertyFilter('hasIndication', '1')}
                          >
                            <span>💡 Avec indication</span>
                          </button>
                          <button
                            type="button"
                            class="filters-menu-option {activeMenuFilters.hasIndication === '0' ? 'filters-menu-option--active' : ''}"
                            on:click={() => applyPropertyFilter('hasIndication', '0')}
                          >
                            <span>🚫 Sans indication</span>
                          </button>
                        </div>
                      </div>
                    {:else if filterMenuCategory === 'author'}
                      <div class="filters-menu-section">
                        <h5>Auteur</h5>
                        <div class="filters-menu-author">
                          <input
                            type="text"
                            class="filters-menu-author-input"
                            placeholder="Nom ou mot-clé"
                            value={authorSearch}
                            on:input={(event) => handleAuthorSearchInput(event.target.value)}
                            on:keydown={(event) => event.key === 'Enter' && applyAuthorSearch()}
                          />
                          <div class="filters-menu-author-actions">
                            <button
                              type="button"
                              class="filters-menu-apply"
                              on:click={applyAuthorSearch}
                              disabled={!authorSearch.trim()}
                            >
                              Appliquer
                            </button>
                          </div>
                        </div>
                        <div class="filters-menu-options">
                          {#if filteredAuthors.length === 0}
                            <p class="filters-menu-empty">Aucun auteur trouvé</p>
                          {:else}
                            {#each filteredAuthors as author (author.value)}
                              <button
                                type="button"
                                class="filters-menu-option {author.active ? 'filters-menu-option--active' : ''}"
                                on:click={() => applyAuthorFilter(author.value)}
                              >
                                <span>{author.value}</span>
                                <span class="filters-menu-option-count">{author.count}</span>
                              </button>
                            {/each}
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}

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
                {#if showModuleSuggestions && moduleOptions.length > 0}
                  <div class="filters-suggestions">
                    {#each moduleOptions.filter((option) => option.value.toLowerCase().includes(($filters.module || '').toLowerCase())) as option}
                      <button on:click={() => selectModule(option.value)}>
                        {option.value} ({option.count})
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
                  {#each levelOptions as level}
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
                  <option value="null">Sans difficulté ({difficultyCounts['null'] || 0})</option>
                  {#each difficultyOptions.filter((diff) => diff.value !== 'null') as diff}
                    <option value={diff.value}>{diff.label} ({diff.count})</option>
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
                {#if showAuthorSuggestions && authorOptions.length > 0}
                  <div class="filters-suggestions">
                    {#each authorOptions.filter((option) => option.value.toLowerCase().includes(($filters.author || '').toLowerCase())) as option}
                      <button on:click={() => selectAuthor(option.value)}>
                        {option.value} ({option.count})
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
          <button type="button" class="btn btn-secondary lg:hidden" on:click={closeFilters}>
            Fermer
          </button>
        </div>
      </div>
    </aside>

    {#if isFilterPanelOpen && !isDesktop}
      <div
        class="filters-backdrop"
        role="button"
        tabindex="0"
        aria-label="Fermer les filtres"
        on:click={closeFilters}
        on:keydown={(event) => handleKeyboardActivate(event, closeFilters)}
      ></div>
    {/if}

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
                  <h3 class="result-title">
                    <MathRenderer content={exercise.title} inline={true} />
                  </h3>
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
  .toolbar-actions { justify-content:flex-start; }
  @media (min-width:640px) {
    .toolbar-actions { justify-content:flex-end; }
  }
  .toolbar-button { display:inline-flex; align-items:center; gap:0.5rem; white-space:nowrap; }

  .breadcrumb-bar { background:#f9fafb; border:1px solid #e5e7eb; border-radius:0.75rem; padding:0.75rem 1rem; }
  .breadcrumb-path { display:flex; align-items:center; gap:0.5rem; font-size:0.95rem; color:#374151; }
  .breadcrumb-actions { display:flex; gap:0.75rem; align-items:center; justify-content:flex-end; }
  .breadcrumb-icon { font-size:1rem; }

  .toolbar-chips .chip { min-height:2.25rem; }

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

  .filters-sidebar { position:fixed; top:0; bottom:0; left:0; width:min(90vw, 22rem); max-width:22rem; padding:1rem; display:flex; flex-direction:column; transform:translateX(-110%); transition:transform 0.25s ease-in-out; z-index:80; pointer-events:none; }
  .filters-sidebar--open { transform:translateX(0); pointer-events:auto; }
  .filters-sidebar--closed { display:none; }
  .filters-backdrop { position:fixed; inset:0; background:rgba(17,24,39,0.45); z-index:70; }
  .filters-panel { background:#fff; border-radius:1rem; width:100%; box-shadow:0 20px 45px rgba(15,23,42,0.2); display:flex; flex-direction:column; gap:1.25rem; padding:1.25rem; max-height:calc(100vh - 2.5rem); overflow-y:auto; }
  .filters-header { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; }
  .filters-header-actions { display:flex; align-items:center; gap:0.5rem; }
  .filters-reset { padding:0.3rem 0.6rem; border:1px solid #d1d5db; border-radius:0.5rem; background:#f9fafb; color:#1d4ed8; font-size:0.85rem; font-weight:500; cursor:pointer; }
  .filters-reset:hover { background:#eef2ff; }
  .filters-header h3 { font-size:1.15rem; font-weight:600; color:#111827; }
  .filters-close { color:#111827; background:#f3f4f6; border:1px solid #d1d5db; border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; cursor:pointer; transition:background-color .2s ease; }
  .filters-close:hover { background:#e5e7eb; }
  .filters-body { display:flex; flex-direction:column; gap:1.25rem; }
  .filters-section { display:flex; flex-direction:column; gap:0.75rem; }
  .filters-section h3 { font-size:1rem; font-weight:600; color:#1f2937; }
  .filters-section-header { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; }
  .filters-section-reset { padding:0.3rem 0.4rem; background:none; border:none; color:#2563eb; font-size:0.85rem; font-weight:500; cursor:pointer; }
  .filters-section-reset:hover { text-decoration:underline; }
  .filters-navigation { border:1px solid #e5e7eb; border-radius:0.75rem; padding:0.75rem; background:#f9fafb; }

  .filters-chips { border:1px solid #e5e7eb; border-radius:0.75rem; background:#f9fafb; padding:0.75rem; display:flex; flex-direction:column; gap:0.6rem; }
  .filters-chips-title { font-weight:600; color:#1f2937; font-size:0.9rem; }
  .filters-chips-list { display:flex; flex-wrap:wrap; gap:0.4rem; }
  .filters-chips-empty { font-size:0.875rem; color:#6b7280; }
  .filters-chip { display:inline-flex; align-items:center; gap:0.5rem; padding:0.45rem 0.75rem; border-radius:9999px; border:1px solid #d1d5db; background:#fff; box-shadow:0 1px 2px rgba(15,23,42,0.08); font-size:0.85rem; color:#1f2937; cursor:pointer; }
  .filters-chip:hover { background:#f3f4f6; }
  .filters-chip-label { display:flex; align-items:center; gap:0.35rem; }
  .filters-chip-remove { display:inline-flex; align-items:center; justify-content:center; width:1.25rem; height:1.25rem; border-radius:9999px; background:#e5e7eb; color:#374151; font-weight:600; cursor:pointer; }
  .filters-chip-remove:hover { background:#d1d5db; }
  .filters-add-chip { align-self:flex-start; display:inline-flex; align-items:center; gap:0.3rem; padding:0.45rem 0.8rem; border-radius:0.75rem; border:1px dashed #94a3b8; background:#fff; color:#1f2937; font-weight:500; cursor:pointer; }
  .filters-add-chip:hover { background:#f8fafc; }

  @media (min-width:1024px) {
    .filters-sidebar { position:sticky; top:1.5rem; align-self:flex-start; transform:none; pointer-events:auto; padding:0; width:min(22rem, 100%); max-width:22rem; z-index:auto; display:block; }
    .filters-sidebar--closed { display:none; }
    .filters-panel { box-shadow:none; border:1px solid #e5e7eb; max-height:calc(100vh - 3rem); }
  }

  .filters-menu-overlay { position:fixed; inset:0; z-index:90; display:flex; align-items:flex-end; justify-content:center; background:rgba(17,24,39,0.45); padding:1rem; }
  .filters-menu { width:100%; max-width:24rem; background:#fff; border-radius:1rem 1rem 0 0; box-shadow:0 20px 45px rgba(15,23,42,0.25); padding:1rem 1.25rem 1.5rem; display:flex; flex-direction:column; gap:1rem; }
  .filters-menu-header { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; }
  .filters-menu-header h4 { font-size:1rem; font-weight:600; color:#111827; }
  .filters-menu-back { border:none; background:none; color:#2563eb; font-weight:600; display:inline-flex; align-items:center; gap:0.35rem; cursor:pointer; }
  .filters-menu-close { border:none; background:none; font-size:1.25rem; color:#6b7280; cursor:pointer; }
  .filters-menu-body { display:flex; flex-direction:column; gap:1rem; max-height:60vh; overflow-y:auto; padding-right:0.25rem; }
  .filters-menu-category { display:flex; align-items:center; justify-content:space-between; padding:0.75rem 0.5rem; border-bottom:1px solid #e5e7eb; font-weight:500; color:#1f2937; background:none; border:none; text-align:left; cursor:pointer; }
  .filters-menu-category:hover { background:#f3f4f6; }
  .filters-menu-category:last-child { border-bottom:none; }
  .filters-menu-category-label { display:flex; align-items:center; gap:0.65rem; }
  .filters-menu-category-icon { font-size:1.1rem; }
  .filters-menu-category-arrow { font-size:1rem; color:#9ca3af; }
  .filters-menu-section { display:flex; flex-direction:column; gap:0.75rem; }
  .filters-menu-section h5 { font-weight:600; color:#1f2937; font-size:0.95rem; }
  .filters-menu-options { display:flex; flex-direction:column; gap:0.5rem; }
  .filters-menu-option { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.6rem 0.75rem; border:1px solid #e5e7eb; border-radius:0.5rem; background:#fff; font-size:0.95rem; color:#1f2937; cursor:pointer; }
  .filters-menu-option:hover { background:#f3f4f6; }
  .filters-menu-option--active { border-color:#2563eb; background:#eff6ff; color:#1d4ed8; }
  .filters-menu-option-count { font-size:0.85rem; color:#6b7280; }
  .filters-menu-helper { font-size:0.8rem; color:#6b7280; margin-top:-0.1rem; }
  .filters-menu-author { display:flex; flex-direction:column; gap:0.75rem; }
  .filters-menu-author-input { width:100%; padding:0.6rem 0.75rem; border:1px solid #d1d5db; border-radius:0.5rem; }
  .filters-menu-author-actions { display:flex; gap:0.5rem; }
  .filters-menu-apply { flex:1; padding:0.6rem 0.75rem; border:none; border-radius:0.5rem; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; }
  .filters-menu-apply:disabled { background:#c7d2fe; color:#1f2937; cursor:not-allowed; }
  .filters-menu-empty { font-size:0.85rem; color:#6b7280; text-align:center; }

  .filters-grid { grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem; }

  @media (min-width:768px) {
    .filters-navigation { border:none; border-radius:0; padding:0; background:transparent; }
    .filters-navigation-desktop { display:block; }
    .filters-navigation-mobile { display:none; }
    .filters-accordion { display:none; }
  }
  .filters-field { display:flex; flex-direction:column; gap:0.4rem; position:relative; }
  .filters-field label { font-size:0.875rem; font-weight:500; color:#374151; }
  .filters-suggestions { position:absolute; z-index:10; left:0; right:0; top:100%; margin-top:0.25rem; background:#fff; border:1px solid #e5e7eb; border-radius:0.5rem; box-shadow:0 10px 30px rgba(15,23,42,0.1); max-height:12rem; overflow:auto; }
  .filters-suggestions button { width:100%; text-align:left; padding:0.5rem 0.75rem; font-size:0.875rem; color:#1f2937; background:transparent; border:none; }
  .filters-suggestions button:hover { background:#eef2ff; }
  .filters-footer { display:flex; flex-direction:column; gap:1rem; align-items:flex-end; }
  @media (min-width:640px) {
    .filters-footer { flex-direction:row; justify-content:flex-end; }
  }

  .toolbar-actions .btn { min-height:2.5rem; }

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
