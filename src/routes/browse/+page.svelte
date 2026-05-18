<!-- src/routes/browse/+page.svelte - CORRIGÉ -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import Chip from '$lib/components/Chip.svelte';
  
  let chapterStructure = [];
  let selectedChapter = null;
  let selectedSubchapter = null;
  let selectedModule = null;
  let selectedLevel = null;
  let exercises = [];
  let loading = true;
  let exercisesLoading = false;
  let error = null;
  let sortBy = 'title';
  let sortOrder = 'asc';
  
  let selectionStats = {
    total: 0,
    byDifficulty: {},
    byModule: {},
    authors: []
  };
  
  $: pageTitle = (() => {
    const titleParts = [];
    if (selectedChapter) titleParts.push(selectedChapter);
    if (selectedModule) titleParts.push(selectedModule);
    if (selectedLevel) titleParts.push(selectedLevel);
    
    return titleParts.length > 0 
      ? `${titleParts.join(' • ')} - Parcourir les exercices - OpenYourMath`
      : 'Parcourir les exercices - OpenYourMath';
  })();
  
  onMount(async () => {
    await loadChapterStructure();
    
    const urlParams = $page.url.searchParams;
    const chapter = urlParams.get('chapter');
    const subchapter = urlParams.get('subchapter');
    const module = urlParams.get('module');
    const level = urlParams.get('level');
    
    if (chapter || module || level) {
      selectFilters(chapter, subchapter, module, level);
    }
  });
  
  async function loadChapterStructure() {
    loading = true; // S'assurer que le chargement est bien indiqué
    error = null;   // Réinitialiser les erreurs
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

  // NOUVELLE FONCTION AJOUTÉE POUR LA CORRECTION
  function reloadData() {
    loadChapterStructure();
  }
  
  async function selectFilters(chapterName = null, subchapterName = null, moduleName = null, levelName = null) {
    selectedChapter = chapterName;
    selectedSubchapter = subchapterName;
    selectedModule = moduleName;
    selectedLevel = levelName;
    exercisesLoading = true;
    
    const params = new URLSearchParams();
    if (chapterName) params.set('chapter', chapterName);
    if (subchapterName) params.set('subchapter', subchapterName);
    if (moduleName) params.set('module', moduleName);
    if (levelName) params.set('level', levelName);
    
    const paramString = params.toString();
    goto(paramString ? `/browse?${paramString}` : '/browse', { replaceState: true, noScroll: true });
    
    try {
      const searchParams = new URLSearchParams();
      if (chapterName) searchParams.set('chapter', chapterName);
      if (subchapterName) searchParams.set('subchapter', subchapterName);
      if (moduleName) searchParams.set('module', moduleName);
      if (levelName) searchParams.set('difficulty', levelName);
      searchParams.set('limit', '100');
      
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        exercises = data.results || [];
        calculateSelectionStats(exercises);
        sortExercises();
      } else {
        exercises = [];
        selectionStats = { total: 0, byDifficulty: {}, byModule: {}, authors: [] };
      }
    } catch (err) {
      console.error('Failed to load exercises:', err);
      exercises = [];
    } finally {
      exercisesLoading = false;
    }
  }
  
  function selectChapter(chapterName, subchapterName = null) {
    selectFilters(chapterName, subchapterName, selectedModule, selectedLevel);
  }
  
  function calculateSelectionStats(exerciseList) {
    selectionStats = {
      total: exerciseList.length,
      byDifficulty: {},
      byModule: {},
      authors: []
    };
    
    exerciseList.forEach(ex => {
      if (ex.difficulty) {
        selectionStats.byDifficulty[ex.difficulty] = (selectionStats.byDifficulty[ex.difficulty] || 0) + 1;
      }
      if (ex.module) {
        selectionStats.byModule[ex.module] = (selectionStats.byModule[ex.module] || 0) + 1;
      }
    });
    
    const authorCounts = {};
    exerciseList.forEach(ex => {
      if (ex.author) {
        authorCounts[ex.author] = (authorCounts[ex.author] || 0) + 1;
      }
    });
    
    selectionStats.authors = Object.entries(authorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
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
          const getDifficultyOrder = (value) => {
            if (value === null || value === undefined || value === '') return 999;
            const normalized = String(value).trim().toUpperCase();
            if (normalized === 'PCSI') return -1;
            if (normalized.startsWith('L')) return parseInt(normalized.substring(1), 10) || 0;
            if (normalized.startsWith('M')) return 100 + (parseInt(normalized.substring(1), 10) || 0);
            const numeric = Number(value);
            if (!Number.isNaN(numeric)) return 200 + numeric;
            return 500;
          };
          comparison = getDifficultyOrder(a.difficulty) - getDifficultyOrder(b.difficulty);
          break;
        case 'date':
          comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
          break;
        case 'author':
          comparison = (a.author || '').localeCompare(b.author || '');
          break;
        case 'module':
          comparison = (a.module || '').localeCompare(b.module || '');
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    exercises = exercises;
  }
  
  function clearSelection() {
    selectedChapter = null;
    selectedSubchapter = null;
    selectedModule = null;
    selectedLevel = null;
    exercises = [];
    selectionStats = { total: 0, byDifficulty: {}, byModule: {}, authors: [] };
    goto('/browse', { replaceState: true, noScroll: true });
  }
  
  function handleNavigationEvent(event) {
    const { chapter, subchapter, module, level } = event.detail;
    selectFilters(chapter, subchapter, module, level);
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <header class="mb-8">
    <h1 class="text-4xl font-bold text-interface-text-primary" style="font-family: theme('fontFamily.heading')">Parcourir les exercices</h1>
    <p class="text-interface-text-secondary mt-2">Explorez les exercices par chapitres, modules et niveaux.</p>
    {#if selectedChapter || selectedModule || selectedLevel}
      <!-- CORRECTION : `resetView` remplacé par `clearSelection` -->
      <button on:click={clearSelection} class="btn btn-text text-brand-primary mt-4">
        &larr; Retour à la vue générale
      </button>
    {/if}
  </header>

  {#if loading}
    <div class="text-center py-16">
      <p class="text-interface-text-muted">Chargement...</p>
    </div>
  {:else if error}
    <div class="empty-state">
      <h3 class="empty-state-title text-red-600">Erreur de chargement</h3>
      <p class="empty-state-subtitle">{error}</p>
      <!-- CORRECTION : `reloadData` est maintenant défini -->
      <button on:click={reloadData} class="btn btn-primary mt-4">Réessayer</button>
    </div>
  {:else}
    <!-- VUE D'ENSEMBLE (QUAND RIEN N'EST SÉLECTIONNÉ) -->
    {#if !selectedChapter && !selectedModule && !selectedLevel}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each chapterStructure as chapter}
          <div class="content-card flex flex-col">
            <div class="flex-grow">
              <h3 class="content-card-title">{chapter.name}</h3>
              <p class="content-card-meta">{chapter.exerciseCount} exercices</p>
              {#if chapter.subchapters && chapter.subchapters.length > 0}
                <div class="text-sm text-gray-500 space-y-1 mt-2">
                  {#each chapter.subchapters.slice(0, 3) as sub}
                    <p class="truncate">&bull; {sub.name}</p>
                  {/each}
                  {#if chapter.subchapters.length > 3}
                    <p class="text-gray-400 italic">+{chapter.subchapters.length - 3} autres</p>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="content-card-footer">
              <button on:click={() => selectChapter(chapter.name)} class="btn btn-primary w-full">
                Explorer
              </button>
            </div>
          </div>
        {/each}
      </div>

    <!-- VUE DÉTAILLÉE (QUAND UN FILTRE EST ACTIF) -->
    {:else}
      <div class="card mb-8">
        <h2 class="text-2xl font-bold text-interface-text-primary" style="font-family: theme('fontFamily.heading')">
          {#if selectedChapter}{selectedChapter}{#if selectedSubchapter} › {selectedSubchapter}{/if}{/if}
          {#if selectedModule} · {selectedModule}{/if}
          {#if selectedLevel} · {selectedLevel}{/if}
        </h2>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-interface-text-secondary mt-4">
          <span class="font-semibold">{selectionStats.total} exercices</span>
          {#if Object.keys(selectionStats.byDifficulty).length > 0}
            <div class="flex flex-wrap gap-1">
              {#each Object.entries(selectionStats.byDifficulty) as [level, count]}
                <Chip variant="teal">{level} · {count}</Chip>
              {/each}
            </div>
          {/if}
          {#if selectionStats.authors.length > 0}
            <div class="flex flex-wrap gap-1">
              {#each selectionStats.authors.slice(0, 3) as author}
                <Chip variant="soft">{author.name} ({author.count})</Chip>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-interface-text-muted">Trier par :</span>
          <button on:click={() => changeSorting('title')} class="btn btn-ghost btn-sm" class:font-bold={sortBy === 'title'}>Titre {#if sortBy === 'title'}{sortOrder === 'asc' ? '↑' : '↓'}{/if}</button>
          <button on:click={() => changeSorting('difficulty')} class="btn btn-ghost btn-sm" class:font-bold={sortBy === 'difficulty'}>Niveau {#if sortBy === 'difficulty'}{sortOrder === 'asc' ? '↑' : '↓'}{/if}</button>
          <button on:click={() => changeSorting('module')} class="btn btn-ghost btn-sm" class:font-bold={sortBy === 'module'}>Module {#if sortBy === 'module'}{sortOrder === 'asc' ? '↑' : '↓'}{/if}</button>
          <button on:click={() => changeSorting('author')} class="btn btn-ghost btn-sm" class:font-bold={sortBy === 'author'}>Auteur {#if sortBy === 'author'}{sortOrder === 'asc' ? '↑' : '↓'}{/if}</button>
        </div>
        <p class="text-sm text-interface-text-muted">{exercises.length} exercice{exercises.length > 1 ? 's' : ''} affiché{exercises.length > 1 ? 's' : ''}</p>
      </div>

      {#if exercisesLoading}
        <div class="text-center py-16"><p class="text-interface-text-muted">Chargement des exercices...</p></div>
      {:else if exercises.length === 0}
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <h3 class="empty-state-title">Aucun exercice trouvé</h3>
          <p class="empty-state-subtitle">Aucun exercice ne correspond aux filtres sélectionnés.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-3">
          {#each exercises as exercise (exercise.uuid)}
            <div class="card card-hover">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <h3 class="font-semibold text-interface-text-primary" style="font-family: theme('fontFamily.heading'); font-size: 15px;">
                    <a href="/exercise/{exercise.uuid}" class="hover:text-brand-600">
                      <MathRenderer content={exercise.title} inline={true} />
                    </a>
                  </h3>
                  <div class="flex flex-wrap gap-1 mt-1">
                    {#if exercise.chapter && exercise.chapter !== selectedChapter}<Chip variant="soft">{exercise.chapter}</Chip>{/if}
                    {#if exercise.module && exercise.module !== selectedModule}<Chip variant="teal">{exercise.module}</Chip>{/if}
                    {#if exercise.author}<span class="text-xs text-interface-text-muted">par {exercise.author}</span>{/if}
                  </div>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                  {#if exercise.difficulty}
                    <StarsRating n={exercise.difficulty} total={4} />
                  {:else if exercise.level}
                    <Chip variant="teal-solid">{exercise.level}</Chip>
                  {/if}
                  <a href="/exercise/{exercise.uuid}" class="btn btn-primary btn-sm">Voir</a>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>
