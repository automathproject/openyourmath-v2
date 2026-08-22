<!--
  RevisionPanel — répercute une modification décrite en langage naturel sur
  l'ensemble de l'exercice (mode 'revise' de /api/create/assist), avec
  prévisualisation des changements avant application.
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {string} revisionInstruction
   * @property {boolean} busy
   * @property {{blocks: Array} | null} proposal
   * @property {Array<{before: Object|undefined, after: Object, index: number}>} changes
   * @property {() => void} onRequest
   * @property {() => void} onApply
   * @property {() => void} onCancel
   */
  /** @type {Props} */
  let {
    revisionInstruction = $bindable(''),
    busy,
    proposal,
    changes,
    onRequest,
    onApply,
    onCancel,
  } = $props();
</script>

<section class="editor-revision-panel" aria-label="Répercuter une modification">
  <div>
    <p class="editor-revision-title">↻ Répercuter une modification</p>
    <p class="editor-revision-hint">Ex. « remplacer $a=2$ par $a=3$ et recalculer les résultats dans les questions et solutions ».</p>
  </div>
  {#if !proposal}
    <div class="editor-revision-row">
      <input
        type="text"
        bind:value={revisionInstruction}
        placeholder="Décrivez le changement à appliquer à l'ensemble de l'exercice"
        onkeydown={(event) => event.key === 'Enter' && onRequest()}
      />
      <button type="button" class="editor-btn-secondary" disabled={busy} onclick={onRequest}>
        {busy ? 'Analyse…' : 'Prévisualiser'}
      </button>
    </div>
  {:else}
    <div class="revision-preview">
      <p><strong>Proposition prête :</strong> {changes.length} bloc{changes.length > 1 ? 's' : ''} {changes.length > 1 ? 'seront modifiés' : 'sera modifié'}.</p>
      <details>
        <summary>Voir les changements</summary>
        {#each changes as change (change.index)}
          <div class="revision-change">
            <strong>Bloc {change.index + 1} · {change.after.type}</strong>
            <del>{change.before?.latex || 'Nouveau bloc'}</del>
            <ins>{change.after.latex}</ins>
          </div>
        {/each}
      </details>
      <div class="revision-preview-actions">
        <button type="button" class="editor-btn-secondary" onclick={onCancel}>Annuler</button>
        <button type="button" class="editor-btn-primary" onclick={onApply}>Appliquer les changements</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .editor-revision-panel {
    @apply border border-violet-200 bg-violet-50 rounded-xl px-4 py-3 flex flex-col gap-2;
    order: 1;
  }

  .editor-revision-title {
    @apply text-sm font-semibold text-violet-900 m-0;
  }

  .editor-revision-hint {
    @apply text-xs text-violet-700 m-0 mt-0.5;
  }

  .editor-revision-row {
    @apply flex gap-2;
  }

  .editor-revision-row input {
    @apply flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-violet-200 bg-white text-sm
           focus:outline-none focus:ring-2 focus:ring-violet-300;
  }

  .revision-preview {
    @apply text-sm text-violet-900;
  }

  .revision-preview p { @apply m-0; }
  .revision-preview details { @apply mt-2; }
  .revision-preview summary { @apply cursor-pointer text-xs font-medium text-violet-700; }

  .revision-change {
    @apply mt-2 p-2 rounded-md bg-white border border-violet-100 text-xs;
  }

  .revision-change strong,
  .revision-change del,
  .revision-change ins { @apply block; }
  .revision-change del { @apply mt-1 text-red-700 no-underline line-through; }
  .revision-change ins { @apply mt-1 text-green-800 no-underline; }

  .revision-preview-actions { @apply flex justify-end gap-2 mt-3; }

  .editor-btn-primary {
    @apply px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium
           hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .editor-btn-secondary {
    @apply px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm font-medium
           hover:bg-gray-50 transition-colors;
  }

  @media (max-width: 640px) {
    .editor-revision-row { @apply flex-col; }
  }
</style>
