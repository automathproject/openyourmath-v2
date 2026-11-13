<!-- src/lib/components/qcm/LiveReviewOverview.svelte
     Vue d'ensemble du bilan d'une session en direct, sur l'écran projeté :
     une ligne par question avec sa réussite, les questions non posées à part.
     Un clic sur une ligne émet `select` avec le rang de la question, que la
     page revoit alors en détail. -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { successRate } from '$lib/qcm/results.js';

  /** Plan de la session pendant le bilan : { title, rank, of, asked, answered, correct } par question. */
  export let outline = [];
  export let participants = 0;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  $: asked = outline.filter((item) => item.asked).length;
</script>

<p class="sub">
  {asked} question{asked > 1 ? 's' : ''} posée{asked > 1 ? 's' : ''} sur {outline.length}
  · {participants} participant{participants > 1 ? 's' : ''}.
  Les participants voient sur leur téléphone leurs réponses et les réponses justes.
</p>
<ol class="list">
  {#each outline as item, index}
    {@const rate = successRate(item.correct, item.answered)}
    <li>
      <button type="button" class="row" class:row--skipped={!item.asked} {disabled} on:click={() => dispatch('select', index)}>
        <span class="num">Q{index + 1}</span>
        <span class="label">{item.title}{#if item.of > 1}<span class="muted"> ({item.rank}/{item.of})</span>{/if}</span>
        {#if item.asked}
          <span class="bar" aria-hidden="true"><span style="width: {rate}%" class:low={rate < 50}></span></span>
          <span class="rate">{item.answered ? `${rate} %` : 'aucune réponse'}{#if item.answered}<span class="muted"> · {item.correct}/{item.answered}</span>{/if}</span>
        {:else}
          <span class="bar bar--empty" aria-hidden="true"></span>
          <span class="rate muted">non posée</span>
        {/if}
      </button>
    </li>
  {/each}
</ol>

<style>
  .muted {
    color: #6b7280;
  }

  .sub {
    margin: -0.5rem 0 1rem;
    color: #6b7280;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }

  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr) minmax(6rem, 14rem) 9rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.6rem;
    background: #fff;
    text-align: left;
    font-size: 1rem;
    color: #111827;
    cursor: pointer;
  }

  .row:hover:not(:disabled) {
    border-color: var(--color-brand-500);
    background: var(--color-brand-50);
  }

  .row:disabled {
    cursor: not-allowed;
  }

  .row--skipped {
    color: #6b7280;
  }

  .num {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar {
    height: 0.6rem;
    border-radius: 999px;
    background: #f3f4f6;
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: #22c55e;
  }

  .bar span.low {
    background: #f59e0b;
  }

  .bar--empty {
    background: repeating-linear-gradient(45deg, #f3f4f6 0 6px, #fff 6px 12px);
  }

  .rate {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    }

    .bar {
      display: none;
    }
  }
</style>
