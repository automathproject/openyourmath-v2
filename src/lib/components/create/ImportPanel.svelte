<!--
  ImportPanel — import d'un exercice existant (PDF, image, .tex), choix des
  exercices détectés à conserver comme brouillons, et liste des brouillons
  importés déjà enregistrés localement.
-->

<script>
  import ImportDropzone from './ImportDropzone.svelte';

  /**
   * @typedef {Object} Props
   * @property {boolean} show
   * @property {string} notice
   * @property {Array<Object>} candidates — mutés en place (candidate.selected)
   * @property {Array<Object>} importedDrafts
   * @property {string|null} activeImportedDraftId
   * @property {(texSources: string[], sourceLabel: string) => void} onImported
   * @property {() => void} onCancelCandidates
   * @property {() => void} onSaveSelected
   * @property {(draft: Object) => void} onOpenDraft
   * @property {(id: string) => void} onDeleteDraft
   */
  /** @type {Props} */
  let {
    show,
    notice,
    candidates,
    importedDrafts,
    activeImportedDraftId,
    onImported,
    onCancelCandidates,
    onSaveSelected,
    onOpenDraft,
    onDeleteDraft,
  } = $props();
</script>

{#if show}
  <div class="create-import">
    <ImportDropzone onimported={onImported} />
  </div>
{/if}
{#if notice}
  <p class="create-import-notice">{notice}</p>
{/if}
{#if candidates.length}
  <section class="import-candidates" aria-label="Exercices détectés">
    <div>
      <h2>Exercices détectés</h2>
      <p>Sélectionnez les exercices à enregistrer comme brouillons distincts.</p>
    </div>
    <div class="import-candidates-list">
      {#each candidates as candidate, index (candidate.id)}
        <label class="import-candidate">
          <input type="checkbox" bind:checked={candidate.selected} />
          <span>
            <strong>Exercice {index + 1}</strong>
            <span>{candidate.label}</span>
            <small>{candidate.blocks.filter((block) => block.type === 'question').length} question{candidate.blocks.filter((block) => block.type === 'question').length > 1 ? 's' : ''}</small>
          </span>
        </label>
      {/each}
    </div>
    <div class="import-candidates-actions">
      <button type="button" class="editor-btn-secondary" onclick={onCancelCandidates}>Annuler</button>
      <button type="button" class="editor-btn-primary" onclick={onSaveSelected}>Enregistrer la sélection</button>
    </div>
  </section>
{/if}
{#if importedDrafts.length}
  <details class="imported-drafts">
    <summary>Brouillons importés ({importedDrafts.length})</summary>
    <div class="imported-drafts-list">
      {#each importedDrafts as draft (draft.id)}
        <div class="imported-draft" class:imported-draft--active={draft.id === activeImportedDraftId}>
          <span>
            {draft.label}
            {#if draft.id === activeImportedDraftId}<small class="imported-draft-active">Ouvert</small>{/if}
          </span>
          <div>
            <button type="button" class="btn-link" onclick={() => onOpenDraft(draft)}>Ouvrir</button>
            <button type="button" class="btn-link imported-draft-delete" onclick={() => onDeleteDraft(draft.id)}>Supprimer</button>
          </div>
        </div>
      {/each}
    </div>
  </details>
{/if}

<style>
  .create-import {
    @apply mb-3;
  }

  .create-import-notice {
    @apply text-sm text-gray-600 mb-3;
  }

  .import-candidates {
    @apply border border-brand-200 bg-brand-50 rounded-xl p-4 mb-3;
  }

  .import-candidates h2 {
    @apply text-base font-semibold text-brand-900 m-0;
  }

  .import-candidates p {
    @apply text-sm text-brand-700 mt-1 mb-3;
  }

  .import-candidates-list {
    @apply flex flex-col gap-2;
  }

  .import-candidate {
    @apply flex gap-2.5 items-start p-2.5 rounded-lg bg-white border border-brand-100 cursor-pointer;
  }

  .import-candidate input { @apply mt-1; }
  .import-candidate span > span,
  .import-candidate small { @apply block text-xs text-gray-500 mt-0.5; }
  .import-candidate strong { @apply text-sm text-gray-800; }

  .import-candidates-actions {
    @apply flex justify-end gap-2 mt-3;
  }

  .imported-drafts {
    @apply border border-gray-200 rounded-lg bg-white px-3 py-2 mb-3;
  }

  .imported-drafts summary {
    @apply cursor-pointer text-sm font-medium text-gray-700;
  }

  .imported-drafts-list { @apply mt-2 flex flex-col gap-1; }

  .imported-draft {
    @apply flex items-center justify-between gap-2 text-sm rounded-md bg-gray-50 px-2.5 py-1.5;
  }

  .imported-draft--active {
    @apply bg-brand-50 border border-brand-200 text-brand-900;
  }

  .imported-draft-active {
    @apply inline-block ml-2 px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-semibold;
  }

  .imported-draft-delete { @apply text-red-600 hover:text-red-800 ml-2; }

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
