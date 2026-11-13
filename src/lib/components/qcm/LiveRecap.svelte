<!-- src/lib/components/qcm/LiveRecap.svelte
     Revue personnelle d'un participant à la fin d'une session en direct :
     son score, puis chaque question corrigée avec sa réponse, les réponses
     justes et les explications. Fait pour un téléphone : une colonne, et une
     rangée de pastilles pour sauter à une question. -->
<script>
  import MathRenderer from '../MathRenderer.svelte';
  import QcmChoices from './QcmChoices.svelte';
  import { choiceMarks } from '$lib/qcm/blocks.js';

  /** Questions corrigées, telles que les renvoie participantRecap(). */
  export let review = [];
  /** { score } du participant. */
  export let me = null;
  export let total = 0;

  $: score = me?.score ?? review.filter((item) => item.ok).length;
  $: unanswered = review.filter((item) => item.answer === null).length;
</script>

<section class="recap" aria-labelledby="recap-title">
  <div class="recap-head">
    <h2 id="recap-title">Votre bilan</h2>
    <p class="recap-score"><strong>{score}</strong> / {review.length}</p>
    <p class="muted">
      question{score > 1 ? 's' : ''} réussie{score > 1 ? 's' : ''}
      {#if review.length < total}<br />sur {review.length} corrigée{review.length > 1 ? 's' : ''} ({total} au programme){/if}
      {#if unanswered}<br />{unanswered} sans réponse{/if}
    </p>
  </div>

  <nav class="recap-chips" aria-label="Aller à une question">
    {#each review as item}
      <a
        class="chip"
        class:chip--ok={item.ok}
        class:chip--ko={item.answer !== null && !item.ok}
        href="#revue-{item.index}"
        title={item.answer === null ? 'Sans réponse' : item.ok ? 'Réussie' : 'Manquée'}
      >
        {item.index + 1}<span aria-hidden="true">{item.answer === null ? '' : item.ok ? ' ✓' : ' ✗'}</span>
      </a>
    {/each}
  </nav>

  {#each review as item (item.index)}
    <article class="card" id="revue-{item.index}">
      <p class="card-head">
        <span>
          Question {item.index + 1}
          {#if item.of > 1}<span class="serie">· série, partie {item.rank}/{item.of}</span>{/if}
        </span>
        <span class="verdict" class:verdict--ok={item.ok} class:verdict--ko={item.answer !== null && !item.ok}>
          {item.answer === null ? 'Sans réponse' : item.ok ? '✓ Réussie' : '✗ Manquée'}
        </span>
      </p>

      {#if item.context_html}
        <div class="context"><MathRenderer content={item.context_html} prerendered /></div>
      {/if}
      <div class="stem"><MathRenderer content={item.stem_html} prerendered /></div>

      <QcmChoices
        choices={item.choices}
        selected={item.answer ?? []}
        marks={choiceMarks(item.choices, item.answer ?? [])}
        disabled
        prerendered
        name="revue-{item.index}"
      />

      {#if item.explanation_html}
        <div class="explanation">
          <p class="explanation-title">Explications</p>
          <MathRenderer content={item.explanation_html} prerendered />
        </div>
      {/if}
    </article>
  {/each}
</section>

<style>
  .recap {
    display: grid;
    gap: 1rem;
  }

  .recap-head {
    text-align: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1.5rem 1.25rem;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: #111827;
  }

  .recap-score {
    margin: 0.5rem 0 0;
    font-size: 1.5rem;
    color: #4b5563;
    font-variant-numeric: tabular-nums;
  }

  .recap-score strong {
    font-size: 2.75rem;
    font-weight: 800;
    color: var(--color-brand-700);
  }

  .muted {
    margin: 0.25rem 0 0;
    color: #6b7280;
    font-size: 0.9rem;
  }

  .recap-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .chip {
    min-width: 2.4rem;
    padding: 0.3rem 0.55rem;
    border: 1.5px solid #d1d5db;
    border-radius: 0.5rem;
    background: #fff;
    color: #374151;
    font-weight: 600;
    font-size: 0.9rem;
    text-align: center;
    text-decoration: none;
    font-variant-numeric: tabular-nums;
  }

  .chip--ok {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
  }

  .chip--ko {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1.25rem;
    scroll-margin-top: 3.5rem;
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #4b5563;
  }

  .serie {
    font-weight: 500;
  }

  .verdict {
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: #f3f4f6;
    color: #4b5563;
  }

  .verdict--ok {
    background: #f0fdf4;
    color: #15803d;
  }

  .verdict--ko {
    background: #fef2f2;
    color: #b91c1c;
  }

  .context {
    padding: 0.75rem 0.9rem;
    margin-bottom: 0.9rem;
    background: var(--color-brand-50);
    border-radius: 0.6rem;
    color: #374151;
    line-height: 1.6;
    overflow-x: auto;
  }

  .stem {
    color: #111827;
    font-size: 1.05rem;
    line-height: 1.6;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 0.2rem;
  }

  .stem :global(img),
  .context :global(img) {
    max-width: 100%;
    height: auto;
  }

  .explanation {
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    border-left: 4px solid #4ade80;
    background: #f0fdf4;
    border-radius: 0 0.5rem 0.5rem 0;
    color: #374151;
    line-height: 1.6;
    overflow-x: auto;
  }

  .explanation-title {
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #15803d;
  }
</style>
