<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let hierarchyStructure = [];
  let loading = true;
  let error = null;
  let expandedLevels = new Set();
  let expandedModules = new Set();
  let expandedChapters = new Set();
  
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
  export let compact = false;
  
  // Mémoriser la sélection précédente pour éviter de ré-étendre après un repli manuel
  let prevSelectedLevel = null;
  let prevSelectedModule = null;
  let prevSelectedChapter = null;
  
  // Charger la structure hiérarchique avec les vrais comptages
  onMount(async () => {
    console.log('🚀 ChapterNavigation component mounted');
    await loadHierarchicalStructure();
  });
  
  async function loadHierarchicalStructure() {
    console.log('🔄 Starting loadHierarchicalStructure');
    
    try {
      // CORRECTION: Utiliser l'API chapters avec le bon type
      const response = await fetch('/api/chapters?type=structure');
      
      if (response.ok) {
        const data = await response.json();
        hierarchyStructure = data.structure || [];
        console.log('Hierarchy loaded:', hierarchyStructure.length, 'levels');
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
    
    // Auto-étendre uniquement quand la sélection change (et pas après un toggle manuel)
    const levelChanged = selectedLevel !== prevSelectedLevel;
    const moduleChanged = selectedModule !== prevSelectedModule || selectedLevel !== prevSelectedLevel;
    const chapterChanged = selectedChapter !== prevSelectedChapter || moduleChanged;

    if (levelChanged && selectedLevel) {
      expandedLevels.add(selectedLevel);
    }
    if (moduleChanged && selectedLevel && selectedModule) {
      expandedModules.add(`${selectedLevel}-${selectedModule}`);
    }
    if (chapterChanged && selectedLevel && selectedModule && selectedChapter) {
      expandedChapters.add(`${selectedLevel}-${selectedModule}-${selectedChapter}`);
    }

    prevSelectedLevel = selectedLevel;
    prevSelectedModule = selectedModule;
    prevSelectedChapter = selectedChapter;
    
    expandedLevels = expandedLevels;
    expandedModules = expandedModules;
    expandedChapters = expandedChapters;
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
  
  function toggleChapter(levelName, moduleName, chapterName) {
    const key = `${levelName}-${moduleName}-${chapterName}`;
    if (expandedChapters.has(key)) {
      expandedChapters.delete(key);
    } else {
      expandedChapters.add(key);
    }
    expandedChapters = expandedChapters;
  }
  
  function selectPath(level = null, module = null, chapter = null, subchapter = null) {
    selectedPath = { level, module, chapter, subchapter };
    
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
    dispatch('navigate', { 
      level: null, 
      module: null, 
      chapter: null, 
      subchapter: null 
    });
  }

  function expandAll() {
    hierarchyStructure.forEach(level => {
      expandedLevels.add(level.name);
      level.modules.forEach(module => {
        expandedModules.add(`${level.name}-${module.name}`);
        module.chapters.forEach(chapter => {
          expandedChapters.add(`${level.name}-${module.name}-${chapter.name}`);
        });
      });
    });
    expandedLevels = expandedLevels;
    expandedModules = expandedModules;
    expandedChapters = expandedChapters;
  }

  function collapseAll() {
    expandedLevels.clear();
    expandedModules.clear();
    expandedChapters.clear();
    expandedLevels = expandedLevels;
    expandedModules = expandedModules;
    expandedChapters = expandedChapters;
  }
</script>

<div class="p-4 bg-white rounded-lg border shadow-sm">
  <!-- En-tête de la navigation -->
  <div class="flex items-center justify-between mb-4">
    <h3 class="font-bold text-gray-800">{compact ? 'Navigation' : 'Navigation hiérarchique'}</h3>
    {#if selectedPath.level || selectedPath.module || selectedPath.chapter}
      <button on:click={clearSelection} class="btn-icon text-gray-500 hover:text-gray-800" title="Effacer la sélection">
        ✕
      </button>
    {/if}
  </div>

  <!-- Fil d'Ariane pour la sélection active (non compact) -->
  {#if (selectedPath.level || selectedPath.module || selectedPath.chapter) && !compact}
    <div class="text-sm text-gray-600 bg-gray-50 p-2 rounded-md mb-4 truncate">
      {#if selectedPath.level}<span class="text-blue-700">🎓 {selectedPath.level}</span>{/if}
      {#if selectedPath.module} › <span class="text-blue-700">📖 {selectedPath.module}</span>{/if}
      {#if selectedPath.chapter} › <span class="text-blue-700">📚 {selectedPath.chapter}</span>{/if}
      {#if selectedPath.subchapter} › <span class="text-blue-700">{selectedPath.subchapter}</span>{/if}
    </div>
  {/if}

  <!-- Contenu principal -->
  <div class="space-y-1">
    {#if loading}
      <div class="text-center text-gray-500 py-4">Chargement de la hiérarchie...</div>
    {:else if error}
      <div class="p-3 bg-red-50 text-red-700 rounded-md text-sm">
        {error}
        <button on:click={loadHierarchicalStructure} class="font-semibold underline mt-2">Réessayer</button>
      </div>
    {:else if hierarchyStructure.length === 0}
      <div class="text-center text-gray-500 py-4">Aucune donnée disponible</div>
    {:else}
      <!-- Boucle sur les Niveaux -->
      {#each hierarchyStructure as level (level.name)}
        <div class="nav-item" class:is-active={selectedPath.level === level.name && !selectedPath.module}>
          <button class="btn-icon -ml-1" on:click={() => toggleLevel(level.name)} disabled={level.modules.length === 0}>
            {#if level.modules.length > 0}
              <span class="transform transition-transform duration-200">{expandedLevels.has(level.name) ? '▼' : '▶'}</span>
            {:else}
              <span class="text-gray-300">-</span>
            {/if}
          </button>
          <div class="nav-item-content" on:click={() => selectPath(level.name)}>
            🎓 {level.name} ({level.exerciseCount})
          </div>
        </div>

        {#if level.modules && expandedLevels.has(level.name)}
          <div class="nav-sublist">
            <!-- Boucle sur les Modules -->
            {#each level.modules as module (module.name)}
              <div class="nav-item" class:is-active={selectedPath.module === module.name && selectedPath.level === level.name && !selectedPath.chapter}>
                <button class="btn-icon -ml-1" on:click={() => toggleModule(level.name, module.name)} disabled={module.chapters.length === 0}>
                  {#if module.chapters.length > 0}
                    <span class="transform transition-transform duration-200">{expandedModules.has(`${level.name}-${module.name}`) ? '▼' : '▶'}</span>
                  {:else}
                    <span class="text-gray-300">-</span>
                  {/if}
                </button>
                <div class="nav-item-content" on:click={() => selectPath(level.name, module.name)}>
                  📖 {module.name} ({module.exerciseCount})
                </div>
              </div>
              
              {#if module.chapters && expandedModules.has(`${level.name}-${module.name}`)}
                <div class="nav-sublist">
                  <!-- Boucle sur les Chapitres -->
                  {#each module.chapters as chapter (chapter.name)}
                    <div class="nav-item" class:is-active={selectedPath.chapter === chapter.name && selectedPath.module === module.name && !selectedPath.subchapter}>
                      <button class="btn-icon -ml-1" on:click={() => toggleChapter(level.name, module.name, chapter.name)} disabled={chapter.subchapters.length === 0}>
                        {#if chapter.subchapters.length > 0}
                          <span class="transform transition-transform duration-200">{expandedChapters.has(`${level.name}-${module.name}-${chapter.name}`) ? '▼' : '▶'}</span>
                        {:else}
                           <span class="text-gray-300">-</span>
                        {/if}
                      </button>
                      <div class="nav-item-content" on:click={() => selectPath(level.name, module.name, chapter.name)}>
                        📚 {chapter.name} ({chapter.exerciseCount})
                      </div>
                    </div>

                    {#if chapter.subchapters && expandedChapters.has(`${level.name}-${module.name}-${chapter.name}`)}
                      <div class="nav-sublist">
                        <!-- Boucle sur les Sous-chapitres -->
                        {#each chapter.subchapters as subchapter (subchapter.name)}
                          <div 
                            class="nav-item" 
                            class:is-active={selectedPath.subchapter === subchapter.name && selectedPath.chapter === chapter.name}
                            on:click={() => selectPath(level.name, module.name, chapter.name, subchapter.name)}>
                            <span class="w-7 text-center text-gray-300">-</span>
                            <div class="nav-item-content">
                              {subchapter.name} ({subchapter.exerciseCount})
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- Actions (non compact) -->
  {#if !compact && hierarchyStructure.length > 0}
    <div class="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
      <button on:click={expandAll} class="btn-text text-sm">Tout développer</button>
      <button on:click={collapseAll} class="btn-text text-sm">Tout réduire</button>
    </div>
  {/if}
</div>

<style>
  /* Local styles for hierarchical navigation (moved from app.css) */
  /* fond gris clair pour le conteneur */

  .nav-item {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    padding: 0.25rem 0.25rem;
    border-radius: 0.375rem;
    gap: 0.25rem;
  }

  .nav-item:not(.is-active):hover {
    background: #f3f4f6; /* gray-100 */
  }

  .nav-item.is-active {
    background: #dbeafe; /* blue-100 */
    color: #1e40af;      /* blue-800 */
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
  }

  .nav-item-content {
    flex: 1;
    min-width: 0;
    margin-left: 0.25rem;
    cursor: pointer;
  }

  .nav-sublist {
    border-left: 2px solid #e5e7eb; /* gray-200 */
    margin-left: 1rem;
    padding-left: 0.5rem;
  }
</style>
