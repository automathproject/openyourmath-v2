<!-- src/routes/exercise/list/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import ExerciseListEditor from '$lib/components/ExerciseListEditor.svelte';
  import { 
    exerciseList, 
    selectedExerciseIndex, 
    selectedExercise,
    exerciseLoading,
    exerciseError,
    currentPosition,
    hasExercises,
    listActions,
    listUtils
  } from '$lib/stores/listStore.js';
  
  export let data;
  
  let showHint = false;
  let showSolution = false;
  let shareUrl = '';
  let isEditMode = false; // NOUVEAU : État du mode édition
  
  // Nouveau : État pour le champ UUID
  let uuidInputValue = '';
  let uuidInputLoading = false;
  let uuidInputFeedback = '';
  let uuidInputError = false;
  
  // Initialiser la liste depuis les données du serveur
  onMount(() => {
    if (data.exercises && data.exercises.length > 0) {
      // Mettre à jour la liste seulement si elle vient de l'URL
      exerciseList.set(data.exercises);
      
      // Sélectionner le premier exercice
      selectedExerciseIndex.set(0);
      if (data.exercises[0].fullExercise) {
        selectedExercise.set(data.exercises[0].fullExercise);
      } else {
        listActions.selectExercise(0);
      }
    } else {
      // Si pas d'exercices dans l'URL, garder la liste existante
      // Ne pas vider exerciseList ici
      selectedExercise.set(null);
      selectedExerciseIndex.set(0);
    }
    
    // Générer l'URL de partage et initialiser le champ UUID
    shareUrl = listUtils.getShareableUrl(window.location.origin);
    updateUuidInput();
  });
  
  // Réactivité pour mettre à jour l'URL de partage et le champ UUID
  $: if ($exerciseList) {
    shareUrl = listUtils.getShareableUrl(typeof window !== 'undefined' ? window.location.origin : '');
    updateUuidInput();
  }
  
  // Mettre à jour le champ UUID avec la liste actuelle
  function updateUuidInput() {
    uuidInputValue = listUtils.formatCurrentList();
    uuidInputFeedback = '';
    uuidInputError = false;
  }
  
  // Analyser le contenu du champ UUID en temps réel
  function analyzeUuidInput() {
    if (!uuidInputValue.trim()) {
      uuidInputFeedback = '';
      uuidInputError = false;
      return;
    }
    
    const stats = listUtils.countValidUuids(uuidInputValue);
    
    if (stats.valid === 0) {
      uuidInputFeedback = 'Aucun UUID valide détecté';
      uuidInputError = true;
    } else if (stats.invalid > 0) {
      uuidInputFeedback = `${stats.valid} UUID${stats.valid > 1 ? 's' : ''} valide${stats.valid > 1 ? 's' : ''}, ${stats.invalid} invalide${stats.invalid > 1 ? 's' : ''}`;
      uuidInputError = true;
    } else {
      uuidInputFeedback = `${stats.valid} UUID${stats.valid > 1 ? 's' : ''} détecté${stats.valid > 1 ? 's' : ''}`;
      uuidInputError = false;
    }
  }
  
  // Charger la liste depuis le champ UUID
  async function loadFromUuidInput() {
    if (!uuidInputValue.trim()) {
      listActions.clearList();
      updateUrl();
      return;
    }
    
    const stats = listUtils.countValidUuids(uuidInputValue);
    if (stats.valid === 0) {
      uuidInputFeedback = 'Aucun UUID valide à charger';
      uuidInputError = true;
      return;
    }
    
    uuidInputLoading = true;
    uuidInputFeedback = 'Chargement...';
    uuidInputError = false;
    
    try {
      await listActions.loadFromUuidString(uuidInputValue);
      updateUrl();
      uuidInputFeedback = `${stats.valid} exercice${stats.valid > 1 ? 's' : ''} chargé${stats.valid > 1 ? 's' : ''}`;
      uuidInputError = false;
    } catch (err) {
      uuidInputFeedback = 'Erreur lors du chargement';
      uuidInputError = true;
      console.error('Error loading from UUID input:', err);
    } finally {
      uuidInputLoading = false;
    }
  }
  
  // Copier le contenu du champ UUID
  async function copyUuidInput() {
    if (!uuidInputValue.trim()) {
      uuidInputFeedback = 'Rien à copier';
      uuidInputError = true;
      return;
    }
    
    try {
      await navigator.clipboard.writeText(uuidInputValue);
      uuidInputFeedback = 'Liste copiée !';
      uuidInputError = false;
      
      // Effacer le feedback après 2 secondes
      setTimeout(() => {
        if (uuidInputFeedback === 'Liste copiée !') {
          uuidInputFeedback = '';
        }
      }, 2000);
    } catch (err) {
      uuidInputFeedback = 'Erreur de copie';
      uuidInputError = true;
      console.error('Copy failed:', err);
    }
  }
  
  // NOUVEAU : Gestion du mode édition
  function toggleEditMode() {
    isEditMode = !isEditMode;
  }
  
  // NOUVEAU : Gestionnaires d'événements de l'éditeur
  function handleReorder(event) {
    const { exercises, newSelectedIndex } = event.detail;
    listActions.reorderExercises(exercises, newSelectedIndex);
    updateUrl();
  }
  
  function handleDeleteMultiple(event) {
    const { indices } = event.detail;
    listActions.removeMultipleExercises(indices);
    updateUrl();
  }
  
  function handleSelectFromEditor(event) {
    const { index } = event.detail;
    listActions.selectExercise(index);
  }
  
  function handleRemoveFromEditor(event) {
    const { index } = event.detail;
    removeExercise(index);
  }
  
  // Fonctions de navigation (existantes)
  function selectExercise(index) {
    listActions.selectExercise(index);
  }
  
  function removeExercise(index) {
    listActions.removeExercise(index);
    updateUrl();
  }
  
  function clearList() {
    listActions.clearList();
    goto('/exercise/list');
  }
  
  function updateUrl() {
    const newUrl = listActions.getCurrentListUrl();
    goto(newUrl, { replaceState: true });
  }
  
  // Partage de la liste
  function shareList() {
    if (navigator.share && shareUrl) {
      navigator.share({
        title: `Liste d'exercices (${$exerciseList.length} exercices)`,
        text: `Découvrez cette liste de ${$exerciseList.length} exercices de mathématiques`,
        url: shareUrl
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Lien copié dans le presse-papier !');
    }
  }
  
  // Navigation clavier
  function handleKeydown(event) {
    if (event.key === 'ArrowUp' && $currentPosition.hasPrevious) {
      event.preventDefault();
      listActions.previousExercise();
    } else if (event.key === 'ArrowDown' && $currentPosition.hasNext) {
      event.preventDefault();
      listActions.nextExercise();
    }
  }
</script>

<svelte:head>
  <title>Liste d'exercices ({$exerciseList.length}) - OpenYourMath</title>
  <meta name="description" content="Liste personnalisée de {$exerciseList.length} exercices de mathématiques" />
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="exercise-list-page">
  <!-- Header de la page -->
  <header class="list-header">
    <div class="list-header-content">
      <div class="list-header-info">
        <h1 class="list-title">
          Liste d'exercices
          {#if $hasExercises}
            <span class="list-count">({$exerciseList.length})</span>
          {/if}
        </h1>
        
        {#if data.meta?.errors > 0}
          <div class="list-warning">
            ⚠️ {data.meta.errors} exercice{data.meta.errors > 1 ? 's' : ''} n'ont pas pu être chargé{data.meta.errors > 1 ? 's' : ''}
          </div>
        {/if}
        
        {#if data.meta?.wasLimited}
          <div class="list-info">
            ℹ️ Liste limitée à {data.meta.total} exercices (sur {data.meta.originalCount} demandés)
          </div>
        {/if}
      </div>
      
      <div class="list-actions">
        <!-- Contrôle UUID -->
        <div class="uuid-control">
          <div class="uuid-input-wrapper">
            <input 
              type="text"
              bind:value={uuidInputValue}
              on:input={analyzeUuidInput}
              placeholder="uuid1, uuid2, uuid3..."
              class="uuid-input"
              class:uuid-input--error={uuidInputError}
              disabled={uuidInputLoading}
            />
            
            <div class="uuid-buttons">
              <button 
                on:click={copyUuidInput}
                class="uuid-btn uuid-btn--copy"
                disabled={!uuidInputValue.trim() || uuidInputLoading}
                title="Copier la liste d'UUIDs"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              
              <button 
                on:click={loadFromUuidInput}
                class="uuid-btn uuid-btn--load"
                disabled={uuidInputLoading}
                title="Charger cette liste d'UUIDs"
              >
                {#if uuidInputLoading}
                  <div class="loading-spinner-small"></div>
                {:else}
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>
          
          {#if uuidInputFeedback}
            <div class="uuid-feedback" class:uuid-feedback--error={uuidInputError}>
              {uuidInputFeedback}
            </div>
          {/if}
        </div>
        
        {#if $hasExercises}
          <button 
            on:click={shareList}
            class="list-action-btn list-action-btn--primary"
            aria-label="Partager la liste d'exercices"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Partager
          </button>
          
          <button 
            on:click={clearList}
            class="list-action-btn list-action-btn--danger"
            aria-label="Vider la liste d'exercices"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Vider
          </button>
        {/if}
        
        <a 
          href="/"
          class="list-action-btn list-action-btn--secondary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Rechercher
        </a>
      </div>
    </div>
  </header>
  
  {#if !$hasExercises}
    <!-- État vide -->
    <div class="empty-state">
      <div class="empty-state-content">
        <div class="empty-state-icon">
          <svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h2 class="empty-state-title">Aucun exercice dans cette liste</h2>
        <p class="empty-state-description">
          Ajoutez des exercices à votre liste en utilisant la recherche, ou collez des UUIDs dans le champ ci-dessus.
        </p>
        
        <div class="empty-state-actions">
          <a 
            href="/"
            class="btn btn--primary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Commencer la recherche
          </a>
        </div>
        
        <div class="empty-state-help">
          <details class="help-details">
            <summary class="help-summary">Format d'URL accepté</summary>
            <div class="help-content">
              <p>Utilisez le format :</p>
              <code class="help-code">/exercise/list?list=uuid1,uuid2,uuid3</code>
              <p class="help-note">Les UUIDs doivent être séparés par des virgules.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  {:else}
    <!-- Interface deux colonnes -->
    <div class="list-container">
      <!-- Colonne de navigation -->
      <aside class="list-navigation">
        <div class="nav-header">
          <h2 class="nav-title">Exercices</h2>
          <div class="nav-header-actions">
            {#if $currentPosition.total > 0}
              <span class="nav-counter">
                {$currentPosition.current} / {$currentPosition.total}
              </span>
            {/if}
            
            <!-- NOUVEAU : Bouton d'édition -->
            <button 
              on:click={toggleEditMode}
              class="edit-toggle-btn"
              class:edit-toggle-btn--active={isEditMode}
              title={isEditMode ? 'Quitter le mode édition' : 'Éditer la liste'}
            >
              {#if isEditMode}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              {/if}
            </button>
          </div>
        </div>
        
        {#if !isEditMode}
          <div class="nav-controls">
            <button 
              on:click={listActions.previousExercise}
              disabled={!$currentPosition.hasPrevious}
              class="nav-btn nav-btn--prev"
              aria-label="Exercice précédent"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            
            <button 
              on:click={listActions.nextExercise}
              disabled={!$currentPosition.hasNext}
              class="nav-btn nav-btn--next"
              aria-label="Exercice suivant"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        {/if}
        
        <!-- NOUVEAU : Composant éditeur -->
        <ExerciseListEditor 
          exercises={$exerciseList}
          selectedIndex={$selectedExerciseIndex}
          {isEditMode}
          on:reorder={handleReorder}
          on:deleteMultiple={handleDeleteMultiple}
          on:select={handleSelectFromEditor}
          on:remove={handleRemoveFromEditor}
        />
      </aside>
      
      <!-- Colonne d'affichage -->
      <main class="exercise-display">
        {#if $exerciseLoading}
          <div class="exercise-loading">
            <div class="loading-spinner"></div>
            <p>Chargement de l'exercice...</p>
          </div>
        {:else if $exerciseError}
          <div class="exercise-error">
            <div class="error-icon">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="error-title">Erreur de chargement</h3>
            <p class="error-message">{$exerciseError}</p>
            <button 
              on:click={() => listActions.selectExercise($selectedExerciseIndex)}
              class="error-retry-btn"
            >
              Réessayer
            </button>
          </div>
        {:else if $selectedExercise}
          <article class="exercise-content-wrapper">
            <!-- Header de l'exercice -->
            <header class="exercise-header">
              <div class="exercise-breadcrumb">
                <div class="breadcrumb-left">
                  <span class="breadcrumb-item">Exercice {$currentPosition.current}</span>
                  {#if $selectedExercise?.chapter}
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-item">{$selectedExercise.chapter}</span>
                  {/if}
                </div>
                <span class="exercise-uuid">{$selectedExercise.uuid}</span>
              </div>
              
              <h1 class="exercise-title">{$selectedExercise?.title || 'Exercice'}</h1>
              
              <div class="exercise-metadata">
                {#if $selectedExercise?.chapter}
                  <span class="exercise-badge exercise-badge--chapter">
                    {$selectedExercise.chapter}
                  </span>
                {/if}
                
                {#if $selectedExercise?.theme}
                  <span class="exercise-badge exercise-badge--theme">
                    {$selectedExercise.theme}
                  </span>
                {/if}
                
                {#if $selectedExercise?.difficulty}
                  <div class="exercise-difficulty">
                    <span class="difficulty-label">Difficulté :</span>
                    <div class="difficulty-stars" aria-label="Difficulté: {$selectedExercise.difficulty} sur 5">
                      {#each Array(5) as _, i}
                        <div class="difficulty-star {i < $selectedExercise.difficulty ? 'difficulty-star--filled' : ''}" aria-hidden="true"></div>
                      {/each}
                    </div>
                    <span class="difficulty-value">({$selectedExercise.difficulty}/5)</span>
                  </div>
                {/if}
                
                {#if $selectedExercise?.author}
                  <span class="exercise-author">
                    Par <strong>{$selectedExercise.author}</strong>
                  </span>
                {/if}
              </div>
              
              <div class="exercise-actions">
                <button 
                  on:click={() => showHint = !showHint}
                  class="exercise-action-btn exercise-action-btn--hint"
                  class:exercise-action-btn--active={showHint}
                >
                  💡 {showHint ? 'Masquer' : 'Voir'} les indications
                </button>
                
                <button 
                  on:click={() => showSolution = !showSolution}
                  class="exercise-action-btn exercise-action-btn--solution"
                  class:exercise-action-btn--active={showSolution}
                >
                  ✅ {showSolution ? 'Masquer' : 'Voir'} les solutions
                </button>
              </div>
            </header>
            
            <!-- Contenu de l'exercice -->
            <div class="exercise-content">
              <ExerciseContent 
                content={$selectedExercise.content || []}
                bind:showHint
                bind:showSolution
              />
            </div>
          </article>
        {:else}
          <div class="no-selection">
            <div class="no-selection-icon">
              <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p class="no-selection-text">Sélectionnez un exercice dans la liste</p>
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  .exercise-breadcrumb {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breadcrumb-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .exercise-uuid {
    font-family: monospace;
    font-size: 0.75rem;
    color: rgb(156, 163, 175); /* text-gray-400 */
    opacity: 0.8;
  }

  /* Styles pour le contrôle UUID */
  .uuid-control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 300px;
  }

  .uuid-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: white;
    border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
    border-radius: 0.375rem;
    overflow: hidden;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .uuid-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: none;
    outline: none;
    font-size: 0.875rem;
    font-family: monospace;
    background: transparent;
  }

  .uuid-input::placeholder {
    color: rgb(156, 163, 175); /* text-gray-400 */
    font-family: ui-sans-serif, system-ui, sans-serif;
  }

  .uuid-input--error {
    border-color: rgb(239, 68, 68); /* border-red-500 */
  }

  .uuid-input:disabled {
    background-color: rgb(249, 250, 251); /* bg-gray-50 */
    color: rgb(107, 114, 128); /* text-gray-500 */
  }

  .uuid-buttons {
    display: flex;
    gap: 0.125rem;
    padding: 0.25rem;
  }

  .uuid-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.25rem;
    background: rgb(243, 244, 246); /* bg-gray-100 */
    color: rgb(75, 85, 99); /* text-gray-600 */
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .uuid-btn:hover:not(:disabled) {
    background: rgb(229, 231, 235); /* bg-gray-200 */
    color: rgb(55, 65, 81); /* text-gray-700 */
  }

  .uuid-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .uuid-btn--copy:hover:not(:disabled) {
    background: rgb(219, 234, 254); /* bg-blue-100 */
    color: rgb(37, 99, 235); /* text-blue-600 */
  }

  .uuid-btn--load {
    background: rgb(34, 197, 94); /* bg-green-500 */
    color: white;
  }

  .uuid-btn--load:hover:not(:disabled) {
    background: rgb(22, 163, 74); /* bg-green-600 */
  }

  .uuid-feedback {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: rgb(219, 234, 254); /* bg-blue-100 */
    color: rgb(37, 99, 235); /* text-blue-600 */
  }

  .uuid-feedback--error {
    background: rgb(254, 226, 226); /* bg-red-100 */
    color: rgb(220, 38, 38); /* text-red-600 */
  }

  .loading-spinner-small {
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* NOUVEAU : Styles pour le bouton d'édition */
  .nav-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .nav-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-toggle-btn {
    width: 2rem;
    height: 2rem;
    border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
    border-radius: 0.375rem;
    background: white;
    color: rgb(75, 85, 99); /* text-gray-600 */
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .edit-toggle-btn:hover {
    background: rgb(243, 244, 246); /* bg-gray-100 */
    border-color: rgb(156, 163, 175); /* border-gray-400 */
  }

  .edit-toggle-btn--active {
    background: rgb(254, 249, 195); /* bg-yellow-100 */
    border-color: rgb(245, 158, 11); /* border-yellow-500 */
    color: rgb(133, 77, 14); /* text-yellow-800 */
  }

  .edit-toggle-btn--active:hover {
    background: rgb(254, 240, 138); /* bg-yellow-200 */
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive : masquer le contrôle UUID sur petits écrans */
  @media (max-width: 768px) {
    .uuid-control {
      display: none;
    }
  }

  /* Ajustements pour le header */
  .list-header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .list-actions {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  @media (max-width: 1024px) {
    .list-header-content {
      flex-direction: column;
      align-items: stretch;
    }
    
    .list-actions {
      justify-content: flex-end;
    }
  }
</style>