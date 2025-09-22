<script> 
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let hierarchyStructure = [];
  let loading = true;
  let error = null;
  let isOpen = false;
  let activeTab = 'levels';
  let expandedLevels = new Set();
  let expandedModules = new Set();
  let containerEl;
  
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
  export let embedded = false;
  
  // Nouveau: prise en compte de la requête et filtres pour recalculer les comptages
  export let query = '';
  export let activeFilters = {
    level: '',
    module: '',
    chapter: '',
    subchapter: '',
    difficulty: '',
    author: '',
    hasSolution: '',
    hasIndication: ''
  };
  let lastParamsKey = '';
  let debounceTimer;

  // Charger la structure hiérarchique complète
  onMount(async () => {
    console.log('🚀 MobileChapterNav component mounted');
    await loadHierarchicalStructure();
  });
  
  async function loadHierarchicalStructure() {
    console.log('🔄 Starting loadHierarchicalStructure (Mobile)');
    
    try {
      // Utiliser l'API chapters avec le bon type + recherche/filters courants
      const params = new URLSearchParams();
      params.set('type', 'structure');
      if (query && query.trim()) params.set('q', query.trim());
      if (activeFilters?.level) params.set('level', activeFilters.level);
      if (activeFilters?.module) params.set('module', activeFilters.module);
      if (activeFilters?.chapter) params.set('chapter', activeFilters.chapter);
      if (activeFilters?.subchapter) params.set('subchapter', activeFilters.subchapter);
      if (activeFilters?.difficulty) params.set('difficulty', String(activeFilters.difficulty));
      if (activeFilters?.author) params.set('author', activeFilters.author);
      if (activeFilters?.hasSolution !== '' && activeFilters?.hasSolution !== undefined && activeFilters?.hasSolution !== null) {
        params.set('hasSolution', String(activeFilters.hasSolution));
      }
      if (activeFilters?.hasIndication !== '' && activeFilters?.hasIndication !== undefined && activeFilters?.hasIndication !== null) {
        params.set('hasIndication', String(activeFilters.hasIndication));
      }
      const response = await fetch(`/api/chapters?${params.toString()}`);
      
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

  function buildParamsKey(qParam, filtersParam) {
    const q = (qParam || '').trim();
    const f = filtersParam || {};
    return JSON.stringify({
      q,
      level: f.level || '',
      module: f.module || '',
      chapter: f.chapter || '',
      subchapter: f.subchapter || '',
      difficulty: f.difficulty || '',
      author: f.author || '',
      hasSolution: f.hasSolution ?? '',
      hasIndication: f.hasIndication ?? ''
    });
  }

  // Initialiser la clé pour éviter un double chargement après onMount
  lastParamsKey = buildParamsKey(query, activeFilters);

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Recharger la structure quand la requête ou les filtres changent
  $: {
    // Référencer explicitement `query` et `activeFilters` pour la réactivité
    const key = buildParamsKey(query, activeFilters);
    if (key !== lastParamsKey) {
      lastParamsKey = key;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadHierarchicalStructure();
      }, 1000);
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
    if (embedded) return;
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
    if (!embedded) {
      isOpen = false;
    }
    
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
    if (!embedded) {
      isOpen = false;
    }
    
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

  $: if (embedded && !isOpen) {
    isOpen = true;
  }

  // Fermer le menu si on clique à l'extérieur
  function handleClickOutside(event) {
    if (embedded) return;
    if (isOpen && containerEl && !containerEl.contains(event.target)) {
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

<div class="mobile-chapter-nav" class:mobile-chapter-nav--embedded={embedded} bind:this={containerEl}>
  {#if !embedded}
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
  {/if}
  
  <!-- Menu déroulant -->
  {#if embedded || isOpen}
    <div class="mobile-nav-dropdown" class:mobile-nav-dropdown--embedded={embedded}>
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
  .mobile-chapter-nav { position: relative; }
  @media (min-width: 1024px) { .mobile-chapter-nav { display: none; } }
  .mobile-nav-trigger { width:100%; padding:1rem; background:#fff; border:1px solid #d1d5db; border-radius:0.5rem; box-shadow:0 1px 2px rgba(0,0,0,0.05); }
  .mobile-nav-trigger:hover { background:#f9fafb; }
  .mobile-nav-trigger--active { background:#f3f4f6; border-color:#9ca3af; }
  .mobile-nav-content { display:flex; align-items:center; gap:0.75rem; }
  .mobile-nav-icon { color:#4b5563; }
  .mobile-nav-text { flex:1; text-align:left; min-width:0; }
  .mobile-nav-selection { font-weight:500; color:#111827; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mobile-nav-placeholder { color:#6b7280; font-weight:400; }
  .mobile-nav-arrow { color:#9ca3af; flex-shrink:0; }
.mobile-nav-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin-top: 0.5rem;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  z-index: 50;
  animation: mobile-slide-down .2s ease-out;
  max-height: min(70vh, 540px);
  overflow-y: auto;
}
.mobile-chapter-nav--embedded {
  position: static;
  width: 100%;
}
.mobile-nav-dropdown--embedded {
  position: static;
  margin-top: 0;
  max-height: none;
  overflow: visible;
  box-shadow: none;
  border: 1px solid #d1d5db;
}
.mobile-nav-content-wrapper { padding-bottom:0.5rem; }
  .mobile-nav-loading, .mobile-nav-error { display:flex; align-items:center; justify-content:center; gap:0.75rem; padding:1.5rem; color:#4b5563; }
  .mobile-loading-spinner { width:1rem; height:1rem; border:2px solid #d1d5db; border-top-color:#2563eb; border-radius:9999px; animation:spin 1s linear infinite; }
  .mobile-nav-error button { color:#2563eb; font-weight:500; }
  .mobile-nav-tabs { display:flex; background:#f9fafb; border-bottom:1px solid #e5e7eb; }
  .mobile-nav-tab { flex:1; display:flex; flex-direction:column; align-items:center; padding:0.75rem 0.5rem; font-size:0.875rem; transition:color .2s; }
  .mobile-nav-tab--active { background:#fff; border-bottom:2px solid #3b82f6; color:#2563eb; }
  .mobile-nav-tab-icon { font-size:1.125rem; margin-bottom:0.25rem; }
  .mobile-nav-tab-text { font-size:0.75rem; font-weight:500; }
  .mobile-nav-tab-count { font-size:0.75rem; background:#e5e7eb; color:#4b5563; border-radius:9999px; padding:0 0.5rem; min-width:20px; text-align:center; margin-top:0.25rem; }
  .mobile-nav-tab--active .mobile-nav-tab-count { background:#dbeafe; color:#2563eb; }
  .mobile-nav-option--clear { width:100%; display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; text-align:left; background:#fff; color:#dc2626; border-bottom:1px solid #f3f4f6; }
  .mobile-nav-option--clear:hover { background:#fef2f2; }
  .mobile-nav-hierarchy { border-top:1px solid #f3f4f6; border-bottom:1px solid #f3f4f6; }
  .mobile-nav-level-container { padding:0.25rem 0; }
  .mobile-nav-level-header { display:flex; align-items:center; }
  .mobile-nav-expand-btn { padding:0.5rem; color:#4b5563; }
  .mobile-nav-expand-btn:hover { color:#1f2937; }
  .mobile-nav-level-button { flex:1; text-align:left; padding:0.5rem; border-radius:0.25rem; }
  .mobile-nav-level-button:hover { background:#eff6ff; }
  .mobile-nav-level-button--active { background:#dbeafe; color:#1e40af; }
  .mobile-nav-level-content, .mobile-nav-module-content, .mobile-nav-chapter-content { display:flex; align-items:center; gap:0.5rem; }
  .mobile-nav-level-icon, .mobile-nav-module-icon { }
  .mobile-nav-level-name, .mobile-nav-module-name { font-weight:500; }
  .mobile-nav-level-count, .mobile-nav-module-count { color:#6b7280; font-size:0.875rem; }
  .mobile-nav-modules-container { margin-left:1.5rem; border-left:2px solid #e5e7eb; padding-left:0.5rem; }
  .mobile-nav-module-container { padding:0.25rem 0; }
  .mobile-nav-module-header { display:flex; align-items:center; }
  .mobile-nav-module-button { flex:1; text-align:left; padding:0.5rem; border-radius:0.25rem; }
  .mobile-nav-module-button:hover { background:#eff6ff; }
  .mobile-nav-module-button--active { background:#dbeafe; color:#1e40af; }
  .mobile-nav-chapters-container { margin-left:1.5rem; border-left:2px solid #e5e7eb; padding-left:0.5rem; display:block; }
  .mobile-nav-chapter-button { width:100%; text-align:left; padding:0.5rem; border-radius:0.25rem; }
  .mobile-nav-chapter-button:hover { background:#f9fafb; }
  .mobile-nav-chapter-button--active { background:#f3f4f6; color:#1f2937; }
  .mobile-nav-chapter-icon { font-size:0.875rem; color:#2563eb; }
  .mobile-nav-chapter-name { font-weight:500; }
  .mobile-nav-subchapters-container { margin-left:1rem; margin-top:0.25rem; display:block; }
  .mobile-nav-subchapter-button { width:100%; text-align:left; padding:0.5rem; border-radius:0.25rem; font-size:0.875rem; }
  .mobile-nav-subchapter-button:hover { background:#f9fafb; }
  .mobile-nav-subchapter-button--active { background:#eff6ff; color:#2563eb; }
  .mobile-nav-subchapter-content { display:flex; align-items:center; gap:0.5rem; }
  .mobile-nav-subchapter-name { color:#374151; }
  .mobile-nav-subchapter-count { font-size:0.75rem; color:#6b7280; margin-left:auto; }
  .mobile-nav-flat { padding:0.5rem; }
  .mobile-nav-flat-section { margin-bottom:1rem; }
  .mobile-nav-flat-title { font-weight:700; color:#1f2937; margin-bottom:0.5rem; padding:0 0.5rem; }
  .mobile-nav-flat-list { display:block; }
  .mobile-nav-flat-item { width:100%; text-align:left; padding:0.75rem; border:1px solid #f3f4f6; border-radius:0.5rem; }
  .mobile-nav-flat-item:hover { background:#f9fafb; }
  .mobile-nav-flat-item--active { background:#eff6ff; color:#2563eb; border-color:#bfdbfe; }
  .mobile-nav-flat-item-content { display:flex; align-items:center; justify-content:space-between; }
  .mobile-nav-flat-item-info { flex:1; }
  .mobile-nav-flat-item-name { font-weight:500; display:block; }
  .mobile-nav-flat-item-path { font-size:0.875rem; color:#6b7280; }
  .mobile-nav-flat-item-count { font-size:0.875rem; color:#6b7280; margin-left:0.5rem; }
  @keyframes mobile-slide-down { from { opacity:0; transform: translateY(-10px);} to { opacity:1; transform: translateY(0);} }
  @media (max-width: 380px) {
    .mobile-nav-trigger { padding:0.75rem; }
    .mobile-nav-content { gap:0.5rem; }
    .mobile-nav-text { font-size:0.875rem; }
    .mobile-nav-level-name, .mobile-nav-module-name, .mobile-nav-chapter-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .mobile-nav-flat-item-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  }
  @keyframes spin { to { transform:rotate(360deg);} }
</style>
