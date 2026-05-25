<script>
  import { fly } from 'svelte/transition';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import { previewState, previewActions, results, layoutState } from '$lib/stores/searchStore.js';

  let showHint = false;
  let showSolution = false;
  let lastUuid = null;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const SWIPE_THRESHOLD = 80;
  const SWIPE_VERTICAL_LIMIT = 60;

  $: currentExercise = $previewState.exercise;
  $: currentIndex = $results.findIndex((exercise) => exercise.uuid === $previewState.selectedUuid);
  $: totalResults = $results.length;
  $: hasPrevious = currentIndex > 0;
  $: hasNext = currentIndex >= 0 && currentIndex < totalResults - 1;

  $: previewTitle = currentExercise?.title || "Exercice";
  $: previewUuid = currentExercise?.uuid || null;
  $: previewDate = formatDisplayDate(currentExercise?.updated_at || currentExercise?.created_at);
  $: previewAuthor = currentExercise?.author || null;
  $: previewOrganization = currentExercise?.organization || null;
  $: hasPreviewMeta = Boolean(previewAuthor || previewOrganization || previewDate || previewUuid);
  $: showTopMeta = Boolean(currentExercise?.level || currentExercise?.module || currentExercise?.difficulty || currentExercise?.chapter || currentExercise?.hasVideo);

  $: if ($previewState.selectedUuid && $previewState.selectedUuid !== lastUuid) {
    showHint = false;
    showSolution = false;
    lastUuid = $previewState.selectedUuid;
  }

  function formatDisplayDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('fr-FR');
  }

  function goToFullPage() {
    if (currentExercise?.uuid) {
      window.open(`/exercise/${currentExercise.uuid}`, '_blank');
    }
  }

  function closePreview() {
    previewActions.closePreview();
  }

  function navigateTo(offset) {
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= totalResults) return;
    const nextExercise = $results[nextIndex];
    if (nextExercise) {
      previewActions.selectExercise(nextExercise.uuid);
    }
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchEndX = touch.clientX;
    touchEndY = touch.clientY;
  }

  function handleTouchMove(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchEndX = touch.clientX;
    touchEndY = touch.clientY;
  }

  function handleTouchEnd() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    if (deltaX > SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_VERTICAL_LIMIT) {
      closePreview();
    }
  }
</script>

{#if $previewState.isOpen && $layoutState.previewPanelVisible}
  <div
    class="mobile-preview"
    transition:fly={{ x: 320, duration: 250, opacity: 0.95 }}
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
  >
    <header class="mobile-preview__header">
      <div class="mobile-preview__header-top">
        <button type="button" class="mobile-preview__back" on:click={closePreview} aria-label="Retour aux résultats">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mobile-preview__title-wrapper">
          {#if showTopMeta}
            <div class="mobile-preview__card-meta">
              {#if currentExercise?.level}
                <span class="mobile-preview__chip mobile-preview__chip--level">{currentExercise.level}</span>
              {/if}
              {#if currentExercise?.module}
                <span class="mobile-preview__chip mobile-preview__chip--soft">{currentExercise.module}</span>
              {/if}
              {#if currentExercise?.difficulty}
                <StarsRating n={currentExercise.difficulty} />
              {/if}
              {#if currentExercise?.chapter}
                <span class="mobile-preview__chapter">{currentExercise.chapter}</span>
              {/if}
              <span class="mobile-preview__meta-spacer"></span>
              {#if currentExercise?.hasVideo}
                <span class="mobile-preview__indicator mobile-preview__indicator--video">▶ vidéo</span>
              {/if}
            </div>
          {/if}
          <h2 class="mobile-preview__title">{previewTitle}</h2>
          {#if hasPreviewMeta}
            <div class="mobile-preview__title-separator"></div>
            <p class="mobile-preview__metadata mobile-preview__metadata--header">
              {#if previewAuthor}
                <span class="mobile-preview__meta-item mobile-preview__meta-author">{previewAuthor}</span>
              {/if}
              {#if previewOrganization}
                <span class="mobile-preview__meta-item">{previewOrganization}</span>
              {/if}
              {#if previewDate}
                <span class="mobile-preview__meta-item">{previewDate}</span>
              {/if}
              {#if previewUuid}
                <span class="mobile-preview__meta-item mobile-preview__uuid">{previewUuid}</span>
              {/if}
            </p>
          {/if}
        </div>

        <div class="mobile-preview__actions">
          {#if currentExercise}
            <AddToListButton exercise={currentExercise} size="small" variant="icon" />
            <button
              type="button"
              class="mobile-preview__action-btn"
              on:click={goToFullPage}
              aria-label="Ouvrir l'exercice"
              title="Ouvrir l'exercice"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M14 4h6m0 0v6m0-6L10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </header>

    <div class="mobile-preview__body">
      {#if $previewState.loading}
        <div class="mobile-preview__state">
          <div class="spinner" aria-hidden="true"></div>
          <span>Chargement…</span>
        </div>
      {:else if $previewState.error}
        <div class="mobile-preview__state mobile-preview__state--error">
          <p>{$previewState.error}</p>
        </div>
      {:else if currentExercise}
        <ExerciseContent
          exercise={currentExercise}
          variant="preview"
          showGlobalToggles={false}
          content={currentExercise.content || []}
          bind:showHint
          bind:showSolution
        />
      {:else}
        <div class="mobile-preview__state">
          <p>Sélectionnez un exercice pour le prévisualiser.</p>
        </div>
      {/if}
    </div>

    {#if totalResults > 1}
      <footer class="mobile-preview__footer">
        <div class="mobile-preview__nav" aria-label="Navigation entre les exercices">
          <button
            type="button"
            class="mobile-preview__nav-btn"
            on:click={() => navigateTo(-1)}
            disabled={!hasPrevious}
            aria-label="Exercice précédent"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="mobile-preview__nav-status">
            {currentIndex >= 0 ? currentIndex + 1 : '—'} / {totalResults > 0 ? totalResults : '—'}
          </span>
          <button
            type="button"
            class="mobile-preview__nav-btn"
            on:click={() => navigateTo(1)}
            disabled={!hasNext}
            aria-label="Exercice suivant"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </footer>
    {/if}
  </div>
{/if}

<style>
  .mobile-preview {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    flex-direction: column;
    background: #fff;
    color: #111827;
  }

  /* Header */
  .mobile-preview__header {
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
  }

  .mobile-preview__header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 0.9rem;
  }

  .mobile-preview__back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: none;
    border: none;
    border-radius: 0.5rem;
    color: #2563eb;
    transition: background-color 0.2s ease;
  }

  .mobile-preview__back svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .mobile-preview__back:active {
    background: rgba(37, 99, 235, 0.1);
  }

  .mobile-preview__title-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
  }

  .mobile-preview__title {
    font-size: 1rem;
    line-height: 1.3;
    font-weight: 700;
    color: #111827;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-preview__card-meta {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
    overflow: hidden;
  }

  .mobile-preview__chip {
    display: inline-flex;
    align-items: center;
    max-width: 38%;
    padding: 0.08rem 0.4rem;
    border-radius: 999px;
    font-size: 0.66rem;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-preview__chip--level {
    color: #ffffff;
    background: #3a8f8f;
    border: 1px solid #3a8f8f;
  }

  .mobile-preview__chip--soft {
    color: #6b8893;
    background: #ffffff;
    border: 1px solid #ead9b8;
  }

  .mobile-preview__chapter {
    min-width: 0;
    max-width: 24%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.66rem;
    font-style: italic;
    color: #6b8893;
  }

  .mobile-preview__meta-spacer {
    flex: 1 1 auto;
    min-width: 0.2rem;
  }

  .mobile-preview__indicator {
    flex-shrink: 0;
    font-size: 0.66rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .mobile-preview__indicator--video {
    color: #3a8f8f;
  }

  .mobile-preview__title-separator {
    height: 1px;
    width: 100%;
    margin: 0.02rem 0 0;
    background: #e5e7eb;
  }

  .mobile-preview__actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .mobile-preview__action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .mobile-preview__action-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .mobile-preview__action-btn:active {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  /* Body */
  .mobile-preview__body {
    flex: 1;
    overflow-y: auto;
    padding: 0.8rem;
    background: #faf6ea;
  }

  .mobile-preview__body :global(.exercise-content) {
    background: #faf6ea;
  }

  .mobile-preview__state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: #6b7280;
    text-align: center;
  }

  .mobile-preview__state--error {
    color: #dc2626;
  }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    border: 3px solid rgba(37, 99, 235, 0.15);
    border-top-color: #2563eb;
    animation: spin 0.9s linear infinite;
  }

  /* Footer */
  .mobile-preview__footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.55rem 0.9rem;
    border-top: 1px solid #e5e7eb;
    background: #ffffff;
  }

  .mobile-preview__metadata {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.22rem 0.5rem;
    font-size: 0.72rem;
    line-height: 1.2;
    color: #6b7280;
    min-width: 0;
    overflow: hidden;
  }

  .mobile-preview__metadata--header {
    max-height: 1.2rem;
    overflow: hidden;
  }

  .mobile-preview__meta-item {
    min-width: 0;
    flex-shrink: 1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-preview__meta-item:not(:first-child)::before {
    content: "·";
    margin-right: 0.5rem;
    color: #9ca3af;
  }

  .mobile-preview__meta-author {
    color: #374151;
    font-weight: 600;
  }

  .mobile-preview__uuid {
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-preview__nav {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .mobile-preview__nav-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    font-size: 1rem;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .mobile-preview__nav-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .mobile-preview__nav-btn:active:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .mobile-preview__nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .mobile-preview__nav-status {
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    min-width: 2.5rem;
    text-align: center;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
