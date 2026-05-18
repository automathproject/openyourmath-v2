<script>
  import { goto } from '$app/navigation';
  import LevelBar from './LevelBar.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  export let chapter;     // { name, count, levels, subchapters, preview?, glyph? }
  export let dense = false;
  export let showLevels = true;

  let hover = false;

  function open() {
    goto(`/browse?chapter=${encodeURIComponent(chapter.name)}`);
  }

  // Use subchapters as topic chips (show top 3-4)
  $: topics = chapter.subchapters?.slice(0, dense ? 2 : 3).map((s) => s.name) ?? [];
  $: extraTopics = (chapter.subchapters?.length ?? 0) - topics.length;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<article
  class="chapter-card"
  class:chapter-card--hover={hover}
  class:chapter-card--dense={dense}
  on:click={open}
  on:mouseenter={() => (hover = true)}
  on:mouseleave={() => (hover = false)}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === 'Enter' && open()}
>
  <!-- Decorative glyph watermark -->
  {#if chapter.glyph}
    <div class="glyph-bg" class:glyph-bg--hover={hover} aria-hidden="true">
      {chapter.glyph}
    </div>
  {/if}

  <!-- Title + count -->
  <div class="card-header">
    <h3 class="card-title" style="font-size: {dense ? '16px' : '18px'}">{chapter.name}</h3>
    <span class="card-count">{chapter.count} ex.</span>
  </div>

  <!-- Topics chips -->
  <div class="card-topics">
    {#each topics as t}
      <span class="topic-chip">{t}</span>
    {/each}
    {#if extraTopics > 0}
      <span class="topic-extra">+{extraTopics}</span>
    {/if}
  </div>

  <div style="flex: 1" />

  <!-- Preview formula -->
  {#if !dense && chapter.preview}
    <div class="card-preview">
      <MathRenderer content={chapter.preview} inline={false} />
    </div>
  {/if}

  <!-- Level distribution bar -->
  {#if showLevels}
    <LevelBar levels={chapter.levels} total={chapter.count} />
  {/if}
</article>

<style>
  .chapter-card {
    position: relative;
    background: var(--oym-bg);
    border: 1px solid var(--oym-line);
    border-radius: 6px;
    padding: 18px 20px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--oym-sh-1);
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    outline: none;
  }

  .chapter-card--dense { padding: 14px 16px; gap: 10px; }

  .chapter-card--hover {
    border-color: var(--oym-teal-700);
    box-shadow: var(--oym-sh-2);
    transform: translateY(-1px);
  }

  .chapter-card:focus-visible {
    box-shadow: var(--oym-sh-focus);
    border-color: var(--oym-teal);
  }

  .glyph-bg {
    position: absolute;
    top: -10px;
    right: 8px;
    font-family: var(--oym-font-serif);
    font-size: 88px;
    line-height: 1;
    font-style: italic;
    color: var(--oym-bg-elev);
    pointer-events: none;
    user-select: none;
    transition: color 0.15s;
    z-index: 0;
  }

  .glyph-bg--hover { color: var(--oym-teal-100); }

  .card-header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .card-title {
    margin: 0;
    font-family: var(--oym-font-serif);
    font-weight: 600;
    color: var(--oym-ink);
    line-height: 1.3;
    flex: 1;
  }

  .card-count {
    font-family: var(--oym-font-mono);
    font-size: 12px;
    color: var(--oym-ink-3);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-topics {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .topic-chip {
    font-family: var(--oym-font-sans);
    font-size: 11px;
    color: var(--oym-ink-3);
    background: var(--oym-bg-elev);
    border: 1px solid var(--oym-line-soft);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .topic-extra {
    font-family: var(--oym-font-sans);
    font-size: 11px;
    color: var(--oym-ink-3);
    padding: 2px 4px;
  }

  .card-preview {
    position: relative;
    z-index: 1;
    font-size: 14px;
    color: var(--oym-ink-2);
    padding: 6px 0;
    border-top: 1px dashed var(--oym-line-soft);
    min-height: 28px;
    overflow: hidden;
  }

  /* Override MathRenderer display for card context */
  .card-preview :global(.katex-display) {
    margin: 0 !important;
  }
</style>
