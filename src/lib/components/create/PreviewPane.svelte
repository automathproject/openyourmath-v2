<!--
  PreviewPane — colonne droite de l'éditeur : aperçu instantané (Markdown →
  DOM local), vérification via le convertisseur de production, ou source
  .tex brute.
-->

<script>
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';

  /**
   * @typedef {Object} Props
   * @property {'preview'|'source'} rightTab
   * @property {Object} previewExercise
   * @property {Array} previewContent
   * @property {string|null} finalPreview
   * @property {boolean} finalPreviewBusy
   * @property {string} finalPreviewError
   * @property {string} texSource
   * @property {boolean} hasContent
   * @property {boolean} showHint
   * @property {boolean} showSolution
   * @property {() => void} onVerify
   */
  /** @type {Props} */
  let {
    rightTab = $bindable('preview'),
    previewExercise,
    previewContent,
    finalPreview,
    finalPreviewBusy,
    finalPreviewError,
    texSource,
    hasContent,
    showHint = $bindable(true),
    showSolution = $bindable(true),
    onVerify,
  } = $props();
</script>

<section class="create-preview" aria-label="Aperçu du rendu">
  <div class="preview-tabs" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={rightTab === 'preview'}
      class="preview-tab"
      class:is-active={rightTab === 'preview'}
      onclick={() => (rightTab = 'preview')}
    >Aperçu</button>
    <button
      type="button"
      role="tab"
      aria-selected={rightTab === 'source'}
      class="preview-tab"
      class:is-active={rightTab === 'source'}
      onclick={() => (rightTab = 'source')}
    >Source .tex</button>
    <button
      type="button"
      class="preview-validate"
      disabled={finalPreviewBusy || !hasContent}
      onclick={onVerify}
      title="Vérifier le rendu avec le convertisseur de production"
    >{finalPreviewBusy ? 'Vérification…' : '✓ Vérifier le rendu final'}</button>
  </div>

  <div class="preview-body">
    {#if rightTab === 'preview'}
      {#if finalPreviewError}
        <p class="preview-final-error" role="alert">{finalPreviewError} L’aperçu instantané reste affiché.</p>
      {/if}
      {#if finalPreview}
        <p class="preview-final-notice">✓ Rendu de validation (convertisseur de production). Modifiez un bloc pour revenir à l’aperçu instantané.</p>
        <ExerciseContent
          exercise={previewExercise}
          content={finalPreview}
          variant="full"
          showHeader={true}
          showGlobalToggles={false}
          bind:showHint
          bind:showSolution
        />
      {:else if previewContent.length === 0}
        <div class="preview-empty">
          <p>L'aperçu s'affichera ici au fur et à mesure de votre rédaction.</p>
          <p class="preview-empty-hint">Les figures TikZ et images ne sont rendues qu'à la construction du site.</p>
        </div>
      {:else}
        <ExerciseContent
          exercise={previewExercise}
          content={previewContent}
          variant="full"
          showHeader={true}
          showGlobalToggles={false}
          bind:showHint
          bind:showSolution
        />
      {/if}
    {:else}
      <div class="preview-source">
        <pre>{texSource}</pre>
      </div>
    {/if}
  </div>
</section>

<style>
  .create-preview {
    @apply border border-gray-200 rounded-xl bg-white min-w-0;
    position: sticky;
    top: 0.75rem;
    max-height: calc(100vh - 1.5rem);
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 1023px) {
    .create-preview {
      position: static;
      max-height: none;
    }
  }

  .preview-tabs {
    @apply flex gap-1 px-3 pt-2 border-b border-gray-100 flex-shrink-0;
  }

  .preview-tab {
    @apply px-3 py-1.5 text-sm font-medium text-gray-500 border-b-2 border-transparent
           hover:text-gray-700 transition-colors;
  }

  .preview-tab.is-active {
    @apply text-brand-700 border-brand-500;
  }

  .preview-validate {
    @apply ml-auto mb-1 px-2 py-1 rounded-md border border-brand-200 bg-brand-50 text-xs font-medium text-brand-700
           hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .preview-body {
    @apply p-3 overflow-y-auto;
  }

  .preview-empty {
    @apply text-center text-gray-400 text-sm py-16 px-6;
  }

  .preview-empty-hint {
    @apply text-xs mt-2;
  }

  .preview-final-notice {
    @apply text-xs text-green-800 bg-green-50 border border-green-200 rounded-md px-2.5 py-2 mb-3;
  }

  .preview-final-error {
    @apply text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 mb-3;
  }

  .preview-source pre {
    @apply text-xs font-mono leading-relaxed text-gray-800 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap;
  }

  /* Encarts d'artefacts dans l'aperçu (générés par texPreview.js) */
  .preview-body :global(.tex-preview-artifact) {
    @apply text-xs text-gray-500 bg-gray-100 border border-dashed border-gray-300 rounded-md px-3 py-2 my-2;
  }

  .preview-body :global(.tex-preview-code) {
    @apply text-xs font-mono bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto;
  }
</style>
