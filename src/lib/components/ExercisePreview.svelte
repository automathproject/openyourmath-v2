<!-- src/lib/components/ExercisePreview.svelte -->
<script>
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import ExerciseContent from './ExerciseContent.svelte';
  import AddToListButton from './AddToListButton.svelte';
  import StarsRating from './StarsRating.svelte';
  import { previewState, layoutActions } from '$lib/stores/searchStore.js';

  let previewContentEl;
  let previewContentInnerEl;
  let previewExpanded = false;
  let contentCanExpand = false;
  let lastMeasuredUuid = null;
  let resizeObserver;

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

  function measurePreviewOverflow() {
    if (!previewContentEl || !previewContentInnerEl || previewExpanded) return;
    contentCanExpand = previewContentInnerEl.scrollHeight > previewContentEl.clientHeight + 4;
  }

  function togglePreviewHeight() {
    previewExpanded = !previewExpanded;
    if (!previewExpanded) {
      tick().then(measurePreviewOverflow);
    }
  }

  onMount(() => {
    if (!browser || typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver(() => {
      tick().then(measurePreviewOverflow);
    });
    return () => resizeObserver?.disconnect();
  });

  $: previewUuid = $previewState.exercise?.uuid || null;
  $: previewDate = formatDisplayDate($previewState.exercise?.updated_at || $previewState.exercise?.created_at);
  $: previewTitle = $previewState.exercise?.title || "Exercice";
  $: previewAuthor = $previewState.exercise?.author || null;
  $: previewOrganization = $previewState.exercise?.organization || null;
  $: hasPreviewMeta = Boolean(previewAuthor || previewOrganization || previewDate || previewUuid);
  $: previewExercise = $previewState.exercise;
  $: showTopMeta = Boolean(previewExercise?.level || previewExercise?.module || previewExercise?.difficulty || previewExercise?.chapter || previewExercise?.hasVideo);
  $: if (previewUuid !== lastMeasuredUuid) {
    lastMeasuredUuid = previewUuid;
    previewExpanded = false;
    contentCanExpand = false;
    tick().then(measurePreviewOverflow);
  }
  $: if (resizeObserver && previewContentEl && previewContentInnerEl) {
    resizeObserver.disconnect();
    resizeObserver.observe(previewContentEl);
    resizeObserver.observe(previewContentInnerEl);
  }
</script>

<div class="exercise-preview">
  <div class="preview-header">
    <div class="preview-header-content">
      <div class="preview-headline">
        {#if showTopMeta}
          <div class="preview-card-meta">
            {#if previewExercise?.level}
              <span class="preview-chip preview-chip--level">{previewExercise.level}</span>
            {/if}
            {#if previewExercise?.module}
              <span class="preview-chip preview-chip--soft">{previewExercise.module}</span>
            {/if}
            {#if previewExercise?.difficulty}
              <StarsRating n={previewExercise.difficulty} />
            {/if}
            {#if previewExercise?.chapter}
              <span class="preview-chapter">{previewExercise.chapter}</span>
            {/if}
            <span class="preview-meta-spacer"></span>
            {#if previewExercise?.hasVideo}
              <span class="preview-indicator preview-indicator--video">▶ vidéo</span>
            {/if}
          </div>
        {/if}
        <h2 class="preview-title">{previewTitle}</h2>
        {#if hasPreviewMeta}
          <div class="preview-title-separator"></div>
          <p class="preview-meta">
            {#if previewAuthor}
              <span class="preview-meta-item preview-meta-author">{previewAuthor}</span>
            {/if}
            {#if previewOrganization}
              <span class="preview-meta-item">{previewOrganization}</span>
            {/if}
            {#if previewDate}
              <span class="preview-meta-item">{previewDate}</span>
            {/if}
            {#if previewUuid}
              <span class="preview-meta-item preview-meta-uuid">{previewUuid}</span>
            {/if}
          </p>
        {/if}
      </div>
    </div>
  </div>

  <div
    class="preview-content"
    class:preview-content--expanded={previewExpanded}
    class:preview-content--can-expand={contentCanExpand && !previewExpanded}
    bind:this={previewContentEl}
  >
    <div class="preview-content-inner" bind:this={previewContentInnerEl}>
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
  </div>

  {#if contentCanExpand}
    <div class="preview-more-row">
      <button type="button" class="preview-more-btn" on:click={togglePreviewHeight}>
        {previewExpanded ? 'Voir moins' : 'Voir plus'}
      </button>
    </div>
  {/if}

  <div class="preview-footer-actions">
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
      <span class="preview-btn-label">Masquer</span>
    </button>
  </div>
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
    padding:0.75rem 0.9rem;
  }
  .preview-headline {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 0.28rem;
  }
  .preview-title {
    font-family: theme('fontFamily.heading');
    font-size: 1rem;
    line-height: 1.3;
    font-weight: 700;
    @apply text-interface-text-primary;
  }
  .preview-title-separator {
    height: 1px;
    width: 100%;
    margin: 0.05rem 0 0.02rem;
    @apply bg-interface-border-primary;
    opacity: 0.7;
  }
  .preview-card-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: nowrap;
    min-width: 0;
    overflow: hidden;
  }
  .preview-chip {
    display: inline-flex;
    align-items: center;
    max-width: 42%;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preview-chip--level {
    @apply bg-brand-500 text-white border border-brand-500;
  }
  .preview-chip--soft {
    @apply bg-interface-bg-white text-interface-text-muted border border-interface-border-primary;
  }
  .preview-chapter {
    min-width: 0;
    max-width: 28%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.68rem;
    font-style: italic;
    @apply text-interface-text-muted;
  }
  .preview-meta-spacer {
    flex: 1 1 auto;
    min-width: 0.25rem;
  }
  .preview-indicator {
    flex-shrink: 0;
    font-size: 0.68rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .preview-indicator--video {
    @apply text-brand-600;
  }
  .preview-meta {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.25rem 0.55rem;
    font-size: 0.72rem;
    line-height: 1.2;
    min-width: 0;
    overflow: hidden;
    @apply text-interface-text-muted;
  }
  .preview-meta-item {
    min-width: 0;
    flex-shrink: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-meta-item:not(:first-child)::before {
    content: "·";
    margin-right: 0.55rem;
    @apply text-interface-text-disabled;
  }
  .preview-meta-author {
    font-weight: 600;
    @apply text-interface-text-secondary;
  }
  .preview-meta-uuid {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    @apply text-interface-text-muted;
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
  .preview-content {
    position: relative;
    flex: 0 0 auto;
    height: min(30rem, calc(100vh - var(--search-controls-height, 9rem) - 13rem));
    min-height: 16rem;
    overflow: hidden;
    @apply bg-interface-bg-secondary;
  }

  .preview-content--expanded {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .preview-content--can-expand::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 4.5rem;
    pointer-events: none;
    background: linear-gradient(to bottom, rgba(250, 246, 234, 0), theme('colors.interface.bg-secondary'));
  }

  .preview-content-inner {
    min-height: 100%;
  }

  .preview-exercise-content {
    padding:0.8rem;
    @apply bg-interface-bg-secondary;
  }

  .preview-exercise-content :global(.exercise-content) {
    background: theme('colors.interface.bg-secondary');
  }

  .preview-more-row {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    padding: 0.55rem 0.9rem 0.7rem;
    @apply border-t border-interface-border-primary bg-interface-bg-white;
  }

  .preview-more-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }

  .preview-more-btn:hover {
    @apply bg-interface-bg-tertiary text-interface-text-primary;
  }

  .preview-footer-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
    padding: 0.55rem 0.9rem;
    @apply border-t border-interface-border-primary bg-interface-bg-white;
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
