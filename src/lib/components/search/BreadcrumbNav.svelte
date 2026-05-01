<script>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let query = '';
  export let filters = {};
  // Comptages issus des résultats courants (null = pas de recherche active → fallback structure).
  export let resultPathCounts = null;

  const dispatch = createEventDispatcher();

  let structure = [];
  let loading = false;
  let error = null;
  let openMenu = null;
  let containerEl;
  let menuEl;
  let lastKey = '';
  let debounceTimer;

  function buildFiltersKey() {
    return JSON.stringify({
      difficulty: filters?.difficulty || '',
      author: filters?.author || '',
      organization: filters?.organization || '',
      hasSolution: filters?.hasSolution ?? '',
      hasIndication: filters?.hasIndication ?? '',
      hasVideo: filters?.hasVideo ?? '',
      createdFrom: filters?.createdFrom || '',
      createdTo: filters?.createdTo || '',
      updatedFrom: filters?.updatedFrom || '',
      updatedTo: filters?.updatedTo || ''
    });
  }

  async function loadStructure() {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams();
      params.set('type', 'structure');
      // Ne pas envoyer la requête texte : les comptages sont basés sur les catégories
      // (indépendants du mode FTS/hybride pour éviter la divergence avec le vectoriel).
      if (filters?.difficulty) params.set('difficulty', String(filters.difficulty));
      if (filters?.author) params.set('author', filters.author);
      if (filters?.organization) params.set('organization', filters.organization);
      if (filters?.hasSolution !== '' && filters?.hasSolution !== undefined && filters?.hasSolution !== null) {
        params.set('hasSolution', String(filters.hasSolution));
      }
      if (filters?.hasIndication !== '' && filters?.hasIndication !== undefined && filters?.hasIndication !== null) {
        params.set('hasIndication', String(filters.hasIndication));
      }
      if (filters?.hasVideo !== '' && filters?.hasVideo !== undefined && filters?.hasVideo !== null) {
        params.set('hasVideo', String(filters.hasVideo));
      }
      if (filters?.createdFrom) params.set('createdFrom', filters.createdFrom);
      if (filters?.createdTo) params.set('createdTo', filters.createdTo);
      if (filters?.updatedFrom) params.set('updatedFrom', filters.updatedFrom);
      if (filters?.updatedTo) params.set('updatedTo', filters.updatedTo);

      const response = await fetch(`/api/chapters?${params.toString()}`);
      if (!response.ok) throw new Error('Impossible de charger la hiérarchie');
      const data = await response.json();
      structure = data.structure || [];
    } catch (err) {
      console.error(err);
      error = 'Erreur de chargement de la navigation';
      structure = [];
    } finally {
      loading = false;
    }
  }

  function handleOutsideClick(event) {
    if (!containerEl) return;
    if (!containerEl.contains(event.target)) {
      openMenu = null;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleOutsideClick, true);
    loadStructure();
  });

  onDestroy(() => {
    document.removeEventListener('click', handleOutsideClick, true);
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  $: if (browser) {
    const key = buildFiltersKey();
    if (key !== lastKey) {
      lastKey = key;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadStructure, 250);
    }
  }

  // Quand resultPathCounts est disponible, les comptages viennent des résultats de recherche
  // (FTS + vectoriel). Sinon, fallback sur les totaux de la structure.
  // Les options à 0 sont masquées quand on est en mode recherche active.
  $: levelOptions = structure
    .map((level) => ({
      name: level.name,
      count: resultPathCounts
        ? (resultPathCounts.levels[level.name] ?? 0)
        : level.exerciseCount
    }))
    .filter((opt) => !resultPathCounts || opt.count > 0);

  $: selectedLevelObj = structure.find((level) => level.name === (filters?.level || ''));

  $: moduleOptions = (selectedLevelObj?.modules || [])
    .map((mod) => ({
      name: mod.name,
      count: resultPathCounts
        ? (resultPathCounts.modules[`${filters?.level || ''}|${mod.name}`] ?? 0)
        : mod.exerciseCount
    }))
    .filter((opt) => !resultPathCounts || opt.count > 0);

  $: selectedModuleObj = selectedLevelObj?.modules?.find((mod) => mod.name === (filters?.module || ''));

  $: chapterOptions = (selectedModuleObj?.chapters || [])
    .map((ch) => ({
      name: ch.name,
      count: resultPathCounts
        ? (resultPathCounts.chapters[`${filters?.level || ''}|${filters?.module || ''}|${ch.name}`] ?? 0)
        : ch.exerciseCount
    }))
    .filter((opt) => !resultPathCounts || opt.count > 0);

  $: selectedChapterObj = selectedModuleObj?.chapters?.find((ch) => ch.name === (filters?.chapter || ''));

  $: subchapterOptions = (selectedChapterObj?.subchapters || [])
    .map((sc) => ({
      name: sc.name,
      count: resultPathCounts
        ? (resultPathCounts.subchapters[`${filters?.level || ''}|${filters?.module || ''}|${filters?.chapter || ''}|${sc.name}`] ?? 0)
        : sc.exerciseCount
    }))
    .filter((opt) => !resultPathCounts || opt.count > 0);

  function toggleMenu(menuId) {
    openMenu = openMenu === menuId ? null : menuId;
  }

  function applyPath(level, module, chapter, subchapter) {
    openMenu = null;
    dispatch('navigate', {
      level: level || '',
      module: module || '',
      chapter: chapter || '',
      subchapter: subchapter || ''
    });
  }

  function chooseLevel(levelName) {
    applyPath(levelName, '', '', '');
  }

  function chooseModule(moduleName) {
    applyPath(filters?.level || '', moduleName, '', '');
  }

  function chooseChapter(chapterName) {
    applyPath(filters?.level || '', filters?.module || '', chapterName, '');
  }

  function chooseSubchapter(subchapterName) {
    applyPath(filters?.level || '', filters?.module || '', filters?.chapter || '', subchapterName);
  }
</script>

<div class="breadcrumb-nav" bind:this={containerEl}>
  <div class="breadcrumb-row">
    <button type="button" class="crumb-btn" on:click={() => toggleMenu('level')}>
      {filters?.level || 'Niveau'} <span class="crumb-caret">▾</span>
    </button>
    <span class="crumb-sep">›</span>
    <button type="button" class="crumb-btn" on:click={() => toggleMenu('module')} disabled={!filters?.level}>
      {filters?.module || 'Module'} <span class="crumb-caret">▾</span>
    </button>
    <span class="crumb-sep">›</span>
    <button type="button" class="crumb-btn" on:click={() => toggleMenu('chapter')} disabled={!filters?.module}>
      {filters?.chapter || 'Chapitre'} <span class="crumb-caret">▾</span>
    </button>
    <span class="crumb-sep">›</span>
    <button type="button" class="crumb-btn" on:click={() => toggleMenu('subchapter')} disabled={!filters?.chapter}>
      {filters?.subchapter || 'Sous-chapitre'} <span class="crumb-caret">▾</span>
    </button>
  </div>

  {#if openMenu}
    <div class="crumb-menu" bind:this={menuEl} role="menu">
      {#if loading}
        <p class="crumb-empty">Chargement…</p>
      {:else if error}
        <p class="crumb-empty">{error}</p>
      {:else if openMenu === 'level'}
        {#if levelOptions.length === 0}
          <p class="crumb-empty">Aucun niveau</p>
        {:else}
          {#each levelOptions as option}
            <button type="button" class="crumb-item" on:click={() => chooseLevel(option.name)}>
              {option.name} ({option.count})
            </button>
          {/each}
        {/if}
      {:else if openMenu === 'module'}
        {#if moduleOptions.length === 0}
          <p class="crumb-empty">Aucun module</p>
        {:else}
          {#each moduleOptions as option}
            <button type="button" class="crumb-item" on:click={() => chooseModule(option.name)}>
              {option.name} ({option.count})
            </button>
          {/each}
        {/if}
      {:else if openMenu === 'chapter'}
        {#if chapterOptions.length === 0}
          <p class="crumb-empty">Aucun chapitre</p>
        {:else}
          {#each chapterOptions as option}
            <button type="button" class="crumb-item" on:click={() => chooseChapter(option.name)}>
              {option.name} ({option.count})
            </button>
          {/each}
        {/if}
      {:else if openMenu === 'subchapter'}
        {#if subchapterOptions.length === 0}
          <p class="crumb-empty">Aucun sous-chapitre</p>
        {:else}
          {#each subchapterOptions as option}
            <button type="button" class="crumb-item" on:click={() => chooseSubchapter(option.name)}>
              {option.name} ({option.count})
            </button>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .breadcrumb-nav {
    position: relative;
    z-index: 45;
    margin-bottom: 1rem;
    border-radius: 0.75rem;
    padding: 0.7rem 0.9rem;
    @apply border border-gray-200 bg-gray-50;
  }
  .breadcrumb-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    overflow-x: auto;
    white-space: nowrap;
  }
  .crumb-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0.6rem;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    @apply bg-white border border-gray-300 text-gray-800;
  }
  .crumb-btn:hover:enabled { @apply bg-gray-100; }
  .crumb-btn:disabled { @apply opacity-50 cursor-not-allowed; }
  .crumb-caret { font-size: 0.75rem; @apply text-gray-500; }
  .crumb-sep { @apply text-gray-400; }

  .crumb-menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    min-width: 16rem;
    max-height: 16rem;
    overflow-y: auto;
    border-radius: 0.75rem;
    padding: 0.35rem;
    z-index: 60;
    @apply border border-gray-200 bg-white shadow-lg;
  }
  .crumb-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-radius: 0.5rem;
    font-size: 0.88rem;
    @apply text-gray-700;
  }
  .crumb-item:hover { @apply bg-gray-100; }
  .crumb-empty {
    padding: 0.6rem;
    font-size: 0.86rem;
    @apply text-gray-500;
  }
</style>
