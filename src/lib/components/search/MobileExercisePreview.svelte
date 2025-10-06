<script>
  import { fly } from 'svelte/transition';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';
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

  $: if ($previewState.selectedUuid && $previewState.selectedUuid !== lastUuid) {
    showHint = false;
    showSolution = false;
    lastUuid = $previewState.selectedUuid;
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
      <button type="button" class="mobile-preview__back" on:click={closePreview}>
        <svg class="mobile-preview__back-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 19l-7-7 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>Résultats</span>
      </button>
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
          {currentIndex >= 0 ? currentIndex + 1 : '—'}
          <span aria-hidden="true">/</span>
          {totalResults > 0 ? totalResults : '—'}
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
      <div class="mobile-preview__actions">
        {#if currentExercise}
          <AddToListButton exercise={currentExercise} size="small" variant="icon" />
          <button
            type="button"
            class="mobile-preview__open"
            on:click={goToFullPage}
            aria-label="Ouvrir dans un nouvel onglet"
            title="Ouvrir dans un nouvel onglet"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M14 4h6m0 0v6m0-6L10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
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

  .mobile-preview__header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(17, 24, 39, 0.1);
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(6px);
  }

  .mobile-preview__back {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    text-align: left;
    font-size: 0.95rem;
    font-weight: 500;
    background: none;
    border: none;
    padding: 0.5rem 0.75rem;
    border-radius: 9999px;
    color: #2563eb;
  }

  .mobile-preview__back:active {
    background: rgba(37, 99, 235, 0.12);
  }

  .mobile-preview__nav {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .mobile-preview__nav-btn {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    border: none;
    background: rgba(37, 99, 235, 0.1);
    color: #1f2937;
    font-size: 1rem;
  }

  .mobile-preview__back-icon,
  .mobile-preview__nav-btn svg,
  .mobile-preview__open svg {
    width: 1.1rem;
    height: 1.1rem;
  }

  .mobile-preview__nav-btn:disabled {
    opacity: 0.35;
  }

  .mobile-preview__nav-status {
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
    color: #6b7280;
  }

  .mobile-preview__actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .mobile-preview__open {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    border: none;
    background: rgba(37, 99, 235, 0.1);
    color: #1f2937;
    font-size: 1rem;
  }

  .mobile-preview__body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: #f9fafb;
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
