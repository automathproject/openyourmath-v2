<!-- src/routes/exercise/list/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { cubicOut, cubicIn } from 'svelte/easing';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import ExerciseListEditor from '$lib/components/ExerciseListEditor.svelte';
  import LatexExportPanel from '$lib/components/LatexExportPanel.svelte';
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
  let isEditMode = false;
  let showSharePanel = false;

  // Vue élève : 'normal' | 'student' | 'student-hints'
  $: studentMode = $page.url.searchParams.get('view') === 'student'
    ? 'student'
    : $page.url.searchParams.get('view') === 'student-hints'
      ? 'student-hints'
      : 'normal';

  // Titre personnalisé
  let listTitle = data.title || '';
  let isEditingTitle = false;
  let titleDraft = '';
  
  // NOUVEAU : États pour la navigation mobile et contrôles
  let isMobileNavOpen = false;
  let showUuidControl = false; // Nouveau : contrôle de l'affichage UUID
  let isMobile = false;

  // Mode présentation (0 = normal, 1 = présentation, 2 = présentation maximale)
  let isPresentationMode = false;
  let isFullPresentation = false;

  // Direction de navigation pour l'animation de glissement
  let navDirection = 1;

  function slideIn(node) {
    const w = node.offsetWidth;
    return {
      duration: 320,
      easing: cubicOut,
      css: (t, u) => `transform: translateX(${u * navDirection * w}px)`
    };
  }

  function slideOut(node) {
    const w = node.offsetWidth;
    return {
      duration: 280,
      easing: cubicIn,
      css: (t, u) => `transform: translateX(${-u * navDirection * w}px)`
    };
  }

  function togglePresentationMode() {
    if (!isPresentationMode) {
      isPresentationMode = true;
      isFullPresentation = false;
      isEditMode = false;
    } else if (!isFullPresentation && !isMobile) {
      // Niveau 2 (header masqué) uniquement sur desktop
      isFullPresentation = true;
    } else {
      isPresentationMode = false;
      isFullPresentation = false;
    }
  }
  
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
      showUuidControl = false; // Fermer UUID control si on passe en desktop
    }
  }
  
  // NOUVEAU : Fonctions pour gérer l'affichage des contrôles
  function toggleUuidControl() {
    showUuidControl = !showUuidControl;
  }
  
  function closeUuidControl() {
    showUuidControl = false;
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
    // Suivre la direction de navigation pour le glissement
    let prevIdx = 0;
    const unsubAnim = selectedExerciseIndex.subscribe(newIdx => {
      if (newIdx !== prevIdx) {
        navDirection = newIdx > prevIdx ? 1 : -1;
        prevIdx = newIdx;
      }
    });
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

    updateUuidInput();

    return () => unsubAnim();
  });
  
  // Synchroniser la classe body avec le mode présentation
  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('presentation-mode', isPresentationMode);
    document.body.classList.toggle('presentation-mode-full', isFullPresentation);
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('presentation-mode');
      document.body.classList.remove('presentation-mode-full');
    }
  });

  // Réactivité pour mettre à jour le champ UUID
  $: if ($exerciseList) {
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
    } else if (event.key === 'Escape') {
      closeUuidControl();
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
  
  function buildUrl() {
    const base = listActions.getCurrentListUrl();
    let url = base;
    if (listTitle) url += `${url.includes('?') ? '&' : '?'}title=${encodeURIComponent(listTitle)}`;
    if (studentMode !== 'normal') url += `${url.includes('?') ? '&' : '?'}view=${studentMode}`;
    return url;
  }

  function buildShareUrl(viewOverride) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const base = listUtils.getShareableUrl(origin);
    let url = base;
    if (listTitle) url += `${url.includes('?') ? '&' : '?'}title=${encodeURIComponent(listTitle)}`;
    const view = viewOverride ?? (studentMode !== 'normal' ? studentMode : null);
    if (view) url += `${url.includes('?') ? '&' : '?'}view=${view}`;
    return url;
  }

  function updateUrl() {
    goto(buildUrl(), { replaceState: true });
  }

  // Focus automatique sur l'input titre
  function focusInput(node) {
    node.focus();
  }

  // Édition du titre
  function startEditTitle() {
    titleDraft = listTitle;
    isEditingTitle = true;
  }

  function saveTitle() {
    listTitle = titleDraft.trim();
    isEditingTitle = false;
    updateUrl();
  }

  function cancelEditTitle() {
    isEditingTitle = false;
    titleDraft = listTitle;
  }

  function handleTitleKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEditTitle(); }
  }
  
  // Panneau de partage
  let shareCopied = ''; // 'normal' | 'student' | 'student-hints' | ''

  function openSharePanel() {
    showSharePanel = true;
  }

  function closeSharePanel() {
    showSharePanel = false;
    shareCopied = '';
  }

  async function copyShareUrl(view) {
    const url = buildShareUrl(view ?? undefined);
    try {
      await navigator.clipboard.writeText(url);
      shareCopied = view ?? 'normal';
      setTimeout(() => { if (shareCopied === (view ?? 'normal')) shareCopied = ''; }, 2000);
    } catch {
      alert(url);
    }
  }

  // Navigation clavier
  function handleKeydown(event) {
    const isTyping = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';

    // Raccourcis F / P pour basculer le mode présentation
    if (!isTyping && (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'p')) {
      event.preventDefault();
      togglePresentationMode();
      return;
    }

    if (isPresentationMode) {
      if (event.key === 'ArrowLeft' && $currentPosition.hasPrevious) {
        event.preventDefault();
        listActions.previousExercise();
      } else if (event.key === 'ArrowRight' && $currentPosition.hasNext) {
        event.preventDefault();
        listActions.nextExercise();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        isPresentationMode = false;
        isFullPresentation = false;
      }
      return;
    }

    if (event.key === 'ArrowUp' && $currentPosition.hasPrevious) {
      event.preventDefault();
      listActions.previousExercise();
    } else if (event.key === 'ArrowDown' && $currentPosition.hasNext) {
      event.preventDefault();
      listActions.nextExercise();
    } else if (event.key === 'Escape') {
      if (isMobileNavOpen) {
        event.preventDefault();
        closeMobileNav();
      } else if (showUuidControl) {
        event.preventDefault();
        closeUuidControl();
      } else if (showSharePanel) {
        event.preventDefault();
        closeSharePanel();
      }
    }
  }

  // Gestionnaire de clic sur l'overlay
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      if (isMobileNavOpen) {
        closeMobileNav();
      } else if (showUuidControl) {
        closeUuidControl();
      } else if (showSharePanel) {
        closeSharePanel();
      }
    }
  }
</script>

<svelte:head>
  <title>{listTitle || "Liste d'exercices"} ({$exerciseList.length}) - OpenYourMath</title>
  <meta name="description" content="Liste personnalisée de {$exerciseList.length} exercices de mathématiques" />
</svelte:head>

<svelte:window on:keydown={handleKeydown} on:resize={checkMobile} />

<div class="exercise-list-page" class:presentation-mode={isPresentationMode} class:full-presentation={isFullPresentation}>
  <!-- Header de la page -->
  <header class="list-header">
    <div class="list-header-content">
      <div class="list-header-info">
        <h1 class="list-title">
          {#if isEditingTitle}
            <input
              class="title-edit-input"
              type="text"
              bind:value={titleDraft}
              on:keydown={handleTitleKeydown}
              on:blur={saveTitle}
              placeholder="Titre de la liste..."
              use:focusInput
            />
          {:else}
            <button class="title-text" on:click={startEditTitle} title="Cliquer pour modifier le titre">
              {listTitle || "Liste d'exercices"}
            </button>
            {#if $hasExercises}
              <span class="list-count">({$exerciseList.length})</span>
            {/if}
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
        <!-- Contrôle UUID desktop (toujours visible) -->
        <div class="uuid-control-desktop">
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
        </div>
        
        <!-- Bouton mobile : ouvrir navigation / gestion UUID -->
        {#if isMobile}
          <button 
            on:click={toggleUuidControl}
            class="header-action-btn header-action-btn--secondary"
            class:header-action-btn--active={showUuidControl}
            title="Gérer les UUIDs"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span class="header-action-btn__label">UUIDs</span>
          </button>
        {/if}

        {#if isMobile && $hasExercises}
          <button 
            on:click={toggleMobileNav}
            class="header-action-btn header-action-btn--primary"
            title="Ouvrir la liste d'exercices"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span class="header-action-btn__label">Liste</span>
            {#if $currentPosition.total > 0}
              <span class="header-nav-badge">{$currentPosition.current}/{$currentPosition.total}</span>
            {/if}
          </button>
        {/if}
        
        {#if $hasExercises}
          <div class="list-action-buttons">
            <button
              on:click={togglePresentationMode}
              class="list-action-btn list-action-btn--presentation"
              class:list-action-btn--presentation-active={isPresentationMode}
              aria-label={isPresentationMode ? 'Présentation maximale' : 'Mode présentation'}
              title={isPresentationMode ? 'Présentation maximale – masque le header (P)' : 'Mode présentation (P)'}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span class="list-action-btn__label">{isPresentationMode ? 'Max' : 'Présentation'}</span>
            </button>

            <button
              on:click={openSharePanel}
              class="list-action-btn list-action-btn--primary"
              class:list-action-btn--active={showSharePanel}
              aria-label="Partager la liste d'exercices"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span class="list-action-btn__label">Partager</span>
            </button>
            
            <button 
              on:click={clearList}
              class="list-action-btn list-action-btn--danger"
              aria-label="Vider la liste d'exercices"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span class="list-action-btn__label">Vider</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- NOUVEAU : Panneau de contrôle UUID (conditionnel) -->
        {#if showUuidControl && isMobile}
      <div class="uuid-control-panel" class:uuid-control-panel--mobile={isMobile}>
        <div class="uuid-control-header">
          <h3 class="uuid-control-title">Gestion des UUIDs</h3>
          <button 
            on:click={closeUuidControl}
            class="uuid-control-close"
            aria-label="Fermer le panneau UUID"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
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
      </div>
    {/if}

    <!-- Panneau de partage -->
    {#if showSharePanel && $hasExercises}
      <div class="share-panel" class:share-panel--mobile={isMobile}>
        <div class="uuid-control-header">
          <h3 class="uuid-control-title">Partager la liste</h3>
          <button
            on:click={closeSharePanel}
            class="uuid-control-close"
            aria-label="Fermer le panneau de partage"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="share-rows">
          <!-- Lien professeur (normal) -->
          <div class="share-row">
            <div class="share-row-info">
              <span class="share-row-label">Vue complète</span>
              <span class="share-row-desc">Solutions et indications accessibles</span>
            </div>
            <button
              class="share-copy-btn"
              class:share-copy-btn--copied={shareCopied === 'normal'}
              on:click={() => copyShareUrl(null)}
            >
              {shareCopied === 'normal' ? '✓ Copié' : 'Copier le lien'}
            </button>
          </div>

          <!-- Lien élève + indications -->
          <div class="share-row">
            <div class="share-row-info">
              <span class="share-row-label">Vue élève + indications</span>
              <span class="share-row-desc">Indications visibles, solutions masquées</span>
            </div>
            <button
              class="share-copy-btn share-copy-btn--hints"
              class:share-copy-btn--copied={shareCopied === 'student-hints'}
              on:click={() => copyShareUrl('student-hints')}
            >
              {shareCopied === 'student-hints' ? '✓ Copié' : 'Copier le lien'}
            </button>
          </div>

          <!-- Lien élève strict -->
          <div class="share-row">
            <div class="share-row-info">
              <span class="share-row-label">Vue élève</span>
              <span class="share-row-desc">Solutions et indications masquées</span>
            </div>
            <button
              class="share-copy-btn share-copy-btn--student"
              class:share-copy-btn--copied={shareCopied === 'student'}
              on:click={() => copyShareUrl('student')}
            >
              {shareCopied === 'student' ? '✓ Copié' : 'Copier le lien'}
            </button>
          </div>
        </div>

        <!-- Export LaTeX -->
        <LatexExportPanel exercises={$exerciseList} title={listTitle} />
      </div>
    {/if}
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
          Ajoutez des exercices à votre liste en utilisant la recherche, ou utilisez le bouton "UUIDs" ci-dessus pour coller des identifiants d'exercices.
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
      <aside class="list-navigation"
        class:list-navigation--mobile-open={isMobileNavOpen}
        class:list-navigation--rail={isPresentationMode && !isMobile}
      >
        {#if isPresentationMode && !isMobile}
          <!-- Rail d'icônes numérotées en mode présentation -->
          <nav class="exercise-rail" aria-label="Navigation exercices">
            {#if isFullPresentation}
              <button class="rail-list-title" on:click={togglePresentationMode} title="Quitter (Échap)">
                <span>{listTitle || "Liste d'exercices"}</span>
              </button>
            {/if}
            {#each $exerciseList as exercise, i}
              <button
                class="rail-item"
                class:rail-item--active={i === $selectedExerciseIndex}
                on:click={() => listActions.selectExercise(i)}
                title={exercise.title || `Exercice ${i + 1}`}
                aria-label={`Exercice ${i + 1}${exercise.title ? ' : ' + exercise.title : ''}`}
                aria-current={i === $selectedExerciseIndex ? 'true' : undefined}
              >
                {i + 1}
              </button>
            {/each}
          </nav>
        {:else}
          <!-- Navigation complète (mode normal) -->
          <div class="nav-header">
            <h2 class="nav-title">Exercices</h2>
            <div class="nav-header-actions">
              {#if $currentPosition.total > 0}
                <span class="nav-counter">
                  {$currentPosition.current} / {$currentPosition.total}
                </span>
              {/if}

              <!-- Bouton fermer sur mobile -->
              {#if isMobile}
                <button
                  class="mobile-close-btn"
                  on:click={closeMobileNav}
                  aria-label="Fermer la navigation"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              {/if}

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
          <div class="list-editor-scroll">
            <ExerciseListEditor
              exercises={$exerciseList}
              selectedIndex={$selectedExerciseIndex}
              {isEditMode}
              on:reorder={handleReorder}
              on:deleteMultiple={handleDeleteMultiple}
              on:select={handleSelectFromEditor}
              on:remove={handleRemoveFromEditor}
            />
          </div>
        {/if}
      </aside>
      
      <!-- Overlay pour mobile (navigation, UUID control, partage) -->
      {#if (isMobileNavOpen || showUuidControl || showSharePanel) && isMobile}
        <div class="mobile-overlay" on:click={handleOverlayClick}></div>
      {/if}

      <!-- Overlay pour UUID control / partage sur desktop -->
      {#if (showUuidControl || showSharePanel) && !isMobile}
        <div class="desktop-uuid-overlay" on:click={handleOverlayClick}></div>
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
          {#if isPresentationMode}
            <div class="exercise-slide-wrapper">
            {#key $selectedExerciseIndex}
              <article
                in:slideIn
                out:slideOut
                class="exercise-content-wrapper exercise-content-wrapper--presentation"
              >
                <ExerciseContent
                  exercise={$selectedExercise}
                  position={$currentPosition}
                  variant="full"
                  showGlobalToggles={true}
                  content={$selectedExercise.content || []}
                  bind:showHint
                  bind:showSolution
                  {studentMode}
                />
              </article>
            {/key}
            </div>
          {:else}
            <article class="exercise-content-wrapper">
              <ExerciseContent
                exercise={$selectedExercise}
                position={$currentPosition}
                variant="full"
                showGlobalToggles={true}
                content={$selectedExercise.content || []}
                bind:showHint
                bind:showSolution
                {studentMode}
              />
            </article>
          {/if}
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

      <!-- Mode présentation : grandes flèches tactiles et indicateur de position -->
      {#if isPresentationMode && !isMobile && $hasExercises}
        <button
          class="pres-arrow pres-arrow--prev"
          on:click={listActions.previousExercise}
          disabled={!$currentPosition.hasPrevious}
          aria-label="Exercice précédent"
          title="Exercice précédent (←)"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          class="pres-arrow pres-arrow--next"
          on:click={listActions.nextExercise}
          disabled={!$currentPosition.hasNext}
          aria-label="Exercice suivant"
          title="Exercice suivant (→)"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div class="pres-indicator" aria-live="polite">
          {$currentPosition.current} / {$currentPosition.total}
        </div>
      {/if}
      
      <!-- Barre de navigation mobile fixe en bas -->
      {#if isMobile && $hasExercises}
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
            {#if isPresentationMode}
              <button
                on:click={togglePresentationMode}
                class="mobile-pres-exit-btn"
                aria-label="Quitter le mode présentation"
              >Quitter</button>
            {/if}
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
      {/if}
    </div>
  {/if}
</div>

<style>
  /* List page styles (moved from app.css) */
  .exercise-list-page {
    min-height: 100vh;
    @apply bg-slate-50;
  }

  .list-header {
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 60;
    @apply bg-interface-bg-primary border-b border-slate-200;
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
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    @apply text-gray-900;
  }

  .list-count { font-weight: 500; @apply text-gray-500; }

  .title-text {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-bottom: 2px dashed transparent;
    transition: border-color 0.15s;
    &:hover { border-bottom-color: currentColor; }
  }

  .title-edit-input {
    font-size: inherit;
    font-weight: inherit;
    border: none;
    border-bottom: 2px solid;
    background: transparent;
    outline: none;
    min-width: 12rem;
    @apply text-gray-900 border-blue-500;
  }

  .list-warning {
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    @apply text-orange-600;
  }

  .list-info {
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    @apply text-brand-primary;
  }

  .list-actions {
    display: flex;
    align-items: stretch;
    gap: 0.75rem;
    flex: 1;
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  /* NOUVEAU : Styles pour les boutons d'action du header */
  .header-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
    border: 1px solid;
    cursor: pointer;
    position: relative;
  }

  .header-action-btn__label {
    display: inline;
  }

  .header-action-btn--primary { 
    @apply bg-brand-600 text-white border-brand-600; 
  }
  .header-action-btn--primary:hover { 
    @apply bg-brand-700 border-brand-700; 
  }

  .header-action-btn--secondary { 
    @apply bg-slate-100 text-slate-600 border-slate-300; 
  }
  .header-action-btn--secondary:hover { 
    @apply bg-slate-200 border-slate-400; 
  }

  .header-action-btn--active {
    @apply bg-brand-100 text-brand-700 border-brand-300;
  }

  /* Badge pour le bouton de navigation mobile */
  .header-nav-badge {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 0.75rem;
    min-width: 1.25rem;
    text-align: center;
    border: 2px solid white;
    @apply bg-error-500 text-white;
  }

  .list-action-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

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

  .list-action-btn__label {
    display: inline;
  }

  .list-action-btn--primary { @apply bg-brand-600 text-white; }
  .list-action-btn--primary:hover { @apply bg-brand-700; }

  .list-action-btn--secondary { @apply bg-slate-100 text-slate-600; }
  .list-action-btn--secondary:hover { @apply bg-slate-200; }

  .list-action-btn--danger { @apply bg-error-500 text-white; }
  .list-action-btn--danger:hover { @apply bg-error-600; }

  /* Panneau de partage */
  .share-panel {
    position: absolute;
    top: 100%;
    right: 1rem;
    width: 420px;
    max-width: calc(100vw - 2rem);
    z-index: 70;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.3);
    animation: slide-in 0.2s ease-out;
    @apply bg-interface-bg-primary border border-gray-300;
  }

  .share-panel--mobile {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 420px;
    z-index: 70;
  }

  .share-rows {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0.5rem 1rem 1rem;
  }

  .share-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid;
    @apply border-gray-100;
  }

  .share-row-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .share-row-label {
    font-size: 0.875rem;
    font-weight: 600;
    @apply text-gray-900;
  }

  .share-row-desc {
    font-size: 0.75rem;
    @apply text-gray-500;
  }

  .share-copy-btn {
    flex-shrink: 0;
    padding: 0.375rem 0.875rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
    @apply bg-slate-100 text-slate-700 border-slate-200;
  }

  .share-copy-btn:hover {
    @apply bg-slate-200;
  }

  .share-copy-btn--copied {
    @apply bg-green-100 text-green-700 border-green-200;
  }

  .share-copy-btn--hints {
    @apply bg-yellow-50 text-yellow-800 border-yellow-200;
  }

  .share-copy-btn--hints:hover {
    @apply bg-yellow-100;
  }

  .share-copy-btn--student {
    @apply bg-blue-50 text-blue-800 border-blue-200;
  }

  .share-copy-btn--student:hover {
    @apply bg-blue-100;
  }

  /* Panneau de contrôle UUID */
  .uuid-control-panel {
    position: absolute;
    top: 100%;
    right: 1rem;
    width: 400px;
    max-width: calc(100vw - 2rem);
    z-index: 70; /* Au-dessus de l'overlay desktop */
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.3);
    animation: slide-in 0.2s ease-out;
    @apply bg-interface-bg-primary border border-gray-300;
  }

  .uuid-control-panel--mobile {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 400px;
    z-index: 70; /* Plus haut que l'overlay mobile */
  }

  .uuid-control-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1rem 0.5rem;
  }

  .uuid-control-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    @apply text-gray-900;
  }

  .uuid-control-close {
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    @apply bg-gray-100 text-gray-600;
  }

  .uuid-control-close:hover {
    @apply bg-red-100 text-red-600;
  }

  /* Overlays */
  .mobile-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 55; /* Sous le header (60), au-dessus du contenu */
  }

  .desktop-uuid-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.1);
    z-index: 40; /* Sous le header (60) et le panneau (70) */
  }

  /* Styles pour le contrôle UUID */
  .uuid-control {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 1rem 1rem;
  }

  .uuid-control-desktop {
    flex: 1 1 340px;
    max-width: 420px;
    display: flex;
    align-items: stretch;
  }

  .uuid-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    @apply bg-interface-bg-primary border border-gray-300;
  }

  .uuid-input {
    flex: 1;
    padding: 0.75rem;
    border: none;
    outline: none;
    font-size: 0.875rem;
    font-family: monospace;
    background: transparent;
  }

  .uuid-input::placeholder {
    font-family: ui-sans-serif, system-ui, sans-serif;
    @apply text-gray-400;
  }

  .uuid-input--error {
    @apply border-red-500;
  }

  .uuid-input:disabled {
    @apply bg-gray-50 text-gray-500;
  }

  .uuid-buttons {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
  }

  .uuid-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s ease;
    @apply bg-gray-100 text-gray-600;
  }

  .uuid-btn:hover:not(:disabled) {
    @apply bg-gray-200 text-gray-700;
  }

  .uuid-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .uuid-btn--copy:hover:not(:disabled) {
    @apply bg-blue-100 text-blue-600;
  }

  .uuid-btn--load {
    @apply bg-brand-500 text-white;
  }

  .uuid-btn--load:hover:not(:disabled) {
    @apply bg-brand-600;
  }

  .uuid-feedback {
    font-size: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    @apply bg-blue-100 text-blue-600;
  }

  .uuid-feedback--error {
    @apply bg-red-100 text-red-600;
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
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    @apply border border-gray-300 rounded-md bg-interface-bg-primary text-gray-600;
  }

  .edit-toggle-btn:hover {
    @apply bg-gray-100 border-gray-400;
  }

  .edit-toggle-btn--active {
    @apply bg-yellow-100 border-yellow-500 text-yellow-800;
  }

  .edit-toggle-btn--active:hover {
    @apply bg-yellow-200;
  }

  .mobile-close-btn {
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    @apply border border-gray-300 rounded-md bg-interface-bg-primary text-gray-600;
  }

  .mobile-close-btn:hover {
    @apply bg-red-100 border-red-500 text-red-600;
  }

  /* Empty state (scoped to list page) */
  .exercise-list-page .empty-state { display:flex; align-items:center; justify-content:center; min-height:60vh; padding:2rem; }
  .exercise-list-page .empty-state-content { text-align:center; max-width:28rem; }
  .exercise-list-page .empty-state-icon { margin:0 auto 1.5rem; @apply text-gray-400; }
  .exercise-list-page .empty-state-title { font-size:1.25rem; font-weight:600; margin:0 0 0.5rem; @apply text-gray-700; }
  .exercise-list-page .empty-state-description { margin:0 0 2rem; line-height:1.6; @apply text-interface-text-secondary; }
  .exercise-list-page .empty-state-actions { margin-bottom:2rem; }
  .exercise-list-page .empty-state-help { padding-top:1.5rem; @apply border-t border-gray-200; }
  .exercise-list-page .help-details { text-align:left; }
  .exercise-list-page .help-summary { cursor:pointer; font-size:0.875rem; @apply text-interface-text-secondary; }
  .help-content { margin-top:0.5rem; padding:1rem; border-radius:0.375rem; font-size:0.875rem; @apply bg-gray-50; }
  .help-code { padding:0.5rem; border-radius:0.25rem; font-family:monospace; display:block; margin:0.5rem 0; @apply bg-gray-900 text-gray-50; }
  .help-note { font-size:0.8rem; margin:0.5rem 0 0; @apply text-interface-text-secondary; }

  /* Layout + display column */
  .list-container { flex:1; display:flex; min-height:0; overflow:hidden; }
  
  /* Desktop: fixed sidebar height with its own scroll */
  @media (min-width: 768px) {
    .list-navigation {
      flex: 0 0 320px;
      max-width: 320px;
      @apply border-r border-gray-200 bg-interface-bg-primary;
      height: auto;
      overflow: visible; /* pas de scroll sur le conteneur */
    }
    /* La zone scrollable est limitée au composant éditeur */
    .list-editor-scroll { height: 600px; overflow-y: auto; }
  }
  
  .exercise-display {
    @apply bg-interface-bg-primary;
    position:relative;
    /* Make width stable regardless of content and scrollbar */
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    /* Let the page scroll; avoid inner scrollbar */
    overflow: visible;
  }
  
  .exercise-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; @apply text-interface-text-secondary; }
  .loading-spinner { width:2rem; height:2rem; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:1rem; border:2px solid theme('colors.gray.200'); border-top:2px solid theme('colors.blue.500'); }
  
  .exercise-error { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:2rem; text-align:center; }
  .error-icon { margin-bottom:1rem; @apply text-error-500; }
  .error-title { font-size:1.125rem; font-weight:600; margin:0 0 0.5rem; @apply text-gray-700; }
  .error-message { margin:0 0 1.5rem; @apply text-interface-text-secondary; }
  .error-retry-btn { padding:0.5rem 1rem; border:none; border-radius:0.375rem; cursor:pointer; font-weight:500; transition:background-color .2s; @apply bg-blue-500 text-white; }
  .error-retry-btn:hover { @apply bg-blue-600; }
  
  .no-selection { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; @apply text-gray-400; }
  .no-selection-icon { margin-bottom:1rem; }
  .no-selection-text { font-size:1.125rem; @apply text-interface-text-secondary; }

  /* Wrapper */
  .exercise-content-wrapper { padding:1.5rem; height:auto; overflow: visible; }

  /* Barre de navigation mobile en bas */
  .mobile-nav-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 -4px 6px -1px rgb(0 0 0 / 0.1);
    @apply bg-interface-bg-primary border-t border-gray-200;
  }

  .mobile-nav-btn {
    width: 3rem;
    height: 3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    @apply border border-gray-300 rounded-lg bg-interface-bg-primary text-gray-600;
  }

  .mobile-nav-btn:hover:not(:disabled) {
    @apply bg-gray-100 border-gray-400 text-gray-700;
  }

  .mobile-nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mobile-nav-btn--prev:hover:not(:disabled) {
    @apply bg-blue-100 border-blue-600 text-blue-600;
  }

  .mobile-nav-btn--next:hover:not(:disabled) {
    @apply bg-green-100 border-green-500 text-green-500;
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
    @apply text-gray-700;
  }

  .mobile-pres-exit-btn {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.625rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    @apply bg-indigo-600 text-white;
  }

  /* Modifications de la navigation pour le mobile */
  .list-navigation {
    position: relative;
    transition: transform 0.3s ease;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Navigation controls */
  .nav-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0 0.5rem;
  }

  .nav-btn {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: 0.875rem;
    font-weight: 500;
    @apply bg-interface-bg-primary text-gray-600 border-gray-300;
  }

  .nav-btn:hover:not(:disabled) {
    @apply bg-gray-100 border-gray-400;
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nav-btn--prev:hover:not(:disabled) {
    @apply bg-blue-100 border-blue-600 text-blue-600;
  }

  .nav-btn--next:hover:not(:disabled) {
    @apply bg-green-100 border-green-500 text-green-500;
  }

  .nav-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    @apply text-gray-900;
  }

  .nav-counter {
    font-size: 0.875rem;
    font-weight: 500;
    @apply text-gray-500;
  }

  /* Responsive : Affichage mobile */
  @media (max-width: 767px) {
    /* Ajustements pour le header mobile */
    .list-header-content {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }

    .list-actions {
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    /* Masquer la navigation par défaut sur mobile */
    .list-navigation {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 85%;
      max-width: 400px;
      @apply bg-interface-bg-primary border-l border-gray-200;
      z-index: 60;
      transform: translateX(100%);
      overflow-y: auto;
      padding: 1rem;
      box-shadow: -4px 0 6px -1px rgb(0 0 0 / 0.1);
    }

    .list-navigation--mobile-open {
      transform: translateX(0);
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

    /* Ajustements des boutons */
    .header-action-btn,
    .list-action-btn {
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
    }

    /* Responsive pour les labels */
    .header-action-btn__label,
    .list-action-btn__label {
      display: none;
    }

    .uuid-control-desktop {
      display: none;
    }

    @media (max-width: 480px) {
      .header-action-btn,
      .list-action-btn {
        padding: 0.5rem;
      }
    }

    /* ── Mode présentation sur mobile : pleine page ── */
    .exercise-list-page.presentation-mode .list-header {
      display: none;
    }

    .exercise-content-wrapper--presentation {
      padding: 0.75rem 0.5rem;
      font-size: 1rem;
      line-height: 1.6;
      overflow: hidden;
    }

    .exercise-content-wrapper--presentation :global(h1) { font-size: 1.5rem !important; }
    .exercise-content-wrapper--presentation :global(h2) { font-size: 1.25rem !important; }
    .exercise-content-wrapper--presentation :global(h3) { font-size: 1.125rem !important; }
    .exercise-content-wrapper--presentation :global(p),
    .exercise-content-wrapper--presentation :global(li) {
      font-size: 1rem !important;
      line-height: 1.6 !important;
    }

    /* Compacter le header d'exercice sur mobile en présentation */
    .exercise-content-wrapper--presentation :global(.exercise-header) {
      padding: 0.5rem 0.75rem !important;
      border-radius: 0.5rem !important;
    }
    .exercise-content-wrapper--presentation :global(.exercise-title) {
      font-size: 1.125rem !important;
      font-weight: 700 !important;
      margin-bottom: 0.25rem !important;
      margin-right: 0 !important;
      line-height: 1.3 !important;
    }
    .exercise-content-wrapper--presentation :global(.title-right) {
      display: none;
    }
    .exercise-content-wrapper--presentation :global(.exercise-actions) {
      gap: 0.375rem !important;
      margin-top: 0.375rem !important;
    }
    .exercise-content-wrapper--presentation :global(.action-button) {
      font-size: 0.75rem !important;
      padding: 0.25rem 0.625rem !important;
    }
    .exercise-content-wrapper--presentation :global(.exercise-metadata) {
      gap: 0.25rem !important;
      margin-top: 0.25rem !important;
    }
    .exercise-content-wrapper--presentation :global(.exercise-badge) {
      font-size: 0.7rem !important;
      padding: 0.1rem 0.375rem !important;
    }
  }

  /* Ajustements pour tablettes */
  @media (max-width: 1024px) and (min-width: 768px) {
    .list-header-content {
      flex-wrap: wrap;
    }

    .list-actions {
      min-width: 100%;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
  }

  /* ── Bouton "Mode présentation" dans le header ─────────────────────────── */
  .list-action-btn--presentation {
    @apply bg-slate-100 text-slate-600 border border-slate-300;
  }
  .list-action-btn--presentation:hover {
    @apply bg-indigo-50 text-indigo-700 border-indigo-400;
  }
  .list-action-btn--presentation-active {
    @apply bg-indigo-600 text-white border-indigo-600;
  }
  .list-action-btn--presentation-active:hover {
    @apply bg-indigo-700 border-indigo-700;
  }

  /* Wrapper CSS Grid : ancien et nouvel exercice dans la même cellule sans doubler la hauteur */
  .exercise-slide-wrapper {
    display: grid;
    overflow: hidden;
    flex: 1;
  }
  .exercise-slide-wrapper > * {
    grid-area: 1 / 1;
    min-width: 0;
  }

  /* ── Présentation maximale : header masqué, titre dans le rail ─────────── */
  .exercise-list-page.full-presentation .list-header {
    display: none !important;
  }

  .rail-list-title {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgb(100 116 139);
    padding: 0.75rem 0;
    max-height: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid rgb(226 232 240);
    margin-bottom: 0.25rem;
    flex-shrink: 0;
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .rail-list-title:hover {
    color: rgb(79 70 229);
    background-color: rgb(238 242 255);
  }

  /* ── Rail de navigation (sidebar réduite) ──────────────────────────────── */
  .list-navigation--rail {
    flex: 0 0 64px !important;
    max-width: 64px !important;
    min-width: 64px !important;
    overflow: hidden;
    padding: 0.5rem 0;
  }

  .exercise-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0;
    overflow-y: auto;
    height: 100%;
  }

  .rail-item {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    border: 1px solid;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
    @apply border-gray-200 bg-interface-bg-primary text-gray-500;
  }

  .rail-item:hover {
    @apply border-indigo-400 bg-indigo-50 text-indigo-700;
  }

  .rail-item--active {
    @apply border-indigo-600 bg-indigo-600 text-white;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
  }

  /* ── Grandes flèches tactiles (position fixed, centrées verticalement) ── */
  .pres-arrow {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    z-index: 45;
    width: 3rem;
    height: 5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.625rem;
    border: 1px solid;
    cursor: pointer;
    transition: all 0.2s ease;
    @apply bg-white/80 border-gray-200 text-gray-500;
    backdrop-filter: blur(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .pres-arrow svg {
    width: 1.75rem;
    height: 1.75rem;
  }

  .pres-arrow:hover:not(:disabled) {
    @apply bg-indigo-50 border-indigo-400 text-indigo-700;
    box-shadow: 0 4px 16px rgba(79, 70, 229, 0.2);
  }

  .pres-arrow:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .pres-arrow--prev {
    left: 72px; /* laisse la place au rail (64px) + 8px */
  }

  .pres-arrow--next {
    right: 0.75rem;
  }

  /* ── Indicateur de position discret ─────────────────────────────────────── */
  .pres-indicator {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 45;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    border-radius: 1rem;
    @apply bg-black/50 text-white;
    backdrop-filter: blur(4px);
    letter-spacing: 0.03em;
  }

  /* ── Typographie agrandie en mode présentation ───────────────────────────── */
  .exercise-content-wrapper--presentation {
    font-size: 1.125rem; /* 18px base */
    line-height: 1.75;
  }

  @media (min-width: 768px) {
    .exercise-content-wrapper--presentation {
      padding: 0.5rem 2.5rem 2rem;
    }

    /* Header compact en mode présentation desktop */
    .exercise-content-wrapper--presentation :global(.exercise-header) {
      padding: 0.625rem 1rem !important;
      border-radius: 0.625rem !important;
    }
    .exercise-content-wrapper--presentation :global(.exercise-title) {
      font-size: 1.375rem !important;
      line-height: 1.25 !important;
      margin-bottom: 0.25rem !important;
    }
    .exercise-content-wrapper--presentation :global(.exercise-metadata) {
      margin-top: 0.25rem !important;
      gap: 0.25rem !important;
    }
    .exercise-content-wrapper--presentation :global(.exercise-actions) {
      margin-top: 0.375rem !important;
      gap: 0.375rem !important;
    }
    .exercise-content-wrapper--presentation :global(.title-right) {
      flex-direction: row !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 0.25rem 0.5rem !important;
    }
    .exercise-content-wrapper--presentation :global(.attribution-info) {
      flex-direction: row !important;
      gap: 0.25rem 0.5rem !important;
      align-items: center !important;
    }
  }

  /* Titres et paragraphes dans le composant enfant */
  .exercise-content-wrapper--presentation :global(h1) {
    font-size: 2rem !important;
    line-height: 1.25 !important;
  }
  .exercise-content-wrapper--presentation :global(h2) {
    font-size: 1.75rem !important;
    line-height: 1.3 !important;
  }
  .exercise-content-wrapper--presentation :global(h3) {
    font-size: 1.375rem !important;
  }
  .exercise-content-wrapper--presentation :global(p),
  .exercise-content-wrapper--presentation :global(li) {
    font-size: 1.125rem !important;
    line-height: 1.75 !important;
  }

  /* ── Header et footer global masqués en mode présentation ──────────────── */
  :global(body.presentation-mode .header-container) {
    display: none !important;
  }
  :global(body.presentation-mode .footer) {
    display: none !important;
  }
  :global(body.presentation-mode .main-content) {
    max-width: 100% !important;
    padding: 0 !important;
  }

  /* Métadonnées (auteur, date, tags) masquées en mode présentation */
  /* Les .question-number-badge sont volontairement préservés */
  .exercise-content-wrapper--presentation :global(.exercise-meta),
  .exercise-content-wrapper--presentation :global(.exercise-tags),
  .exercise-content-wrapper--presentation :global(.exercise-author),
  .exercise-content-wrapper--presentation :global(.exercise-footer),
  .exercise-content-wrapper--presentation :global(.date-entry),
  .exercise-content-wrapper--presentation :global([class*="meta"]),
  .exercise-content-wrapper--presentation :global([class*="tag"]) {
    display: none !important;
  }
</style>
