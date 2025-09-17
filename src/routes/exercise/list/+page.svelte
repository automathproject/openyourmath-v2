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
  let isEditMode = false;
  
  // NOUVEAU : État pour la navigation mobile
  let isMobileNavOpen = false;
  let isMobile = false;
  
  // État pour le champ UUID
  let uuidInputValue = '';
  let uuidInputLoading = false;
  let uuidInputFeedback = '';
  let uuidInputError = false;
  
  // NOUVEAU : Fonction pour détecter si on est sur mobile
  function checkMobile() {
    isMobile = window.innerWidth < 768; // md breakpoint
    if (!isMobile) {
      isMobileNavOpen = false; // Fermer la nav si on passe en desktop
    }
  }
  
  // NOUVEAU : Fermer la navigation mobile
  function closeMobileNav() {
    isMobileNavOpen = false;
  }
  
  // NOUVEAU : Ouvrir/fermer la navigation mobile
  function toggleMobileNav() {
    isMobileNavOpen = !isMobileNavOpen;
  }
  
  // Initialiser la liste depuis les données du serveur
  onMount(() => {
    // Vérifier si on est sur mobile
    checkMobile();
    
    if (data.exercises && data.exercises.length > 0) {
      exerciseList.set(data.exercises);
      selectedExerciseIndex.set(0);
      if (data.exercises[0].fullExercise) {
        selectedExercise.set(data.exercises[0].fullExercise);
      } else {
        listActions.selectExercise(0);
      }
    } else {
      selectedExercise.set(null);
      selectedExerciseIndex.set(0);
    }
    
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
  
  // Normaliser une chaîne d'UUIDs (espaces/virgules -> virgules, sans espaces)
  function normalizeUuidString(str) {
    if (!str || typeof str !== 'string') return '';
    const hasTrailingSeparator = /[\s,]$/.test(str);
    const tokens = str.trim().split(/[\s,]+/).filter(Boolean);
    let normalized = tokens.join(',');
    if (normalized && hasTrailingSeparator) {
      normalized += ','; // préserver l'intention de saisir un nouveau UUID
    }
    return normalized;
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

  // Normaliser au blur ou Enter, pas à chaque frappe
  function handleUuidBlur() {
    uuidInputValue = normalizeUuidString(uuidInputValue);
    analyzeUuidInput();
  }

  function handleUuidKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      uuidInputValue = normalizeUuidString(uuidInputValue);
      analyzeUuidInput();
      if (!uuidInputLoading) {
        loadFromUuidInput();
      }
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
      // Copier la version normalisée (sans espaces)
      await navigator.clipboard.writeText(normalizeUuidString(uuidInputValue));
      uuidInputFeedback = 'Liste copiée !';
      uuidInputError = false;
      
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
  
  // Gestion du mode édition
  function toggleEditMode() {
    isEditMode = !isEditMode;
  }
  
  // Gestionnaires d'événements de l'éditeur
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
    // NOUVEAU : Fermer la navigation mobile après sélection
    if (isMobile) {
      closeMobileNav();
    }
  }
  
  function handleRemoveFromEditor(event) {
    const { index } = event.detail;
    removeExercise(index);
  }
  
  // Fonctions de navigation
  function selectExercise(index) {
    listActions.selectExercise(index);
    if (isMobile) {
      closeMobileNav();
    }
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
    } else if (event.key === 'Escape' && isMobileNavOpen) {
      event.preventDefault();
      closeMobileNav();
    }
  }
  
  // NOUVEAU : Gestionnaire de clic sur l'overlay
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      closeMobileNav();
    }
  }
</script>

<svelte:head>
  <title>Liste d'exercices ({$exerciseList.length}) - OpenYourMath</title>
  <meta name="description" content="Liste personnalisée de {$exerciseList.length} exercices de mathématiques" />
</svelte:head>

<svelte:window on:keydown={handleKeydown} on:resize={checkMobile} />

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
        <!-- Contrôle UUID - masqué sur mobile -->
        <div class="uuid-control">
          <div class="uuid-input-wrapper">
            <input 
              type="text"
              bind:value={uuidInputValue}
              on:input={analyzeUuidInput}
              on:blur={handleUuidBlur}
              on:keydown={handleUuidKeydown}
              placeholder="uuid1,uuid2,uuid3..."
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
        
        <!-- Bouton rechercher déplacé dans le header global -->
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
      <!-- Colonne de navigation - MODIFIÉE pour le responsive -->
      <aside class="list-navigation" class:list-navigation--mobile-open={isMobileNavOpen}>
        <div class="nav-header">
          <h2 class="nav-title">Exercices</h2>
          <div class="nav-header-actions">
            {#if $currentPosition.total > 0}
              <span class="nav-counter">
                {$currentPosition.current} / {$currentPosition.total}
              </span>
            {/if}
            
            <!-- Bouton fermer sur mobile -->
            <button 
              class="mobile-close-btn"
              on:click={closeMobileNav}
              aria-label="Fermer la navigation"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <!-- Bouton d'édition -->
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
        
        <!-- Composant éditeur -->
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
      
      <!-- NOUVEAU : Overlay pour mobile -->
      {#if isMobileNavOpen}
        <div class="mobile-nav-overlay" on:click={handleOverlayClick}></div>
      {/if}
      
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
            <ExerciseContent 
              exercise={$selectedExercise}
              position={$currentPosition}
              variant="full"
              showGlobalToggles={true}
              content={$selectedExercise.content || []}
              bind:showHint
              bind:showSolution
            />
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
      
      <!-- NOUVEAU : Bouton flottant pour ouvrir la navigation mobile -->
      <button 
        class="mobile-nav-toggle"
        on:click={toggleMobileNav}
        aria-label="Ouvrir la liste d'exercices"
        title="Liste d'exercices"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {#if $currentPosition.total > 0}
          <span class="mobile-nav-badge">{$currentPosition.current}/{$currentPosition.total}</span>
        {/if}
      </button>
      
      <!-- NOUVEAU : Barre de navigation mobile fixe en bas -->
      <div class="mobile-nav-bar">
        <button 
          on:click={listActions.previousExercise}
          disabled={!$currentPosition.hasPrevious}
          class="mobile-nav-btn mobile-nav-btn--prev"
          aria-label="Exercice précédent"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div class="mobile-nav-info">
          <span class="mobile-nav-counter">{$currentPosition.current} / {$currentPosition.total}</span>
        </div>
        
        <button 
          on:click={listActions.nextExercise}
          disabled={!$currentPosition.hasNext}
          class="mobile-nav-btn mobile-nav-btn--next"
          aria-label="Exercice suivant"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* List page styles (moved from app.css) */
  .exercise-list-page {
    min-height: 100vh;
    background-color: #f8fafc;
  }

  .list-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .list-header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .list-header-info { flex: 1; }

  .list-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .list-count { color: #6b7280; font-weight: 500; }

  .list-warning {
    color: #d97706;
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .list-info {
    color: #3b82f6;
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .list-actions { display: flex; gap: 0.5rem; align-items: center; }

  .list-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .list-action-btn--primary { background-color: #3b82f6; color: white; }
  .list-action-btn--primary:hover { background-color: #2563eb; }

  .list-action-btn--secondary { background-color: #f1f5f9; color: #475569; }
  .list-action-btn--secondary:hover { background-color: #e2e8f0; }

  .list-action-btn--danger { background-color: #ef4444; color: white; }
  .list-action-btn--danger:hover { background-color: #dc2626; }

  @media (max-width: 768px) {
    .list-header-content { flex-direction: column; align-items: stretch; gap: 1rem; }
    .list-actions { justify-content: center; }
  }
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

  /* Styles pour le bouton d'édition */
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

  /* Empty state (scoped to list page) */
  .exercise-list-page .empty-state { display:flex; align-items:center; justify-content:center; min-height:60vh; padding:2rem; }
  .exercise-list-page .empty-state-content { text-align:center; max-width:28rem; }
  .exercise-list-page .empty-state-icon { margin:0 auto 1.5rem; color:#9ca3af; }
  .exercise-list-page .empty-state-title { font-size:1.25rem; font-weight:600; color:#374151; margin:0 0 0.5rem; }
  .exercise-list-page .empty-state-description { color:#6b7280; margin:0 0 2rem; line-height:1.6; }
  .exercise-list-page .empty-state-actions { margin-bottom:2rem; }
  .exercise-list-page .empty-state-help { border-top:1px solid #e5e7eb; padding-top:1.5rem; }
  .exercise-list-page .help-details { text-align:left; }
  .exercise-list-page .help-summary { color:#6b7280; cursor:pointer; font-size:0.875rem; }
  .help-content { margin-top:0.5rem; padding:1rem; background:#f9fafb; border-radius:0.375rem; font-size:0.875rem; }
  .help-code { background:#1f2937; color:#f9fafb; padding:0.5rem; border-radius:0.25rem; font-family:monospace; display:block; margin:0.5rem 0; }
  .help-note { color:#6b7280; font-size:0.8rem; margin:0.5rem 0 0; }

  /* Layout + display column */
  .list-container { flex:1; display:flex; min-height:0; overflow:hidden; }
  .exercise-display {
    background:white;
    position:relative;
    /* Make width stable regardless of content and scrollbar */
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    scrollbar-gutter: stable; /* reserve scrollbar space when needed */
  }
  .exercise-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#6b7280; }
  .loading-spinner { width:2rem; height:2rem; border:2px solid #e5e7eb; border-top:2px solid #3b82f6; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .exercise-error { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:2rem; text-align:center; }
  .error-icon { color:#ef4444; margin-bottom:1rem; }
  .error-title { font-size:1.125rem; font-weight:600; color:#374151; margin:0 0 0.5rem; }
  .error-message { color:#6b7280; margin:0 0 1.5rem; }
  .error-retry-btn { padding:0.5rem 1rem; background:#3b82f6; color:white; border:none; border-radius:0.375rem; cursor:pointer; font-weight:500; transition:background-color .2s; }
  .error-retry-btn:hover { background:#2563eb; }
  .no-selection { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#9ca3af; }
  .no-selection-icon { margin-bottom:1rem; }
  .no-selection-text { font-size:1.125rem; color:#6b7280; }

  /* Wrapper */
  .exercise-content-wrapper { padding:1.5rem; height:100%; overflow-y:auto; }

  /* Responsive */
  @media (max-width: 768px) {
    .list-container { flex-direction:column; }
    .list-navigation { width:100%; height:200px; border-right:none; border-bottom:1px solid #e5e7eb; }
  }

  /* NOUVEAU : Styles pour la navigation mobile */
  
  /* Bouton flottant principal */
  .mobile-nav-toggle {
    position: fixed;
    bottom: 6rem; /* Au-dessus de la barre de navigation */
    right: 1rem;
    z-index: 1000;
    width: 3.5rem;
    height: 3.5rem;
    background: rgb(37, 99, 235); /* bg-blue-600 */
    color: white;
    border: none;
    border-radius: 50%;
    box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.3);
    cursor: pointer;
    display: none; /* Masqué par défaut */
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    position: relative;
  }

  .mobile-nav-toggle:hover {
    background: rgb(29, 78, 216); /* bg-blue-700 */
    transform: scale(1.05);
  }

  .mobile-nav-toggle:active {
    transform: scale(0.95);
  }

  /* Badge du compteur sur le bouton flottant */
  .mobile-nav-badge {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    background: rgb(239, 68, 68); /* bg-red-500 */
    color: white;
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 0.75rem;
    min-width: 1.25rem;
    text-align: center;
    border: 2px solid white;
  }

  /* Barre de navigation mobile en bas */
  .mobile-nav-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: white;
    border-top: 1px solid rgb(229, 231, 235); /* border-gray-200 */
    padding: 0.75rem;
    display: none; /* Masqué par défaut */
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 -4px 6px -1px rgb(0 0 0 / 0.1);
    safe-area-inset-bottom: env(safe-area-inset-bottom);
  }

  .mobile-nav-btn {
    width: 3rem;
    height: 3rem;
    border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
    border-radius: 0.5rem;
    background: white;
    color: rgb(75, 85, 99); /* text-gray-600 */
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .mobile-nav-btn:hover:not(:disabled) {
    background: rgb(243, 244, 246); /* bg-gray-100 */
    border-color: rgb(156, 163, 175); /* border-gray-400 */
    color: rgb(55, 65, 81); /* text-gray-700 */
  }

  .mobile-nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mobile-nav-btn--prev:hover:not(:disabled) {
    background: rgb(219, 234, 254); /* bg-blue-100 */
    border-color: rgb(37, 99, 235); /* border-blue-600 */
    color: rgb(37, 99, 235); /* text-blue-600 */
  }

  .mobile-nav-btn--next:hover:not(:disabled) {
    background: rgb(220, 252, 231); /* bg-green-100 */
    border-color: rgb(34, 197, 94); /* border-green-500 */
    color: rgb(34, 197, 94); /* text-green-500 */
  }

  .mobile-nav-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .mobile-nav-counter {
    font-size: 1rem;
    font-weight: 600;
    color: rgb(55, 65, 81); /* text-gray-700 */
  }

  /* Overlay pour la navigation mobile */
  .mobile-nav-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1100;
    display: none;
  }

  /* Modifications de la navigation pour le mobile */
  .list-navigation {
    position: relative;
    transition: transform 0.3s ease;
  }

  /* Bouton fermer mobile (masqué par défaut) */
  .mobile-close-btn {
    display: none;
    width: 2rem;
    height: 2rem;
    border: 1px solid rgb(209, 213, 219);
    border-radius: 0.375rem;
    background: white;
    color: rgb(75, 85, 99);
    cursor: pointer;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .mobile-close-btn:hover {
    background: rgb(254, 226, 226); /* bg-red-100 */
    border-color: rgb(239, 68, 68); /* border-red-500 */
    color: rgb(220, 38, 38); /* text-red-600 */
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Responsive : Affichage mobile */
  @media (max-width: 767px) {
    /* Masquer le contrôle UUID sur mobile */
    .uuid-control {
      display: none;
    }

    /* Afficher les éléments mobiles */
    .mobile-nav-toggle,
    .mobile-nav-bar {
      display: flex;
    }

    /* Masquer la navigation par défaut sur mobile */
    .list-navigation {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 85%;
      max-width: 400px;
      background: white;
      border-left: 1px solid rgb(229, 231, 235);
      z-index: 1200;
      transform: translateX(100%);
      overflow-y: auto;
      padding: 1rem;
      box-shadow: -4px 0 6px -1px rgb(0 0 0 / 0.1);
    }

    .list-navigation--mobile-open {
      transform: translateX(0);
    }

    /* Afficher l'overlay quand la nav est ouverte */
    .mobile-nav-overlay {
      display: block;
    }

    /* Afficher le bouton fermer sur mobile */
    .mobile-close-btn {
      display: flex;
    }

    /* Ajuster l'affichage principal pour faire place à la barre mobile */
    .exercise-display {
      padding-bottom: 5rem; /* Espace pour la barre mobile */
    }

    /* Masquer les contrôles de navigation dans la sidebar mobile */
    .list-navigation .nav-controls {
      display: none;
    }

    /* Ajuster le container principal */
    .list-container {
      display: block;
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

  @media (max-width: 767px) {
    .list-actions {
      justify-content: center;
      gap: 0.5rem;
    }
    
    .list-action-btn {
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
    }
  }
  /* Mobile compact for list page */
  @media (max-width: 640px) {
    .exercise-list-page .exercise { border: 0 !important; box-shadow: none !important; }
    .exercise-list-page .exercise-header { border-bottom: 0 !important; padding: 0.75rem 0.75rem !important; }
    .exercise-list-page .exercise-content { padding: 0.75rem !important; }
    .exercise-list-page .exercise-breadcrumb { margin-bottom: 0.5rem !important; gap: 0.25rem !important; }
    .exercise-list-page .exercise-title { margin-bottom: 0.75rem !important; font-size: 1.25rem !important; line-height: 1.25 !important; }
    .exercise-list-page .exercise-metadata { gap: 0.5rem !important; margin-bottom: 0.75rem !important; }
    .exercise-list-page .exercise-badge { padding: 0.125rem 0.5rem !important; font-size: 0.75rem !important; }
    .exercise-list-page .exercise-actions { gap: 0.5rem !important; margin-top: 0.25rem !important; }
    .exercise-list-page .exercise-action-btn { padding: 0.375rem 0.5rem !important; font-size: 0.875rem !important; border-radius: 0.5rem !important; }
    .exercise-list-page .content-card,
    .exercise-list-page .question-block,
    .exercise-list-page .collapsible-section,
    .exercise-list-page .preview-header,
    .exercise-list-page .preview-exercise-header,
    .exercise-list-page .similar-exercise-card {
      border: 0 !important; box-shadow: none !important; padding: 0.75rem !important;
    }
    .exercise-list-page .content-card-footer,
    .exercise-list-page .results-header,
    .exercise-list-page .nav-header,
    .exercise-list-page .nav-controls {
      border: 0 !important;
    }
    .exercise-list-page .questions-responses { gap: 0.75rem !important; }
    .exercise-list-page .question-response-pair { margin: 0.75rem 0 !important; }
  }
</style>
