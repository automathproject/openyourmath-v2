<script>
  import { createEventDispatcher } from 'svelte';
  import { tick } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import SearchSnippet from '$lib/components/search/SearchSnippet.svelte';
  import NameRenderer from '$lib/components/NameRenderer.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';

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
  $: showLevelBadge = Boolean(exercise?.level) && String(activeFilters?.level || '') !== String(exercise?.level || '');
  $: showModuleBadge = Boolean(exercise?.module) && String(activeFilters?.module || '') !== String(exercise?.module || '');
  $: showChapterBadge = Boolean(exercise?.chapter) && String(activeFilters?.chapter || '') !== String(exercise?.chapter || '');
  $: showDifficultyDots = Boolean(exercise?.difficulty) && String(activeFilters?.difficulty || '') !== String(exercise?.difficulty || '');
  $: showTags = !isCompact && (showLevelBadge || showModuleBadge || showChapterBadge || showDifficultyDots);
  $: snippetLines = isCompact ? 2 : 4;

  $: if (isSelected && cardEl) {
    tick().then(() => {
      cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function handleClick() {
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
  class="result-card cursor-pointer transition-all duration-200 {isSelected ? 'result-card--selected' : ''}"
  role="button"
  tabindex="0"
  bind:this={cardEl}
  on:click={handleClick}
  on:keydown={(event) => event.key === 'Enter' && handleClick()}
>
  <div class="flex justify-between items-start mb-2">
    <div class="flex gap-2 items-center">
      {#if showTags && showLevelBadge}
        <div class="result-badge">{exercise.level}</div>
      {/if}
      {#if showTags && showDifficultyDots}
        <div class="flex items-center gap-1">
          {#each Array(5) as _, i}
            <div class="w-2 h-2 rounded-full {i < exercise.difficulty ? 'bg-orange-400' : 'bg-gray-200'}"></div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        on:click|stopPropagation
        aria-label="Ajouter à la liste"
        class="bg-transparent border-none p-0 m-0"
      >
        <AddToListButton
          {exercise}
          size="small"
          variant="icon"
        />
      </button>

      {#if isSelected}
        <div class="selection-indicator">
          <svg class="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </div>
      {/if}

      <span class="text-xs text-gray-400 font-mono">{exercise.uuid}</span>

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

  <div class="result-header">
    <div>
      <h3 class="result-title">
        <MathRenderer content={exercise.title} inline={true} />
      </h3>
      {#if showTags}
        <div class="result-metadata">
          {#if showModuleBadge}
            <span class="result-badge">📖 {exercise.module}</span>
          {/if}
          {#if showChapterBadge}
            <span class="result-badge">{exercise.chapter}</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if exercise.preview}
    <div class="result-preview mt-3">
      <SearchSnippet content={exercise.preview} lines={snippetLines} />
    </div>
  {/if}

  {#if showFooter}
    <div class="result-footer">
      {#if hasFooterInfo}
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
        </div>
      {/if}
      {#if hasDates}
        <div class="result-date" role="presentation">
          {#if createdAtLabel}
            <span
              class="result-date-entry"
              title="Créé"
              aria-label={`Créé le ${createdAtLabel}`}
            >
              <span class="result-date-icon" aria-hidden="true">📅</span>
              <span class="result-date-text">{createdAtLabel}</span>
            </span>
          {/if}
          {#if updatedAtLabel}
            <span
              class="result-date-entry"
              title="Mis à jour"
              aria-label={`Mis à jour le ${updatedAtLabel}`}
            >
              <span class="result-date-icon" aria-hidden="true">🔄</span>
              <span class="result-date-text">{updatedAtLabel}</span>
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .result-card {
    border-radius: 0.75rem;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
    padding: 1.5rem;
    transition: box-shadow .2s;
    @apply border border-gray-200 bg-interface-bg-primary;
  }
  .result-card:hover { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06); }
  .result-card--selected {
    box-shadow: 0 4px 10px -2px rgb(0 0 0 / 0.12);
    border-left-width: 4px;
    @apply border-brand-primary bg-brand-50;
  }
  .result-header { display: flex; align-items: start; justify-content: space-between; }
  .result-title {
    font-size: 1.125rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    @apply text-gray-900;
  }
  .result-metadata {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    @apply text-gray-600;
  }
  .result-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    @apply bg-gray-100;
  }
  .result-footer {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    display:flex;
    align-items:center;
    gap:0.5rem;
    flex-wrap:wrap;
    font-size:0.875rem;
    @apply border-t border-gray-100 text-interface-text-secondary;
  }
  .result-footer-left {
    display:flex;
    align-items:center;
    gap:0.5rem;
    flex-wrap:wrap;
  }
  .result-footer-item { white-space: nowrap; }
  .result-footer-sep { @apply text-gray-300; }
  .result-date {
    margin-left:auto;
    display:flex;
    align-items:center;
    gap:0.5rem;
    font-size:0.75rem;
    color: rgb(156 163 175);
    font-weight:500;
    white-space:nowrap;
  }

  .result-date-entry {
    display:inline-flex;
    align-items:center;
    gap:0.375rem;
  }

  .result-date-icon {
    font-size:0.875rem;
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
  .external-link-btn {
    transition: color .2s, background-color .2s;
    padding: 0.25rem;
    border-radius: 0.25rem;
    @apply text-gray-400;
  }
  .external-link-btn:hover { @apply text-brand-primary bg-brand-50; }
</style>
