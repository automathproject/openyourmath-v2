<!--
  BlockAddRow — rangée intercalée après le dernier bloc d'un groupe question
  (la question elle-même, ou sa dernière indication/solution) : ajout d'une
  indication/solution générée par l'IA ou vide (édition manuelle).
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {Object} questionBlock
   * @property {string|null} aiBusyBlockId
   * @property {string|null} aiBusyKind
   * @property {(questionBlock: Object) => void} onGenerateIndication
   * @property {(questionBlock: Object) => void} onGenerateSolution
   * @property {(questionBlock: Object) => void} onAddIndication
   * @property {(questionBlock: Object) => void} onAddSolution
   */
  /** @type {Props} */
  let {
    questionBlock,
    aiBusyBlockId,
    aiBusyKind,
    onGenerateIndication,
    onGenerateSolution,
    onAddIndication,
    onAddSolution,
  } = $props();
</script>

<div class="block-add-row">
  <button
    type="button"
    class="btn-add"
    title="Générer une indication (IA)"
    disabled={aiBusyBlockId !== null}
    onclick={() => onGenerateIndication(questionBlock)}
  >{aiBusyBlockId === questionBlock.id && aiBusyKind === 'indication' ? '💡 …' : '💡 Indication (IA)'}</button>
  <button
    type="button"
    class="btn-add"
    title="Générer une solution (IA)"
    disabled={aiBusyBlockId !== null}
    onclick={() => onGenerateSolution(questionBlock)}
  >{aiBusyBlockId === questionBlock.id && aiBusyKind === 'reponse' ? '✅ …' : '✅ Solution (IA)'}</button>
  <button type="button" class="btn-add" onclick={() => onAddIndication(questionBlock)}>+💡 Indication</button>
  <button type="button" class="btn-add" onclick={() => onAddSolution(questionBlock)}>+✅ Solution</button>
</div>

<style>
  .block-add-row {
    @apply flex items-center gap-2 -mt-1 pl-2;
  }

  .btn-add {
    @apply px-2.5 py-1 rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-600
           hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style>
