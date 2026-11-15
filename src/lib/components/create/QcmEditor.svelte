<!--
  QcmEditor — édition d'un qcm dans /create : panneau de génération IA
  (question complète), énoncé commun, puis une carte par question avec ses
  réponses à cocher, ses commentaires par réponse et ses explications.

  `draft` est l'état du parent ({ context, questions }), muté en place. Les
  appels IA restent dans la page : ce composant ne fait que les demander.
-->

<script>
  import { autoResize } from '$lib/actions/autoResize.js';
  import { choiceLetter } from '$lib/qcm/source.js';
  import {
    QCM_EDITOR_TYPES,
    newQcmChoice,
    newQcmQuestion,
    qcmIssues,
    qcmHasContent,
    shuffledChoices,
  } from '$lib/qcm/editor.js';

  /**
   * @typedef {Object} Props
   * @property {{ context: string, questions: Array }} draft
   * @property {Object} meta
   * @property {string} instruction — brief de la génération IA
   * @property {number} questionCount
   * @property {number} answerCount
   * @property {string} generatedType — type des questions générées
   * @property {string|null} aiBusyBlockId — id de la question occupée, '__new__' pour la génération, ou null
   * @property {string|null} aiBusyKind
   * @property {() => void} onGenerate
   * @property {(question: Object, options: { count: number, instruction: string }) => void} onDistractors
   * @property {(event: FocusEvent, write: (value: string) => void) => void} onFocus
   */
  /** @type {Props} */
  let {
    draft = $bindable(),
    meta,
    instruction = $bindable(''),
    questionCount = $bindable(1),
    answerCount = $bindable(4),
    generatedType = $bindable('onlyone'),
    aiBusyBlockId,
    aiBusyKind,
    onGenerate,
    onDistractors,
    onFocus,
  } = $props();

  // Réglages de la demande de distracteurs, par question.
  let distractorCount = $state({});
  let distractorHint = $state({});

  let issues = $derived(qcmHasContent(draft) ? qcmIssues(draft, meta) : []);

  const isSingle = (question) => question.type === 'onlyone' || question.type === 'truefalse';

  function setType(question, type) {
    question.type = type;
    if (type === 'truefalse' && question.choices.every((choice) => !choice.latex.trim())) {
      question.choices = [newQcmChoice({ latex: 'Vrai', correct: true }), newQcmChoice({ latex: 'Faux' })];
    }
    if (isSingle(question)) {
      // Une seule réponse juste : on garde la première cochée.
      let kept = false;
      for (const choice of question.choices) {
        if (choice.correct && kept) choice.correct = false;
        kept ||= choice.correct;
      }
    }
  }

  function toggleCorrect(question, choice) {
    if (isSingle(question)) {
      for (const other of question.choices) other.correct = other === choice;
    } else {
      choice.correct = !choice.correct;
    }
  }

  function move(list, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
  }

  function removeQuestion(index) {
    draft.questions.splice(index, 1);
    if (draft.questions.length === 0) draft.questions.push(newQcmQuestion());
  }
</script>

<div class="editor-ai-panel">
  <div class="editor-ai-heading">
    <div>
      <p class="editor-ai-kicker">Point de départ</p>
      <p class="editor-ai-title">✨ Composer une question de QCM <span class="editor-ai-model">Albert · gpt-oss-120b</span></p>
    </div>
    <span class="editor-ai-badge">Assistant principal</span>
  </div>
  <div class="editor-ai-parameters">
    <label>
      <span>Niveau</span>
      <input type="text" bind:value={meta.level} list="create-levels" placeholder="L1, L2…" />
    </label>
    <label>
      <span>Réponses justes</span>
      <select bind:value={generatedType}>
        <option value="onlyone">Une seule</option>
        <option value="onetoall">Une ou plusieurs</option>
      </select>
    </label>
    <label>
      <span>Réponses</span>
      <input class="is-narrow" type="number" min="3" max="6" bind:value={answerCount} />
    </label>
  </div>
  <div class="editor-ai-row">
    <textarea
      bind:value={instruction}
      placeholder="Décrivez la question : notion évaluée, type de calcul ou de raisonnement, erreurs à repérer…"
      rows="3"
    ></textarea>
    <div class="editor-ai-generate">
      <label><span>Questions</span><input type="number" min="1" max="8" bind:value={questionCount} /></label>
      <button type="button" class="editor-btn-primary" disabled={aiBusyBlockId !== null} onclick={onGenerate}>
        {aiBusyBlockId === '__new__' ? 'Génération…' : `Générer ${questionCount > 1 ? `${questionCount} questions` : 'la question'}`}
      </button>
    </div>
  </div>
  <p class="editor-ai-hint">
    Chaque réponse fausse est construite à partir d'une erreur d'étudiant, indiquée sous la réponse : relisez-les avant de publier.
    Un fichier porte une question indépendante ; plusieurs questions forment une série ordonnée.
  </p>
</div>

<div class="qcm-editor">
  <div class="qcm-card qcm-card--context">
    <label class="qcm-label" for="qcm-context">Énoncé commun <span>facultatif — contexte partagé par les questions d'une série</span></label>
    <textarea
      id="qcm-context"
      class="qcm-input"
      rows="2"
      spellcheck="false"
      placeholder="Mise en situation, notations, convention…"
      bind:value={draft.context}
      use:autoResize
      onfocus={(e) => onFocus(e, (value) => (draft.context = value))}
    ></textarea>
  </div>

  {#each draft.questions as question, qIndex (question.id)}
    {@const busyHere = aiBusyBlockId === question.id && aiBusyKind === 'distractors'}
    <div class="qcm-card qcm-card--question">
      <div class="qcm-card-head">
        <div class="qcm-card-title">
          <span class="qcm-rank">Question {qIndex + 1}</span>
          <select
            class="qcm-type"
            value={question.type}
            aria-label="Type de la question"
            onchange={(e) => setType(question, e.target.value)}
          >
            {#each QCM_EDITOR_TYPES as entry}
              <option value={entry.type}>{entry.label}</option>
            {/each}
          </select>
        </div>
        <div class="qcm-actions">
          <button type="button" class="block-btn" title="Monter" disabled={qIndex === 0} onclick={() => move(draft.questions, qIndex, -1)}>↑</button>
          <button type="button" class="block-btn" title="Descendre" disabled={qIndex === draft.questions.length - 1} onclick={() => move(draft.questions, qIndex, 1)}>↓</button>
          <button type="button" class="block-btn block-btn--danger" title="Supprimer cette question" onclick={() => removeQuestion(qIndex)}>✕</button>
        </div>
      </div>

      <textarea
        id="qcm-stem-{question.id}"
        class="qcm-input"
        rows="2"
        spellcheck="false"
        placeholder="Énoncé de la question (LaTeX, math entre $…$)"
        aria-label="Énoncé de la question {qIndex + 1}"
        bind:value={question.stem}
        use:autoResize
        onfocus={(e) => onFocus(e, (value) => (question.stem = value))}
      ></textarea>

      <div class="qcm-choices-head">
        <span class="qcm-label">Réponses</span>
        <button
          type="button"
          class="btn-link"
          title="Mélanger les réponses : la réponse juste ne doit pas toujours être la première"
          onclick={() => (question.choices = shuffledChoices(question))}
        >🔀 Mélanger</button>
      </div>

      <ul class="qcm-choices">
        {#each question.choices as choice, cIndex (choice.id)}
          <li class="qcm-choice" class:qcm-choice--good={choice.correct}>
            <button
              type="button"
              class="qcm-mark"
              class:qcm-mark--good={choice.correct}
              aria-pressed={choice.correct}
              title={choice.correct ? 'Réponse juste (cliquer pour la marquer fausse)' : 'Réponse fausse (cliquer pour la marquer juste)'}
              onclick={() => toggleCorrect(question, choice)}
            >{choice.correct ? '✓' : '✗'} {choiceLetter(cIndex)}</button>
            <div class="qcm-choice-body">
              <textarea
                class="qcm-input qcm-input--choice"
                rows="1"
                spellcheck="false"
                placeholder={choice.correct ? 'Réponse juste' : 'Réponse fausse (distracteur)'}
                aria-label="Réponse {choiceLetter(cIndex)}"
                bind:value={choice.latex}
                use:autoResize
                onfocus={(e) => onFocus(e, (value) => (choice.latex = value))}
              ></textarea>
              {#if choice.note}
                <p class="qcm-note">
                  <span><strong>Erreur visée :</strong> {choice.note}</span>
                  <button type="button" class="btn-link" title="Masquer cette note (elle n'est pas exportée)" onclick={() => (choice.note = '')}>masquer</button>
                </p>
              {/if}
              <textarea
                class="qcm-feedback"
                rows="1"
                spellcheck="false"
                placeholder="Commentaire affiché à la correction si l'étudiant coche cette réponse (facultatif)"
                aria-label="Commentaire de la réponse {choiceLetter(cIndex)}"
                bind:value={choice.feedback}
                use:autoResize
                onfocus={(e) => onFocus(e, (value) => (choice.feedback = value))}
              ></textarea>
            </div>
            <div class="qcm-actions">
              <button type="button" class="block-btn" title="Monter" disabled={cIndex === 0} onclick={() => move(question.choices, cIndex, -1)}>↑</button>
              <button type="button" class="block-btn" title="Descendre" disabled={cIndex === question.choices.length - 1} onclick={() => move(question.choices, cIndex, 1)}>↓</button>
              <button type="button" class="block-btn block-btn--danger" title="Supprimer cette réponse" onclick={() => question.choices.splice(cIndex, 1)}>✕</button>
            </div>
          </li>
        {/each}
      </ul>

      <div class="qcm-choices-add">
        <button type="button" class="btn-add" onclick={() => question.choices.push(newQcmChoice())}>+ Réponse</button>
        <span class="qcm-distractors">
          <button
            type="button"
            class="btn-add btn-add--ai"
            title="Proposer des réponses fausses construites sur des erreurs d'étudiants (IA)"
            disabled={aiBusyBlockId !== null || !question.stem.trim()}
            onclick={() => onDistractors(question, {
              count: distractorCount[question.id] ?? 3,
              instruction: distractorHint[question.id] ?? '',
            })}
          >{busyHere ? '✨ Recherche des erreurs…' : '✨ Distracteurs (IA)'}</button>
          <select
            aria-label="Nombre de distracteurs"
            value={distractorCount[question.id] ?? 3}
            onchange={(e) => (distractorCount[question.id] = Number(e.target.value))}
          >
            {#each [1, 2, 3, 4, 5] as n}
              <option value={n}>{n}</option>
            {/each}
          </select>
          <input
            type="text"
            placeholder="Erreur à viser (facultatif)"
            aria-label="Erreur à viser par les distracteurs"
            value={distractorHint[question.id] ?? ''}
            oninput={(e) => (distractorHint[question.id] = e.target.value)}
          />
        </span>
      </div>

      <label class="qcm-label" for="qcm-expl-{question.id}">Explications <span>correction affichée après validation</span></label>
      <textarea
        id="qcm-expl-{question.id}"
        class="qcm-input"
        rows="2"
        spellcheck="false"
        placeholder="Correction rédigée de la question"
        bind:value={question.explanation}
        use:autoResize
        onfocus={(e) => onFocus(e, (value) => (question.explanation = value))}
      ></textarea>
    </div>
  {/each}

  <div class="qcm-add-row">
    <button type="button" class="btn-add" onclick={() => draft.questions.push(newQcmQuestion())}>+ Question</button>
    {#if draft.questions.length > 1}
      <span>Plusieurs questions : le fichier sera une série ordonnée, jouée dans cet ordre.</span>
    {/if}
  </div>

  {#if issues.length}
    <div class="qcm-issues" role="status">
      <p>À corriger avant publication</p>
      <ul>
        {#each issues as issue}
          <li>{issue}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  @reference "../../../app.css";

  /* Panneau IA : mêmes repères visuels que AiSequencePanel. */
  .editor-ai-panel {
    @apply border-2 border-brand-300 bg-brand-50 rounded-xl px-4 py-4 shadow-sm;
    order: 1;
  }

  .editor-ai-heading {
    @apply flex items-start justify-between gap-3 mb-3;
  }

  .editor-ai-kicker {
    @apply uppercase tracking-wider text-[10px] font-bold text-brand-600 m-0 mb-0.5;
  }

  .editor-ai-badge {
    @apply rounded-full px-2 py-1 text-[10px] font-semibold text-brand-700 bg-white border border-brand-200 whitespace-nowrap;
  }

  .editor-ai-title {
    @apply text-base font-semibold text-brand-800 m-0;
  }

  .editor-ai-model {
    @apply text-[0.65rem] font-normal text-brand-600 ml-1;
  }

  .editor-ai-parameters {
    @apply flex items-end gap-3 mb-3 flex-wrap;
  }

  .editor-ai-parameters label {
    @apply flex flex-col gap-0.5 text-xs font-medium text-brand-800;
  }

  .editor-ai-parameters input,
  .editor-ai-parameters select {
    @apply min-w-28 px-2 py-1.5 rounded-md border border-brand-200 bg-white text-sm text-gray-800
           focus:outline-none focus:ring-2 focus:ring-brand-300;
  }

  .editor-ai-parameters input.is-narrow {
    @apply min-w-0 w-16;
  }

  .editor-ai-row {
    @apply flex gap-3 items-stretch;
  }

  .editor-ai-row textarea {
    @apply flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-brand-200 text-sm
           focus:outline-none focus:ring-2 focus:ring-brand-300 resize-y;
  }

  .editor-ai-generate {
    @apply flex flex-col justify-between gap-2 min-w-36;
  }

  .editor-ai-generate label {
    @apply flex items-center justify-between gap-2 text-xs font-medium text-brand-800;
  }

  .editor-ai-generate input {
    @apply w-14 px-2 py-1 rounded-md border border-brand-200 bg-white text-sm text-gray-800;
  }

  .editor-ai-hint {
    @apply text-xs text-brand-700 m-0 mt-2;
  }

  .editor-btn-primary {
    @apply px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium
           hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  /* Cartes */
  .qcm-editor {
    @apply flex flex-col gap-2.5;
    order: 5;
  }

  .qcm-card {
    @apply border rounded-lg bg-white border-gray-200 px-3 py-2.5 flex flex-col gap-2;
    border-left-width: 4px;
  }

  .qcm-card--context { border-left-color: var(--color-gray-300); }
  .qcm-card--question { border-left-color: var(--color-brand-400); }

  .qcm-card-head,
  .qcm-choices-head {
    @apply flex items-center justify-between gap-2;
  }

  .qcm-card-title {
    @apply flex items-center gap-2 min-w-0 flex-wrap;
  }

  .qcm-rank {
    @apply text-xs font-bold text-brand-700;
  }

  .qcm-type {
    @apply text-xs font-semibold text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-gray-50 max-w-full;
  }

  .qcm-label {
    @apply text-xs font-semibold text-gray-600;
  }

  .qcm-label span {
    @apply font-normal text-gray-400 ml-1;
  }

  .qcm-input {
    @apply w-full px-2.5 py-1.5 text-sm font-mono leading-relaxed text-gray-800 rounded-md border border-gray-200 resize-none
           focus:outline-none focus:ring-2 focus:ring-brand-200;
    min-height: 3.25rem;
  }

  .qcm-input--choice {
    min-height: 2.1rem;
  }

  .qcm-choices {
    @apply flex flex-col gap-2 list-none m-0 p-0;
  }

  .qcm-choice {
    @apply flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50 p-1.5;
  }

  .qcm-choice--good {
    @apply border-green-200 bg-green-50;
  }

  .qcm-choice-body {
    @apply flex-1 min-w-0 flex flex-col gap-1;
  }

  .qcm-mark {
    @apply shrink-0 w-12 h-8 rounded-md border border-gray-300 bg-white text-xs font-bold text-gray-500
           hover:border-gray-400 transition-colors;
  }

  .qcm-mark--good {
    @apply border-green-500 bg-green-600 text-white hover:border-green-600;
  }

  .qcm-note {
    @apply flex items-start justify-between gap-2 m-0 text-[11px] leading-snug text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1;
  }

  .qcm-feedback {
    @apply w-full px-2 py-1 text-xs leading-snug text-gray-700 rounded border border-gray-200 bg-white
           focus:outline-none focus:ring-2 focus:ring-brand-200;
    resize: none;
    min-height: 1.75rem;
  }

  .qcm-actions {
    @apply flex items-center gap-0.5 shrink-0;
  }

  .block-btn {
    @apply w-7 h-7 grid place-items-center rounded-md text-sm text-gray-500 border border-transparent
           hover:bg-gray-100 transition-colors disabled:opacity-35 disabled:cursor-not-allowed;
  }

  .block-btn--danger:hover {
    @apply bg-red-50 text-red-600;
  }

  .qcm-choices-add,
  .qcm-add-row {
    @apply flex items-center gap-2 flex-wrap text-xs text-gray-500;
  }

  .qcm-distractors {
    @apply flex items-center gap-1.5 flex-1 min-w-0;
  }

  .qcm-distractors select,
  .qcm-distractors input {
    @apply px-1.5 py-1 rounded-md border border-gray-200 bg-white text-xs text-gray-700
           focus:outline-none focus:ring-2 focus:ring-brand-200;
  }

  .qcm-distractors input {
    @apply flex-1 min-w-24;
  }

  .btn-add {
    @apply px-2.5 py-1 rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-600 whitespace-nowrap
           hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-add--ai {
    @apply border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100;
  }

  .btn-link {
    @apply text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800 whitespace-nowrap;
  }

  .qcm-issues {
    @apply text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2;
  }

  .qcm-issues p {
    @apply font-semibold m-0 mb-1;
  }

  .qcm-issues ul {
    @apply list-disc pl-4 m-0 space-y-0.5;
  }

  @media (max-width: 640px) {
    .editor-ai-row { @apply flex-col; }
    .editor-ai-generate { @apply flex-row items-center; }
    .qcm-distractors { @apply flex-wrap; }
  }
</style>
