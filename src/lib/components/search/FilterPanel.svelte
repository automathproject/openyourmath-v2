<script>
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '$lib/components/MobileChapterNav.svelte';
  import FilterChips from '$lib/components/search/FilterChips.svelte';
  import FilterGrid from '$lib/components/search/FilterGrid.svelte';
  import FilterMenu from '$lib/components/search/FilterMenu.svelte';
  import {
    filters,
    filterCounts,
    hasActiveFilters,
    searchActions,
    searchQuery,
    suggestions,
    breadcrumb
  } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel, buildOptions } from '$lib/utils/filterUtils.js';

  export let isDesktop = false;
  export let isFilterPanelOpen = false;
  export let closeFilters = () => {};
  export let clearHierarchyFilters = () => {};
  export let handleChapterNavigation = () => {};

  const filterMenuCategories = [
    { id: 'content', icon: '📚', label: 'Contenu' },
    { id: 'level', icon: '🎓', label: 'Niveau académique' },
    { id: 'properties', icon: '✅', label: 'Propriétés' },
    { id: 'author', icon: '👤', label: 'Auteur' }
  ];

  let showAuthorSuggestions = false;
  let showModuleSuggestions = false;
  let showFilterMenu = false;
  let filterMenuCategory = null;
  let authorSearch = '';
  let filtersValues = {};

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
    if ($filters.hasVideo === '1') {
      chips.push({ key: 'hasVideo', label: 'Avec vidéo', icon: '📺', category: 'properties' });
    } else if ($filters.hasVideo === '0') {
      chips.push({ key: 'hasVideo', label: 'Sans vidéo', icon: '🚫', category: 'properties' });
    }
    if ($filters.author) {
      chips.push({ key: 'author', label: $filters.author, icon: '👤', category: 'author' });
    }

    return chips;
  })();

  $: activeMenuFilters = {
    difficulty: $filters.difficulty ?? '',
    hasSolution: $filters.hasSolution ?? '',
    hasIndication: $filters.hasIndication ?? '',
    hasVideo: $filters.hasVideo ?? ''
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
      case 'hasVideo':
        searchActions.updateFilter('hasVideo', '');
        break;
      case 'author':
        searchActions.updateFilter('author', '');
        break;
      default:
        return;
    }
    searchActions.search();
  }

  function selectModule(module) {
    searchActions.updateFilter('module', module);
    showModuleSuggestions = false;
    searchActions.search();
  }

  function selectAuthor(author) {
    searchActions.updateFilter('author', author);
    showAuthorSuggestions = false;
    searchActions.search();
  }

  function handleModuleInput(value) {
    showModuleSuggestions = true;
    searchActions.updateFilter('module', value);
  }

  function handleAuthorInput(value) {
    showAuthorSuggestions = true;
    searchActions.updateFilter('author', value);
  }

  function handleModuleBlur() {
    setTimeout(() => (showModuleSuggestions = false), 150);
  }

  function handleAuthorBlur() {
    setTimeout(() => (showAuthorSuggestions = false), 150);
  }

  function handleLevelChange(value) {
    searchActions.updateFilter('level', value);
    searchActions.search();
  }

  function handleDifficultyChange(value) {
    searchActions.updateFilter('difficulty', value);
    searchActions.search();
  }

  function handleSolutionChange(value) {
    searchActions.updateFilter('hasSolution', value);
    searchActions.search();
  }

  function handleIndicationChange(value) {
    searchActions.updateFilter('hasIndication', value);
    searchActions.search();
  }

  function handleVideoChange(value) {
    searchActions.updateFilter('hasVideo', value);
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

  $: if (!isFilterPanelOpen) {
    showAuthorSuggestions = false;
    showModuleSuggestions = false;
    closeFilterMenu();
  }

  $: if (isDesktop) {
    showFilterMenu = false;
    showAuthorSuggestions = false;
    showModuleSuggestions = false;
  }

  $: filtersValues = $filters;
</script>

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
        <FilterChips
          chips={activeFilterChips}
          on:chipSelect={(event) => handleChipClick(event.detail.chip)}
          on:chipRemove={(event) => removeFilterChip(event.detail.chip.key)}
          on:addFilter={() => openFilterMenu()}
        />
        <FilterMenu
          isOpen={showFilterMenu}
          categories={filterMenuCategories}
          activeCategory={filterMenuCategory}
          onClose={closeFilterMenu}
          onSelectCategory={handleFilterMenuCategory}
          moduleOptions={moduleOptions}
          levelOptions={levelOptions}
          difficultyOptions={difficultyOptions}
          activeMenuFilters={activeMenuFilters}
          filteredAuthors={filteredAuthors}
          authorSearch={authorSearch}
          onModuleSelect={applyModuleFilter}
          onLevelSelect={applyLevelFilter}
          onDifficultySelect={applyDifficultyFilter}
          onPropertySelect={applyPropertyFilter}
          onAuthorSelect={applyAuthorFilter}
          onAuthorSearchInput={handleAuthorSearchInput}
          onAuthorSearchSubmit={applyAuthorSearch}
        />

        <FilterGrid
          {filtersValues}
          {moduleOptions}
          {levelOptions}
          {difficultyOptions}
          difficultyCounts={difficultyCounts}
          authorOptions={authorOptions}
          showModuleSuggestions={showModuleSuggestions}
          showAuthorSuggestions={showAuthorSuggestions}
          onModuleInput={handleModuleInput}
          onModuleBlur={handleModuleBlur}
          onModuleSuggestionSelect={selectModule}
          onLevelChange={handleLevelChange}
          onDifficultyChange={handleDifficultyChange}
          onSolutionChange={handleSolutionChange}
          onIndicationChange={handleIndicationChange}
          onVideoChange={handleVideoChange}
          onAuthorInput={handleAuthorInput}
          onAuthorBlur={handleAuthorBlur}
          onAuthorSuggestionSelect={selectAuthor}
        />
      </section>
    </div>
    <div class="filters-footer">
      <button type="button" class="btn btn-text text-sm text-brand-primary" on:click={searchActions.clearAllFilters}>
        Effacer tous les filtres
      </button>
      <button type="button" class="btn btn-secondary lg:hidden" on:click={closeFilters}>
        Fermer
      </button>
    </div>
  </div>
</aside>

<style>
  .filters-sidebar {
    position:fixed;
    top:0;
    bottom:0;
    left:0;
    width:min(90vw, 22rem);
    max-width:22rem;
    padding:1rem;
    display:flex;
    flex-direction:column;
    transform:translateX(-110%);
    transition:transform 0.25s ease-in-out;
    z-index:80;
    pointer-events:none;
  }
  .filters-sidebar--open {
    transform:translateX(0);
    pointer-events:auto;
  }
  .filters-sidebar--closed {
    display:none;
  }
  @media (min-width:1024px) {
    .filters-sidebar {
      position:sticky;
      top:1.5rem;
      align-self:flex-start;
      transform:none;
      pointer-events:auto;
      padding:0;
      width:min(22rem, 100%);
      max-width:22rem;
      z-index:auto;
      display:block;
    }
    .filters-sidebar--closed {
      display:none;
    }
  }

  .filters-panel {
    border-radius:1rem;
    width:100%;
    box-shadow:0 20px 45px rgba(15,23,42,0.2);
    display:flex;
    flex-direction:column;
    gap:1.25rem;
    padding:1.25rem;
    max-height:calc(100vh - 2.5rem);
    overflow-y:auto;
    @apply bg-interface-bg-primary;
  }
  @media (min-width:1024px) {
    .filters-panel {
      box-shadow:none;
      max-height:calc(100vh - 3rem);
      @apply border border-gray-200;
    }
  }

  .filters-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.75rem;
  }
  .filters-header h3 {
    font-size:1.15rem;
    font-weight:600;
    @apply text-interface-text-primary;
  }
  .filters-header-actions {
    display:flex;
    align-items:center;
    gap:0.5rem;
  }
  .filters-reset {
    padding:0.3rem 0.6rem;
    font-size:0.85rem;
    font-weight:500;
    cursor:pointer;
    @apply border border-gray-300 rounded-md bg-gray-50 text-brand-primary transition-colors;
  }
  .filters-reset:hover { @apply bg-brand-50; }
  .filters-close {
    padding:0.4rem 0.65rem;
    font-size:0.85rem;
    font-weight:500;
    border-radius:0.5rem;
    @apply bg-gray-200 text-gray-800;
  }

  .filters-body {
    display:flex;
    flex-direction:column;
    gap:1.5rem;
  }
  .filters-section {
    display:flex;
    flex-direction:column;
    gap:1.25rem;
  }
  .filters-section-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.5rem;
  }
  .filters-section-reset {
    padding:0.3rem 0.4rem;
    background:none;
    border:none;
    font-size:0.85rem;
    font-weight:500;
    cursor:pointer;
    @apply text-brand-primary;
  }
  .filters-section-reset:hover { text-decoration:underline; }

  .filters-navigation {
    border-radius:0.75rem;
    padding:0.75rem;
    @apply border border-gray-200 bg-gray-50;
  }
  .filters-navigation-mobile { margin-top:1rem; }
  @media (min-width:768px) {
    .filters-navigation-mobile { display:none; }
  }
  .filters-navigation-desktop { display:none; }
  @media (min-width:768px) {
    .filters-navigation-desktop { display:block; }
  }

  .filters-footer {
    display:flex;
    flex-direction:column;
    gap:1rem;
    align-items:flex-end;
  }
  @media (min-width:640px) {
    .filters-footer {
      flex-direction:row;
      justify-content:flex-end;
    }
  }
</style>
