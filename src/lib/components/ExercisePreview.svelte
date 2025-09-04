<!-- src/lib/components/ExercisePreview.svelte -->
<script>
  import ExerciseContent from './ExerciseContent.svelte';
  import { previewState, previewActions } from '$lib/stores/searchStore.js';
  
  // Variables locales pour contrôler l'affichage
  let showHint = false;
  let showSolution = false;
  
  // Fonction pour fermer la preview
  function closePreview() {
    previewActions.closePreview();
    // Reset des états d'affichage quand on ferme
    showHint = false;
    showSolution = false;
  }
  
  // Fonction pour aller vers la page complète
  function goToFullPage() {
    if ($previewState.exercise?.uuid) {
      window.open(`/exercise/${$previewState.exercise.uuid}`, '_blank');
    }
  }
  
  // Fonction pour formater la difficulté
  function formatDifficulty(difficulty) {
    if (difficulty === null || difficulty === undefined) {
      return null;
    }
    return `★${difficulty}`;
  }
</script>

<div class="exercise-preview">
  <div class="preview-header">
    <div class="preview-header-content">
      <h2 class="preview-title">Prévisualisation</h2>
      <div class="preview-actions">
        <button 
          on:click={goToFullPage}
          class="preview-btn preview-btn--primary"
          title="Ouvrir dans un nouvel onglet"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Ouvrir
        </button>
        <button 
          on:click={closePreview}
          class="preview-btn preview-btn--close"
          title="Fermer la prévisualisation"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="preview-content">
    {#if $previewState.loading}
      <div class="preview-loading">
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-3 text-gray-600">Chargement...</span>
        </div>
      </div>
    {:else if $previewState.error}
      <div class="preview-error">
        <div class="text-center py-12">
          <div class="text-red-500 mb-2">
            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-1">Erreur de chargement</h3>
          <p class="text-gray-600 text-sm">{$previewState.error}</p>
        </div>
      </div>
    {:else if $previewState.exercise}
      <div class="preview-exercise">
        <!-- En-tête de l'exercice -->
        <div class="preview-exercise-header">
          <div class="preview-breadcrumb">
            <span class="text-sm text-gray-500">
              {$previewState.exercise.chapter}
              {#if $previewState.exercise.theme}
                › {$previewState.exercise.theme}
              {/if}
            </span>
          </div>
          
          <h1 class="preview-exercise-title">
            {$previewState.exercise.title}
          </h1>
          
          <!-- Métadonnées -->
          <div class="preview-metadata">
            {#if $previewState.exercise.level}
              <span class="preview-badge preview-badge--level">
                {$previewState.exercise.level}
              </span>
            {/if}
            
            {#if $previewState.exercise.difficulty}
              <span class="preview-badge preview-badge--difficulty">
                {formatDifficulty($previewState.exercise.difficulty)}
              </span>
            {/if}
            
            {#if $previewState.exercise.author}
              <span class="text-sm text-gray-600">
                Par <strong>{$previewState.exercise.author}</strong>
              </span>
            {/if}
          </div>
          
          <!-- Actions rapides -->
          <div class="preview-quick-actions">
            <button 
              on:click={() => showHint = !showHint}
              class="preview-action-btn {showHint ? 'preview-action-btn--active' : ''}"
            >
              💡 {showHint ? 'Masquer' : 'Voir'} indices
            </button>
            
            <button 
              on:click={() => showSolution = !showSolution}
              class="preview-action-btn {showSolution ? 'preview-action-btn--active' : ''}"
            >
              ✅ {showSolution ? 'Masquer' : 'Voir'} solutions
            </button>
          </div>
        </div>
        
        <!-- Contenu de l'exercice -->
        <div class="preview-exercise-content">
          <ExerciseContent 
            content={$previewState.exercise.content || []}
            bind:showHint
            bind:showSolution
          />
        </div>
      </div>
    {:else}
      <div class="preview-empty">
        <div class="text-center py-12 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p>Cliquez sur un exercice pour le prévisualiser</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .exercise-preview {
    @apply h-full flex flex-col bg-white border-l border-gray-200;
  }
  
  .preview-header {
    @apply flex-shrink-0 border-b border-gray-200 bg-gray-50;
  }
  
  .preview-header-content {
    @apply flex items-center justify-between p-4;
  }
  
  .preview-title {
    @apply text-lg font-semibold text-gray-900;
  }
  
  .preview-actions {
    @apply flex items-center gap-2;
  }
  
  .preview-btn {
    @apply inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors;
  }
  
  .preview-btn--primary {
    @apply bg-blue-600 text-white border-blue-600 hover:bg-blue-700;
  }
  
  .preview-btn--close {
    @apply bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-900;
  }
  
  .preview-content {
    @apply flex-1 overflow-y-auto;
  }
  
  .preview-exercise-header {
    @apply p-4 border-b border-gray-100;
  }
  
  .preview-breadcrumb {
    @apply mb-2;
  }
  
  .preview-exercise-title {
    @apply text-xl font-bold text-gray-900 mb-3;
  }
  
  .preview-metadata {
    @apply flex items-center gap-3 mb-4;
  }
  
  .preview-badge {
    @apply px-2 py-1 text-xs rounded-md font-medium;
  }
  
  .preview-badge--level {
    @apply bg-blue-100 text-blue-800;
  }
  
  .preview-badge--difficulty {
    @apply bg-yellow-100 text-yellow-800;
  }
  
  .preview-quick-actions {
    @apply flex gap-2;
  }
  
  .preview-action-btn {
    @apply px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors;
  }
  
  .preview-action-btn--active {
    @apply bg-blue-100 text-blue-800 hover:bg-blue-200;
  }
  
  .preview-exercise-content {
    @apply p-4;
  }
  
  /* Ajustements pour le contenu dans la preview */
  .preview-exercise-content :global(.exercise-content) {
    @apply text-sm;
  }
  
  .preview-exercise-content :global(.question-block) {
    @apply mb-4;
  }
  
  .preview-exercise-content :global(.question-number-badge) {
    @apply text-xs w-5 h-5;
  }
</style>