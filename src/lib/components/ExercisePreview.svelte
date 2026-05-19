<!-- src/lib/components/ExercisePreview.svelte -->
<script>
  import { browser } from '$app/environment';
  import ExerciseContent from './ExerciseContent.svelte';
  import AddToListButton from './AddToListButton.svelte';
  import { previewState, layoutActions } from '$lib/stores/searchStore.js';

  function formatDisplayDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('fr-FR');
  }

  function hidePanel() {
    layoutActions.setPreviewPanelVisible(false);
  }

  function goToFullPage() {
    if ($previewState.exercise?.uuid && browser) {
      window.open(`/exercise/${$previewState.exercise.uuid}`, '_blank');
    }
  }

  $: previewUuid = $previewState.exercise?.uuid || null;
  $: previewDate = formatDisplayDate($previewState.exercise?.updated_at || $previewState.exercise?.created_at);
  $: previewTitle = $previewState.exercise?.title || "Exercice";
</script>

<div class="exercise-preview">
  <div class="preview-header">
    <div class="preview-header-content">
      <div class="preview-headline">
        <h2 class="preview-title">{previewTitle}</h2>
      </div>
      <div class="preview-actions">
        {#if $previewState.exercise}
          <AddToListButton
            exercise={$previewState.exercise}
            size="small"
            variant="icon"
          />

          <button
            on:click={goToFullPage}
            class="preview-btn preview-btn--secondary"
            title="Ouvrir l'exercice"
            aria-label="Ouvrir l'exercice"
          >
            <span class="preview-btn-icon" aria-hidden="true">↗</span>
            <span class="preview-btn-label">Ouvrir</span>
          </button>
        {/if}

        <button
          on:click={hidePanel}
          class="preview-btn preview-btn--ghost"
          title="Masquer la prévisualisation"
          aria-label="Masquer la prévisualisation"
        >
          <span class="preview-btn-icon" aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  </div>

  <div class="preview-content">
    {#if $previewState.loading}
      <div class="preview-loading">
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <span class="ml-3 text-interface-text-muted">Chargement...</span>
        </div>
      </div>
    {:else if $previewState.error}
      <div class="preview-error">
        <div class="text-center py-12">
          <div class="text-error-500 mb-2">
            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-interface-text-primary mb-1">Erreur de chargement</h3>
          <p class="text-interface-text-muted text-sm">{$previewState.error}</p>
        </div>
      </div>
    {:else if $previewState.exercise}
      <div class="preview-exercise-content">
        <ExerciseContent
          variant="preview"
          showGlobalToggles={false}
          content={$previewState.exercise.content || []}
        />
      </div>
    {:else}
      <div class="preview-empty">
        <div class="text-center py-12 text-interface-text-muted">
          <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p>Cliquez sur un exercice pour le prévisualiser</p>
        </div>
      </div>
    {/if}
  </div>

  {#if previewUuid}
    <div class="preview-footer">
      <p class="preview-meta">
        <span class="preview-meta-uuid">{previewUuid}</span>
        {#if previewDate}
          <span class="preview-meta-sep">·</span>
          <span class="preview-meta-date">{previewDate}</span>
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .exercise-preview {
    display:flex;
    flex-direction:column;
    @apply bg-interface-bg-white border border-interface-border-primary rounded-xl shadow-card;
    overflow: hidden;
  }

  .preview-header {
    flex-shrink:0;
    @apply border-b border-interface-border-primary bg-interface-bg-secondary;
  }
  .preview-header-content {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.75rem;
    padding:0.75rem 0.9rem;
  }
  .preview-headline {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .preview-title {
    font-family: theme('fontFamily.heading');
    font-size: 1rem;
    line-height: 1.3;
    font-weight: 700;
    @apply text-interface-text-primary;
  }
  .preview-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    line-height: 1.2;
    @apply text-interface-text-secondary;
  }
  .preview-meta-uuid {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    @apply text-interface-text-secondary;
  }
  .preview-meta-sep { @apply text-interface-text-disabled; }
  .preview-meta-date { @apply text-interface-text-muted; }
  .preview-actions {
    display:flex;
    align-items:center;
    justify-content:flex-end;
    flex-wrap:nowrap;
    gap:0.4rem;
  }

  .preview-btn {
    display:inline-flex;
    align-items:center;
    gap:0.35rem;
    padding:0.35rem 0.65rem;
    border-radius:0.55rem;
    font-size:0.82rem;
    font-weight:600;
    border:1px solid transparent;
  }
  .preview-btn--secondary { @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-primary; }
  .preview-btn--secondary:hover { @apply bg-interface-bg-tertiary; }
  .preview-btn--ghost { @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary; }
  .preview-btn--ghost:hover { @apply bg-interface-bg-tertiary text-interface-text-primary; }

  .preview-btn-icon { line-height:1; }
  .preview-content { flex:1; overflow-y:auto; }

  .preview-exercise-content {
    padding:0.8rem;
    @apply bg-interface-bg-white;
  }

  .preview-footer {
    flex-shrink: 0;
    @apply border-t border-interface-border-primary bg-interface-bg-secondary;
    padding: 0.55rem 0.9rem;
  }

  @media (max-width: 1200px) {
    .preview-btn-label {
      display: none;
    }
    .preview-btn {
      width: 2rem;
      height: 2rem;
      justify-content: center;
      padding: 0;
    }
  }
</style>
