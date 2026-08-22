<!--
  BlockCard — un bloc de l'éditeur (texte, question, indication, solution) :
  sélecteur de type, actions IA (rédaction/amélioration, correction LaTeX),
  déplacement/suppression, panneau de consigne et barre d'annulation TeX.

  `block` et `promptPanel` (quand il concerne ce bloc) sont des références
  réactives du parent : leurs champs sont mutés directement (bind:value),
  la fermeture/réassignation complète (promptPanel = null, etc.) passe par
  les callbacks fournis.
-->

<script>
  import { BLOCK_TYPES } from '$lib/latex/exerciseTex.js';
  import { SYSTEM_PROMPT, FIX_LATEX_SYSTEM_PROMPT } from '$lib/ia/assistPrompts.js';
  import { autoResize } from '$lib/actions/autoResize.js';

  /**
   * @typedef {Object} Props
   * @property {Object} block
   * @property {string|null} parentLabel — "liée à la question N", ou null
   * @property {Object|null} promptPanel — panneau ouvert (partagé, peut concerner un autre bloc)
   * @property {string|null} aiBusyBlockId
   * @property {string|null} aiBusyKind
   * @property {{blockId: string, previousLatex: string}|null} fixLatexUndo
   * @property {boolean} canMoveUp
   * @property {boolean} canMoveDown
   * @property {(block: Object, newType: string) => void} onChangeType
   * @property {(block: Object) => void} onOpenPromptPanel
   * @property {(block: Object) => void} onFixLatex
   * @property {(block: Object) => void} onUndoFixLatex
   * @property {(block: Object) => void} onOpenFixLatexPanel
   * @property {() => void} onClosePromptPanel
   * @property {() => void} onResetPromptTemplate
   * @property {(block: Object) => void} onGenerateFromPanel
   * @property {(block: Object) => void} onMoveUp
   * @property {(block: Object) => void} onMoveDown
   * @property {(block: Object) => void} onRemove
   * @property {(event: FocusEvent, blockId: string) => void} onFocus
   * @property {(block: Object) => void} onInput
   */
  /** @type {Props} */
  let {
    block,
    parentLabel,
    promptPanel,
    aiBusyBlockId,
    aiBusyKind,
    fixLatexUndo,
    canMoveUp,
    canMoveDown,
    onChangeType,
    onOpenPromptPanel,
    onFixLatex,
    onUndoFixLatex,
    onOpenFixLatexPanel,
    onClosePromptPanel,
    onResetPromptTemplate,
    onGenerateFromPanel,
    onMoveUp,
    onMoveDown,
    onRemove,
    onFocus,
    onInput,
  } = $props();

  let panelHere = $derived(promptPanel?.blockId === block.id);
</script>

<div class="editor-block editor-block--{block.type}">
  <div class="editor-block-head">
    <div class="editor-block-label">
      <select
        class="editor-block-type"
        value={block.type}
        aria-label="Type du bloc"
        onchange={(e) => onChangeType(block, e.target.value)}
      >
        {#each BLOCK_TYPES as bt}
          <option value={bt.type}>{bt.label}</option>
        {/each}
        {#if block.type === 'code'}<option value="code">Code</option>{/if}
      </select>
      {#if parentLabel}
        <span class="editor-block-parent">{parentLabel}</span>
      {/if}
    </div>

    <div class="editor-block-actions">
      <button
        type="button"
        class="block-btn block-btn--ai"
        class:block-btn--ai-open={panelHere && promptPanel?.mode === block.type}
        title={block.latex.trim()
          ? 'Améliorer ce bloc avec l’IA (voir et modifier la consigne)'
          : 'Rédiger ce bloc avec l’IA (voir et modifier la consigne)'}
        disabled={aiBusyBlockId !== null}
        onclick={() => onOpenPromptPanel(block)}
      >
        {aiBusyBlockId === block.id && aiBusyKind === block.type ? '…' : '✨'}
      </button>
      <button
        type="button"
        class="block-btn block-btn--ai block-btn--tex"
        title="Corriger la syntaxe LaTeX de ce bloc, sans changer le contenu (IA)"
        disabled={aiBusyBlockId !== null || !block.latex.trim()}
        onclick={() => onFixLatex(block)}
      >
        {aiBusyBlockId === block.id && aiBusyKind === 'fixlatex' ? '…' : 'TeX'}
      </button>
      <button type="button" class="block-btn" title="Monter" disabled={!canMoveUp} onclick={() => onMoveUp(block)}>↑</button>
      <button type="button" class="block-btn" title="Descendre" disabled={!canMoveDown} onclick={() => onMoveDown(block)}>↓</button>
      <button type="button" class="block-btn block-btn--danger" title="Supprimer ce bloc" onclick={() => onRemove(block)}>✕</button>
    </div>
  </div>

  {#if fixLatexUndo?.blockId === block.id}
    <div class="fixlatex-undo-bar">
      <span>TeX · Syntaxe LaTeX corrigée.</span>
      <button type="button" class="btn-link" onclick={() => onUndoFixLatex(block)}>↩ Revenir au texte d'origine</button>
      <button type="button" class="btn-link" onclick={() => onOpenFixLatexPanel(block)}>⚙ Résultat inattendu ? Personnaliser la consigne</button>
    </div>
  {/if}

  {#if panelHere}
    <div class="prompt-panel">
      <label class="prompt-panel-label" for="prompt-ta-{block.id}">
        Consigne envoyée à l'IA
        {#if promptPanel.mode === 'fixlatex'}
          <span class="prompt-panel-tag">correction LaTeX</span>
        {:else if promptPanel.isImprove}
          <span class="prompt-panel-tag">amélioration</span>
        {:else}
          <span class="prompt-panel-tag">rédaction</span>
        {/if}
      </label>
      <textarea
        id="prompt-ta-{block.id}"
        class="prompt-panel-input"
        rows="3"
        bind:value={promptPanel.template}
      ></textarea>

      <details class="prompt-panel-details">
        <summary>Joint automatiquement à la consigne</summary>
        <ul>
          {#if promptPanel.mode === 'fixlatex'}
            <li>Uniquement le texte de ce bloc, sans le reste de l'exercice (pour ne pas inciter le modèle à le réécrire).</li>
          {:else}
            <li>Les métadonnées et tous les blocs de l'exercice (contexte).</li>
            {#if promptPanel.targetLatex}
              <li>La question concernée : <code>{promptPanel.targetLatex.slice(0, 120)}{promptPanel.targetLatex.length > 120 ? '…' : ''}</code></li>
            {/if}
            {#if promptPanel.isImprove}
              <li>Le contenu actuel du bloc (à améliorer).</li>
            {/if}
          {/if}
        </ul>
        <p class="prompt-panel-system-title">Instructions générales du modèle (fixes) :</p>
        <pre class="prompt-panel-system">{promptPanel.mode === 'fixlatex' ? FIX_LATEX_SYSTEM_PROMPT : SYSTEM_PROMPT}</pre>
      </details>

      <div class="prompt-panel-footer">
        <label class="prompt-panel-remember">
          <input type="checkbox" bind:checked={promptPanel.remember} />
          Mémoriser comme consigne par défaut
        </label>
        <div class="prompt-panel-actions">
          <button type="button" class="btn-link" onclick={onResetPromptTemplate}>
            Consigne d'origine
          </button>
          <button type="button" class="editor-btn-secondary" onclick={onClosePromptPanel}>
            Annuler
          </button>
          <button
            type="button"
            class="editor-btn-primary"
            disabled={aiBusyBlockId !== null || !promptPanel.template.trim()}
            onclick={() => onGenerateFromPanel(block)}
          >
            {#if aiBusyBlockId === block.id}
              {promptPanel.mode === 'fixlatex' ? 'Correction…' : 'Génération…'}
            {:else}
              {promptPanel.mode === 'fixlatex' ? 'TeX · Corriger' : '✨ Générer'}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <textarea
    id="block-ta-{block.id}"
    class="editor-block-input"
    rows="3"
    spellcheck="false"
    placeholder={block.type === 'question'
      ? 'Énoncé de la question (LaTeX, math entre $…$)'
      : block.type === 'indication'
        ? 'Indication pour la question liée'
        : block.type === 'reponse'
          ? 'Solution détaillée de la question liée'
          : 'Mise en situation, définitions, notations…'}
    bind:value={block.latex}
    use:autoResize
    onfocus={(e) => onFocus(e, block.id)}
    oninput={() => onInput(block)}
  ></textarea>
</div>

<style>
  .editor-block {
    @apply border rounded-lg bg-white overflow-hidden border-gray-200;
    border-left-width: 4px;
  }

  .editor-block--text { border-left-color: theme('colors.gray.300'); }
  .editor-block--question { border-left-color: theme('colors.brand.400'); }
  .editor-block--indication { border-left-color: theme('colors.yellow.400'); }
  .editor-block--reponse { border-left-color: theme('colors.green.400'); }
  .editor-block--code { border-left-color: theme('colors.purple.400'); }

  .editor-block-head {
    @apply flex items-center justify-between gap-2 px-2 pt-2;
  }

  .editor-block-label {
    @apply flex items-center gap-2 min-w-0;
  }

  .editor-block-parent {
    @apply text-[11px] text-gray-500 whitespace-nowrap;
  }

  .editor-block-type {
    @apply text-xs font-semibold text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-gray-50;
  }

  .editor-block-actions {
    @apply flex items-center gap-1;
  }

  .block-btn {
    @apply w-7 h-7 grid place-items-center rounded-md text-sm text-gray-500 border border-transparent
           hover:bg-gray-100 transition-colors disabled:opacity-35 disabled:cursor-not-allowed;
  }

  .block-btn--ai {
    @apply border-brand-200 bg-brand-50 hover:bg-brand-100;
  }

  .block-btn--ai-open {
    @apply bg-brand-100 border-brand-400;
  }

  .block-btn--tex {
    @apply w-auto px-1.5 text-[11px] font-bold tracking-tight;
  }

  .block-btn--danger:hover {
    @apply bg-red-50 text-red-600;
  }

  .fixlatex-undo-bar {
    @apply mx-2 mt-2 px-3 py-1.5 rounded-md border border-gray-200 bg-gray-50 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600;
  }

  /* Panneau de consigne IA */
  .prompt-panel {
    @apply mx-2 mt-2 px-3 py-2.5 rounded-lg border border-brand-200 bg-brand-50 flex flex-col gap-2;
  }

  .prompt-panel-label {
    @apply flex items-center gap-2 text-xs font-semibold text-brand-800;
  }

  .prompt-panel-tag {
    @apply px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white border border-brand-200 text-brand-600;
  }

  .prompt-panel-input {
    @apply w-full px-2.5 py-2 rounded-md border border-brand-200 bg-white text-sm leading-relaxed text-gray-800
           focus:outline-none focus:ring-2 focus:ring-brand-300 resize-y;
  }

  .prompt-panel-details {
    @apply text-xs text-brand-700;
  }

  .prompt-panel-details summary {
    @apply cursor-pointer select-none font-medium;
  }

  .prompt-panel-details ul {
    @apply list-disc pl-5 mt-1 space-y-0.5;
  }

  .prompt-panel-details code {
    @apply bg-white px-1 rounded border border-brand-100 text-[11px];
  }

  .prompt-panel-system-title {
    @apply mt-2 mb-1 font-medium;
  }

  .prompt-panel-system {
    @apply text-[11px] leading-relaxed bg-white border border-brand-100 rounded-md p-2 whitespace-pre-wrap max-h-44 overflow-y-auto text-gray-600;
  }

  .prompt-panel-footer {
    @apply flex items-center justify-between gap-2 flex-wrap;
  }

  .prompt-panel-remember {
    @apply flex items-center gap-1.5 text-xs text-brand-800 cursor-pointer;
  }

  .prompt-panel-actions {
    @apply flex items-center gap-2;
  }

  .editor-block-input {
    @apply w-full px-3 py-2 text-sm font-mono leading-relaxed text-gray-800 border-0 resize-none
           focus:outline-none focus:ring-0;
    min-height: 4.5rem;
  }

  .editor-btn-primary {
    @apply px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium
           hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .editor-btn-secondary {
    @apply px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm font-medium
           hover:bg-gray-50 transition-colors;
  }

  .btn-link {
    @apply text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800;
  }
</style>
