<!-- src/lib/components/MobileChapterNav.svelte -->
<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let chapterStructure = [];
  let loading = true;
  let error = null;
  let isOpen = false;
  let selectedChapter = '';
  let selectedSubchapter = '';
  
  export { selectedChapter, selectedSubchapter };
  
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
  
  function toggleMenu() {
    isOpen = !isOpen;
  }
  
  function selectChapter(chapterName, subchapterName = null) {
    // Si on clique sur un chapitre déjà sélectionné (sans sous-chapitre), effacer la sélection
    if (!subchapterName && selectedChapter === chapterName && !selectedSubchapter) {
      selectedChapter = '';
      selectedSubchapter = '';
      isOpen = false;
      
      dispatch('navigate', {
        chapter: null,
        subchapter: null
      });
      return;
    }
    
    // Sinon, comportement normal
    selectedChapter = chapterName;
    selectedSubchapter = subchapterName;
    isOpen = false;
    
    dispatch('navigate', {
      chapter: chapterName,
      subchapter: subchapterName
    });
  }
  
  function clearSelection() {
    selectedChapter = '';
    selectedSubchapter = '';
    isOpen = false;
    
    dispatch('navigate', {
      chapter: null,
      subchapter: null
    });
  }
  
  // Fermer le menu si on clique à l'extérieur
  function handleClickOutside(event) {
    if (isOpen && !event.target.closest('.mobile-chapter-nav')) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="mobile-chapter-nav">
  <!-- Bouton d'ouverture -->
  <button 
    class="mobile-nav-trigger"
    class:mobile-nav-trigger--active={isOpen}
    on:click={toggleMenu}
  >
    <div class="mobile-nav-content">
      <div class="mobile-nav-icon">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </div>
      
      <div class="mobile-nav-text">
        {#if selectedChapter}
          <span class="mobile-nav-selected">
            {selectedChapter}
            {#if selectedSubchapter}
              › {selectedSubchapter}
            {/if}
          </span>
        {:else}
          <span class="mobile-nav-placeholder">Choisir un chapitre</span>
        {/if}
      </div>
      
      <div class="mobile-nav-arrow">
        <svg 
          class="w-4 h-4 transition-transform"
          class:rotate-180={isOpen}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  </button>
  
  <!-- Menu déroulant -->
  {#if isOpen}
    <div class="mobile-nav-dropdown">
      {#if loading}
        <div class="mobile-nav-loading">
          <div class="mobile-loading-spinner"></div>
          <span>Chargement...</span>
        </div>
        
      {:else if error}
        <div class="mobile-nav-error">
          <span>{error}</span>
          <button on:click={() => window.location.reload()}>Réessayer</button>
        </div>
        
      {:else}
        <div class="mobile-nav-content-wrapper">
          <!-- Option pour effacer la sélection -->
          {#if selectedChapter}
            <button 
              class="mobile-nav-option mobile-nav-option--clear"
              on:click={clearSelection}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Effacer la sélection</span>
            </button>
          {/if}
          
          <!-- Liste des chapitres -->
          <div class="mobile-nav-chapters">
            {#each chapterStructure as chapter}
              <div class="mobile-nav-chapter-group">
                <!-- Chapitre principal -->
                <button
                  class="mobile-nav-chapter"
                  class:mobile-nav-chapter--selected={selectedChapter === chapter.name && !selectedSubchapter}
                  on:click={() => selectChapter(chapter.name)}
                >
                  <div class="mobile-nav-chapter-info">
                    <span class="mobile-nav-chapter-name">{chapter.name}</span>
                    <span class="mobile-nav-chapter-count">({chapter.exerciseCount})</span>
                  </div>
                  
                  {#if selectedChapter === chapter.name && !selectedSubchapter}
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
                
                <!-- Sous-chapitres -->
                {#if chapter.subchapters && chapter.subchapters.length > 0}
                  <div class="mobile-nav-subchapters">
                    {#each chapter.subchapters as subchapter}
                      <button
                        class="mobile-nav-subchapter"
                        class:mobile-nav-subchapter--selected={selectedChapter === chapter.name && selectedSubchapter === subchapter.name}
                        on:click={() => selectChapter(chapter.name, subchapter.name)}
                      >
                        <div class="mobile-nav-subchapter-info">
                          <span class="mobile-nav-subchapter-name">{subchapter.name}</span>
                          <span class="mobile-nav-subchapter-count">({subchapter.exerciseCount})</span>
                        </div>
                        
                        {#if selectedChapter === chapter.name && selectedSubchapter === subchapter.name}
                          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                        {/if}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mobile-chapter-nav {
    @apply relative lg:hidden;
  }
  
  .mobile-nav-trigger {
    @apply w-full p-4 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors;
  }
  
  .mobile-nav-trigger--active {
    @apply bg-gray-50 border-gray-400;
  }
  
  .mobile-nav-content {
    @apply flex items-center gap-3;
  }
  
  .mobile-nav-icon {
    @apply text-gray-600;
  }
  
  .mobile-nav-text {
    @apply flex-1 text-left;
  }
  
  .mobile-nav-selected {
    @apply font-medium text-gray-900;
  }
  
  .mobile-nav-placeholder {
    @apply text-gray-500;
  }
  
  .mobile-nav-arrow {
    @apply text-gray-400;
  }
  
  .mobile-nav-dropdown {
    @apply absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .mobile-nav-loading, .mobile-nav-error {
    @apply flex items-center justify-center gap-3 p-6 text-gray-600;
  }
  
  .mobile-loading-spinner {
    @apply w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin;
  }
  
  .mobile-nav-error button {
    @apply text-blue-600 hover:text-blue-800 font-medium;
  }
  
  .mobile-nav-content-wrapper {
    @apply py-2;
  }
  
  .mobile-nav-option--clear {
    @apply w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 text-red-600 border-b border-gray-100;
  }
  
  .mobile-nav-chapters {
    @apply divide-y divide-gray-100;
  }
  
  .mobile-nav-chapter-group {
    @apply py-1;
  }
  
  .mobile-nav-chapter {
    @apply w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors;
  }
  
  .mobile-nav-chapter--selected {
    @apply bg-blue-50 text-blue-700;
  }
  
  .mobile-nav-chapter-info {
    @apply flex items-center gap-2;
  }
  
  .mobile-nav-chapter-name {
    @apply font-medium text-gray-900;
  }
  
  .mobile-nav-chapter--selected .mobile-nav-chapter-name {
    @apply text-blue-700;
  }
  
  .mobile-nav-chapter-count {
    @apply text-sm text-gray-500;
  }
  
  .mobile-nav-subchapters {
    @apply bg-gray-50 divide-y divide-gray-100;
  }
  
  .mobile-nav-subchapter {
    @apply w-full flex items-center justify-between px-8 py-2 text-left hover:bg-gray-50 transition-colors;
  }
  
  .mobile-nav-subchapter--selected {
    @apply bg-blue-50 text-blue-700;
  }
  
  .mobile-nav-subchapter-info {
    @apply flex items-center gap-2;
  }
  
  .mobile-nav-subchapter-name {
    @apply text-sm text-gray-700;
  }
  
  .mobile-nav-subchapter--selected .mobile-nav-subchapter-name {
    @apply text-blue-700 font-medium;
  }
  
  .mobile-nav-subchapter-count {
    @apply text-xs text-gray-500;
  }
  
  /* Animation du dropdown */
  .mobile-nav-dropdown {
    animation: slideDown 0.2s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Responsive pour très petits écrans */
  @media (max-width: 380px) {
    .mobile-nav-trigger {
      @apply p-3;
    }
    
    .mobile-nav-content {
      @apply gap-2;
    }
    
    .mobile-nav-text {
      @apply text-sm;
    }
    
    .mobile-nav-chapter {
      @apply px-3 py-2;
    }
    
    .mobile-nav-subchapter {
      @apply px-6 py-2;
    }
    
    .mobile-nav-chapter-name, .mobile-nav-subchapter-name {
      @apply truncate max-w-48;
    }
  }
</style>