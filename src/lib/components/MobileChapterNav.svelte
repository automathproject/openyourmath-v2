<!-- src/lib/components/MobileChapterNav.svelte - Version enrichie avec modules/niveaux -->
<script> 
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let chapterStructure = [];
  let modulesList = [];     // NOUVEAU
  let levelsList = [];      // NOUVEAU
  let loading = true;
  let error = null;
  let isOpen = false;
  let activeTab = 'levels'; // MODIFIÉ : Commencer par les niveaux (hiérarchie)
  
  export let selectedChapter = '';
  export let selectedSubchapter = '';
  export let selectedModule = '';   // NOUVEAU
  export let selectedLevel = '';    // NOUVEAU
  
  onMount(async () => {
    await Promise.all([
      loadChapterStructure(),
      loadModules(),
      loadLevels()
    ]);
  });
  
  async function loadChapterStructure() {
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
    }
  }
  
  // NOUVEAU : Charger les modules
  async function loadModules() {
    try {
      const response = await fetch('/api/chapters?type=suggestions&for=modules&limit=50');
      if (response.ok) {
        const data = await response.json();
        modulesList = data.suggestions || [];
      }
    } catch (err) {
      console.error('Failed to load modules:', err);
    }
  }
  
  // NOUVEAU : Charger les niveaux
  async function loadLevels() {
    try {
      const response = await fetch('/api/chapters?type=suggestions&for=levels&limit=20');
      if (response.ok) {
        const data = await response.json();
        levelsList = data.suggestions || [];
      }
    } catch (err) {
      console.error('Failed to load levels:', err);
    } finally {
      loading = false;
    }
  }
  
  function toggleMenu() {
    isOpen = !isOpen;
  }
  
  // MODIFIÉ : Événements de sélection suivant la hiérarchie niveau > module > chapitre
  function selectChapter(chapterName, subchapterName = null) {
    selectedChapter = selectedChapter === chapterName && !subchapterName ? '' : chapterName;
    selectedSubchapter = subchapterName || '';
    isOpen = false;
    
    dispatch('navigate', {
      level: selectedLevel || null,
      module: selectedModule || null, 
      chapter: selectedChapter || null,
      subchapter: selectedSubchapter || null
    });
  }
  
  function selectModule(moduleName) {
    selectedModule = selectedModule === moduleName ? '' : moduleName;
    isOpen = false;
    
    dispatch('navigate', {
      level: selectedLevel || null,
      module: selectedModule || null,
      chapter: selectedChapter || null,
      subchapter: selectedSubchapter || null
    });
  }
  
  function selectLevel(levelName) {
    selectedLevel = selectedLevel === levelName ? '' : levelName;
    isOpen = false;
    
    dispatch('navigate', {
      level: selectedLevel || null,
      module: selectedModule || null,
      chapter: selectedChapter || null,
      subchapter: selectedSubchapter || null
    });
  }
  
  function clearSelection() {
    selectedChapter = '';
    selectedSubchapter = '';
    selectedModule = '';
    selectedLevel = '';
    isOpen = false;
    
    dispatch('navigate', {
      level: null,
      module: null,
      chapter: null,
      subchapter: null
    });
  }
  
  // NOUVEAU : Changer d'onglet
  function switchTab(tab) {
    activeTab = tab;
  }
  
  // Fermer le menu si on clique à l'extérieur
  function handleClickOutside(event) {
    if (isOpen && !event.target.closest('.mobile-chapter-nav')) {
      isOpen = false;
    }
  }
  
  // NOUVEAU : Obtenir le texte d'affichage de la sélection hiérarchique
  function getSelectionDisplayText() {
    const selections = [];
    
    // Ordre hiérarchique : Niveau > Module > Chapitre
    if (selectedLevel) {
      selections.push(`🎓 ${selectedLevel}`);
    }
    
    if (selectedModule) {
      selections.push(`📖 ${selectedModule}`);
    }
    
    if (selectedChapter) {
      let chapterText = `📚 ${selectedChapter}`;
      if (selectedSubchapter) {
        chapterText += ` › ${selectedSubchapter}`;
      }
      selections.push(chapterText);
    }
    
    return selections.length > 0 ? selections.join(' • ') : 'Choisir dans la hiérarchie';
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
        <span class="mobile-nav-selection" class:mobile-nav-placeholder={!selectedChapter && !selectedModule && !selectedLevel}>
          {getSelectionDisplayText()}
        </span>
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
          <!-- NOUVEAU : Onglets pour mobile avec ordre hiérarchique -->
          <div class="mobile-nav-tabs">
            <button 
              class="mobile-nav-tab"
              class:mobile-nav-tab--active={activeTab === 'levels'}
              on:click={() => switchTab('levels')}
            >
              <span class="mobile-nav-tab-icon">🎓</span>
              <span class="mobile-nav-tab-text">Niveaux</span>
              <span class="mobile-nav-tab-count">{levelsList.length}</span>
            </button>
            
            <button 
              class="mobile-nav-tab"
              class:mobile-nav-tab--active={activeTab === 'modules'}
              on:click={() => switchTab('modules')}
            >
              <span class="mobile-nav-tab-icon">📖</span>
              <span class="mobile-nav-tab-text">Modules</span>
              <span class="mobile-nav-tab-count">{modulesList.length}</span>
            </button>
            
            <button 
              class="mobile-nav-tab"
              class:mobile-nav-tab--active={activeTab === 'chapters'}
              on:click={() => switchTab('chapters')}
            >
              <span class="mobile-nav-tab-icon">📚</span>
              <span class="mobile-nav-tab-text">Chapitres</span>
              <span class="mobile-nav-tab-count">{chapterStructure.length}</span>
            </button>
          </div>
          
          <!-- Option pour effacer la sélection -->
          {#if selectedChapter || selectedModule || selectedLevel}
            <button 
              class="mobile-nav-option mobile-nav-option--clear"
              on:click={clearSelection}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Effacer toute la sélection</span>
            </button>
          {/if}
          
          <!-- Contenu par onglets - ORDRE HIERARCHIQUE -->
          {#if activeTab === 'levels'}
            <!-- NOUVEAU : Liste des niveaux en premier -->
            <div class="mobile-nav-levels">
              {#each levelsList as level}
                <button
                  class="mobile-nav-level"
                  class:mobile-nav-level--selected={selectedLevel === level.value}
                  class:mobile-nav-level--l1={level.value === 'L1'}
                  class:mobile-nav-level--l2={level.value === 'L2'}
                  class:mobile-nav-level--l3={level.value === 'L3'}
                  class:mobile-nav-level--m1={level.value === 'M1'}
                  class:mobile-nav-level--m2={level.value === 'M2'}
                  on:click={() => selectLevel(level.value)}
                >
                  <div class="mobile-nav-level-icon">🎓</div>
                  <div class="mobile-nav-level-info">
                    <span class="mobile-nav-level-name">{level.value}</span>
                    <span class="mobile-nav-level-count">({level.count})</span>
                  </div>
                  
                  {#if selectedLevel === level.value}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
          
          {#if activeTab === 'modules'}
            <!-- Liste des modules en deuxième -->
            <div class="mobile-nav-modules">
              {#each modulesList as module}
                <button
                  class="mobile-nav-module"
                  class:mobile-nav-module--selected={selectedModule === module.value}
                  on:click={() => selectModule(module.value)}
                >
                  <div class="mobile-nav-module-icon">📖</div>
                  <div class="mobile-nav-module-info">
                    <span class="mobile-nav-module-name">{module.value}</span>
                    <span class="mobile-nav-module-count">({module.count})</span>
                  </div>
                  
                  {#if selectedModule === module.value}
                    <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
          
          {#if activeTab === 'chapters'}
            <!-- Liste des chapitres en dernier -->
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
          {/if}
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
    @apply flex-1 text-left min-w-0;
  }
  
  .mobile-nav-selection {
    @apply font-medium text-gray-900 block truncate;
  }
  
  .mobile-nav-placeholder {
    @apply text-gray-500 font-normal;
  }
  
  .mobile-nav-arrow {
    @apply text-gray-400 flex-shrink-0;
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
    @apply pb-2;
  }
  
  /* NOUVEAU : Styles pour les onglets mobiles */
  .mobile-nav-tabs {
    @apply flex bg-gray-50 border-b border-gray-200;
  }
  
  .mobile-nav-tab {
    @apply flex-1 flex flex-col items-center py-3 px-2 text-sm transition-colors;
  }
  
  .mobile-nav-tab--active {
    @apply bg-white border-b-2 border-blue-500 text-blue-600;
  }
  
  .mobile-nav-tab-icon {
    @apply text-lg mb-1;
  }
  
  .mobile-nav-tab-text {
    @apply text-xs font-medium;
  }
  
  .mobile-nav-tab-count {
    @apply text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 min-w-[20px] text-center mt-1;
  }
  
  .mobile-nav-tab--active .mobile-nav-tab-count {
    @apply bg-blue-100 text-blue-600;
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
  
  /* NOUVEAU : Styles pour les modules */
  .mobile-nav-modules {
    @apply divide-y divide-gray-100;
  }
  
  .mobile-nav-module {
    @apply w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors;
  }
  
  .mobile-nav-module--selected {
    @apply bg-green-50 text-green-700;
  }
  
  .mobile-nav-module-icon {
    @apply text-lg text-green-600;
  }
  
  .mobile-nav-module-info {
    @apply flex-1 flex items-center gap-2;
  }
  
  .mobile-nav-module-name {
    @apply font-medium text-gray-900;
  }
  
  .mobile-nav-module--selected .mobile-nav-module-name {
    @apply text-green-700;
  }
  
  .mobile-nav-module-count {
    @apply text-sm text-gray-500;
  }
  
  /* NOUVEAU : Styles pour les niveaux */
  .mobile-nav-levels {
    @apply divide-y divide-gray-100;
  }
  
  .mobile-nav-level {
    @apply w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors;
  }
  
  .mobile-nav-level--selected {
    @apply font-medium;
  }
  
  .mobile-nav-level--l1 {
    @apply hover:bg-green-50;
  }
  .mobile-nav-level--l1.mobile-nav-level--selected {
    @apply bg-green-100 text-green-800;
  }
  .mobile-nav-level--l1 .mobile-nav-level-icon { @apply text-green-600; }
  .mobile-nav-level--l1 svg { @apply text-green-600; }
  
  .mobile-nav-level--l2 {
    @apply hover:bg-blue-50;
  }
  .mobile-nav-level--l2.mobile-nav-level--selected {
    @apply bg-blue-100 text-blue-800;
  }
  .mobile-nav-level--l2 .mobile-nav-level-icon { @apply text-blue-600; }
  .mobile-nav-level--l2 svg { @apply text-blue-600; }
  
  .mobile-nav-level--l3 {
    @apply hover:bg-yellow-50;
  }
  .mobile-nav-level--l3.mobile-nav-level--selected {
    @apply bg-yellow-100 text-yellow-800;
  }
  .mobile-nav-level--l3 .mobile-nav-level-icon { @apply text-yellow-600; }
  .mobile-nav-level--l3 svg { @apply text-yellow-600; }
  
  .mobile-nav-level--m1 {
    @apply hover:bg-orange-50;
  }
  .mobile-nav-level--m1.mobile-nav-level--selected {
    @apply bg-orange-100 text-orange-800;
  }
  .mobile-nav-level--m1 .mobile-nav-level-icon { @apply text-orange-600; }
  .mobile-nav-level--m1 svg { @apply text-orange-600; }
  
  .mobile-nav-level--m2 {
    @apply hover:bg-red-50;
  }
  .mobile-nav-level--m2.mobile-nav-level--selected {
    @apply bg-red-100 text-red-800;
  }
  .mobile-nav-level--m2 .mobile-nav-level-icon { @apply text-red-600; }
  .mobile-nav-level--m2 svg { @apply text-red-600; }
  
  .mobile-nav-level-info {
    @apply flex-1 flex items-center gap-2;
  }
  
  .mobile-nav-level-name {
    @apply font-bold text-lg;
  }
  
  .mobile-nav-level-count {
    @apply text-sm text-gray-500;
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
    
    .mobile-nav-tab {
      @apply px-1 py-2;
    }
    
    .mobile-nav-tab-text {
      @apply text-xs;
    }
    
    .mobile-nav-chapter, .mobile-nav-module, .mobile-nav-level {
      @apply px-3 py-2;
    }
    
    .mobile-nav-subchapter {
      @apply px-6 py-2;
    }
    
    .mobile-nav-chapter-name, .mobile-nav-subchapter-name, 
    .mobile-nav-module-name, .mobile-nav-level-name {
      @apply truncate max-w-48;
    }
  }
</style>