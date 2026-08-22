<!--
  AiSequencePanel — point de départ de l'assistant IA : décrit l'exercice
  souhaité et génère une séquence de questions progressives en fin
  d'exercice (mode 'sequence' de /api/create/assist).
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {Object} meta
   * @property {string} aiInstruction
   * @property {number} aiQuestionCount
   * @property {string|null} aiBusyBlockId — id du bloc IA occupé, '__new__' pour cette action, ou null
   * @property {() => void} onGenerate
   */
  /** @type {Props} */
  let {
    meta,
    aiInstruction = $bindable(''),
    aiQuestionCount = $bindable(3),
    aiBusyBlockId,
    onGenerate,
  } = $props();
</script>

<div class="editor-ai-panel">
  <div class="editor-ai-heading">
    <div>
      <p class="editor-ai-kicker">Point de départ</p>
      <p class="editor-ai-title">✨ Composer une séquence d'exercice <span class="editor-ai-model">Albert · gpt-oss-120b</span></p>
    </div>
    <span class="editor-ai-badge">Assistant principal</span>
  </div>
  <div class="editor-ai-parameters">
    <label>
      <span>Niveau</span>
      <input type="text" bind:value={meta.level} list="create-levels" placeholder="L1, L2…" />
    </label>
    <label>
      <span>Difficulté</span>
      <select bind:value={meta.difficulty}>
        <option value="">À définir</option>
        {#each [1, 2, 3, 4, 5] as d}
          <option value={String(d)}>{d}/5</option>
        {/each}
      </select>
    </label>
  </div>
  <div class="editor-ai-row">
    <textarea
      bind:value={aiInstruction}
      placeholder="Décrivez l'exercice : notions, objectif pédagogique, contraintes…"
      rows="3"
    ></textarea>
    <div class="editor-ai-generate">
      <label><span>Questions</span><input type="number" min="1" max="8" bind:value={aiQuestionCount} /></label>
      <button type="button" class="editor-btn-primary" disabled={aiBusyBlockId !== null} onclick={onGenerate}>
        {aiBusyBlockId === '__new__' ? 'Génération…' : `Générer ${aiQuestionCount} questions`}
      </button>
    </div>
  </div>
  <p class="editor-ai-hint">
    L'assistant propose une progression cohérente à partir de tout l'exercice. Les retouches locales viennent ensuite.
  </p>
</div>

<style>
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
    @apply flex items-end gap-3 mb-3;
  }

  .editor-ai-parameters label {
    @apply flex flex-col gap-0.5 text-xs font-medium text-brand-800;
  }

  .editor-ai-parameters input,
  .editor-ai-parameters select {
    @apply min-w-28 px-2 py-1.5 rounded-md border border-brand-200 bg-white text-sm text-gray-800
           focus:outline-none focus:ring-2 focus:ring-brand-300;
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

  @media (max-width: 640px) {
    .editor-ai-row { @apply flex-col; }
    .editor-ai-generate { @apply flex-row items-center; }
    .editor-ai-parameters { @apply flex-wrap; }
  }
</style>
