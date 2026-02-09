<!-- src/lib/components/ExercisePreview.svelte -->
<script>
  import { browser } from '$app/environment';
  import ExerciseContent from './ExerciseContent.svelte';
  import AddToListButton from './AddToListButton.svelte';
  import { previewState, layoutActions } from '$lib/stores/searchStore.js';
  let copiedLatex = false;

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

  function normalizeRaw(block) {
    if (!block) return '';
    if (block.latex) return block.latex;
    if (block.text) return block.text;
    if (block.html) return block.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  function buildLatexSource() {
    if (!$previewState.exercise?.content || !Array.isArray($previewState.exercise.content)) {
      return '';
    }

    return $previewState.exercise.content
      .map((block) => normalizeRaw(block))
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  async function copyLatexSource() {
    if (!browser || !$previewState.exercise) return;
    const raw = buildLatexSource();
    if (!raw) return;

    try {
      await navigator.clipboard.writeText(raw);
      copiedLatex = true;
      setTimeout(() => {
        copiedLatex = false;
      }, 1800);
    } catch (err) {
      console.error('Failed to copy LaTeX source:', err);
    }
  }

  $: previewUuid = $previewState.exercise?.uuid || null;
  $: previewDate = formatDisplayDate($previewState.exercise?.updated_at || $previewState.exercise?.created_at);
</script>

<div class="exercise-preview">
  <div class="preview-header">
    <div class="preview-header-content">
      <div class="preview-headline">
        <h2 class="preview-title" aria-label="Prévisualisation">
          <svg class="preview-title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </h2>
        {#if previewUuid}
          <p class="preview-meta">
            <span class="preview-meta-uuid">{previewUuid}</span>
            {#if previewDate}
              <span class="preview-meta-sep">·</span>
              <span class="preview-meta-date">{previewDate}</span>
            {/if}
          </p>
        {/if}
      </div>
      <div class="preview-actions">
        {#if $previewState.exercise}
          <AddToListButton
            exercise={$previewState.exercise}
            size="small"
            variant="button"
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

          <button
            on:click={copyLatexSource}
            class="preview-btn preview-btn--secondary"
            title="Copier le LaTeX"
            aria-label="Copier le LaTeX"
          >
            <span class="preview-btn-icon" aria-hidden="true">📋</span>
            <span class="preview-btn-label">{copiedLatex ? 'Copié' : 'Copier le LaTeX'}</span>
          </button>
        {/if}

        <button
          on:click={hidePanel}
          class="preview-btn preview-btn--ghost"
          title="Masquer la prévisualisation"
          aria-label="Masquer la prévisualisation"
        >
          <span class="preview-btn-icon" aria-hidden="true">−</span>
          <span class="preview-btn-label">Fermer</span>
        </button>
      </div>
    </div>
  </div>

  <div class="preview-content">
    {#if $previewState.loading}
      <div class="preview-loading">
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
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
      <div class="preview-exercise-content">
        <ExerciseContent
          variant="preview"
          showGlobalToggles={false}
          content={$previewState.exercise.content || []}
        />
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
    height:100%;
    display:flex;
    flex-direction:column;
    @apply bg-interface-bg-primary border-l border-gray-200;
  }

  .preview-header {
    flex-shrink:0;
    @apply border-b border-gray-200 bg-brand-100;
  }
  .preview-header-content {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:0.75rem;
    padding:0.9rem;
  }
  .preview-headline {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .preview-title { font-size:1rem; font-weight:700; @apply text-gray-900; }
  .preview-title-icon {
    width: 1.05rem;
    height: 1.05rem;
    display: block;
  }
  .preview-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    line-height: 1.2;
    @apply text-gray-600;
  }
  .preview-meta-uuid {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    @apply text-gray-700;
  }
  .preview-meta-sep { @apply text-gray-400; }
  .preview-meta-date { @apply text-gray-500; }
  .preview-actions {
    display:flex;
    align-items:center;
    justify-content:flex-end;
    flex-wrap:wrap;
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
  .preview-btn--secondary { @apply border border-gray-300 bg-white text-gray-700; }
  .preview-btn--secondary:hover { @apply bg-gray-100; }
  .preview-btn--ghost { @apply border border-gray-300 bg-gray-100 text-gray-700; }
  .preview-btn--ghost:hover { @apply bg-gray-200; }

  .preview-btn-icon { line-height:1; }
  .preview-content { flex:1; overflow-y:auto; }

  .preview-exercise-content {
    padding:0.8rem;
    @apply bg-brand-50;
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
