<!-- src/lib/components/ChapterNavigation.svelte -->
<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let chapterStructure = [];
  let loading = true;
  let error = null;
  let expandedChapters = new Set();
  let selectedPath = { chapter: null, subchapter: null };
  
  export let selectedChapter = '';
  export let selectedSubchapter = '';
  export let compact = false; // Mode compact pour la sidebar
  
  // Charger la structure des chapitres
  onMount(async () => {
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
  });
  
  // Synchroniser avec les props externes
  $: {
    if (selectedChapter) {
      selectedPath.chapter = selectedChapter;
      expandedChapters.add(selectedChapter);
      expandedChapters = expandedChapters;
    }
    if (selectedSubchapter) {
      selectedPath.subchapter = selectedSubchapter;
    }
  }
  
  function toggleChapter(chapterName) {
    if (expandedChapters.has(chapterName)) {
      expandedChapters.delete(chapterName);
    } else {
      expandedChapters.add(chapterName);
    }
    expandedChapters = expandedChapters;
  }
  
  function selectChapter(chapterName, subchapterName = null) {
    // Si on clique sur un chapitre principal (pas de sous-chapitre) 
    // et que ce chapitre est déjà déplié, le replier au lieu de le sélectionner
    if (!subchapterName && expandedChapters.has(chapterName)) {
      // Si en plus c'est le chapitre actuellement sélectionné, on le désélectionne
      if (selectedPath.chapter === chapterName && !selectedPath.subchapter) {
        selectedPath = { chapter: null, subchapter: null };
        dispatch('navigate', { chapter: null, subchapter: null });
      }
      // Dans tous les cas, on le replie
      toggleChapter(chapterName);
      return;
    }
    
    // Sinon, comportement normal de sélection
    selectedPath = {
      chapter: chapterName,
      subchapter: subchapterName
    };
    
    // Auto-déplier le chapitre si on sélectionne un sous-chapitre
    if (subchapterName && !expandedChapters.has(chapterName)) {
      expandedChapters.add(chapterName);
      expandedChapters = expandedChapters;
    }
    
    // Auto-déplier si on sélectionne un chapitre replié
    if (!subchapterName && !expandedChapters.has(chapterName)) {
      expandedChapters.add(chapterName);
      expandedChapters = expandedChapters;
    }
    
    // Émettre l'événement de sélection
    dispatch('navigate', {
      chapter: chapterName,
      subchapter: subchapterName
    });
  }
  
  function clearSelection() {
    selectedPath = { chapter: null, subchapter: null };
    dispatch('navigate', { chapter: null, subchapter: null });
  }
</script>

<div class="chapter-navigation" class:chapter-navigation--compact={compact}>
  <!-- Header avec actions -->
  <div class="chapter-navigation-header">
    <h3 class="chapter-navigation-title">
      {compact ? 'Chapitres' : 'Navigation par chapitres'}
    </h3>
    
    {#if selectedPath.chapter || selectedPath.subchapter}
      <button 
        on:click={clearSelection}
        class="chapter-clear-btn"
        title="Effacer la sélection"
      >
        ✕
      </button>
    {/if}
  </div>
  
  <!-- Fil d'Ariane -->
  {#if (selectedPath.chapter || selectedPath.subchapter) && !compact}
    <div class="chapter-breadcrumb">
      <span class="chapter-breadcrumb-item">📚</span>
      {#if selectedPath.chapter}
        <span class="chapter-breadcrumb-separator">›</span>
        <span class="chapter-breadcrumb-item chapter-breadcrumb-item--active">
          {selectedPath.chapter}
        </span>
      {/if}
      {#if selectedPath.subchapter}
        <span class="chapter-breadcrumb-separator">›</span>
        <span class="chapter-breadcrumb-item chapter-breadcrumb-item--active">
          {selectedPath.subchapter}
        </span>
      {/if}
    </div>
  {/if}
  
  <!-- Contenu principal -->
  <div class="chapter-navigation-content">
    {#if loading}
      <div class="chapter-loading">
        <div class="chapter-spinner"></div>
        <p>Chargement des chapitres...</p>
      </div>
      
    {:else if error}
      <div class="chapter-error">
        <p class="chapter-error-text">{error}</p>
        <button on:click={() => window.location.reload()} class="chapter-retry-btn">
          Réessayer
        </button>
      </div>
      
    {:else if chapterStructure.length === 0}
      <div class="chapter-empty">
        <p>Aucun chapitre disponible</p>
      </div>
      
    {:else}
      <!-- Arborescence des chapitres -->
      <div class="chapter-tree">
        {#each chapterStructure as chapter}
          <div class="chapter-item">
            <!-- Titre du chapitre principal -->
            <div 
              class="chapter-main"
              class:chapter-main--selected={selectedPath.chapter === chapter.name}
              class:chapter-main--expanded={expandedChapters.has(chapter.name)}
            >
              <button 
                class="chapter-toggle"
                class:chapter-toggle--expanded={expandedChapters.has(chapter.name)}
                on:click={() => toggleChapter(chapter.name)}
                disabled={!chapter.subchapters || chapter.subchapters.length === 0}
              >
                {#if chapter.subchapters && chapter.subchapters.length > 0}
                  <svg class="chapter-toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                {:else}
                  <div class="chapter-toggle-placeholder"></div>
                {/if}
              </button>
              
              <button 
                class="chapter-link"
                on:click={() => selectChapter(chapter.name)}
              >
                <span class="chapter-name">{chapter.name}</span>
                <span class="chapter-count">({chapter.exerciseCount})</span>
              </button>
            </div>
            
            <!-- Sous-chapitres -->
            {#if chapter.subchapters && expandedChapters.has(chapter.name)}
              <div class="chapter-subchapters">
                {#each chapter.subchapters as subchapter}
                  <button
                    class="chapter-sublink"
                    class:chapter-sublink--selected={selectedPath.chapter === chapter.name && selectedPath.subchapter === subchapter.name}
                    on:click={() => selectChapter(chapter.name, subchapter.name)}
                  >
                    <span class="chapter-subname">{subchapter.name}</span>
                    <span class="chapter-subcount">({subchapter.exerciseCount})</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Actions rapides -->
  {#if !compact && chapterStructure.length > 0}
    <div class="chapter-quick-actions">
      <button 
        on:click={() => {
          chapterStructure.forEach(ch => expandedChapters.add(ch.name));
          expandedChapters = expandedChapters;
        }}
        class="chapter-action-btn"
      >
        Tout développer
      </button>
      
      <button 
        on:click={() => {
          expandedChapters.clear();
          expandedChapters = expandedChapters;
        }}
        class="chapter-action-btn"
      >
        Tout réduire
      </button>
    </div>
  {/if}
</div>

<style>
  .chapter-navigation {
    @apply bg-white rounded-lg shadow-sm border border-gray-200;
    min-height: 300px;
  }
  
  .chapter-navigation--compact {
    @apply bg-gray-50 shadow-none border-0;
  }
  
  .chapter-navigation-header {
    @apply flex items-center justify-between p-4 border-b border-gray-100;
  }
  
  .chapter-navigation--compact .chapter-navigation-header {
    @apply p-3 border-b-0;
  }
  
  .chapter-navigation-title {
    @apply text-lg font-semibold text-gray-900;
  }
  
  .chapter-navigation--compact .chapter-navigation-title {
    @apply text-sm font-medium;
  }
  
  .chapter-clear-btn {
    @apply w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 text-xs transition-colors;
  }
  
  .chapter-breadcrumb {
    @apply px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-sm;
  }
  
  .chapter-breadcrumb-item {
    @apply text-gray-600;
  }
  
  .chapter-breadcrumb-item--active {
    @apply text-gray-900 font-medium;
  }
  
  .chapter-breadcrumb-separator {
    @apply text-gray-400;
  }
  
  .chapter-navigation-content {
    @apply flex-1 overflow-y-auto;
    max-height: 500px;
  }
  
  .chapter-loading {
    @apply flex flex-col items-center justify-center py-12 text-gray-500;
  }
  
  .chapter-spinner {
    @apply w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-3;
  }
  
  .chapter-error {
    @apply text-center py-8 px-4;
  }
  
  .chapter-error-text {
    @apply text-red-600 mb-4;
  }
  
  .chapter-retry-btn {
    @apply px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors;
  }
  
  .chapter-empty {
    @apply text-center py-8 text-gray-500;
  }
  
  .chapter-tree {
    @apply py-2;
  }
  
  .chapter-item {
    @apply border-b border-gray-50 last:border-b-0;
  }
  
  .chapter-main {
    @apply flex items-center hover:bg-gray-50;
  }
  
  .chapter-main--selected {
    @apply bg-blue-50 border-r-2 border-blue-500;
  }
  
  .chapter-toggle {
    @apply w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors;
  }
  
  .chapter-toggle:disabled {
    @apply cursor-default;
  }
  
  .chapter-toggle-icon {
    @apply w-4 h-4 transition-transform;
  }
  
  .chapter-toggle--expanded .chapter-toggle-icon {
    @apply rotate-90;
  }
  
  .chapter-toggle-placeholder {
    @apply w-4 h-4;
  }
  
  .chapter-link {
    @apply flex-1 flex items-center justify-between py-3 px-3 text-left hover:text-blue-600 transition-colors;
  }
  
  .chapter-name {
    @apply font-medium text-gray-900;
  }
  
  .chapter-count {
    @apply text-sm text-gray-500;
  }
  
  .chapter-subchapters {
    @apply bg-gray-50;
  }
  
  .chapter-sublink {
    @apply w-full flex items-center justify-between py-2 px-12 text-left hover:bg-gray-100 hover:text-blue-600 transition-colors;
  }
  
  .chapter-sublink--selected {
    @apply bg-blue-50 text-blue-700 border-r-2 border-blue-500;
  }
  
  .chapter-subname {
    @apply text-sm text-gray-700;
  }
  
  .chapter-sublink--selected .chapter-subname {
    @apply text-blue-700 font-medium;
  }
  
  .chapter-subcount {
    @apply text-xs text-gray-500;
  }
  
  .chapter-quick-actions {
    @apply flex gap-2 p-4 border-t border-gray-100 bg-gray-50;
  }
  
  .chapter-action-btn {
    @apply flex-1 py-2 px-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors;
  }
  
  /* Styles compacts */
  .chapter-navigation--compact .chapter-tree {
    @apply py-1;
  }
  
  .chapter-navigation--compact .chapter-link {
    @apply py-2 px-2;
  }
  
  .chapter-navigation--compact .chapter-name {
    @apply text-sm;
  }
  
  .chapter-navigation--compact .chapter-count {
    @apply text-xs;
  }
  
  .chapter-navigation--compact .chapter-sublink {
    @apply py-1 px-8;
  }
  
  .chapter-navigation--compact .chapter-subname {
    @apply text-xs;
  }
</style>