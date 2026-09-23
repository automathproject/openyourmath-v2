<script>
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import { previewState, previewActions, results } from '$lib/stores/searchStore.js';
  import { openExercise, exerciseOpenLabel } from '$lib/utils/exerciseLink.js';

  let showHint = false;
  let showSolution = false;
  let lastUuid = null;

  // ── Glissé pour fermer ────────────────────────────────────────────────────
  // La feuille suit le doigt pendant tout le mouvement : sans ce retour visuel,
  // rien n'indiquait que le geste était en cours ni jusqu'où il fallait aller.
  const DISMISS_THRESHOLD = 80;   // px au-delà desquels on relâche pour fermer
  const AXIS_LOCK_SLOP = 6;       // px avant de décider défilement ou glissé

  /** Corps défilant : on n'amorce le glissé que s'il est déjà en haut. */
  let bodyEl;
  let sheetEl;
  let touchStartX = 0;
  let touchStartY = 0;
  let dragY = 0;            // décalage courant, suivi par le transform
  let dragging = false;     // vrai pendant le geste : la transition CSS est coupée
  let axis = null;          // 'y' = glissé de fermeture, 'x'/'scroll' = ignoré
  let canDrag = false;
  /** Distance déjà parcourue au doigt : l'animation de sortie part de là. */
  let dismissOffset = 0;

  let sheetHeight = 0;    // mesurée au début du geste, le contenu variant
  $: dragProgress = sheetHeight > 0 ? Math.min(dragY / sheetHeight, 1) : 0;

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

  // La feuille ne dépend que de « un exercice est prévisualisé ». Elle était
  // aussi conditionnée à la préférence de colonne desktop : fermer la feuille
  // sur téléphone repliait donc la colonne sur ordinateur, et inversement.
  $: sheetOpen = $previewState.isOpen;
  $: if (typeof document !== 'undefined') {
    // La feuille ne couvre plus l'écran : sans ce verrou, la liste défilerait
    // derrière elle au glissé.
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
  }
  onDestroy(() => {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  });

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
    openExercise(currentExercise?.uuid);
  }

  /**
   * @param {number} [fromOffset] position atteinte au doigt, pour que
   *   l'animation de sortie enchaîne au lieu de repartir de zéro.
   */
  function closePreview(fromOffset = 0) {
    dismissOffset = fromOffset;
    dragging = false;
    dragY = 0;
    previewActions.closePreview();
  }

  // ── Animations d'ouverture / fermeture ────────────────────────────────────
  // Séparées (`in:` / `out:`) plutôt qu'un `transition:` unique : la sortie doit
  // démarrer à la position laissée par le doigt, l'entrée toujours d'en bas.
  function sheetIn(node, { duration = 260 } = {}) {
    const h = node.offsetHeight || 400;
    return { duration, easing: cubicOut, css: (_t, u) => `transform: translateY(${h * u}px)` };
  }

  function sheetOut(node, { duration = 220 } = {}) {
    const h = node.offsetHeight || 400;
    const start = Math.min(dismissOffset, h);
    return {
      // Inutile de rejouer toute la course si le doigt a déjà fait le trajet.
      duration: Math.max(120, Math.round(duration * (1 - start / h))),
      easing: cubicOut,
      css: (_t, u) => `transform: translateY(${start + (h - start) * u}px)`
    };
  }

  function navigateTo(offset) {
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= totalResults) return;
    const nextExercise = $results[nextIndex];
    if (nextExercise) {
      previewActions.selectExercise(nextExercise.uuid, { revealPanel: false });
    }
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    dragY = 0;
    dragging = false;
    axis = null;
    // Si l'énoncé est déjà défilé, le geste appartient au contenu.
    canDrag = !bodyEl || bodyEl.scrollTop <= 0;
    sheetHeight = sheetEl?.offsetHeight || 0;
  }

  function handleTouchMove(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (axis === null) {
      if (Math.abs(deltaX) < AXIS_LOCK_SLOP && Math.abs(deltaY) < AXIS_LOCK_SLOP) return;
      // Un seul axe pour tout le geste : sinon la feuille tremblerait pendant
      // qu'on essaie simplement de faire défiler l'énoncé.
      axis = Math.abs(deltaY) > Math.abs(deltaX) && canDrag && deltaY > 0 ? 'y' : 'ignore';
    }
    if (axis !== 'y') return;

    dragging = true;
    dragY = Math.max(0, deltaY);
    // Empêche le rebond de défilement du navigateur pendant qu'on tire la feuille.
    event.preventDefault();
  }

  function handleTouchEnd() {
    if (axis !== 'y') return;
    if (dragY > DISMISS_THRESHOLD) {
      closePreview(dragY);
    } else {
      // Sous le seuil : retour élastique à sa place.
      dragging = false;
      dragY = 0;
    }
    axis = null;
  }
</script>

{#if sheetOpen}
  <button
    type="button"
    class="mobile-preview__backdrop"
    aria-label="Fermer la prévisualisation"
    on:click={() => closePreview()}
    style={`opacity: ${1 - dragProgress}`}
    class:mobile-preview__backdrop--dragging={dragging}
    transition:fade={{ duration: 180 }}
  ></button>
  <!-- Devenue une vraie boîte de dialogue modale depuis qu'elle a un fond
       cliquable et ne couvre plus l'écran entier. -->
  <div
    class="mobile-preview"
    role="dialog"
    aria-modal="true"
    aria-label={previewTitle}
    tabindex="-1"
    bind:this={sheetEl}
    style={`transform: translateY(${dragY}px)`}
    class:mobile-preview--dragging={dragging}
    in:sheetIn
    out:sheetOut
    on:touchstart={handleTouchStart}
    on:touchmove|nonpassive={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:touchcancel={handleTouchEnd}
  >
    <div class="mobile-preview__grabber" aria-hidden="true"></div>

    <header class="mobile-preview__header">
      <div class="mobile-preview__header-top">
        <button type="button" class="mobile-preview__back" on:click={() => closePreview()} aria-label="Retour aux résultats">
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

      </div>
    </header>

    <div class="mobile-preview__body" bind:this={bodyEl}>
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

    {#if currentExercise || totalResults > 1}
      <footer class="mobile-preview__footer">
        {#if currentExercise}
          <div class="mobile-preview__footer-actions">
            <AddToListButton exercise={currentExercise} size="normal" variant="button" />
            <button
              type="button"
              class="mobile-preview__open-btn"
              on:click={goToFullPage}
              aria-label={exerciseOpenLabel()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M14 4h6m0 0v6m0-6L10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>Ouvrir</span>
            </button>
          </div>
        {/if}

        {#if totalResults > 1}
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
        {/if}
      </footer>
    {/if}
  </div>
{/if}

<style>
  .mobile-preview__backdrop {
    position: fixed;
    inset: 0;
    z-index: 79;
    border: 0;
    padding: 0;
    background: rgba(17, 24, 39, 0.35);
    transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Pendant le geste, l'opacité suit le doigt : pas de transition à rattraper. */
  .mobile-preview__backdrop--dragging {
    transition: none;
  }

  .mobile-preview {
    position: fixed;
    /* Feuille ancrée en bas plutôt que surface plein écran : elle épouse son
       contenu, donc un exercice d'une seule question n'occupe plus tout
       l'écran, et les résultats restent visibles derrière. */
    inset: auto 0 0 0;
    z-index: 80;
    display: flex;
    flex-direction: column;
    max-height: 88vh;
    max-height: 88dvh;
    border-radius: 1.1rem 1.1rem 0 0;
    background: #fff;
    color: #111827;
    box-shadow: 0 -10px 40px rgba(17, 24, 39, 0.22);
    /* Sert au retour élastique quand le geste n'atteint pas le seuil. */
    transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
    touch-action: pan-y;
  }

  .mobile-preview--dragging {
    transition: none;
  }

  .mobile-preview__grabber {
    flex-shrink: 0;
    width: 2.25rem;
    height: 0.25rem;
    margin: 0.5rem auto 0.15rem;
    border-radius: 999px;
    background: #d1d5db;
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

  /* Body */
  .mobile-preview__body {
    /* `flex: 1` étirait la zone crème sur toute la hauteur restante : c'est ce
       qui donnait un grand vide sous les énoncés courts. */
    flex: 0 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.65rem 0.9rem calc(0.65rem + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid #e5e7eb;
    background: #ffffff;
    box-shadow: 0 -8px 22px rgba(17, 24, 39, 0.08);
  }

  .mobile-preview__footer-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(7rem, 0.85fr);
    gap: 0.55rem;
    width: 100%;
  }

  .mobile-preview__footer-actions :global(.add-to-list-btn) {
    width: 100% !important;
    height: 2.75rem !important;
    min-width: 0;
    justify-content: center !important;
    border-radius: 0.65rem !important;
    padding: 0 0.75rem !important;
    border-color: #426027 !important;
    background: #426027 !important;
    color: #ffffff !important;
    font-size: 0.86rem !important;
    font-weight: 800 !important;
    box-shadow: 0 6px 14px rgba(66, 96, 39, 0.22);
  }

  .mobile-preview__footer-actions :global(.add-to-list-btn:active:not(:disabled)) {
    background: #334d1f !important;
    border-color: #334d1f !important;
    transform: translateY(1px);
  }

  .mobile-preview__footer-actions :global(.add-to-list-btn--in-list) {
    border-color: #fecaca !important;
    background: #fef2f2 !important;
    color: #b91c1c !important;
    box-shadow: none;
  }

  .mobile-preview__footer-actions :global(.add-to-list-text) {
    display: inline !important;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-preview__open-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    height: 2.75rem;
    min-width: 0;
    border-radius: 0.65rem;
    border: 1px solid #3a8f8f;
    background: #3a8f8f;
    color: #ffffff;
    font-size: 0.86rem;
    font-weight: 800;
    box-shadow: 0 6px 14px rgba(58, 143, 143, 0.2);
    transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  }

  .mobile-preview__open-btn svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .mobile-preview__open-btn span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-preview__open-btn:active {
    background: #2f7373;
    border-color: #2f7373;
    transform: translateY(1px);
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
