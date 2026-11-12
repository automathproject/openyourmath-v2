<!-- src/lib/components/qcm/QcmChoices.svelte
     Réponses d'une question de qcm : cases à cocher (ou boutons radio), avec,
     une fois la correction montrée, l'état de chaque réponse. Sans logique de
     jeu : la page de qcm comme la session en direct s'en servent. -->
<script>
  import { createEventDispatcher } from 'svelte';
  import MathRenderer from '../MathRenderer.svelte';
  import { choiceLetter } from '$lib/qcm/source.js';

  /** @type {Array<{ html: string, feedback_html?: string }>} */
  export let choices = [];
  /** Rangs cochés. */
  export let selected = [];
  /** Une seule réponse possible : boutons radio. */
  export let single = false;
  export let disabled = false;
  /** État par réponse après correction : 'good' | 'bad' | 'missed' | 'correct' | ''. */
  export let marks = null;
  /** Nombre de participants par réponse (session en direct, côté enseignant). */
  export let counts = null;
  export let total = 0;
  export let prerendered = false;
  /** Nom du groupe de boutons radio : unique par question. */
  export let name = 'qcm';
  /** Affichage sans case, pour la projection et les aperçus. */
  export let readonly = false;

  const dispatch = createEventDispatcher();

  function toggle(index) {
    if (disabled || readonly) return;
    let next;
    if (single) next = [index];
    else next = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index].sort((a, b) => a - b);
    selected = next;
    dispatch('change', { selected: next });
  }

  const MARK_LABELS = {
    good: 'Juste, et cochée',
    bad: 'Fausse, cochée à tort',
    missed: 'Juste, mais non cochée',
    correct: 'Réponse juste',
  };

  $: percent = (index) => (total > 0 && counts ? Math.round((100 * (counts[index] || 0)) / total) : 0);
</script>

<ul class="qcm-choices" class:qcm-choices--marked={Boolean(marks)}>
  {#each choices as choice, index}
    {@const mark = marks?.[index] || ''}
    <li>
      <label
        class="qcm-choice"
        class:qcm-choice--selected={selected.includes(index)}
        class:qcm-choice--good={mark === 'good' || mark === 'correct'}
        class:qcm-choice--bad={mark === 'bad'}
        class:qcm-choice--missed={mark === 'missed'}
        class:qcm-choice--static={disabled || readonly}
      >
        {#if counts}
          <span class="qcm-choice-bar" style="width: {percent(index)}%" aria-hidden="true"></span>
        {/if}
        {#if !readonly}
          <input
            type={single ? 'radio' : 'checkbox'}
            {name}
            checked={selected.includes(index)}
            {disabled}
            on:change={() => toggle(index)}
          />
        {/if}
        <span class="qcm-choice-letter">{choiceLetter(index)}</span>
        <span class="qcm-choice-text">
          <MathRenderer content={choice.html} inline {prerendered} />
          {#if marks && choice.feedback_html && (selected.includes(index) || mark)}
            <span class="qcm-choice-feedback"><MathRenderer content={choice.feedback_html} inline {prerendered} /></span>
          {/if}
        </span>
        {#if mark}
          <span class="qcm-choice-mark" title={MARK_LABELS[mark]}>
            {mark === 'bad' ? '✗' : '✓'}
            <span class="sr-only">{MARK_LABELS[mark]}</span>
          </span>
        {/if}
        {#if counts}
          <span class="qcm-choice-count" title="{counts[index] || 0} réponse(s)">{counts[index] || 0} · {percent(index)} %</span>
        {/if}
      </label>
    </li>
  {/each}
</ul>

<style>
  .qcm-choices {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .qcm-choice {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.65rem 0.8rem;
    border: 1.5px solid #d1d5db;
    border-radius: 0.6rem;
    background: #fff;
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.15s, background-color 0.15s;
    /* Une formule large défile dans sa réponse au lieu d'élargir la page. */
    min-width: 0;
  }

  .qcm-choice:hover:not(.qcm-choice--static) {
    border-color: var(--color-brand-500);
  }

  .qcm-choice--static {
    cursor: default;
  }

  .qcm-choice--selected {
    border-color: var(--color-brand-600);
    background: var(--color-brand-50);
  }

  .qcm-choice:focus-within {
    outline: 2px solid var(--color-brand-500);
    outline-offset: 1px;
  }

  .qcm-choice input {
    flex-shrink: 0;
    width: 1.15rem;
    height: 1.15rem;
    margin-top: 0.2rem;
    accent-color: var(--color-brand-600);
  }

  .qcm-choice-letter {
    position: relative;
    flex-shrink: 0;
    font-weight: 700;
    color: var(--color-brand-700);
    min-width: 1.1rem;
  }

  .qcm-choice-text {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 0.2rem;
    color: #1f2937;
  }

  .qcm-choice-feedback {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.9em;
    font-style: italic;
    color: #4b5563;
  }

  .qcm-choice-mark {
    position: relative;
    flex-shrink: 0;
    font-weight: 800;
    font-size: 1.05rem;
    line-height: 1.5;
  }

  .qcm-choice--good {
    border-color: #15803d;
    background: #f0fdf4;
  }

  .qcm-choice--good .qcm-choice-mark {
    color: #15803d;
  }

  .qcm-choice--bad {
    border-color: #b91c1c;
    background: #fef2f2;
  }

  .qcm-choice--bad .qcm-choice-mark {
    color: #b91c1c;
  }

  /* Juste mais oubliée : bordure en pointillés, pour la distinguer sans la couleur seule. */
  .qcm-choice--missed {
    border-color: #15803d;
    border-style: dashed;
    background: #fff;
  }

  .qcm-choice--missed .qcm-choice-mark {
    color: #15803d;
    opacity: 0.75;
  }

  .qcm-choice-bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: rgba(73, 178, 178, 0.18);
    transition: width 0.4s ease;
    pointer-events: none;
  }

  .qcm-choice--good .qcm-choice-bar {
    background: rgba(21, 128, 61, 0.16);
  }

  .qcm-choice-count {
    position: relative;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
    line-height: 1.7;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
