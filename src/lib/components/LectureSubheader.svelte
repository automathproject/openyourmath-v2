<!-- src/lib/components/LectureSubheader.svelte -->
<script>
  import AddToListButton from './AddToListButton.svelte';
  import MathRenderer from './MathRenderer.svelte';
  import StarsRating from './StarsRating.svelte';
  import { LatexExport } from '$lib/latex/exportState.svelte.js';

  let {
    exercise = {},
    // Les trois états de lecture sont pilotés depuis l'en-tête mais partagés
    // avec ExerciseContent : la page parente en reste propriétaire.
    mode = $bindable('classic'),
    showHint = $bindable(false),
    showSolution = $bindable(false),
    questionCount = 0,
    showModeSwitch = true,
    showShareAction = true,
    showLatexAction = true,
    showPrimaryAction = true,
    showRevealControls = true,
    compactMobile = false,
  } = $props();

  let shareLabel = $state('Partager');

  let isImmersive = $derived(mode === 'immersive');
  let titleSizeClass = $derived(
    isImmersive ? 'lecture-title--immersive' : 'lecture-title--classic',
  );
  let difficulty = $derived(Math.min(Number(exercise?.difficulty) || 0, 4));
  let timeAndCount = $derived(
    [
      questionCount > 0 ? `${questionCount} question${questionCount > 1 ? 's' : ''}` : ''
    ].filter(Boolean),
  );

  async function shareExercise() {
    if (typeof window === 'undefined') return;

    const url = window.location.href;
    const title = exercise?.title || 'Exercice OpenYourMath';

    try {
      if (navigator?.share) {
        await navigator.share({ title, url });
      } else if (navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        shareLabel = 'Lien copié';
        setTimeout(() => {
          shareLabel = 'Partager';
        }, 1600);
      }
    } catch (err) {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        shareLabel = 'Lien copié';
        setTimeout(() => {
          shareLabel = 'Partager';
        }, 1600);
      }
    }
  }

  // L'export d'un exercice seul passe par la même fabrique que celui d'une
  // liste : il récupère ainsi les images et les blocs de code que cette action
  // laissait auparavant de côté sans le signaler.
  const latexExport = new LatexExport(() => ({
    exercises: exercise ? [exercise] : [],
    title: exercise?.title || 'Exercice',
    fallbackName: exercise?.uuid || 'exercice',
  }));

  function downloadLatex() {
    if (!exercise) return;
    latexExport.download();
  }
</script>

<section
  class="lecture-subheader"
  class:lecture-subheader--immersive={isImmersive}
  class:lecture-subheader--compact-mobile={compactMobile}
>

  {#if isImmersive && (showModeSwitch || showShareAction || showPrimaryAction)}
    <div class="lecture-immersive-bar">
      {#if showModeSwitch}
        <button type="button" class="immersive-exit-btn" onclick={() => mode = 'classic'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Classique
        </button>
      {/if}

      <div class="immersive-bar-right">
        {#if exercise?.hasSolution}
          <button
            type="button"
            class="btn btn-ghost btn-sm lecture-action"
            class:immersive-action--active={showSolution}
            onclick={() => showSolution = !showSolution}
          >
            {showSolution ? 'Masquer solutions' : 'Solutions'}
          </button>
        {/if}
        {#if showShareAction}
          <button type="button" class="btn btn-ghost btn-sm lecture-action" onclick={shareExercise}>
            <span aria-hidden="true">↗</span>
            <span>{shareLabel}</span>
          </button>
        {/if}
        {#if showPrimaryAction}
          <div class="lecture-primary-action">
            <AddToListButton {exercise} size="normal" />
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="lecture-title-band">
    <div class="lecture-title-inner">

      {#if !isImmersive}
        <div class="lecture-top-row">
          <div class="lecture-metadata">
            {#if exercise?.level}
              <span class="chip chip-teal-solid">{exercise.level}</span>
            {/if}
            {#if exercise?.module}
              <span class="chip chip-soft">{exercise.module}</span>
            {/if}
            {#if exercise?.chapter}
              <span class="chip chip-soft">{exercise.chapter}</span>
            {/if}
            {#if difficulty > 0}
              <span class="lecture-stars">
                <StarsRating n={difficulty} total={4} />
              </span>
            {/if}
            {#if timeAndCount.length > 0}
              <span class="t-caption lecture-facts">
                {timeAndCount.join(' · ')}
              </span>
            {/if}
          </div>

          <div class="lecture-actions">
            {#if showModeSwitch}
              <div class="mode-switch" aria-label="Mode de lecture">
                <button
                  type="button"
                  class:active={mode === 'classic'}
                  aria-pressed={mode === 'classic'}
                  onclick={() => mode = 'classic'}
                >
                  Classique
                </button>
                <button
                  type="button"
                  class:active={mode === 'immersive'}
                  aria-pressed={mode === 'immersive'}
                  onclick={() => mode = 'immersive'}
                >
                  Immersif
                </button>
              </div>
            {/if}

            {#if showShareAction}
              <button type="button" class="btn btn-ghost btn-sm lecture-action" onclick={shareExercise}>
                <span aria-hidden="true">↗</span>
                <span>{shareLabel}</span>
              </button>
            {/if}

            {#if showLatexAction}
              <button type="button" class="btn btn-ghost btn-sm lecture-action" onclick={downloadLatex}>
                <span aria-hidden="true">⤓</span>
                <span>LaTeX</span>
              </button>
            {/if}

            {#if showPrimaryAction}
              <div class="lecture-primary-action">
                <AddToListButton {exercise} size="normal" />
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="lecture-metadata lecture-metadata--immersive">
          {#if exercise?.level}
            <span class="chip chip-teal-solid">{exercise.level}</span>
          {/if}
          {#if exercise?.module}
            <span class="chip chip-soft">{exercise.module}</span>
          {/if}
          {#if exercise?.chapter}
            <span class="chip chip-soft">{exercise.chapter}</span>
          {/if}
          {#if difficulty > 0}
            <span class="lecture-stars">
              <StarsRating n={difficulty} total={4} />
            </span>
          {/if}
          {#if timeAndCount.length > 0}
            <span class="t-caption lecture-facts">
              {timeAndCount.join(' · ')}
            </span>
          {/if}
        </div>
      {/if}

      <h1 class="t-display lecture-title {titleSizeClass}">
        <MathRenderer content={exercise?.title || 'Exercice'} inline={true} />
      </h1>

      {#if isImmersive && showRevealControls}
        <div class="reveal-controls" aria-label="Contrôles de révélation du contenu">
          {#if exercise?.hasIndication}
            <button
              type="button"
              class="reveal-button reveal-button--hint"
              class:active={showHint}
              aria-pressed={showHint}
              onclick={() => showHint = !showHint}
            >
              <span>Tout révéler : indices</span>
              {#if showHint}<span class="reveal-check" aria-hidden="true">✓</span>{/if}
            </button>
          {/if}

          {#if exercise?.hasSolution}
            <button
              type="button"
              class="reveal-button reveal-button--solution"
              class:active={showSolution}
              aria-pressed={showSolution}
              onclick={() => showSolution = !showSolution}
            >
              <span>Tout révéler : solutions</span>
              {#if showSolution}<span class="reveal-check" aria-hidden="true">✓</span>{/if}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .lecture-subheader {
    --bg: theme('colors.interface.bg-white');
    --sh-1: 0 1px 3px rgba(13, 60, 77, 0.12);
    --r-pill: theme('borderRadius.pill');
    --gold: theme('colors.warning.500');
    --gold-100: theme('colors.warning.100');
    --teal: theme('colors.brand.600');
    --teal-50: theme('colors.brand.50');
    background: #fbf8ef;
    border-bottom: 0;
  }

  .lecture-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .lecture-metadata {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 0;
  }

  .lecture-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: var(--r-pill);
    background: theme('colors.interface.bg-tertiary');
    border: 1px solid theme('colors.interface.border-primary');
  }

  .mode-switch button {
    min-height: 30px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: theme('colors.interface.text-secondary');
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
  }

  .mode-switch button.active {
    background: var(--bg);
    box-shadow: var(--sh-1);
    color: theme('colors.interface.text-primary');
    font-weight: 600;
  }

  .lecture-action {
    height: 34px;
    gap: 5px;
    white-space: nowrap;
  }

  .lecture-primary-action {
    display: inline-flex;
  }

  .lecture-primary-action :global(.add-to-list-btn) {
    min-height: 34px;
    border-color: theme('colors.brand.600');
    background: theme('colors.brand.600');
    color: white;
    box-shadow: none;
  }

  .lecture-primary-action :global(.add-to-list-btn:hover:not(:disabled)) {
    background: theme('colors.brand.700');
    border-color: theme('colors.brand.700');
    color: white;
  }

  /* ── Immersive sticky bar ─────────────────── */
  .lecture-immersive-bar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 24px;
    height: 44px;
    background: rgba(251, 248, 239, 0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid theme('colors.interface.border-primary');
  }

  .immersive-exit-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: theme('colors.interface.text-secondary');
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .immersive-exit-btn:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }

  .immersive-bar-right {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .immersive-action--active {
    background: theme('colors.brand.50') !important;
    color: theme('colors.brand.700') !important;
  }

  .lecture-metadata--immersive {
    margin-bottom: 12px;
  }

  /* ── Title band ───────────────────────────── */
  .lecture-title-band {
    padding: 20px 32px 24px;
  }

  .lecture-title-inner {
    max-width: none;
  }

  .lecture-subheader--immersive .lecture-title-inner {
    max-width: 720px;
    margin: 0 auto;
  }

  .lecture-subheader--immersive .lecture-title-band {
    padding: 32px 32px 28px;
  }

  .lecture-stars {
    display: inline-flex;
    align-items: center;
  }

  .lecture-facts {
    color: theme('colors.interface.text-muted');
  }

  .lecture-title {
    max-width: 880px;
    margin: 0;
    color: theme('colors.interface.text-primary');
    line-height: 1.08;
  }

  .lecture-title--classic {
    font-size: 36px;
  }

  .lecture-title--immersive {
    font-size: 44px;
  }

  .reveal-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 26px;
  }

  .reveal-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 12px;
    border-radius: var(--r-pill);
    border: 1px solid transparent;
    background: theme('colors.interface.bg-white');
    color: theme('colors.interface.text-secondary');
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
  }

  .reveal-button--hint {
    border-color: theme('colors.warning.200');
    color: theme('colors.warning.700');
  }

  .reveal-button--hint.active {
    background: var(--gold-100);
    border-color: var(--gold);
    color: theme('colors.warning.800');
  }

  .reveal-button--solution {
    border-color: theme('colors.brand.200');
    color: theme('colors.brand.700');
  }

  .reveal-button--solution.active {
    background: var(--teal-50);
    border-color: var(--teal);
    color: theme('colors.brand.800');
  }

  .reveal-check {
    font-weight: 800;
    line-height: 1;
  }

  @media (max-width: 860px) {
    .lecture-immersive-bar {
      padding: 0 16px;
    }

    .lecture-top-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .lecture-actions {
      flex-wrap: wrap;
    }

    .mode-switch {
      width: 100%;
    }

    .mode-switch button {
      flex: 1;
    }

    .lecture-primary-action :global(.add-to-list-btn) {
      width: auto;
      height: 34px;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
    }

    .lecture-primary-action :global(.add-to-list-text) {
      display: inline;
    }

    .lecture-title-band {
      padding: 24px 16px 20px;
    }

    .lecture-subheader--compact-mobile .lecture-title-band,
    .lecture-subheader--compact-mobile.lecture-subheader--immersive .lecture-title-band {
      padding: 18px 16px 14px;
    }

    .lecture-subheader--compact-mobile .lecture-metadata--immersive {
      gap: 6px;
      margin-bottom: 8px;
    }

    .lecture-title--classic,
    .lecture-title--immersive {
      font-size: clamp(28px, 8vw, 36px);
    }

    .lecture-subheader--compact-mobile .lecture-title--classic,
    .lecture-subheader--compact-mobile .lecture-title--immersive {
      font-size: clamp(26px, 7vw, 34px);
    }
  }
</style>
