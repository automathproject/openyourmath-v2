<script>
  import { createEventDispatcher, tick } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import SearchSnippet from '$lib/components/search/SearchSnippet.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';

  export let exercise;
  export let activeFilters = {};
  export let cardMode = 'detailed';
  export let isSelected = false;

  const dispatch = createEventDispatcher();
  let cardEl;

  function formatDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  $: displayDate = formatDate(exercise?.updated_at ?? exercise?.updatedAt ?? exercise?.created_at);
  $: isCompact = cardMode === 'compact';

  // Suppress unused warning — activeFilters may be used by parent for context
  $: void activeFilters;

  $: if (isSelected && cardEl) {
    tick().then(() => cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
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

  function difficultyStars(n, max = 4) {
    return Array.from({ length: max }, (_, i) => i < (n ?? 0));
  }
</script>

<article
  class="exo-card {isSelected ? 'exo-card--selected' : ''} {isCompact ? 'exo-card--compact' : ''}"
  role="option"
  aria-selected={isSelected}
  tabindex="0"
  bind:this={cardEl}
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
  <!-- Meta row: level chip + module chip + difficulty stars + indicators -->
  <div class="meta-row">
    {#if exercise.level}
      <span class="chip-level {isSelected ? 'chip-level--solid' : ''}">{exercise.level}</span>
    {/if}
    {#if exercise.module}
      <span class="chip-module">{exercise.module}</span>
    {/if}
    {#if exercise.difficulty}
      <span class="stars" aria-label="difficulté {exercise.difficulty}/4">
        {#each difficultyStars(exercise.difficulty) as filled}
          <span class={filled ? 'star-on' : 'star-off'}>★</span>
        {/each}
      </span>
    {/if}
    <span class="meta-spacer"></span>
    {#if exercise.video_id}
      <span class="indicator indicator--video">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        vidéo
      </span>
    {/if}
    {#if exercise.hasSolution}
      <span class="indicator indicator--solution">★ solution</span>
    {/if}
  </div>

  <!-- Title -->
  <h3 class="exo-title">
    <MathRenderer content={exercise.title} inline={true} />
  </h3>

  <!-- Excerpt / preview -->
  {#if exercise.preview && !isCompact}
    <div class="exo-excerpt">
      <SearchSnippet content={exercise.preview} lines={4} />
    </div>
  {/if}

  <!-- Footer: author · date + actions -->
  <div class="exo-footer">
    <span class="footer-meta">
      {#if exercise.author}<span>{exercise.author}</span>{/if}
      {#if exercise.author && displayDate}<span class="sep">·</span>{/if}
      {#if displayDate}<span>{displayDate}</span>{/if}
    </span>
    <span class="meta-spacer"></span>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="footer-actions" on:click|stopPropagation>
      <AddToListButton {exercise} size="small" variant="icon" />
      <button class="action-btn" title="Ouvrir dans un nouvel onglet" on:click={openExternal}>
        Ouvrir →
      </button>
    </div>
  </div>
</article>

<style>
  .exo-card {
    padding: 14px 16px;
    border: 1px solid var(--oym-line);
    border-radius: 6px;
    background: var(--oym-bg);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 7px;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }

  .exo-card:hover {
    border-color: var(--oym-ink-3);
    box-shadow: var(--oym-sh-1);
  }

  .exo-card--selected {
    border-color: var(--oym-teal-700);
    background: var(--oym-teal-50);
    box-shadow: 0 0 0 1px var(--oym-teal-700);
  }

  .exo-card--compact {
    padding: 10px 12px;
    gap: 5px;
  }

  /* Meta row */
  .meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .meta-spacer { flex: 1; }

  .chip-level {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--oym-teal-300);
    background: var(--oym-teal-100);
    color: var(--oym-teal-800);
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }

  .chip-level--solid {
    background: var(--oym-teal);
    color: white;
    border-color: var(--oym-teal);
  }

  .chip-module {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--oym-line-2);
    background: transparent;
    color: var(--oym-ink-3);
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .stars {
    display: inline-flex;
    gap: 1px;
    line-height: 1;
  }

  .star-on  { color: var(--oym-gold); font-size: 12px; }
  .star-off { color: var(--oym-ink-5); font-size: 12px; }

  .indicator {
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .indicator--video  { color: var(--oym-accent-700); }
  .indicator--solution { color: var(--oym-ok); }

  /* Title */
  .exo-title {
    font-family: var(--oym-font-serif);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--oym-ink);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Excerpt */
  .exo-excerpt {
    font-family: var(--oym-font-serif);
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--oym-ink-2);
  }

  /* Footer */
  .exo-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--oym-line-soft);
    margin-top: 2px;
  }

  .footer-meta {
    font-family: var(--oym-font-sans);
    font-size: 11.5px;
    color: var(--oym-ink-3);
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .sep { color: var(--oym-ink-5); }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    background: none;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-ink-2);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    white-space: nowrap;
  }

  .action-btn:hover {
    background: var(--oym-bg-elev);
    color: var(--oym-ink);
  }
</style>
