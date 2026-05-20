<script>
  import { createEventDispatcher } from 'svelte';
  import { tick } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import SearchSnippet from '$lib/components/search/SearchSnippet.svelte';
  import NameRenderer from '$lib/components/NameRenderer.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';

  export let exercise;
  export let activeFilters = {};
  export let cardMode = 'detailed'; // 'detailed' | 'compact'
  export let isSelected = false;

  const dispatch = createEventDispatcher();
  let cardEl;

  function formatDisplayDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('fr-FR');
  }

  $: createdAtLabel = formatDisplayDate(exercise?.created_at ?? exercise?.createdAt);
  $: updatedAtLabel = formatDisplayDate(exercise?.updated_at ?? exercise?.updatedAt);
  $: hasDates = Boolean(createdAtLabel || updatedAtLabel);
  $: hasFooterInfo = Boolean(exercise?.author || exercise?.organization);
  $: isCompact = cardMode === 'compact';
  $: showFooter = !isCompact && (hasFooterInfo || hasDates);
  $: showLevelBadge = !isCompact && Boolean(exercise?.level);
  $: showModuleBadge = !isCompact && Boolean(exercise?.module);
  $: showChapterBadge = !isCompact && Boolean(exercise?.chapter) && String(activeFilters?.chapter || '') !== String(exercise?.chapter || '');
  $: showDifficultyDots = !isCompact && Boolean(exercise?.difficulty);
  $: showTags = showLevelBadge || showModuleBadge || showChapterBadge || showDifficultyDots;
  $: snippetLines = isCompact ? 3 : 6;

  $: if (isSelected && cardEl) {
    tick().then(() => {
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function handleClick() {
    dispatch('select', { exercise });
  }

  function handlePreview(event) {
    event.stopPropagation();
    dispatch('select', { exercise });
  }

  function openExternal(event) {
    event.stopPropagation();
    if (typeof window !== 'undefined') {
      window.open(`/exercise/${exercise.uuid}`, '_blank');
    }
  }
</script>

<div
  class="result-card cursor-pointer transition-all duration-200 {isSelected ? 'result-card--selected' : ''} {isCompact ? 'result-card--compact' : ''}"
  role="option"
  aria-selected={isSelected ? 'true' : 'false'}
  tabindex="0"
  bind:this={cardEl}
  on:click={handleClick}
  on:keydown={(event) => event.key === 'Enter' && handleClick()}
>
  {#if isCompact}
    <!-- Compact : titre + actions sur la même ligne, sans UUID -->
    <div class="compact-row">
      <h3 class="result-title compact-title">
        <MathRenderer content={exercise.title} inline={true} />
      </h3>
      <div class="compact-actions">
        <button
          type="button"
          on:click|stopPropagation
          aria-label="Ajouter à la liste"
          class="bg-transparent border-none p-0 m-0"
        >
          <AddToListButton {exercise} size="small" variant="icon" />
        </button>
        {#if isSelected}
          <div class="selection-indicator">
            <svg class="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
        {/if}
        <button
          type="button"
          class="external-link-btn"
          title="Ouvrir dans un nouvel onglet"
          aria-label="Ouvrir dans un nouvel onglet"
          on:click={openExternal}
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </div>
  {:else}
    <!-- Detailed : meta row (chips + stars + indicators) then title -->
    <div class="rc-meta-row">
      {#if showLevelBadge}
        <span class="chip {isSelected ? 'chip-teal-solid' : 'chip-teal'}">{exercise.level}</span>
      {/if}
      {#if showModuleBadge}
        <span class="chip chip-soft rc-chip-module">{exercise.module}</span>
      {/if}
      {#if showDifficultyDots}
        <StarsRating n={exercise.difficulty} />
      {/if}
      {#if showChapterBadge}
        <span class="rc-chapter-badge">{exercise.chapter}</span>
      {/if}
      <span class="rc-flex-spacer" />
      {#if exercise.hasVideo}
        <span class="rc-indicator rc-indicator--video">▶ vidéo</span>
      {/if}
      {#if exercise.hasSolution}
        <span class="rc-indicator rc-indicator--solution" title="Fourni avec la solution">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          solution
        </span>
      {/if}
    </div>

    <h3 class="result-title">
      <MathRenderer content={exercise.title} inline={true} />
    </h3>
  {/if}

  {#if exercise.preview}
    <div class="result-preview mt-3">
      <SearchSnippet content={exercise.preview} lines={snippetLines} />
    </div>
  {/if}

  {#if isCompact}
    <div class="compact-uuid">{exercise.uuid.slice(0, 8)}</div>
  {/if}

  {#if !isCompact}
    <div class="result-footer">
      <!-- Left: author / org / dates -->
      <div class="result-footer-left">
        {#if exercise.author}
          <NameRenderer
            author={exercise.author}
            licenseCode={exercise.license_code}
            licenseUrl={exercise.license_url}
            email={exercise.author_email || exercise.authorEmail || ''}
            variant="footer"
            className="result-footer-item"
          />
        {/if}
        {#if exercise.author && exercise.organization}
          <span class="result-footer-sep">•</span>
        {/if}
        {#if exercise.organization}
          <span class="result-footer-item">🏛️ {exercise.organization}</span>
        {/if}
        {#if hasDates && createdAtLabel}
          {#if hasFooterInfo}<span class="result-footer-sep">·</span>{/if}
          <span class="result-date-text">{createdAtLabel}</span>
        {/if}
      </div>
      <!-- Right: actions -->
      <div class="rc-footer-actions" on:click|stopPropagation>
        <AddToListButton {exercise} size="small" variant="button" />
        <button
          type="button"
          class="rc-footer-open"
          on:click={openExternal}
          aria-label="Ouvrir l'exercice"
        >
          Ouvrir →
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .result-card {
    border-radius: 10px;
    padding: 1rem 1.125rem;
    transition: box-shadow .15s, border-color .15s;
    @apply border border-interface-border-primary bg-interface-bg-white;
  }
  .result-card--compact {
    padding: 0.625rem 0.875rem;
  }
  .compact-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .compact-title {
    flex: 1;
    min-width: 0;
    font-size: 1rem;
  }
  .compact-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .compact-uuid {
    margin-top: 0.375rem;
    text-align: right;
    font-size: 0.65rem;
    font-family: monospace;
    letter-spacing: 0.03em;
    @apply text-interface-text-muted;
    user-select: all;
  }
  .result-card:hover {
    @apply border-interface-border-secondary shadow-card;
  }
  .result-card--selected {
    border-left: 3px solid theme('colors.brand.500');
    @apply bg-brand-50;
  }
  /* ── Meta row (detailed mode) ── */
  .rc-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .rc-chip-module {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
  }
  .rc-chapter-badge {
    font-size: 11px;
    color: theme('colors.interface.text-muted');
    font-style: italic;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 1;
  }
  .rc-flex-spacer { flex: 1; }
  /* Indicators (vidéo / solution) in top-right of meta row */
  .rc-indicator {
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .rc-indicator--video  { color: theme('colors.brand.600'); }
  .rc-indicator--solution {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: theme('colors.success.600');
  }
  .result-title {
    font-family: theme('fontFamily.heading');
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    @apply text-interface-text-primary;
  }
  .result-footer {
    margin-top: 0.625rem;
    padding-top: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.78rem;
    @apply border-t border-interface-border-primary text-interface-text-muted;
  }
  .result-footer-left {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
    min-width: 0;
  }
  .result-footer-item { white-space: nowrap; }
  .result-footer-sep { @apply text-interface-text-disabled; }
  .result-date-text {
    font-size: 0.75rem;
    color: theme('colors.interface.text-muted');
    white-space: nowrap;
  }
  .rc-footer-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  /* Compact AddToListButton style inside card footer */
  .rc-footer-actions :global(.add-to-list-btn) {
    border: none;
    background: transparent;
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: theme('colors.interface.text-secondary');
    border-radius: 4px;
    transform: none !important;
    box-shadow: none !important;
  }
  .rc-footer-actions :global(.add-to-list-btn:hover:not(:disabled)) {
    background: theme('colors.interface.bg-tertiary');
    transform: none !important;
    box-shadow: none !important;
  }
  .rc-footer-open {
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: theme('colors.interface.text-secondary');
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .rc-footer-open:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .selection-indicator {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    @apply bg-brand-50;
  }
</style>
