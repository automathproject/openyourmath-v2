<!-- src/lib/components/ChapterNavigation.svelte - Version hiérarchique Niveau > Module > Chapitre -->
<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let hierarchyStructure = [];  // Structure hiérarchique complète
  let loading = true;
  let error = null;
  let loadingPromise = null; // NOUVEAU : Guard contre les doubles chargements
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
  
  // Charger la structure hiérarchique complète
  onMount(async () => {
    console.log('🚀 ChapterNavigation component mounted');
    await loadHierarchicalStructure();
  });
  
  async function loadHierarchicalStructure() {
    // NOUVEAU : Éviter les doubles chargements
    if (loadingPromise) {
      console.log('⚠️ loadHierarchicalStructure already in progress, skipping');
      return loadingPromise;
    }
    
    console.log('🔄 Starting loadHierarchicalStructure');
    
    loadingPromise = (async () => {
      try {
        // Charger toutes les données en parallèle - LIMITE pour éviter trop de données
        const [exercisesResponse] = await Promise.all([
          fetch('/api/search?limit=500') // Limiter pour éviter les doublons
        ]);
        
        if (exercisesResponse.ok) {
          const data = await exercisesResponse.json();
          hierarchyStructure = buildHierarchy(data.results || []);
          console.log('Hierarchy loaded:', hierarchyStructure.length, 'levels');
        } else {
          error = 'Impossible de charger la structure';
        }
      } catch (err) {
        error = 'Erreur de connexion';
        console.error('Failed to load hierarchy:', err);
      } finally {
        loading = false;
        loadingPromise = null; // Reset après completion
      }
    })();
    
    return loadingPromise;
  }
  
  // Construction de la hiérarchie Niveau > Module > Chapitre
  function buildHierarchy(exercises) {
    const hierarchy = new Map();
    
    // DÉBOGAGE : Éviter les doublons
    const uniqueExercises = exercises.filter((exercise, index, self) => 
      index === self.findIndex(e => e.uuid === exercise.uuid)
    );
    
    console.log(`Building hierarchy from ${exercises.length} exercises (${uniqueExercises.length} unique)`);
    
    uniqueExercises.forEach(exercise => {
      const level = exercise.difficulty || 'Non spécifié';
      const module = exercise.module || 'Non spécifié';
      const chapter = exercise.chapter || 'Non spécifié';
      const subchapter = exercise.subchapter;
      
      // Niveau
      if (!hierarchy.has(level)) {
        hierarchy.set(level, {
          name: level,
          exerciseCount: 0,
          modules: new Map()
        });
      }
      
      const levelObj = hierarchy.get(level);
      levelObj.exerciseCount++;
      
      // Module dans le niveau
      if (!levelObj.modules.has(module)) {
        levelObj.modules.set(module, {
          name: module,
          exerciseCount: 0,
          chapters: new Map()
        });
      }
      
      const moduleObj = levelObj.modules.get(module);
      moduleObj.exerciseCount++;
      
      // Chapitre dans le module
      if (!moduleObj.chapters.has(chapter)) {
        moduleObj.chapters.set(chapter, {
          name: chapter,
          exerciseCount: 0,
          subchapters: new Map()
        });
      }
      
      const chapterObj = moduleObj.chapters.get(chapter);
      chapterObj.exerciseCount++;
      
      // Sous-chapitre dans le chapitre (si existe)
      if (subchapter) {
        if (!chapterObj.subchapters.has(subchapter)) {
          chapterObj.subchapters.set(subchapter, {
            name: subchapter,
            exerciseCount: 0
          });
        }
        chapterObj.subchapters.get(subchapter).exerciseCount++;
      }
    });
    
    // Convertir en arrays et trier
    const result = Array.from(hierarchy.entries()).map(([levelName, levelData]) => ({
      name: levelName,
      exerciseCount: levelData.exerciseCount,
      modules: Array.from(levelData.modules.entries()).map(([moduleName, moduleData]) => ({
        name: moduleName,
        exerciseCount: moduleData.exerciseCount,
        chapters: Array.from(moduleData.chapters.entries()).map(([chapterName, chapterData]) => ({
          name: chapterName,
          exerciseCount: chapterData.exerciseCount,
          subchapters: Array.from(chapterData.subchapters.entries()).map(([subName, subData]) => ({
            name: subName,
            exerciseCount: subData.exerciseCount
          })).sort((a, b) => a.name.localeCompare(b.name))
        })).sort((a, b) => a.name.localeCompare(b.name))
      })).sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => {
      // Tri intelligent des niveaux
      const getOrder = (level) => {
        if (level.startsWith('L')) return parseInt(level.substring(1)) || 0;
        if (level.startsWith('M')) return 100 + (parseInt(level.substring(1)) || 0);
        return 1000;
      };
      return getOrder(a.name) - getOrder(b.name);
    });
    
    console.log(`Hierarchy built with ${result.length} levels`);
    return result;
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
    if (selectedChapter) expandedChapters.add(`${selectedLevel}-${selectedModule}-${selectedChapter}`);
    
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
</script>

<!-- ======================================================= -->
<!-- LA PARTIE HTML COMMENCE ICI, EN DEHORS DE LA BALISE SCRIPT -->
<!-- ======================================================= -->

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
      <span class="font-semibold">🧭 Actif :</span>
      {#if selectedPath.level} › <span class="text-blue-700">🎓 {selectedPath.level}</span>{/if}
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
        <button on:click={fetchHierarchy} class="font-semibold underline mt-2">Réessayer</button>
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

<!-- ======================================================= -->
<!-- LA BALISE STYLE EST OPTIONNELLE MAIS MONTRE LA STRUCTURE -->
<!-- ======================================================= -->
<style>
  /* Les styles spécifiques à CE composant iraient ici.
     Puisque nous avons tout factorisé dans app.css, cette section peut rester vide. */
</style>