<script> 
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let hierarchyStructure = [];
  let loading = true;
  let error = null;
  let isOpen = false;
  let activeTab = 'levels';
  let expandedLevels = new Set();
  let expandedModules = new Set();
  
  let selectedPath = { 
    level: null, 
    module: null, 
    chapter: null, 
    subchapter: null 
  };
  
  export let selectedChapter = '';
  export let selectedSubchapter = '';
  export let selectedModule = '';
  export let selectedLevel = '';
  
  // Charger la structure hiérarchique complète
  onMount(async () => {
    console.log('🚀 MobileChapterNav component mounted');
    await loadHierarchicalStructure();
  });
  
  async function loadHierarchicalStructure() {
    console.log('🔄 Starting loadHierarchicalStructure (Mobile)');
    
    try {
      // Utiliser l'API chapters avec le bon type
      const response = await fetch('/api/chapters?type=structure');
      
      if (response.ok) {
        const data = await response.json();
        hierarchyStructure = data.structure || [];
        console.log('Mobile Hierarchy loaded:', hierarchyStructure.length, 'levels');
      } else {
        error = 'Impossible de charger la structure';
      }
    } catch (err) {
      error = 'Erreur de connexion';
      console.error('Failed to load hierarchy:', err);
    } finally {
      loading = false;
    }
  }
  
  // Synchroniser avec les props externes
  $: {
    selectedPath.level = selectedLevel;
    selectedPath.module = selectedModule;
    selectedPath.chapter = selectedChapter;
    selectedPath.subchapter = selectedSubchapter;
    
    // Auto-expand basé sur la sélection
    if (selectedLevel) expandedLevels.add(selectedLevel);
    if (selectedModule) expandedModules.add(`${selectedLevel}-${selectedModule}`);
    
    expandedLevels = expandedLevels;
    expandedModules = expandedModules;
  }
  
  function toggleMenu() {
    isOpen = !isOpen;
  }
  
  function toggleLevel(levelName) {
    if (expandedLevels.has(levelName)) {
      expandedLevels.delete(levelName);
    } else {
      expandedLevels.add(levelName);
    }
    expandedLevels = expandedLevels;
  }
  
  function toggleModule(levelName, moduleName) {
    const key = `${levelName}-${moduleName}`;
    if (expandedModules.has(key)) {
      expandedModules.delete(key);
    } else {
      expandedModules.add(key);
    }
    expandedModules = expandedModules;
  }
  
  function selectPath(level = null, module = null, chapter = null, subchapter = null) {
    selectedPath = { level, module, chapter, subchapter };
    isOpen = false;
    
    // Émettre l'événement de navigation
    dispatch('navigate', {
      level,
      module, 
      chapter,
      subchapter
    });
  }
  
  function clearSelection() {
    selectedPath = { level: null, module: null, chapter: null, subchapter: null };
    isOpen = false;
    
    dispatch('navigate', { 
      level: null, 
      module: null, 
      chapter: null, 
      subchapter: null 
    });
  }
  
  function switchTab(tab) {
    activeTab = tab;
  }
  
  // Fermer le menu si on clique à l'extérieur
  function handleClickOutside(event) {
    if (isOpen && !event.target.closest('.mobile-chapter-nav')) {
      isOpen = false;
    }
  }
  
  // Obtenir le texte d'affichage de la sélection hiérarchique
  function getSelectionDisplayText() {
    const selections = [];
    
    if (selectedPath.level) {
      selections.push(`🎓 ${selectedPath.level}`);
    }
    
    if (selectedPath.module) {
      selections.push(`📖 ${selectedPath.module}`);
    }
    
    if (selectedPath.chapter) {
      let chapterText = `📚 ${selectedPath.chapter}`;
      if (selectedPath.subchapter) {
        chapterText += ` › ${selectedPath.subchapter}`;
      }
      selections.push(chapterText);
    }
    
    return selections.length > 0 ? selections.join(' • ') : 'Choisir dans la hiérarchie';
  }
  
  // Obtenir les statistiques par onglet
  $: levelCount = hierarchyStructure.length;
  $: moduleCount = hierarchyStructure.reduce((total, level) => total + level.modules.length, 0);
  $: chapterCount = hierarchyStructure.reduce((total, level) => 
    total + level.modules.reduce((moduleTotal, module) => moduleTotal + module.chapters.length, 0), 0);
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
        <span class="mobile-nav-selection" class:mobile-nav-placeholder={!selectedPath.level && !selectedPath.module && !selectedPath.chapter}>
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
          <span>Chargement de la hiérarchie...</span>
        </div>
        
      {:else if error}
        <div class="mobile-nav-error">
          <span>{error}</span>
          <button on:click={loadHierarchicalStructure}>Réessayer</button>
        </div>
        
      {:else if hierarchyStructure.length === 0}
        <div class="mobile-nav-error">
          <span>Aucune donnée disponible</span>
        </div>
        
      {:else}
        <div class="mobile-nav-content-wrapper">
          <!-- Onglets pour la navigation hiérarchique -->
          <div class="mobile-nav-tabs">
            <button 
              class="mobile-nav-tab"
              class:mobile-nav-tab--active={activeTab === 'hierarchy'}
              on:click={() => switchTab('hierarchy')}
            >
              <span class="mobile-nav-tab-icon">🏗️</span>
              <span class="mobile-nav-tab-text">Hiérarchie</span>
              <span class="mobile-nav-tab-count">{levelCount}</span>
            </button>
            
            <button 
              class="mobile-nav-tab"
              class:mobile-nav-tab--active={activeTab === 'flat'}
              on:click={() => switchTab('flat')}
            >
              <span class="mobile-nav-tab-icon">📋</span>
              <span class="mobile-nav-tab-text">Vue plate</span>
              <span class="mobile-nav-tab-count">{chapterCount}</span>
            </button>
          </div>
          
          <!-- Option pour effacer la sélection -->
          {#if selectedPath.level || selectedPath.module || selectedPath.chapter}
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
          
          <!-- Contenu par onglets -->
          {#if activeTab === 'hierarchy'}
            <!-- Vue hiérarchique complète -->
            <div class="mobile-nav-hierarchy">
              {#each hierarchyStructure as level (level.name)}
                <!-- Niveau -->
                <div class="mobile-nav-level-container">
                  <div class="mobile-nav-level-header">
                    <button 
                      class="mobile-nav-expand-btn" 
                      on:click={() => toggleLevel(level.name)} 
                      disabled={level.modules.length === 0}
                    >
                      {#if level.modules.length > 0}
                        <span class="transform transition-transform duration-200">
                          {expandedLevels.has(level.name) ? '▼' : '▶'}
                        </span>
                      {:else}
                        <span class="text-gray-300">-</span>
                      {/if}
                    </button>
                    
                    <button 
                      class="mobile-nav-level-button"
                      class:mobile-nav-level-button--active={selectedPath.level === level.name && !selectedPath.module}
                      on:click={() => selectPath(level.name)}
                    >
                      <div class="mobile-nav-level-content">
                        <span class="mobile-nav-level-icon">🎓</span>
                        <span class="mobile-nav-level-name">{level.name}</span>
                        <span class="mobile-nav-level-count">({level.exerciseCount})</span>
                      </div>
                    </button>
                  </div>
                  
                  {#if level.modules && expandedLevels.has(level.name)}
                    <div class="mobile-nav-modules-container">
                      {#each level.modules as module (module.name)}
                        <!-- Module -->
                        <div class="mobile-nav-module-container">
                          <div class="mobile-nav-module-header">
                            <button 
                              class="mobile-nav-expand-btn" 
                              on:click={() => toggleModule(level.name, module.name)} 
                              disabled={module.chapters.length === 0}
                            >
                              {#if module.chapters.length > 0}
                                <span class="transform transition-transform duration-200">
                                  {expandedModules.has(`${level.name}-${module.name}`) ? '▼' : '▶'}
                                </span>
                              {:else}
                                <span class="text-gray-300">-</span>
                              {/if}
                            </button>
                            
                            <button 
                              class="mobile-nav-module-button"
                              class:mobile-nav-module-button--active={selectedPath.module === module.name && selectedPath.level === level.name && !selectedPath.chapter}
                              on:click={() => selectPath(level.name, module.name)}
                            >
                              <div class="mobile-nav-module-content">
                                <span class="mobile-nav-module-icon">📖</span>
                                <span class="mobile-nav-module-name">{module.name}</span>
                                <span class="mobile-nav-module-count">({module.exerciseCount})</span>
                              </div>
                            </button>
                          </div>
                          
                          {#if module.chapters && expandedModules.has(`${level.name}-${module.name}`)}
                            <div class="mobile-nav-chapters-container">
                              {#each module.chapters as chapter (chapter.name)}
                                <!-- Chapitre -->
                                <button 
                                  class="mobile-nav-chapter-button"
                                  class:mobile-nav-chapter-button--active={selectedPath.chapter === chapter.name && selectedPath.module === module.name && !selectedPath.subchapter}
                                  on:click={() => selectPath(level.name, module.name, chapter.name)}
                                >
                                  <div class="mobile-nav-chapter-content">
                                    <span class="mobile-nav-chapter-icon">📚</span>
                                    <span class="mobile-nav-chapter-name">{chapter.name}</span>
                                    <span class="mobile-nav-chapter-count">({chapter.exerciseCount})</span>
                                  </div>
                                </button>
                                
                                {#if chapter.subchapters && chapter.subchapters.length > 0 && selectedPath.chapter === chapter.name}
                                  <div class="mobile-nav-subchapters-container">
                                    {#each chapter.subchapters as subchapter (subchapter.name)}
                                      <button 
                                        class="mobile-nav-subchapter-button"
                                        class:mobile-nav-subchapter-button--active={selectedPath.subchapter === subchapter.name && selectedPath.chapter === chapter.name}
                                        on:click={() => selectPath(level.name, module.name, chapter.name, subchapter.name)}
                                      >
                                        <div class="mobile-nav-subchapter-content">
                                          <span class="mobile-nav-subchapter-name">{subchapter.name}</span>
                                          <span class="mobile-nav-subchapter-count">({subchapter.exerciseCount})</span>
                                        </div>
                                      </button>
                                    {/each}
                                  </div>
                                {/if}
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
          
          {#if activeTab === 'flat'}
            <!-- Vue plate par catégorie -->
            <div class="mobile-nav-flat">
              <!-- Tous les chapitres dans une liste plate -->
              <div class="mobile-nav-flat-section">
                <h4 class="mobile-nav-flat-title">📚 Tous les chapitres</h4>
                <div class="mobile-nav-flat-list">
                  {#each hierarchyStructure as level}
                    {#each level.modules as module}
                      {#each module.chapters as chapter}
                        <button 
                          class="mobile-nav-flat-item"
                          class:mobile-nav-flat-item--active={selectedPath.chapter === chapter.name}
                          on:click={() => selectPath(level.name, module.name, chapter.name)}
                        >
                          <div class="mobile-nav-flat-item-content">
                            <div class="mobile-nav-flat-item-info">
                              <span class="mobile-nav-flat-item-name">{chapter.name}</span>
                              <span class="mobile-nav-flat-item-path">{level.name} › {module.name}</span>
                            </div>
                            <span class="mobile-nav-flat-item-count">({chapter.exerciseCount})</span>
                          </div>
                        </button>
                      {/each}
                    {/each}
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>

</style>