<!-- src/lib/components/SeanceLatexEditor.svelte -->
<!--
  Mode « Éditer » de /exercise/list : le source LaTeX de la liste dans un
  éditeur, à côté du PDF compilé.

  Le source est généré à partir des exercices, puis l'utilisateur peut le
  retoucher. Les retouches sont un brouillon rangé dans le navigateur
  (listLatexDraft.js) : elles survivent à un changement de mode ou à un
  rechargement. Tant qu'un brouillon existe, les options de contenu sont
  verrouillées, puisque les changer régénérerait le source et écraserait les
  retouches ; « Repartir de la liste » abandonne le brouillon.

  La compilation n'est lancée qu'à la demande : chaque compilation est un
  appel au service externe.

  Une fiche ne charge le contenu d'un exercice qu'à son affichage : le
  document n'est montré qu'une fois tous les contenus chargés, sans quoi les
  exercices jamais ouverts sortiraient vides.

  Props:
    exercises    {Object[]} — exercices de la liste (format listStore)
    title        {string}   — titre de la liste, base du nom de fichier
    loadContents {() => Promise<void>} — charge le contenu des exercices qui
                              n'ont que leurs métadonnées
-->
<script>
  import { tick, untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { LatexExport } from '$lib/latex/exportState.svelte.js';
  import { downloadTexFile } from '$lib/latex/export.js';
  import {
    draftKey,
    findDraft,
    findExerciseLine,
    readDrafts,
    removeDraft,
    saveDraft,
  } from '$lib/latex/listLatexDraft.js';
  import LatexContentOptions from '$lib/components/LatexContentOptions.svelte';
  import LatexCompiler from '$lib/components/LatexCompiler.svelte';

  let { exercises = [], title = '', loadContents = undefined } = $props();

  const latex = new LatexExport(() => ({ exercises, title, fallbackName: 'seance' }));

  let uuids = $derived(exercises.map((ex) => ex?.uuid).filter(Boolean));

  /** @type {import('$lib/latex/listLatexDraft.js').ListLatexDraft | null} */
  let draft = $state(null);
  /** Brouillon d'une autre composition de la liste, proposé à la reprise. */
  /** @type {import('$lib/latex/listLatexDraft.js').ListLatexDraft | null} */
  let foreignDraft = $state(null);
  /** Composition dont tous les contenus sont chargés. */
  let contentsKey = $state(null);
  /** Composition en cours de chargement : hors $state, seule la garde le lit. */
  let contentsPendingKey = null;
  /** Composition pour laquelle le brouillon a été recherché. */
  let restoredKey = $state(null);
  let copied = $state(false);
  /** @type {LatexCompiler | undefined} */
  let compiler = $state();

  let saveTimer = null;
  let copyTimer = null;

  let ready = $derived(restoredKey === draftKey(uuids));
  let loadedCount = $derived(exercises.filter(hasContent).length);
  let editorSource = $derived(draft ? draft.source : latex.compilerSource);
  let isStale = $derived(Boolean(draft) && draft.base !== latex.compilerSource);

  function storage() {
    if (!browser) return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  $effect(() => {
    const key = draftKey(uuids);
    if (!browser || key === contentsKey || key === contentsPendingKey) return;
    untrack(() => ensureContents(key));
  });

  // Le source dépend des contenus puis des artifacts (images, blocs de code) :
  // on attend les deux avant de chercher un brouillon et de montrer l'éditeur.
  // Sinon le source changerait sous les doigts de l'utilisateur, et un
  // brouillon pris sur la version incomplète paraîtrait aussitôt périmé.
  $effect(() => {
    const key = draftKey(uuids);
    if (!browser || key !== contentsKey || latex.artifactsLoading || key === restoredKey) return;
    untrack(() => restore(key));
  });

  // Les figures ne servent qu'à la compilation en ligne, qui est la raison
  // d'être de ce mode : on les télécharge dès que le document est connu.
  $effect(() => {
    if (!latex.artifactsLoading) latex.loadAssets();
  });

  $effect(() => {
    return () => {
      if (saveTimer) flushSave();
      if (copyTimer) clearTimeout(copyTimer);
    };
  });

  /** @param {Object} ex */
  function hasContent(ex) {
    return Boolean(ex?.fullExercise) || (Array.isArray(ex?.content) && ex.content.length > 0);
  }

  async function ensureContents(key) {
    contentsPendingKey = key;
    try {
      await loadContents?.();
      // Laisse la liste mise à jour redescendre jusqu'ici, et l'effet des
      // artifacts démarrer, avant de déclarer les contenus prêts.
      await tick();
    } finally {
      if (contentsPendingKey === key) contentsPendingKey = null;
    }
    if (draftKey(uuids) === key) contentsKey = key;
  }

  function restore(key) {
    const found = findDraft(readDrafts(storage()), uuids);
    draft = found?.exact ? found.draft : null;
    foreignDraft = found && !found.exact ? found.draft : null;
    if (draft) applyContent(draft.content);
    restoredKey = key;
  }

  function applyContent(content) {
    if (!content) return;
    latex.content.includeHints = Boolean(content.includeHints);
    latex.content.includeSolutions = Boolean(content.includeSolutions);
    latex.content.solutionsAtEnd = Boolean(content.includeSolutions && content.solutionsAtEnd);
  }

  function handleEdit(text) {
    const generated = latex.compilerSource;
    // Revenir exactement au source généré, c'est ne plus rien avoir modifié.
    if (text === generated) {
      if (draft) discardDraft();
      return;
    }
    draft = {
      uuids: [...uuids],
      source: text,
      base: draft?.base ?? generated,
      content: { ...latex.content },
      savedAt: Date.now(),
    };
    // Une reprise proposée après une retouche écraserait celle-ci.
    foreignDraft = null;
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
  }

  function flushSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (draft) saveDraft(storage(), $state.snapshot(draft));
  }

  function discardDraft() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    removeDraft(storage(), uuids);
    draft = null;
  }

  function resetToList() {
    if (!confirm('Abandonner vos modifications et régénérer le source à partir de la liste ?')) return;
    discardDraft();
  }

  function resumeForeignDraft() {
    if (!foreignDraft) return;
    const previous = foreignDraft;
    applyContent(previous.content);
    draft = { ...previous, uuids: [...uuids], savedAt: Date.now() };
    foreignDraft = null;
    flushSave();
  }

  function gotoExercise(event) {
    const uuid = event.currentTarget.value;
    event.currentTarget.value = '';
    const line = findExerciseLine(editorSource, uuid);
    if (line) compiler?.revealLine(line);
  }

  // Sans retouche, copie et téléchargement passent par l'export habituel : sa
  // version garde les \includegraphics d'origine pour une compilation locale.
  async function copySource() {
    if (!draft) {
      latex.copy();
      return;
    }
    try {
      await navigator.clipboard.writeText(draft.source);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 2000);
    } catch {
      // Presse-papiers indisponible : le téléchargement reste possible.
    }
  }

  function downloadSource() {
    if (draft) downloadTexFile(draft.source, latex.fileName);
    else latex.download();
  }

  function formatDate(ms) {
    try {
      return new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  }
</script>

<svelte:window onpagehide={() => saveTimer && flushSave()} />

<div class="seance-latex-editor">
  <div class="sle-inner">
    <header class="sle-header">
      <div>
        <h2 class="sle-title">Éditer le LaTeX</h2>
        <p class="sle-desc">
          Retouchez le document de la liste puis compilez-le. Vos modifications restent dans ce navigateur.
        </p>
      </div>
      {#if exercises.length > 0}
        <div class="sle-actions">
          <select class="sle-jump" onchange={gotoExercise} aria-label="Aller à un exercice" disabled={!ready}>
            <option value="">Aller à un exercice…</option>
            {#each exercises as ex, i (ex.uuid ?? i)}
              <option value={ex.uuid}>{i + 1}. {ex.title || `Exercice ${i + 1}`}</option>
            {/each}
          </select>
          <button type="button" class="sle-btn" onclick={copySource} disabled={!ready}>
            {#if copied || latex.copied}✓ Copié{:else}Copier{/if}
          </button>
          <button type="button" class="sle-btn" onclick={downloadSource} disabled={!ready}>
            Télécharger .tex
          </button>
          {#if draft}
            <button type="button" class="sle-btn sle-btn--danger" onclick={resetToList}>
              Repartir de la liste
            </button>
          {/if}
        </div>
      {/if}
    </header>

    {#if exercises.length === 0}
      <div class="sle-empty">
        <p>Ajoutez des exercices à la liste pour générer son document LaTeX.</p>
        <a href="/" class="btn btn-primary">Commencer la recherche</a>
      </div>
    {:else}
      <div class="sle-options">
        <fieldset class="sle-options-lock" disabled={Boolean(draft)}>
          <LatexContentOptions
            bind:includeHints={latex.content.includeHints}
            bind:includeSolutions={latex.content.includeSolutions}
            bind:solutionsAtEnd={latex.content.solutionsAtEnd}
            compact
          />
        </fieldset>
        <p class="sle-status" class:sle-status--edited={draft}>
          {#if draft}
            Source modifié le {formatDate(draft.savedAt)} · options verrouillées. « Repartir de la liste » pour les changer.
          {:else}
            Source généré à partir de la liste.
          {/if}
        </p>
      </div>

      {#if foreignDraft}
        <div class="sle-notice" role="status">
          <p>
            Vous aviez modifié le source d'une autre version de cette liste
            ({foreignDraft.uuids.length} exercice{foreignDraft.uuids.length > 1 ? 's' : ''}, le {formatDate(foreignDraft.savedAt)}).
          </p>
          <div class="sle-notice-actions">
            <button type="button" class="sle-btn" onclick={resumeForeignDraft}>Reprendre ces modifications</button>
            <button type="button" class="sle-btn" onclick={() => (foreignDraft = null)}>Ignorer</button>
          </div>
        </div>
      {/if}

      {#if isStale}
        <div class="sle-notice" role="status">
          <p>
            Les exercices de la liste ont changé depuis vos modifications : le source modifié ne les reflète pas.
          </p>
          <div class="sle-notice-actions">
            <button type="button" class="sle-btn" onclick={resetToList}>Repartir de la liste</button>
          </div>
        </div>
      {/if}

      {#if ready && loadedCount < exercises.length}
        <p class="sle-warning" role="alert">
          <strong>{exercises.length - loadedCount}</strong>
          exercice{exercises.length - loadedCount > 1 ? 's' : ''} n'{exercises.length - loadedCount > 1 ? 'ont' : 'a'} pas pu être chargé{exercises.length - loadedCount > 1 ? 's' : ''} :
          {exercises.length - loadedCount > 1 ? 'ils apparaissent' : 'il apparaît'} vide{exercises.length - loadedCount > 1 ? 's' : ''} dans le document. Rechargez la page pour réessayer.
        </p>
      {/if}

      {#if latex.skippedImages.length > 0}
        <p class="sle-warning">
          <strong>{latex.skippedImages.length}</strong>
          figure{latex.skippedImages.length > 1 ? 's' : ''}
          ne peut{latex.skippedImages.length > 1 ? 'vent' : ''} pas être transmise{latex.skippedImages.length > 1 ? 's' : ''}
          au compilateur en ligne ({[...new Set(latex.skippedImages.map((i) => i.extension))].join(', ')}) :
          le PDF les remplacera par un encart.
          {#if draft}
            Le <code>.tex</code> modifié contient aussi ces encarts ; repartez de la liste pour télécharger la version illustrée.
          {:else}
            Téléchargez le <code>.tex</code> et compilez-le localement pour obtenir le document illustré.
          {/if}
        </p>
      {/if}

      {#if ready}
        <LatexCompiler
          bind:this={compiler}
          source={editorSource}
          assets={latex.assets}
          filename={latex.texFileName}
          onedit={handleEdit}
        />
      {:else if contentsKey !== draftKey(uuids)}
        <p class="sle-loading">Chargement des exercices… {loadedCount} / {exercises.length}</p>
      {:else}
        <p class="sle-loading">Préparation du document…</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .seance-latex-editor {
    background: var(--color-interface-bg-secondary);
    min-height: calc(100vh - 80px);
    padding: 24px 16px 64px;
  }
  .sle-inner {
    max-width: 1800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sle-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .sle-title {
    font-family: var(--font-heading);
    font-size: 20px;
    font-weight: 800;
    margin: 0;
    color: var(--color-interface-text-primary);
  }
  .sle-desc {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--color-interface-text-muted);
  }

  .sle-actions,
  .sle-notice-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sle-jump {
    max-width: 260px;
    padding: 6px 10px;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 6px;
    background: var(--color-interface-bg-primary);
    color: var(--color-interface-text-primary);
    font: inherit;
    font-size: 13px;
  }
  .sle-btn {
    padding: 6px 12px;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 6px;
    background: var(--color-interface-bg-primary);
    color: var(--color-interface-text-secondary);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  .sle-btn:hover:not(:disabled) {
    border-color: var(--color-brand-400);
    color: var(--color-brand-700);
  }
  .sle-btn:disabled { opacity: 0.5; cursor: default; }
  .sle-btn--danger:hover:not(:disabled) {
    border-color: var(--color-red-400);
    color: var(--color-red-700);
  }

  .sle-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 0.75rem;
    background: var(--color-interface-bg-primary);
  }
  /* Simple conteneur : la bordure et la légende sont celles de LatexContentOptions. */
  .sle-options-lock {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  .sle-options-lock:disabled { opacity: 0.55; }
  .sle-status {
    margin: 0;
    font-size: 12px;
    color: var(--color-interface-text-muted);
  }
  .sle-status--edited { color: var(--color-brand-700); font-weight: 600; }

  .sle-notice,
  .sle-warning {
    margin: 0;
    padding: 0.7rem 1rem;
    border: 1px solid var(--color-amber-300);
    border-radius: 0.75rem;
    background: var(--color-amber-50);
    color: var(--color-amber-900);
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .sle-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .sle-notice p { margin: 0; }
  .sle-warning code {
    padding: 0 0.2em;
    border-radius: 0.2rem;
    background: var(--color-amber-100);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .sle-empty,
  .sle-loading {
    padding: 48px 16px;
    text-align: center;
    font-size: 14px;
    color: var(--color-interface-text-muted);
  }
  .sle-empty p { margin: 0 0 16px; }

  @media (max-width: 640px) {
    .sle-jump { max-width: 100%; flex: 1 1 100%; }
  }
</style>
