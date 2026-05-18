<!-- src/lib/components/ExerciseHeader.svelte -->
<script>
  import { tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Breadcrumb from './Breadcrumb.svelte';
  import NameRenderer from './NameRenderer.svelte';
  import MathRenderer from './MathRenderer.svelte';
  import StarsRating from './StarsRating.svelte';
  import Chip from './Chip.svelte';

  export let exercise = {};
  export let variant = 'full'; // 'full' | 'preview' | 'simple'
  export let position = null; // { current, total }
  export let showGlobalToggles = false;
  export let showHint = false;
  export let showSolution = false;
  export let studentMode = 'normal'; // 'normal' | 'student' | 'student-hints'
  export let breadcrumbItems = []; // [{label, href?}]
  export let showBreadcrumb = true;

  let showVideoModal = false;
  let videoCloseButton;
  let metadataCollapsed = false;

  const metadataBlockId = 'exercise-metadata-block';

  $: metadataToggleLabel = metadataCollapsed
    ? 'Afficher les métadonnées'
    : 'Masquer les métadonnées';

  function formatDisplayDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('fr-FR');
  }

  function extractYoutubeId(ex) {
    if (!ex) return null;
    const rawValue = ex?.artifacts?.video ?? ex?.video_id ?? ex?.videoId;
    if (!rawValue) return null;

    const stringValue = typeof rawValue === 'string' ? rawValue : String(rawValue);
    const trimmed = stringValue.trim();
    if (!trimmed) return null;

    try {
      const asUrl = new URL(trimmed);
      const host = asUrl.hostname.toLowerCase();

      if (host.includes('youtube.com')) {
        const byParam = asUrl.searchParams.get('v');
        if (byParam) return byParam;
        const parts = asUrl.pathname.split('/').filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
      }

      if (host.includes('youtu.be')) {
        const parts = asUrl.pathname.split('/').filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
      }
    } catch (err) {
      // Not a full URL, fall back to regex checks below.
    }

    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (watchMatch) {
      return watchMatch[1];
    }

    const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{6,}$/);
    if (idMatch) {
      return trimmed;
    }

    return null;
  }

  $: createdAtLabel = formatDisplayDate(exercise?.created_at ?? exercise?.createdAt);
  $: updatedAtLabel = formatDisplayDate(exercise?.updated_at ?? exercise?.updatedAt);
  $: hasDates = Boolean(createdAtLabel || updatedAtLabel);
  $: videoId = extractYoutubeId(exercise);
  $: canDisplayVideoAction = Boolean(videoId && variant === 'full');
  $: if (showVideoModal) {
    tick().then(() => {
      videoCloseButton?.focus();
    });
  }
  $: if (!canDisplayVideoAction && showVideoModal) {
    showVideoModal = false;
  }

  function toggleHint() {
    showHint = !showHint;
    const e = new CustomEvent('toggleHint', { detail: { showHint } });
    dispatchEvent(e);
  }

  function toggleSolution() {
    showSolution = !showSolution;
    const e = new CustomEvent('toggleSolution', { detail: { showSolution } });
    dispatchEvent(e);
  }

  function openVideoModal() {
    if (!canDisplayVideoAction) return;
    showVideoModal = true;
  }

  function closeVideoModal() {
    showVideoModal = false;
  }

  function toggleMetadata() {
    metadataCollapsed = !metadataCollapsed;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && showVideoModal) {
      event.preventDefault();
      closeVideoModal();
    }
  }

  $: showCrumb = showBreadcrumb && variant !== 'preview';
  $: computedBreadcrumb = (() => {
    if (!showCrumb) return [];
    if (breadcrumbItems && breadcrumbItems.length > 0) return breadcrumbItems;
    const items = [];
    if (variant === 'full' && position) {
      items.push({ label: `Exercice ${position.current}` });
      if (exercise?.chapter) items.push({ label: exercise.chapter });
      return items;
    }
    if (exercise) {
      items.push({ label: 'Accueil', href: '/' });
      if (exercise.level) items.push({ label: exercise.level });
      if (exercise.module) items.push({ label: exercise.module });
      if (exercise.chapter) items.push({ label: exercise.chapter });
    }
    return items;
  })();
</script>

<svelte:window on:keydown={handleKeydown} />

<header
  class="exercise-header"
  class:is-preview={variant === 'preview'}
  class:metadata-collapsed={metadataCollapsed}
>
  {#if showCrumb}
    <Breadcrumb items={computedBreadcrumb} />
  {/if}

  <!-- Top row -->
  <div class="header-top">
    {#if variant !== 'preview'}
      <h1 class="exercise-title {variant !== 'full' ? 'text-2xl mb-6' : ''}">
        <MathRenderer content={exercise?.title || 'Exercice'} inline={true} />
      </h1>
    {/if}

    {#if variant !== 'preview' && !metadataCollapsed}
      <div
        class="exercise-metadata"
        id={metadataBlockId}
        transition:slide={{ duration: 220, easing: cubicOut }}
      >
        {#if exercise.level}
          <Chip variant="teal-solid">{exercise.level}</Chip>
        {/if}
        {#if exercise.theme}
          <Chip variant="info">{exercise.theme}</Chip>
        {/if}
        {#if exercise.difficulty}
          <div class="exercise-difficulty">
            <StarsRating n={exercise.difficulty} total={5} />
            {#if variant === 'full'}
              <span class="text-sm text-interface-text-muted">({exercise.difficulty}/5)</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Absolutely positioned, removed from normal flow -->
    <div class="title-right">
      <div class="title-right-top">
        {#if variant !== 'preview'}
          <button
            type="button"
            class="metadata-toggle"
            class:collapsed={metadataCollapsed}
            on:click={toggleMetadata}
            aria-expanded={!metadataCollapsed}
            aria-controls={metadataBlockId}
            aria-label={metadataToggleLabel}
            title={metadataToggleLabel}
          >
            <span class="chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
          {#if exercise?.uuid}
            <span class="exercise-uuid text-xs text-interface-text-muted font-mono">{exercise.uuid}</span>
          {/if}
        {/if}
      </div>

      {#if variant !== 'preview' && !metadataCollapsed}
        <div class="attribution-info" transition:slide={{ duration: 220, easing: cubicOut }}>
          {#if exercise?.author}
            <NameRenderer
              author={exercise.author}
              licenseCode={exercise.license_code}
              licenseUrl={exercise.license_url}
              email={exercise.author_email || exercise.authorEmail || ''}
              variant="compact"
            />
          {/if}

          {#if exercise?.organization}
            <div class="attribution-item">
              <span class="attribution-icon">🏛️</span>
              <span class="attribution-text">{exercise.organization}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if showGlobalToggles || canDisplayVideoAction}
    {#if !metadataCollapsed}
      <div class="exercise-actions" transition:slide={{ duration: 220, easing: cubicOut }}>
        {#if canDisplayVideoAction}
          <button
            type="button"
            class="action-button action-button--video"
            on:click={openVideoModal}
          >
            📺 Voir la vidéo
          </button>
        {/if}

        {#if showGlobalToggles && exercise?.hasIndication && studentMode !== 'student'}
          <button
            on:click={() => showHint = !showHint}
            class="action-button action-button--hint"
            aria-pressed={showHint}
          >
            💡 {showHint ? 'Masquer' : 'Voir'} les indications
          </button>
        {/if}
        {#if showGlobalToggles && exercise?.hasSolution && studentMode === 'normal'}
          <button
            on:click={() => showSolution = !showSolution}
            class="action-button action-button--solution"
            aria-pressed={showSolution}
          >
            ✅ {showSolution ? 'Masquer' : 'Voir'} les solutions
          </button>
        {/if}
      </div>
    {/if}
  {/if}

  {#if hasDates && !metadataCollapsed && variant !== 'preview'}
    <div class="header-bottom" transition:slide={{ duration: 220, easing: cubicOut }}>
      {#if createdAtLabel}
        <span
          class="date-entry"
          title="Créé"
          aria-label={`Créé le ${createdAtLabel}`}
        >
          <span class="date-entry-icon" aria-hidden="true">📅</span>
          <span class="date-entry-text">{createdAtLabel}</span>
        </span>
      {/if}
      {#if updatedAtLabel}
        <span
          class="date-entry"
          title="Mis à jour"
          aria-label={`Mis à jour le ${updatedAtLabel}`}
        >
          <span class="date-entry-icon" aria-hidden="true">🔄</span>
          <span class="date-entry-text">{updatedAtLabel}</span>
        </span>
      {/if}
    </div>
  {/if}
</header>

{#if showVideoModal && canDisplayVideoAction}
  <div class="video-modal-backdrop" role="presentation" on:click={closeVideoModal}>
    <div
      class="video-modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Vidéo associée à l'exercice"
      on:click|stopPropagation
    >
      <button
        type="button"
        class="video-modal-close"
        on:click={closeVideoModal}
        aria-label="Fermer la vidéo"
        bind:this={videoCloseButton}
      >
        ×
      </button>
      {#if videoId}
        <div class="video-modal-content">
          <iframe
            title="Lecture vidéo"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .exercise-header {
    position: relative;
    border-bottom: 1px solid theme('colors.interface.border-primary');
    @apply bg-interface-bg-secondary px-6 py-4 md:px-8 md:py-6 rounded-xl;
    transition: padding 0.2s ease;
  }

  .header-top {
    position: relative;
    display: block;
    min-height: 2.25rem; /* ensures room for the absolutely positioned block */
  }

  .exercise-title {
    font-family: theme('fontFamily.heading');
    font-weight: 800;
    font-size: 28px;
    color: theme('colors.interface.text-primary');
    letter-spacing: -0.3px;
    margin-bottom: 0.5rem;
    margin-right: clamp(10rem, 28vw, 22rem);
    line-height: 1.2;
  }

  .title-right {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.375rem;
    max-width: 40ch; /* prevent overgrowth */
  }

  .title-right-top {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    justify-content: flex-end;
    width: 100%;
  }

  .exercise-uuid {
    opacity: 0.8;
  }

  .metadata-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    border: 1px solid rgba(107, 114, 128, 0.15);
    background: rgba(255, 255, 255, 0.9);
    color: rgb(55 65 81);
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }

  .metadata-toggle:hover,
  .metadata-toggle:focus-visible {
    background: rgb(219 234 254);
    color: rgb(30 64 175);
    border-color: rgba(30, 64, 175, 0.3);
  }

  .metadata-toggle:focus-visible {
    outline: 2px solid rgb(30 64 175);
    outline-offset: 2px;
  }

  .metadata-toggle .chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
    transform: rotate(180deg);
  }

  .metadata-toggle.collapsed .chevron {
    transform: rotate(0deg);
  }

  .metadata-toggle svg {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .attribution-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    align-items: flex-end;
  }

  .attribution-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: theme('colors.interface.text-secondary');
    white-space: nowrap;
  }

  .attribution-icon {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .attribution-text {
    font-weight: 500;
  }

  .exercise-metadata {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .exercise-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .exercise-badge--chapter { background: rgb(219 234 254); color: rgb(30 64 175); }
  .exercise-badge--theme { background: rgb(237 233 254); color: rgb(91 33 182); }
  .exercise-badge--module { background: rgb(243 244 246); color: rgb(55 65 81); }
  .exercise-badge--level { background: rgb(240 253 244); color: rgb(22 101 52); }
  .exercise-difficulty { display: flex; align-items: center; gap: 0.5rem; }

  .exercise-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  .action-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border-radius: 0.5rem;
    transition: background-color .2s ease;
  }
  .action-button--video { background: theme('colors.info.50'); color: theme('colors.info.700'); }
  .action-button--video:hover { background: theme('colors.info.100'); }
  .action-button--hint { background: theme('colors.warning.50'); color: theme('colors.warning.700'); }
  .action-button--hint:hover { background: theme('colors.warning.100'); }
  .action-button--solution { background: theme('colors.success.50'); color: theme('colors.success.700'); }
  .action-button--solution:hover { background: theme('colors.success.100'); }

  .header-bottom {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .date-entry {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: theme('colors.interface.text-muted');
    font-weight: 500;
    white-space: nowrap;
  }

  .date-entry-icon {
    font-size: 0.875rem;
  }

  /* Preview context */
  .exercise-header.is-preview { font-size: 0.9em; }
  .exercise-header.is-preview .exercise-badge,
  .exercise-header.is-preview .action-button,
  .exercise-header.is-preview .exercise-title,
  .exercise-header.is-preview .exercise-metadata { font-size: inherit !important; }

  .exercise-header.metadata-collapsed {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .exercise-header.metadata-collapsed .exercise-title {
    margin-bottom: 0;
  }

  .exercise-header.metadata-collapsed .header-top {
    min-height: auto;
  }

  .exercise-header.metadata-collapsed .title-right {
    gap: 0.125rem;
  }

  /* In preview, allow the title to take more width */
  .exercise-header.is-preview .exercise-title {
    /* Reduce the reserved space for the right block */
    margin-right: clamp(6rem, 18vw, 14rem);
  }

  /* Compact preview header without the title */
  .exercise-header.is-preview {
    @apply px-4 py-3 md:px-5 md:py-4 rounded-lg;
  }

  .exercise-header.is-preview .header-top {
    min-height: auto;
  }

  .exercise-header.is-preview .title-right {
    position: static;
    align-items: flex-start;
    gap: 0.25rem;
    max-width: 100%;
  }

  .exercise-header.is-preview .title-right-top {
    justify-content: flex-start;
  }

  .video-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.65);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 1.5rem;
    z-index: 60;
  }

  .video-modal-dialog {
    position: relative;
    width: min(960px, 100%);
    background: white;
    border-radius: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
    padding: 1.5rem;
  }

  .video-modal-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    border-radius: 9999px;
    background: rgba(243, 244, 246, 0.9);
    color: rgb(55 65 81);
    font-size: 1.5rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .video-modal-close:hover {
    background: rgb(219 234 254);
    color: rgb(30 64 175);
  }

  .video-modal-content {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 0.75rem;
    overflow: hidden;
    background: black;
  }

  .video-modal-content iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  /* Responsive: on small screens, put the right block back into flow */
  @media (max-width: 640px) {
    .header-top {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "title title-right"
        "metadata title-right";
      column-gap: 0.75rem;
      row-gap: 0.5rem;
      align-items: start;
    }
    .exercise-title {
      grid-area: title;
      margin-right: 0; /* no reservation needed on mobile */
      margin-bottom: 0;
    }
    .exercise-metadata {
      grid-area: metadata;
      margin-bottom: 0;
    }
    .title-right {
      grid-area: title-right;
      position: static;
      align-items: flex-end;
      text-align: right;
      margin-top: 0;
      max-width: 100%;
    }

    .title-right-top {
      justify-content: flex-end;
    }
    .video-modal-dialog {
      padding: 1rem;
      border-radius: 0.75rem;
    }
  }
</style>
