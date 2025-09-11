<!-- src/lib/components/ExercisePreview.svelte -->
<script>
  import ExerciseContent from './ExerciseContent.svelte';
  import AddToListButton from './AddToListButton.svelte';
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
        <!-- NOUVEAU : Bouton d'ajout à la liste dans la preview -->
        {#if $previewState.exercise}
          <AddToListButton 
            exercise={$previewState.exercise} 
            size="small" 
            variant="icon"
          />
        {/if}
        
        <button 
          on:click={goToFullPage}
          class="preview-btn preview-btn--primary"
          title="Ouvrir dans un nouvel onglet"
          aria-label="Ouvrir dans un nouvel onglet"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        <button 
          on:click={closePreview}
          class="preview-btn preview-btn--close"
          title="Fermer la prévisualisation"
          aria-label="Fermer la prévisualisation"
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
        <div class="preview-exercise-content">
          <ExerciseContent 
            exercise={$previewState.exercise}
            variant="preview"
            showGlobalToggles={false}
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

<style></style>
