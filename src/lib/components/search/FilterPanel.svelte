<script>
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MobileChapterNav from '$lib/components/MobileChapterNav.svelte';
  import FilterChips from '$lib/components/search/FilterChips.svelte';
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

  function handleKeyboardActivate(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
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
                  <h4>{filterMenuCategories.find((item) => item.id === filterMenuCategory)?.label || 'Ajouter un filtre'}</h4>
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

  .filters-menu-overlay {
    position:fixed;
    inset:0;
    background:rgba(17,24,39,0.45);
    z-index:70;
    display:flex;
    align-items:flex-end;
    justify-content:center;
  }
  .filters-menu {
    width:100%;
    max-width:480px;
    max-height:80vh;
    border-radius:1rem 1rem 0 0;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    @apply bg-interface-bg-primary;
  }
  .filters-menu-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:1rem 1.25rem;
    @apply border-b border-gray-200;
  }
  .filters-menu-header h4 {
    font-size:1rem;
    font-weight:600;
    @apply text-interface-text-primary;
  }
  .filters-menu-close,
  .filters-menu-back {
    font-size:0.95rem;
    font-weight:500;
    @apply text-brand-primary;
  }
  .filters-menu-body {
    padding:1rem;
    overflow-y:auto;
    display:flex;
    flex-direction:column;
    gap:1rem;
  }
  .filters-menu-category {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0.75rem 1rem;
    border-radius:0.75rem;
    cursor:pointer;
    @apply bg-gray-100 text-gray-800;
  }
  .filters-menu-category-label { display:flex; align-items:center; gap:0.75rem; }
  .filters-menu-category-icon { font-size:1.25rem; }

  .filters-menu-section {
    display:flex;
    flex-direction:column;
    gap:0.75rem;
  }
  .filters-menu-section h5 {
    font-size:0.95rem;
    font-weight:600;
    @apply text-interface-text-primary;
  }
  .filters-menu-options {
    display:flex;
    flex-direction:column;
    gap:0.5rem;
  }
  .filters-menu-option {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0.6rem 0.85rem;
    border-radius:0.75rem;
    cursor:pointer;
    @apply bg-gray-100 text-gray-800;
  }
  .filters-menu-option--active {
    @apply bg-brand-50 border border-brand-200;
  }
  .filters-menu-option-count { font-size:0.85rem; @apply text-gray-500; }
  .filters-menu-empty {
    font-size:0.875rem;
    @apply text-interface-text-secondary;
  }
  .filters-menu-helper {
    font-size:0.8rem;
    @apply text-gray-500;
  }

  .filters-menu-author {
    display:flex;
    gap:0.5rem;
    align-items:center;
  }
  .filters-menu-author-input {
    flex:1;
    padding:0.6rem 0.75rem;
    border-radius:0.75rem;
    @apply border border-gray-300;
  }
  .filters-menu-author-actions { display:flex; align-items:center; }
  .filters-menu-apply {
    padding:0.5rem 0.9rem;
    border-radius:0.65rem;
    font-weight:500;
    @apply bg-brand-500 text-white;
  }

  .filters-grid {
    display:grid;
    gap:1rem;
    grid-template-columns:repeat(1, minmax(0, 1fr));
  }
  @media (min-width:1024px) {
    .filters-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
  }
  .filters-field {
    position:relative;
    display:flex;
    flex-direction:column;
    gap:0.5rem;
  }
  .filters-field label {
    font-size:0.85rem;
    font-weight:600;
    @apply text-interface-text-secondary;
  }
  .filters-field .form-input {
    width:100%;
    padding:0.6rem 0.75rem;
    border-radius:0.65rem;
    @apply border border-gray-300;
  }
  .filters-suggestions {
    position:absolute;
    top:100%;
    left:0;
    right:0;
    margin-top:0.25rem;
    border-radius:0.5rem;
    box-shadow:0 10px 30px rgba(15,23,42,0.1);
    max-height:12rem;
    overflow:auto;
    @apply bg-interface-bg-primary border border-gray-200;
  }
  .filters-suggestions button {
    width:100%;
    text-align:left;
    padding:0.5rem 0.75rem;
    font-size:0.875rem;
    background:transparent;
    border:none;
    @apply text-gray-800;
  }
  .filters-suggestions button:hover { @apply bg-brand-50; }

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
