<!-- src/routes/exercise/list/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
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
  
  // Initialiser la liste depuis les données du serveur
  onMount(() => {
    if (data.exercises && data.exercises.length > 0) {
      exerciseList.set(data.exercises);
      
      // Sélectionner le premier exercice
      selectedExerciseIndex.set(0);
      if (data.exercises[0].fullExercise) {
        selectedExercise.set(data.exercises[0].fullExercise);
      } else {
        listActions.selectExercise(0);
      }
    } else {
      exerciseList.set([]);
      selectedExercise.set(null);
    }
    
    // Générer l'URL de partage
    shareUrl = listUtils.getShareableUrl(window.location.origin);
  });
  
  // Réactivité pour mettre à jour l'URL de partage
  $: if ($exerciseList) {
    shareUrl = listUtils.getShareableUrl(typeof window !== 'undefined' ? window.location.origin : '');
  }
  
  // Fonctions de navigation
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
        {#if $hasExercises}
          <button 
            on:click={shareList}
            class="list-action-btn list-action-btn--primary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Partager
          </button>
          
          <button 
            on:click={clearList}
            class="list-action-btn list-action-btn--danger"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Vider
          </button>
        {/if}
        
        <a 
          href="/"
          class="list-action-btn list-action-btn--secondary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h2 class="empty-state-title">Aucun exercice dans cette liste</h2>
        <p class="empty-state-description">
          Ajoutez des exercices à votre liste en utilisant la recherche, ou partagez une URL avec des UUIDs d'exercices.
        </p>
        
        <div class="empty-state-actions">
          <a 
            href="/"
            class="btn btn--primary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {#if $currentPosition.total > 0}
            <span class="nav-counter">
              {$currentPosition.current} / {$currentPosition.total}
            </span>
          {/if}
        </div>
        
        <div class="nav-controls">
          <button 
            on:click={listActions.previousExercise}
            disabled={!$currentPosition.hasPrevious}
            class="nav-btn nav-btn--prev"
            title="Exercice précédent (↑)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          
          <button 
            on:click={listActions.nextExercise}
            disabled={!$currentPosition.hasNext}
            class="nav-btn nav-btn--next"
            title="Exercice suivant (↓)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        <div class="exercise-nav-list">
          {#each $exerciseList as exercise, index}
            <div 
              class="nav-exercise-item"
              class:nav-exercise-item--selected={index === $selectedExerciseIndex}
              class:nav-exercise-item--error={exercise.error}
            >
              <button 
                on:click={() => selectExercise(index)}
                class="nav-exercise-btn"
              >
                <div class="nav-exercise-info">
                  <div class="nav-exercise-number">
                    {index + 1}
                  </div>
                  
                  <div class="nav-exercise-content">
                    <h3 class="nav-exercise-title">
                      {exercise.title || `Exercice ${exercise.uuid.slice(0, 8)}...`}
                    </h3>
                    
                    <div class="nav-exercise-meta">
                      {#if exercise.chapter}
                        <span class="nav-exercise-chapter">
                          {exercise.chapter}
                        </span>
                      {/if}
                      
                      {#if exercise.difficulty}
                        <div class="nav-exercise-difficulty">
                          {#each Array(exercise.difficulty) as _}
                            <div class="difficulty-dot difficulty-dot--filled"></div>
                          {/each}
                          {#each Array(5 - exercise.difficulty) as _}
                            <div class="difficulty-dot"></div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              </button>
              
              <button 
                on:click={() => removeExercise(index)}
                class="nav-exercise-remove"
                title="Supprimer de la liste"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
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
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <span class="breadcrumb-item">Liste</span>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-item">Exercice {$currentPosition.current}</span>
                {#if $selectedExercise.chapter}
                  <span class="breadcrumb-separator">›</span>
                  <span class="breadcrumb-item">{$selectedExercise.chapter}</span>
                {/if}
              </div>
              
              <h1 class="exercise-title">{$selectedExercise.title}</h1>
              
              <div class="exercise-metadata">
                {#if $selectedExercise.chapter}
                  <span class="exercise-badge exercise-badge--chapter">
                    {$selectedExercise.chapter}
                  </span>
                {/if}
                
                {#if $selectedExercise.theme}
                  <span class="exercise-badge exercise-badge--theme">
                    {$selectedExercise.theme}
                  </span>
                {/if}
                
                {#if $selectedExercise.difficulty}
                  <div class="exercise-difficulty">
                    <span class="difficulty-label">Difficulté :</span>
                    <div class="difficulty-stars">
                      {#each Array(5) as _, i}
                        <div class="difficulty-star {i < $selectedExercise.difficulty ? 'difficulty-star--filled' : ''}"></div>
                      {/each}
                    </div>
                    <span class="difficulty-value">({$selectedExercise.difficulty}/5)</span>
                  </div>
                {/if}
                
                {#if $selectedExercise.author}
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
              <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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