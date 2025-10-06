<script>
  import { createEventDispatcher } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import NameRenderer from '$lib/components/NameRenderer.svelte';
  import AddToListButton from '$lib/components/AddToListButton.svelte';

  export let exercise;
  export let isSelected = false;

  const dispatch = createEventDispatcher();

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
  on:click={handleClick}
  on:keydown={(event) => event.key === 'Enter' && handleClick()}
>
  <div class="flex justify-between items-start mb-2">
    <div class="flex gap-2 items-center">
      {#if exercise.level}
        <div class="result-badge">{exercise.level}</div>
      {/if}
      {#if exercise.difficulty}
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
      <div class="result-metadata">
        {#if exercise.module}
          <span class="result-badge">📖 {exercise.module}</span>
        {/if}
        {#if exercise.chapter}
          <span class="result-badge">{exercise.chapter}</span>
        {/if}
      </div>
    </div>
  </div>

  {#if exercise.preview}
    <div class="result-preview mt-3">
      <div class="text-gray-600 text-sm line-clamp-3">
        <MathRenderer content={exercise.preview} />
      </div>
    </div>
  {/if}

  {#if exercise.author || exercise.organization}
    <div class="result-footer">
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
      {#if exercise.organization}
        <span class="result-footer-sep">•</span>
        <span class="result-footer-item">🏛️ {exercise.organization}</span>
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
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    @apply border-brand-primary bg-brand-50;
  }
  .result-header { display: flex; align-items: start; justify-content: space-between; }
  .result-title {
    font-size: 1.125rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
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
  .result-preview div { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .result-preview .katex { font-size: 0.875rem !important; }
  .result-preview .katex-display { margin: 0.25rem 0 !important; }
  .result-footer {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    display:flex;
    gap:0.5rem;
    flex-wrap:wrap;
    font-size:0.875rem;
    @apply border-t border-gray-100 text-interface-text-secondary;
  }
  .result-footer-item { white-space: nowrap; }
  .result-footer-sep { @apply text-gray-300; }
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
