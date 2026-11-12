<!-- src/lib/components/qcm/QcmQuestion.svelte
     Une question de qcm jouée seul : on coche, on valide, la correction
     s'affiche. `reveal` montre la correction sans réponse (bouton « solution »
     de la page). -->
<script>
  import { createEventDispatcher } from 'svelte';
  import MathRenderer from '../MathRenderer.svelte';
  import QcmChoices from './QcmChoices.svelte';
  import { choiceMarks, instructionFor, isCorrectSelection, isSingleChoice } from '$lib/qcm/blocks.js';

  /** Champ `qcm` du bloc question. */
  export let qcm;
  export let prerendered = false;
  /** Montrer la correction, que la question ait été validée ou non. */
  export let reveal = false;
  /** Autoriser la validation (désactivée en mode élève sans solution). */
  export let allowCheck = true;
  /** Aperçu statique : réponses lisibles, sans case ni bouton. */
  export let readonly = false;
  export let name = 'qcm';

  const dispatch = createEventDispatcher();

  let selected = [];
  let validated = false;

  $: single = isSingleChoice(qcm);
  $: corrected = validated || reveal;
  $: correct = validated && isCorrectSelection(qcm.choices, selected);
  $: marks = !corrected
    ? null
    : validated
      ? choiceMarks(qcm.choices, selected)
      : qcm.choices.map((choice) => (choice.correct ? 'correct' : ''));
  $: canValidate = qcm.type === 'zerotoall' || selected.length > 0;

  function validate() {
    validated = true;
    dispatch('validated', { correct: isCorrectSelection(qcm.choices, selected), selected });
  }

  function retry() {
    validated = false;
    selected = [];
  }
</script>

<div class="qcm-question">
  <div class="qcm-stem">
    <MathRenderer content={qcm.stem_html} {prerendered} />
  </div>

  {#if !readonly}
    <p class="qcm-instruction">{instructionFor(qcm)}</p>
  {/if}

  <QcmChoices
    choices={qcm.choices}
    bind:selected
    {single}
    {marks}
    {prerendered}
    {name}
    {readonly}
    disabled={corrected}
  />

  {#if !readonly}
    <div class="qcm-actions">
      {#if !corrected && allowCheck}
        <button type="button" class="qcm-btn qcm-btn--primary" disabled={!canValidate} on:click={validate}>
          Valider
        </button>
      {:else if validated}
        <p class="qcm-verdict" class:qcm-verdict--good={correct} class:qcm-verdict--bad={!correct} role="status">
          {correct ? '✓ Bonne réponse' : '✗ Réponse inexacte ou incomplète'}
        </p>
        <button type="button" class="qcm-btn" on:click={retry}>Recommencer</button>
      {/if}
    </div>
  {/if}

  {#if corrected && qcm.explanation_html}
    <div class="qcm-explanation">
      <p class="qcm-explanation-title">Explications</p>
      <MathRenderer content={qcm.explanation_html} {prerendered} />
    </div>
  {/if}
</div>

<style>
  .qcm-question {
    min-width: 0;
  }

  .qcm-stem {
    color: #1f2937;
    line-height: 1.6;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 0.2rem;
  }

  .qcm-stem :global(.qcm-figure) {
    margin: 0.75rem 0;
    text-align: center;
  }

  .qcm-stem :global(.qcm-figure img) {
    max-width: 100%;
    height: auto;
    display: inline-block;
  }

  .qcm-instruction {
    margin: 0.6rem 0 0;
    font-size: 0.85rem;
    color: #4b5563;
  }

  .qcm-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.85rem;
  }

  .qcm-btn {
    padding: 0.5rem 1.1rem;
    border-radius: 0.5rem;
    border: 1.5px solid #d1d5db;
    background: #fff;
    font-weight: 600;
    font-size: 0.9rem;
    color: #374151;
    cursor: pointer;
  }

  .qcm-btn:hover {
    border-color: #9ca3af;
  }

  .qcm-btn--primary {
    background: var(--color-brand-600);
    border-color: var(--color-brand-600);
    color: #fff;
  }

  .qcm-btn--primary:hover:not(:disabled) {
    background: var(--color-brand-700);
    border-color: var(--color-brand-700);
  }

  .qcm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .qcm-verdict {
    margin: 0;
    font-weight: 700;
  }

  .qcm-verdict--good {
    color: #15803d;
  }

  .qcm-verdict--bad {
    color: #b91c1c;
  }

  .qcm-explanation {
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    border-left: 4px solid #4ade80;
    background: #f0fdf4;
    border-radius: 0 0.5rem 0.5rem 0;
    color: #374151;
    line-height: 1.6;
    overflow-x: auto;
  }

  .qcm-explanation-title {
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #15803d;
  }
</style>
