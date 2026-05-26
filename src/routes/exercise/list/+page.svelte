<!-- src/routes/exercise/list/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { cubicOut, cubicIn } from 'svelte/easing';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import ExerciseListEditor from '$lib/components/ExerciseListEditor.svelte';
  import LatexExportPanel from '$lib/components/LatexExportPanel.svelte';
  import LectureSidebar from '$lib/components/LectureSidebar.svelte';
  import LectureSubheader from '$lib/components/LectureSubheader.svelte';
  import SeanceModeBar from '$lib/components/SeanceModeBar.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import { immersiveMode } from '$lib/stores/uiStore.ts';
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

  // Mode séance (URL param)
  let mode = 'preparer';
  $: mode = /** @type {'preparer'|'consulter'|'presenter'|'partager'} */ ($page.url.searchParams.get('mode') || 'preparer');

  // Consulter view state
  let consulterShowHint = false;
  let consulterShowSolution = false;

  // Presenter view state
  let presenterQIdx = 0;
  let presenterShowInd = false;
  let presenterShowSol = false;

  $: presenterExo = $selectedExercise;
  $: presenterQuestions = presenterExo?.content?.filter(b => b.type === 'question' || b.type === 'enonce') || [];

  function presenterNext() {
    if (presenterQIdx < presenterQuestions.length - 1) { presenterQIdx++; presenterShowInd = false; presenterShowSol = false; }
    else if ($currentPosition.hasNext) { listActions.nextExercise(); presenterQIdx = 0; presenterShowInd = false; presenterShowSol = false; }
  }
  function presenterPrev() {
    if (presenterQIdx > 0) { presenterQIdx--; presenterShowInd = false; presenterShowSol = false; }
    else if ($currentPosition.hasPrevious) { listActions.previousExercise(); presenterQIdx = 0; presenterShowInd = false; presenterShowSol = false; }
  }
  function presenterNextExo() { if ($currentPosition.hasNext) { listActions.nextExercise(); presenterQIdx = 0; presenterShowInd = false; presenterShowSol = false; } }
  function presenterPrevExo() { if ($currentPosition.hasPrevious) { listActions.previousExercise(); presenterQIdx = 0; presenterShowInd = false; presenterShowSol = false; } }

  function handlePresenterKey(e) {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    if (mode !== 'presenter') return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); presenterNext(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); presenterPrev(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); presenterNextExo(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); presenterPrevExo(); }
    else if (e.key === 'i' || e.key === 'I') presenterShowInd = !presenterShowInd;
    else if (e.key === 's' || e.key === 'S') presenterShowSol = !presenterShowSol;
    else if (/^[1-9]$/.test(e.key)) listActions.selectExercise(parseInt(e.key) - 1);
  }

  // Partager view state
  let partagerCopied = '';
  let partagerSolVisible = false;
  let partagerIndVisible = true;
  let partagerNotesVisible = false;

  async function partagerCopyLink() {
    const url = buildShareUrl(null);
    try {
      await navigator.clipboard.writeText(url);
      partagerCopied = 'link';
      setTimeout(() => { if (partagerCopied === 'link') partagerCopied = ''; }, 2000);
    } catch { alert(url); }
  }
  async function partagerCopyEmbed() {
    const url = buildShareUrl(null);
    const embed = `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
    try {
      await navigator.clipboard.writeText(embed);
      partagerCopied = 'embed';
      setTimeout(() => { if (partagerCopied === 'embed') partagerCopied = ''; }, 2000);
    } catch { alert(embed); }
  }

  let showHint = false;
  let showSolution = false;
  let showInlineControls = true;
  let readingMode = 'classic';
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

  function getQuestionCount(content = []) {
    return content.filter((block) => (block?.type || 'text') === 'question').length;
  }

  $: selectedContent = $selectedExercise?.content || [];
  $: selectedQuestionCount = getQuestionCount(selectedContent);
  $: isReadingImmersive = mode === 'preparer' && !isPresentationMode && readingMode === 'immersive' && Boolean($selectedExercise);
  $: immersiveMode.set(isReadingImmersive);
  
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
    immersiveMode.set(false);
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

<svelte:window on:keydown={(e) => { handleKeydown(e); handlePresenterKey(e); }} on:resize={checkMobile} />

<SeanceModeBar
  bind:mode
  title={listTitle || "Liste d'exercices"}
  subtitle="{$exerciseList.length} exercice{$exerciseList.length !== 1 ? 's' : ''}"
  breadcrumb={[{ label: 'Mes séances', href: '/exercise/list' }, { label: listTitle || 'Sans titre' }]}
>
  <svelte:fragment slot="title">
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
      {/if}
    </h1>
  </svelte:fragment>

  <svelte:fragment slot="actions">
    {#if mode === 'preparer'}
      <div class="list-actions">
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
                aria-label="Copier la liste d'UUIDs"
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
                aria-label="Charger cette liste d'UUIDs"
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
        {/if}
      </div>
    {/if}
  </svelte:fragment>
</SeanceModeBar>

{#if mode === 'preparer'}
<div class="exercise-list-page" class:presentation-mode={isPresentationMode} class:full-presentation={isFullPresentation}>
  {#if data.meta?.errors > 0 || data.meta?.wasLimited}
    <div class="list-notices">
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
  {/if}

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
                aria-label="Copier la liste d'UUIDs"
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
                aria-label="Charger cette liste d'UUIDs"
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
                aria-label="Copier la liste d'UUIDs"
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
                aria-label="Charger cette liste d'UUIDs"
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
            <div class="exercise-page-shell" class:exercise-page-shell--immersive={readingMode === 'immersive'}>
              <LectureSubheader
                exercise={$selectedExercise}
                bind:mode={readingMode}
                bind:showHint
                bind:showSolution
                questionCount={selectedQuestionCount}
                showModeSwitch={false}
                showShareAction={false}
                showLatexAction={false}
                showPrimaryAction={false}
              />

              <div class="exercise-reading-layout">
                <article class="exercise-reading-column">
                  <div class="exercise-block">
                    <ExerciseContent
                      exercise={$selectedExercise}
                      variant="full"
                      showHeader={false}
                      content={selectedContent}
                      bind:showHint
                      bind:showSolution
                      bind:showInlineControls
                      {studentMode}
                    />
                  </div>
                </article>

                {#if readingMode !== 'immersive'}
                  <LectureSidebar
                    exercise={$selectedExercise}
                    similar={[]}
                    bind:showHint
                    bind:showSolution
                    bind:showInlineControls
                  />
                {/if}
              </div>
            </div>
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

{:else if mode === 'consulter'}
<!-- ────────── MODE CONSULTER ────────── -->
<div class="mode-consulter">
  {#if !$hasExercises}
    <div class="empty-state" style="margin: 4rem auto">
      <div class="empty-state-icon">📚</div>
      <h2 class="empty-state-title">Aucun exercice</h2>
      <p class="empty-state-subtitle">Ajoutez des exercices en mode Préparer.</p>
    </div>
  {:else}
    <!-- TOC sidebar -->
    <aside class="consulter-toc">
      <div class="t-overline mb-3">Sommaire · {$exerciseList.length} exercices</div>
      <div class="consulter-list">
        {#each $exerciseList as e, i}
          {@const isSel = i === $selectedExerciseIndex}
          <button
            class="consulter-item"
            class:is-selected={isSel}
            on:click={() => listActions.selectExercise(i)}
          >
            <span class="consulter-num" class:is-selected={isSel}>{String(i + 1).padStart(2, '0')}</span>
            <div class="consulter-item-body">
              <div class="consulter-item-title" class:is-selected={isSel}>
                <MathRenderer content={e.title || `Exercice ${i+1}`} inline={true} />
              </div>
              <div style="display:flex; align-items:center; gap:6px">
                {#if e.difficulty}<StarsRating n={e.difficulty} total={4} />{/if}
                {#if e.estimated_time}<span class="consulter-item-time">· {e.estimated_time}</span>{/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    </aside>

    <!-- Reading panel -->
    <main class="consulter-main">
      <!-- Controls bar -->
      <div class="consulter-controls">
        <span class="consulter-pos">
          <strong style="font-family:var(--font-mono, monospace)">{$selectedExerciseIndex + 1} / {$exerciseList.length}</strong>
          {#if listTitle} · {listTitle}{/if}
        </span>
        <span style="flex:1"></span>
        <span class="consulter-reveal-label">Tout révéler :</span>
        <button
          class="btn btn-secondary btn-sm consulter-btn-hint"
          class:is-active={consulterShowHint}
          on:click={() => (consulterShowHint = !consulterShowHint)}
        >💡 Indications</button>
        <button
          class="btn btn-secondary btn-sm consulter-btn-sol"
          class:is-active={consulterShowSolution}
          on:click={() => (consulterShowSolution = !consulterShowSolution)}
        >★ Solutions</button>
      </div>

      <!-- Exercise body -->
      {#if $exerciseLoading}
        <div class="consulter-loading">Chargement…</div>
      {:else if $selectedExercise}
        <div class="consulter-body consulter-body--immersive">
          <div class="exercise-page-shell exercise-page-shell--immersive">
            <LectureSubheader
              exercise={$selectedExercise}
              mode="immersive"
              bind:showHint={consulterShowHint}
              bind:showSolution={consulterShowSolution}
              questionCount={selectedQuestionCount}
              showModeSwitch={false}
              showShareAction={false}
              showLatexAction={false}
              showPrimaryAction={false}
              showRevealControls={false}
            />

            <div class="exercise-reading-layout">
              <article class="exercise-reading-column">
                <div class="exercise-block">
                  <ExerciseContent
                    exercise={$selectedExercise}
                    variant="full"
                    showHeader={false}
                    content={selectedContent}
                    bind:showHint={consulterShowHint}
                    bind:showSolution={consulterShowSolution}
                    bind:showInlineControls
                  />
                </div>
              </article>
            </div>
          </div>

          <!-- Bottom navigation -->
          <div class="consulter-nav-btns">
            <button
              class="btn btn-secondary"
              disabled={!$currentPosition.hasPrevious}
              on:click={listActions.previousExercise}
            >← Précédent</button>
            <span style="flex:1"></span>
            {#if $currentPosition.hasNext}
              <button class="btn btn-primary" on:click={listActions.nextExercise}>
                {$exerciseList[$selectedExerciseIndex + 1]?.title
                  ? ($exerciseList[$selectedExerciseIndex + 1].title.length > 28
                    ? $exerciseList[$selectedExerciseIndex + 1].title.slice(0, 28) + '…'
                    : $exerciseList[$selectedExerciseIndex + 1].title)
                  : 'Suivant'} →
              </button>
            {/if}
          </div>
        </div>
      {:else}
        <div class="consulter-loading">Sélectionnez un exercice dans le sommaire</div>
      {/if}
    </main>
  {/if}
</div>

{:else if mode === 'presenter'}
<!-- ────────── MODE PRÉSENTER ────────── -->
<div class="mode-presenter">
  {#if !$hasExercises}
    <div style="text-align:center; padding: 4rem 2rem; color: rgba(254,249,235,0.5);">
      <p>Aucun exercice dans la séance. Ajoutez des exercices en mode Préparer.</p>
    </div>
  {:else}
    <!-- 42px thin top bar (accent dot + title + counter) -->
    <div class="presenter-topbar">
      <span class="presenter-topbar-brand">
        <span class="presenter-accent-dot"></span>
        OpenYourMath · projection
      </span>
      <span class="presenter-topbar-sep">·</span>
      <span class="presenter-topbar-title">{listTitle || "Liste d'exercices"}</span>
      <span style="flex:1"></span>
      <span class="presenter-topbar-counter">
        Exercice {$selectedExerciseIndex + 1} / {$exerciseList.length}
        {#if presenterQuestions.length > 0} · Question {presenterQIdx + 1} / {presenterQuestions.length}{/if}
      </span>
      <span class="presenter-topbar-sep">·</span>
      <span class="presenter-topbar-slide-count">Diapo {$selectedExerciseIndex * Math.max(presenterQuestions.length, 1) + presenterQIdx + 1}</span>
    </div>

    <!-- Slide canvas -->
    <div class="presenter-slide">
      {#if $selectedExercise}
        <!-- Exercise breadcrumb inside slide -->
        <div class="presenter-slide-breadcrumb">
          <span class="presenter-exo-label">Exercice {$selectedExerciseIndex + 1}</span>
          <span class="presenter-slide-sep">·</span>
          <span class="presenter-exo-name">{$selectedExercise.title || ''}</span>
          {#if presenterQuestions.length > 0}
            <span class="presenter-slide-sep">·</span>
            <span class="presenter-q-label">Question {presenterQIdx + 1} / {presenterQuestions.length}</span>
          {/if}
        </div>

        {#if presenterQuestions.length > 0}
          {@const q = presenterQuestions[presenterQIdx]}
          <div class="presenter-slide-inner">
            <div class="presenter-bignum">{presenterQIdx + 1}.</div>
            <div class="presenter-body">
              {#if q?.title}
                <div class="presenter-q-title">
                  <MathRenderer content={q.title} inline={true} />
                </div>
              {/if}
              {#if q?.content || q?.body}
                <div class="presenter-q-body">
                  <MathRenderer content={q.content || q.body} inline={false} />
                </div>
              {/if}
              <div class="presenter-reveal-btns">
                <button class="presenter-btn presenter-btn--ind" on:click={() => (presenterShowInd = !presenterShowInd)}>
                  💡 {presenterShowInd ? 'Masquer' : 'Afficher'} l'indication
                  <span class="presenter-kbd-hint">I</span>
                </button>
                <button class="presenter-btn presenter-btn--sol" on:click={() => (presenterShowSol = !presenterShowSol)}>
                  ★ {presenterShowSol ? 'Masquer' : 'Afficher'} la solution
                  <span class="presenter-kbd-hint">S</span>
                </button>
              </div>
              {#if presenterShowInd && q?.indication}
                <div class="presenter-reveal presenter-reveal--ind">
                  <div class="presenter-reveal-label">Indication</div>
                  <div class="presenter-reveal-body"><MathRenderer content={q.indication} inline={false} /></div>
                </div>
              {/if}
              {#if presenterShowSol && q?.solution}
                <div class="presenter-reveal presenter-reveal--sol">
                  <div class="presenter-reveal-label">Solution</div>
                  <div class="presenter-reveal-body"><MathRenderer content={q.solution} inline={false} /></div>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <!-- No structured questions: show full exercise content -->
          <div class="presenter-slide-inner">
            <div class="presenter-body presenter-body--full">
              <ExerciseContent
                exercise={$selectedExercise}
                variant="full"
                showGlobalToggles={false}
                content={$selectedExercise.content || []}
                bind:showHint={presenterShowInd}
                bind:showSolution={presenterShowSol}
              />
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Bottom controls bar -->
    <div class="presenter-controls">
      <button class="presenter-exo-btn" disabled={!$currentPosition.hasPrevious} on:click={presenterPrevExo} title="Exercice précédent">
        ⇇ Exo
      </button>
      <button class="presenter-nav-btn" disabled={!$currentPosition.hasPrevious && presenterQIdx === 0} on:click={presenterPrev}>
        ← Précédent
      </button>
      <div class="presenter-hints">
        <span><span class="presenter-kbd">←</span><span class="presenter-kbd">→</span> diapo</span>
        <span><span class="presenter-kbd">↑</span><span class="presenter-kbd">↓</span> exercice</span>
        <span><span class="presenter-kbd">I</span> indication</span>
        <span><span class="presenter-kbd">S</span> solution</span>
      </div>
      <button
        class="presenter-nav-btn presenter-nav-btn--next"
        disabled={!$currentPosition.hasNext && presenterQIdx >= presenterQuestions.length - 1}
        on:click={presenterNext}
      >
        Suivant →
      </button>
      <button class="presenter-exo-btn" disabled={!$currentPosition.hasNext} on:click={presenterNextExo} title="Exercice suivant">
        Exo ⇉
      </button>
    </div>
  {/if}
</div>

{:else if mode === 'partager'}
<!-- ────────── MODE PARTAGER ────────── -->
<div class="mode-partager">
  <div class="partager-inner">
    <!-- Header -->
    <header>
      <h2 class="partager-section-title">Partager cette séance</h2>
      <p class="partager-section-desc">
        Distribuez la séance à vos élèves ou à un collègue. Tout exercice partagé reste à jour : si l'auteur modifie un exercice, la séance partagée se met à jour automatiquement.
      </p>
    </header>

    <!-- Lien public -->
    <section class="partager-section">
      <div class="t-overline mb-3">Lien public</div>
      <div class="partager-link-row">
        <div class="form-input partager-link-display">
          {typeof window !== 'undefined' ? buildShareUrl(null) : ''}
        </div>
        <button class="btn btn-primary" on:click={partagerCopyLink}>
          {partagerCopied === 'link' ? '✓ Copié !' : 'Copier'}
        </button>
      </div>
      <!-- Always-on toggle row -->
      <div class="partager-always-on-row">
        <span class="partager-toggle-pill partager-toggle-pill--on">
          <span class="partager-toggle-thumb"></span>
        </span>
        <span>Accessible sans compte</span>
        <span style="flex:1"></span>
        <span class="partager-visibility-label">Visibilité : <strong>publique</strong></span>
      </div>
    </section>

    <!-- QR + Embed 2-column grid -->
    <div class="partager-qr-embed-grid">
      <section class="partager-section partager-qr-card">
        <div class="t-overline mb-3">QR code</div>
        <div class="partager-qr-placeholder">
          <!-- QR pattern placeholder -->
          <svg viewBox="0 0 140 140" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
            <rect width="140" height="140" fill="white"/>
            <!-- Top-left finder -->
            <rect x="10" y="10" width="40" height="40" rx="3" fill="currentColor"/>
            <rect x="18" y="18" width="24" height="24" rx="2" fill="white"/>
            <rect x="24" y="24" width="12" height="12" rx="1" fill="currentColor"/>
            <!-- Top-right finder -->
            <rect x="90" y="10" width="40" height="40" rx="3" fill="currentColor"/>
            <rect x="98" y="18" width="24" height="24" rx="2" fill="white"/>
            <rect x="104" y="24" width="12" height="12" rx="1" fill="currentColor"/>
            <!-- Bottom-left finder -->
            <rect x="10" y="90" width="40" height="40" rx="3" fill="currentColor"/>
            <rect x="18" y="98" width="24" height="24" rx="2" fill="white"/>
            <rect x="24" y="104" width="12" height="12" rx="1" fill="currentColor"/>
            <!-- Data modules (simplified pattern) -->
            {#each [60,70,80,90,100,110,120] as x}
              {#each [10,20,30,40,50,60] as y}
                {#if (x + y) % 16 < 8}
                  <rect x={x} y={y} width="8" height="8" fill="currentColor"/>
                {/if}
              {/each}
            {/each}
            {#each [10,20,30,40,50] as x}
              {#each [60,70,80,120,130] as y}
                {#if (x * 3 + y) % 14 < 6}
                  <rect x={x} y={y} width="8" height="8" fill="currentColor"/>
                {/if}
              {/each}
            {/each}
          </svg>
        </div>
        <button class="btn btn-secondary btn-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          PNG
        </button>
      </section>

      <section class="partager-section">
        <div class="t-overline mb-3">Intégrer dans un cours / blog</div>
        <pre class="partager-embed-pre">&lt;iframe src="{typeof window !== 'undefined' ? buildShareUrl(null) : ''}/embed"
        width="100%" height="600"
        frameborder="0"&gt;
&lt;/iframe&gt;</pre>
        <button class="btn btn-secondary btn-sm mt-2" on:click={partagerCopyEmbed}>
          {partagerCopied === 'embed' ? '✓ Copié !' : 'Copier le code'}
        </button>
      </section>
    </div>

    <!-- Export -->
    <section class="partager-section">
      <div class="t-overline mb-3">Exporter</div>
      <div class="partager-export-grid">
        <a href="/api/export/pdf?{buildUrl().split('?')[1] || ''}" class="partager-export-card" target="_blank">
          <span class="partager-export-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </span>
          <span class="partager-export-label">PDF — feuille TD</span>
          <span class="partager-export-sub">Énoncés sans solutions, 1 colonne</span>
        </a>
        <a href="/api/export/pdf?{buildUrl().split('?')[1] || ''}&solutions=1" class="partager-export-card" target="_blank">
          <span class="partager-export-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </span>
          <span class="partager-export-label">PDF — corrigé</span>
          <span class="partager-export-sub">Énoncés + solutions intégrales</span>
        </a>
        <a href="/api/export/latex?{buildUrl().split('?')[1] || ''}" class="partager-export-card" target="_blank">
          <span class="partager-export-icon" style="font-family:monospace;font-size:16px">⟨/⟩</span>
          <span class="partager-export-label">Source LaTeX</span>
          <span class="partager-export-sub">Archive .tex prête à compiler</span>
        </a>
      </div>
    </section>

    <!-- Permissions avec CSS toggles -->
    <section class="partager-section">
      <div class="t-overline mb-3">Accès &amp; permissions</div>
      <div class="partager-perms">
        <label class="partager-perm-row">
          <div class="partager-perm-info">
            <span class="partager-perm-label">Solutions visibles dans le lien public</span>
          </div>
          <button
            class="partager-toggle-btn"
            class:is-on={partagerSolVisible}
            on:click={() => (partagerSolVisible = !partagerSolVisible)}
            role="switch"
            aria-checked={partagerSolVisible}
          >
            <span class="partager-toggle-btn-thumb"></span>
          </button>
        </label>
        <label class="partager-perm-row">
          <div class="partager-perm-info">
            <span class="partager-perm-label">Indications visibles dans le lien public</span>
          </div>
          <button
            class="partager-toggle-btn"
            class:is-on={partagerIndVisible}
            on:click={() => (partagerIndVisible = !partagerIndVisible)}
            role="switch"
            aria-checked={partagerIndVisible}
          >
            <span class="partager-toggle-btn-thumb"></span>
          </button>
        </label>
        <label class="partager-perm-row">
          <div class="partager-perm-info">
            <span class="partager-perm-label">Notes personnelles partagées</span>
            <span class="partager-perm-hint chip chip-warning">Risqué</span>
          </div>
          <button
            class="partager-toggle-btn"
            class:is-on={partagerNotesVisible}
            on:click={() => (partagerNotesVisible = !partagerNotesVisible)}
            role="switch"
            aria-checked={partagerNotesVisible}
          >
            <span class="partager-toggle-btn-thumb"></span>
          </button>
        </label>
      </div>
    </section>

    <!-- Stats -->
    <div class="partager-stats-grid">
      <div class="partager-stat-card">
        <div class="partager-stat-value">{$exerciseList.length}</div>
        <div class="partager-stat-label">exercices</div>
      </div>
      <div class="partager-stat-card">
        <div class="partager-stat-value">—</div>
        <div class="partager-stat-label">Vues uniques</div>
      </div>
      <div class="partager-stat-card">
        <div class="partager-stat-value">—</div>
        <div class="partager-stat-label">Téléchargements PDF</div>
      </div>
    </div>
  </div>
</div>

{/if}

<style>
  /* List page styles (moved from app.css) */
  .exercise-list-page {
    min-height: 100vh;
    @apply bg-interface-bg-primary;
  }

  .list-header {
    display: contents;
  }

  .list-header-content {
    display: none;
  }

  .list-header-info { flex: 1; }

  .list-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    @apply text-interface-text-primary;
  }

  .list-count { font-weight: 500; @apply text-interface-text-muted; }

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
    @apply text-interface-text-primary border-brand-500;
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

  .list-notices {
    padding: 0.5rem 1.75rem;
    @apply bg-interface-bg-primary border-b border-interface-border-primary;
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
    @apply bg-interface-bg-secondary text-interface-text-secondary border-interface-border-primary; 
  }
  .header-action-btn--secondary:hover { 
    @apply bg-interface-bg-tertiary border-interface-border-secondary; 
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

  .list-action-btn--secondary { @apply bg-interface-bg-secondary text-interface-text-secondary; }
  .list-action-btn--secondary:hover { @apply bg-interface-bg-tertiary; }

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
    @apply bg-interface-bg-primary border border-interface-border-primary;
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
    @apply border-interface-border-primary;
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
    @apply text-interface-text-primary;
  }

  .share-row-desc {
    font-size: 0.75rem;
    @apply text-interface-text-muted;
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
    @apply bg-interface-bg-secondary text-interface-text-secondary border-interface-border-primary;
  }

  .share-copy-btn:hover {
    @apply bg-interface-bg-tertiary;
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
    @apply bg-interface-bg-primary border border-interface-border-primary;
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
    @apply text-interface-text-primary;
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
    @apply bg-interface-bg-secondary text-interface-text-secondary;
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
    @apply bg-interface-bg-primary border border-interface-border-primary;
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
    @apply text-interface-text-disabled;
  }

  .uuid-input--error {
    @apply border-red-500;
  }

  .uuid-input:disabled {
    @apply bg-interface-bg-secondary text-interface-text-muted;
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
    @apply bg-interface-bg-secondary text-interface-text-secondary;
  }

  .uuid-btn:hover:not(:disabled) {
    @apply bg-interface-bg-tertiary text-interface-text-secondary;
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
    @apply border border-interface-border-primary rounded-md bg-interface-bg-primary text-interface-text-secondary;
  }

  .edit-toggle-btn:hover {
    @apply bg-interface-bg-secondary border-interface-border-secondary;
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
    @apply border border-interface-border-primary rounded-md bg-interface-bg-primary text-interface-text-secondary;
  }

  .mobile-close-btn:hover {
    @apply bg-red-100 border-red-500 text-red-600;
  }

  /* Empty state (scoped to list page) */
  .exercise-list-page .empty-state { display:flex; align-items:center; justify-content:center; min-height:60vh; padding:2rem; }
  .exercise-list-page .empty-state-content { text-align:center; max-width:28rem; }
  .exercise-list-page .empty-state-icon { margin:0 auto 1.5rem; @apply text-interface-text-disabled; }
  .exercise-list-page .empty-state-title { font-size:1.25rem; font-weight:600; margin:0 0 0.5rem; @apply text-interface-text-secondary; }
  .exercise-list-page .empty-state-description { margin:0 0 2rem; line-height:1.6; @apply text-interface-text-secondary; }
  .exercise-list-page .empty-state-actions { margin-bottom:2rem; }
  .exercise-list-page .empty-state-help { padding-top:1.5rem; @apply border-t border-interface-border-primary; }
  .exercise-list-page .help-details { text-align:left; }
  .exercise-list-page .help-summary { cursor:pointer; font-size:0.875rem; @apply text-interface-text-secondary; }
  .help-content { margin-top:0.5rem; padding:1rem; border-radius:0.375rem; font-size:0.875rem; @apply bg-interface-bg-secondary; }
  .help-code { padding:0.5rem; border-radius:0.25rem; font-family:monospace; display:block; margin:0.5rem 0; @apply bg-gray-900 text-gray-50; }
  .help-note { font-size:0.8rem; margin:0.5rem 0 0; @apply text-interface-text-secondary; }

  /* Layout + display column */
  .list-container { flex:1; display:flex; min-height:0; overflow:hidden; }
  
  /* Desktop: fixed sidebar height with its own scroll */
  @media (min-width: 768px) {
    .list-navigation {
      flex: 0 0 320px;
      max-width: 320px;
      @apply border-r border-interface-border-primary bg-interface-bg-primary;
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

  .exercise-display .exercise-page-shell {
    background: #fbf8ef;
    min-height: 100%;
  }

  .exercise-display .exercise-reading-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 0;
    align-items: stretch;
    max-width: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid theme('colors.interface.border-primary');
  }

  .exercise-display .exercise-reading-column {
    background: #fffdf8;
    padding: 32px 48px 72px 32px;
    min-width: 0;
  }

  .exercise-display .exercise-page-shell--immersive .exercise-reading-layout {
    display: block;
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 24px 72px;
    border-top: 0;
  }

  .exercise-display .exercise-page-shell--immersive .exercise-reading-column {
    padding: 0;
    background: transparent;
  }

  .exercise-display .exercise-block {
    max-width: 880px;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
  }

  .exercise-display .exercise-block :global(.exercise-content) {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }

  .exercise-display .exercise-block :global(.question-response-pair) {
    border-left: 0;
    padding-left: 0 !important;
  }

  .exercise-display .exercise-block :global(.question-block) {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }
  
  .exercise-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; @apply text-interface-text-secondary; }
  .loading-spinner { width:2rem; height:2rem; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:1rem; border:2px solid theme('colors.gray.200'); border-top:2px solid theme('colors.blue.500'); }
  
  .exercise-error { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:2rem; text-align:center; }
  .error-icon { margin-bottom:1rem; @apply text-error-500; }
  .error-title { font-size:1.125rem; font-weight:600; margin:0 0 0.5rem; @apply text-interface-text-secondary; }
  .error-message { margin:0 0 1.5rem; @apply text-interface-text-secondary; }
  .error-retry-btn { padding:0.5rem 1rem; border:none; border-radius:0.375rem; cursor:pointer; font-weight:500; transition:background-color .2s; @apply bg-blue-500 text-white; }
  .error-retry-btn:hover { @apply bg-blue-600; }
  
  .no-selection { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; @apply text-interface-text-disabled; }
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
    @apply bg-interface-bg-primary border-t border-interface-border-primary;
  }

  .mobile-nav-btn {
    width: 3rem;
    height: 3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    @apply border border-interface-border-primary rounded-lg bg-interface-bg-primary text-interface-text-secondary;
  }

  .mobile-nav-btn:hover:not(:disabled) {
    @apply bg-interface-bg-secondary border-interface-border-secondary text-interface-text-secondary;
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
    @apply text-interface-text-secondary;
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
    @apply bg-interface-bg-primary text-interface-text-secondary border-interface-border-primary;
  }

  .nav-btn:hover:not(:disabled) {
    @apply bg-interface-bg-secondary border-interface-border-secondary;
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
    @apply text-interface-text-primary;
  }

  .nav-counter {
    font-size: 0.875rem;
    font-weight: 500;
    @apply text-interface-text-muted;
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
      @apply bg-interface-bg-primary border-l border-interface-border-primary;
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

    .exercise-display .exercise-reading-layout {
      display: block;
      padding: 0;
      border-top: 1px solid theme('colors.interface.border-primary');
    }

    .exercise-display .exercise-reading-column {
      padding: 24px 16px 40px;
    }

    .exercise-display .exercise-block {
      border-radius: 0;
      border-left: 0;
      border-right: 0;
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

  @media (max-width: 1200px) {
    .exercise-display .exercise-reading-layout {
      display: block;
    }

    .exercise-display :global(.lecture-sidebar) {
      position: static;
      width: auto;
      max-height: none;
      min-height: 0;
      border-left: 0;
      border-top: 1px solid theme('colors.interface.border-primary');
    }
  }

  /* ── Bouton "Mode présentation" dans le header ─────────────────────────── */
  .list-action-btn--presentation {
    @apply bg-interface-bg-secondary text-interface-text-secondary border border-slate-300;
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
    @apply border-interface-border-primary bg-interface-bg-primary text-gray-500;
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
    @apply bg-white/80 border-interface-border-primary text-gray-500;
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

  /* ── MODE CONSULTER ──────────────────────────────────────────────────────── */
  .mode-consulter {
    display: flex;
    height: calc(100vh - 80px);
    background: theme('colors.interface.bg-primary');
  }
  .consulter-toc {
    width: 300px;
    flex-shrink: 0;
    padding: 16px 14px;
    background: theme('colors.interface.bg-secondary');
    border-right: 1px solid theme('colors.interface.border-primary');
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .consulter-list { display: flex; flex-direction: column; gap: 4px; }
  .consulter-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border-radius: 6px;
    border-left: 3px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    color: theme('colors.interface.text-primary');
  }
  .consulter-item:hover { background: theme('colors.interface.bg-tertiary'); }
  .consulter-item.is-selected {
    background: theme('colors.brand.50');
    border-left-color: theme('colors.brand.500');
  }
  .consulter-num {
    font-size: 12px;
    font-weight: 600;
    color: theme('colors.interface.text-muted');
    min-width: 18px;
    padding-top: 2px;
    font-family: theme('fontFamily.mono');
  }
  .consulter-item.is-selected .consulter-num { color: theme('colors.brand.700'); }
  .consulter-item-body { flex: 1; min-width: 0; }
  .consulter-item-title {
    font-family: theme('fontFamily.heading');
    font-size: 13px;
    font-weight: 500;
    line-height: 1.3;
    margin-bottom: 4px;
    color: theme('colors.interface.text-primary');
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .consulter-item.is-selected .consulter-item-title { font-weight: 700; color: theme('colors.brand.800'); }
  .consulter-item-time { font-size: 10px; color: theme('colors.interface.text-muted'); }
  .consulter-main {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    background: theme('colors.interface.bg-primary');
  }
  .consulter-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
  }
  .consulter-pos { font-size: 12px; color: theme('colors.interface.text-muted'); }
  .consulter-reveal-label { font-size: 12px; color: theme('colors.interface.text-muted'); }
  .consulter-btn-hint.is-active {
    background: theme('colors.warning.50') !important;
    border-color: theme('colors.warning.200') !important;
    color: theme('colors.warning.700') !important;
  }
  .consulter-btn-sol.is-active {
    background: theme('colors.brand.50') !important;
    border-color: theme('colors.brand.200') !important;
    color: theme('colors.brand.700') !important;
  }
  .consulter-body { max-width: 860px; margin: 0 auto; }
  .consulter-body--immersive .exercise-page-shell {
    background: #fbf8ef;
  }
  .consulter-body--immersive .exercise-reading-layout {
    display: block;
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 24px 72px;
    border-top: 0;
  }
  .consulter-body--immersive .exercise-reading-column {
    padding: 0;
    background: transparent;
  }
  .consulter-body--immersive .exercise-block {
    max-width: 880px;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
  }
  .consulter-body--immersive .exercise-block :global(.exercise-content) {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }
  .consulter-body--immersive .exercise-block :global(.question-response-pair) {
    border-left: 0;
    padding-left: 0 !important;
  }
  .consulter-body--immersive .exercise-block :global(.question-block) {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }
  .consulter-nav-btns {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 32px;
    padding-top: 18px;
    border-top: 1px solid theme('colors.interface.border-primary');
  }
  .consulter-loading {
    padding: 3rem 2rem;
    text-align: center;
    color: theme('colors.interface.text-muted');
    font-size: 14px;
  }
  @media (max-width: 768px) {
    .mode-consulter { flex-direction: column; height: auto; }
    .consulter-toc { width: 100%; height: 200px; }
    .consulter-main { padding: 16px; }
  }

  /* ── MODE PRÉSENTER ──────────────────────────────────────────────────────── */
  .mode-presenter {
    min-height: calc(100vh - 80px);
    background: #0d3c4d;
    color: #fef9eb;
    display: flex;
    flex-direction: column;
  }
  .presenter-topbar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 42px;
    padding: 0 24px;
    background: rgba(0,0,0,0.25);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .presenter-topbar-brand {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(254,249,235,0.7);
    letter-spacing: 0.02em;
  }
  .presenter-accent-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5bcaca;
    flex-shrink: 0;
  }
  .presenter-topbar-sep { font-size: 12px; color: rgba(254,249,235,0.25); }
  .presenter-topbar-title {
    font-size: 12px;
    color: rgba(254,249,235,0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
  }
  .presenter-topbar-counter {
    font-size: 12px;
    color: #5bcaca;
    font-weight: 600;
    font-family: theme('fontFamily.mono');
  }
  .presenter-topbar-slide-count {
    font-size: 11px;
    color: rgba(254,249,235,0.35);
    font-family: theme('fontFamily.mono');
  }
  .presenter-slide {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 28px 32px 16px;
    overflow-y: auto;
  }
  .presenter-slide-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 28px;
    width: 100%;
    max-width: 900px;
  }
  .presenter-exo-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5bcaca;
  }
  .presenter-slide-sep { font-size: 12px; color: rgba(254,249,235,0.25); }
  .presenter-exo-name {
    font-size: 13px;
    color: rgba(254,249,235,0.6);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .presenter-q-label { font-size: 12px; color: rgba(254,249,235,0.4); font-family: theme('fontFamily.mono'); }
  .presenter-slide-inner { display: flex; align-items: flex-start; gap: 24px; max-width: 900px; width: 100%; }
  .presenter-bignum {
    font-family: theme('fontFamily.heading');
    font-size: 110px;
    font-weight: 800;
    color: #5bcaca;
    letter-spacing: -3px;
    line-height: 1;
    flex-shrink: 0;
    min-width: 120px;
    text-align: right;
  }
  .presenter-body { flex: 1; min-width: 0; }
  .presenter-body--full { padding-top: 8px; }
  .presenter-q-title {
    font-family: theme('fontFamily.heading');
    font-size: 22px;
    font-weight: 700;
    color: #fef9eb;
    margin-bottom: 12px;
  }
  .presenter-q-body { font-size: 18px; line-height: 1.7; color: rgba(254,249,235,0.9); margin-bottom: 20px; }
  .presenter-reveal-btns { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .presenter-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: theme('borderRadius.pill');
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.07);
    color: rgba(254,249,235,0.75);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .presenter-btn:hover { background: rgba(255,255,255,0.14); }
  .presenter-btn--ind {
    border-color: rgba(245,197,95,0.4);
    color: #f5c55f;
  }
  .presenter-btn--ind:hover { background: rgba(245,197,95,0.12); }
  .presenter-btn--sol {
    border-color: rgba(91,202,202,0.4);
    color: #5bcaca;
  }
  .presenter-btn--sol:hover { background: rgba(91,202,202,0.1); }
  .presenter-kbd-hint {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 4px;
    padding: 1px 6px;
    font-family: theme('fontFamily.mono');
    font-size: 10px;
    color: rgba(254,249,235,0.5);
  }
  .presenter-reveal {
    padding: 14px 18px;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 16px;
    line-height: 1.65;
  }
  .presenter-reveal--ind {
    border-left: 3px solid #f5c55f;
    background: rgba(245,197,95,0.18);
    border-radius: 0 8px 8px 0;
  }
  .presenter-reveal--sol {
    background: rgba(254,249,235,0.06);
    border: 1px solid rgba(254,249,235,0.12);
  }
  .presenter-reveal-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 6px;
    color: rgba(254,249,235,0.45);
  }
  .presenter-reveal--ind .presenter-reveal-label { color: #f5c55f; }
  .presenter-reveal-body { color: rgba(254,249,235,0.9); }
  .presenter-reveal--ind .presenter-reveal-body { color: #fef9eb; }
  .presenter-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: rgba(0,0,0,0.25);
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .presenter-exo-btn {
    padding: 7px 14px;
    border-radius: theme('borderRadius.pill');
    border: 1px solid rgba(255,255,255,0.15);
    background: transparent;
    color: rgba(254,249,235,0.5);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .presenter-exo-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: rgba(254,249,235,0.8); }
  .presenter-exo-btn:disabled { opacity: 0.3; cursor: default; }
  .presenter-nav-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    border-radius: theme('borderRadius.pill');
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.06);
    color: rgba(254,249,235,0.8);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .presenter-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
  .presenter-nav-btn:disabled { opacity: 0.3; cursor: default; }
  .presenter-nav-btn--next {
    background: #5bcaca;
    border-color: #5bcaca;
    color: #0d3c4d;
    font-weight: 600;
  }
  .presenter-nav-btn--next:hover:not(:disabled) { background: #6dd4d4; border-color: #6dd4d4; }
  .presenter-hints {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    font-size: 11px;
    color: rgba(254,249,235,0.35);
  }
  .presenter-hints span { display: flex; align-items: center; gap: 4px; }
  .presenter-kbd {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: theme('fontFamily.mono');
    font-size: 10px;
    color: rgba(254,249,235,0.55);
  }
  @media (max-width: 640px) {
    .presenter-bignum { font-size: 60px; min-width: 70px; }
    .presenter-slide { padding: 20px; }
    .presenter-slide-inner { flex-direction: column; gap: 12px; }
    .presenter-hints { display: none; }
  }

  /* ── MODE PARTAGER ───────────────────────────────────────────────────────── */
  .mode-partager {
    background: theme('colors.interface.bg-primary');
    min-height: calc(100vh - 80px);
    padding: 32px 16px 64px;
  }
  .partager-inner {
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .partager-section-title {
    font-family: theme('fontFamily.heading');
    font-size: 28px;
    font-weight: 800;
    color: theme('colors.interface.text-primary');
    margin: 0 0 6px;
  }
  .partager-section-desc {
    font-size: 14px;
    color: theme('colors.interface.text-muted');
    line-height: 1.6;
    margin: 0;
  }
  .partager-section {
    background: theme('colors.interface.bg-white');
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    padding: 20px 24px;
    box-shadow: theme('boxShadow.card');
  }
  .partager-link-row { display: flex; gap: 8px; align-items: center; }
  .partager-link-display {
    flex: 1;
    font-size: 13px;
    font-family: theme('fontFamily.mono');
    color: theme('colors.interface.text-secondary');
    background: theme('colors.interface.bg-secondary');
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 6px;
    padding: 8px 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .partager-always-on-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    font-size: 13px;
    color: theme('colors.interface.text-secondary');
  }
  .partager-toggle-pill {
    display: inline-flex;
    align-items: center;
    width: 32px;
    height: 18px;
    border-radius: 999px;
    background: theme('colors.interface.border-secondary');
    padding: 2px;
    flex-shrink: 0;
  }
  .partager-toggle-pill--on { background: theme('colors.brand.500'); }
  .partager-toggle-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .partager-toggle-pill--on .partager-toggle-thumb { margin-left: auto; }
  .partager-visibility-label { font-size: 12px; color: theme('colors.interface.text-muted'); }
  /* QR + Embed 2-col */
  .partager-qr-embed-grid {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 16px;
    align-items: start;
  }
  .partager-qr-card { display: flex; flex-direction: column; gap: 12px; }
  .partager-qr-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: theme('colors.interface.text-primary');
    border-radius: 6px;
    overflow: hidden;
  }
  .partager-embed-pre {
    background: theme('colors.interface.bg-secondary');
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 6px;
    padding: 12px;
    font-family: theme('fontFamily.mono');
    font-size: 12px;
    color: theme('colors.interface.text-secondary');
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0 0 10px;
  }
  /* Export */
  .partager-export-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .partager-export-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    background: theme('colors.interface.bg-primary');
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    text-decoration: none;
    color: theme('colors.interface.text-primary');
    transition: background 0.12s, border-color 0.12s;
  }
  .partager-export-card:hover { background: theme('colors.interface.bg-secondary'); border-color: theme('colors.brand.300'); }
  .partager-export-icon { color: theme('colors.interface.text-muted'); }
  .partager-export-label { font-size: 13px; font-weight: 600; text-align: center; }
  .partager-export-sub { font-size: 11px; color: theme('colors.interface.text-muted'); text-align: center; line-height: 1.4; }
  /* Permissions */
  .partager-perms { display: flex; flex-direction: column; }
  .partager-perm-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid theme('colors.interface.border-primary');
    cursor: pointer;
  }
  .partager-perm-row:last-child { border-bottom: 0; }
  .partager-perm-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .partager-perm-label { font-size: 14px; font-weight: 600; color: theme('colors.interface.text-primary'); }
  .partager-perm-hint { font-size: 11px; }
  /* CSS toggle switch */
  .partager-toggle-btn {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    border: none;
    background: theme('colors.interface.border-secondary');
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.2s;
    padding: 0;
  }
  .partager-toggle-btn.is-on { background: theme('colors.brand.500'); }
  .partager-toggle-btn-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    transition: left 0.2s;
  }
  .partager-toggle-btn.is-on .partager-toggle-btn-thumb { left: 18px; }
  /* Stats */
  .partager-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .partager-stat-card {
    text-align: center;
    padding: 20px 16px;
    background: theme('colors.interface.bg-white');
    border-radius: 8px;
    border: 1px solid theme('colors.interface.border-primary');
    box-shadow: theme('boxShadow.card');
  }
  .partager-stat-value { font-family: theme('fontFamily.heading'); font-size: 28px; font-weight: 800; color: theme('colors.interface.text-primary'); }
  .partager-stat-label { font-size: 12px; color: theme('colors.interface.text-muted'); margin-top: 4px; }
  @media (max-width: 640px) {
    .partager-qr-embed-grid { grid-template-columns: 1fr; }
    .partager-export-grid { grid-template-columns: 1fr 1fr; }
    .partager-stats-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
