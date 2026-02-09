<!-- src/lib/components/ExercisePreview.svelte -->
<script>
  import { browser } from '$app/environment';
  import MathRenderer from './MathRenderer.svelte';
  import Collapsible from './Collapsible.svelte';
  import AddToListButton from './AddToListButton.svelte';
  import { previewState, layoutActions } from '$lib/stores/searchStore.js';

  const previewSectionsState = new Map();

  let hintOpen = false;
  let solutionOpen = false;
  let copiedLatex = false;

  function hidePanel() {
    layoutActions.setPreviewPanelVisible(false);
  }

  function goToFullPage() {
    if ($previewState.exercise?.uuid && browser) {
      window.open(`/exercise/${$previewState.exercise.uuid}`, '_blank');
    }
  }

  function normalizeHtml(block) {
    if (!block) return '';
    if (block.html) return block.html;
    if (block.latex) return block.latex;
    if (block.text) return `<p>${block.text}</p>`;
    return '';
  }

  function normalizeRaw(block) {
    if (!block) return '';
    if (block.latex) return block.latex;
    if (block.text) return block.text;
    if (block.html) return block.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  function isHintBlock(block) {
    const type = String(block?.type || '').toLowerCase();
    return type === 'hint' || type === 'indication';
  }

  function isSolutionBlock(block) {
    const type = String(block?.type || '').toLowerCase();
    return type === 'solution' || type === 'reponse' || type === 'answer';
  }

  $: contentBlocks = Array.isArray($previewState.exercise?.content)
    ? [...$previewState.exercise.content].sort((a, b) => (a?.order || 0) - (b?.order || 0))
    : [];

  $: statementBlocks = contentBlocks.filter((block) => !isHintBlock(block) && !isSolutionBlock(block));
  $: hintBlocks = contentBlocks.filter((block) => isHintBlock(block));
  $: solutionBlocks = contentBlocks.filter((block) => isSolutionBlock(block));

  $: selectedUuid = $previewState.selectedUuid;
  $: if (selectedUuid) {
    const savedState = previewSectionsState.get(selectedUuid) || { hintOpen: false, solutionOpen: false };
    hintOpen = savedState.hintOpen;
    solutionOpen = savedState.solutionOpen;
  } else {
    hintOpen = false;
    solutionOpen = false;
  }

  $: if (selectedUuid) {
    previewSectionsState.set(selectedUuid, { hintOpen, solutionOpen });
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
</script>

<div class="exercise-preview">
  <div class="preview-header">
    <div class="preview-header-content">
      <h2 class="preview-title">Prévisualisation</h2>
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
        <section class="preview-section-main">
          {#if statementBlocks.length > 0}
            {#each statementBlocks as block}
              <div class="preview-block">
                <MathRenderer content={normalizeHtml(block)} />
              </div>
            {/each}
          {:else}
            <p class="preview-empty-text">Aucun énoncé disponible.</p>
          {/if}
        </section>

        {#if hintBlocks.length > 0}
          <Collapsible title="💡 Indication" bind:open={hintOpen} tone="hint">
            {#each hintBlocks as block}
              <div class="preview-block preview-block--sub">
                <MathRenderer content={normalizeHtml(block)} />
              </div>
            {/each}
          </Collapsible>
        {/if}

        {#if solutionBlocks.length > 0}
          <Collapsible title="✅ Solution" bind:open={solutionOpen} tone="solution">
            {#each solutionBlocks as block}
              <div class="preview-block preview-block--sub">
                <MathRenderer content={normalizeHtml(block)} />
              </div>
            {/each}
          </Collapsible>
        {/if}
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
  .preview-title { font-size:1rem; font-weight:700; @apply text-gray-900; }
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
    display:flex;
    flex-direction:column;
    gap:0.75rem;
    padding:0.8rem;
    @apply bg-brand-50;
  }
  .preview-section-main {
    display:flex;
    flex-direction:column;
    gap:0.65rem;
  }
  .preview-block {
    border-radius:0.65rem;
    padding:0.65rem;
    @apply bg-white border border-gray-200;
  }
  .preview-block--sub {
    padding:0.5rem 0.6rem;
    @apply bg-white/90 border border-transparent;
  }
  .preview-empty-text {
    font-size:0.9rem;
    @apply text-gray-500;
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
