<!-- src/lib/components/LatexExport.svelte -->
<!--
  Point d'entrée unique de l'export LaTeX.

  C'est le seul composant qui instancie la fabrique d'état : tout ce qui
  produit du .tex dans l'application passe par ici, et bénéficie donc des mêmes
  réglages, du même chargement de ressources et des mêmes actions. Les trois
  présentations ne diffèrent que par leur densité.

  Props:
    exercises    {Object[]}  — exercices à exporter (format listStore)
    title        {string}    — titre du document et base du nom de fichier
    fallbackName {string}    — nom de fichier si le titre ne donne rien
    variant      {'button'|'panel'|'full'}
       button — une action compacte qui ouvre le dialogue complet ;
                pour une barre d'outils (page de lecture d'un exercice).
       panel  — options et téléchargement direct, sans aperçu ;
                pour un panneau latéral.
       full   — source complète, navigation et compilation.
    label        {string}    — libellé de l'action par défaut, variante « button »
    trigger      {Snippet}   — déclencheur fourni par l'appelant, variante
                               « button ». Reçoit la fonction d'ouverture. Le
                               bouton est alors déclaré chez l'appelant, donc
                               couvert par ses styles scopés : c'est la seule
                               façon d'intégrer une barre d'outils existante
                               sans dupliquer sa CSS ni la rendre globale.
-->
<script>
  import { LatexExport } from '$lib/latex/exportState.svelte.js';
  import LatexContentOptions from '$lib/components/LatexContentOptions.svelte';
  import LatexSourceViewer from '$lib/components/LatexSourceViewer.svelte';

  let {
    exercises = [],
    title = '',
    fallbackName = 'exercices',
    variant = 'panel',
    label = 'LaTeX',
    trigger = undefined,
  } = $props();

  const latex = new LatexExport(() => ({ exercises, title, fallbackName }));

  let dialogOpen = $state(false);

  function openDialog() {
    dialogOpen = true;
  }
</script>

{#if variant === 'button'}
  {#if trigger}
    {@render trigger(openDialog)}
  {:else}
    <button type="button" class="latex-trigger-btn" onclick={openDialog}>
      <span aria-hidden="true">⤓</span>
      <span>{label}</span>
    </button>
  {/if}
{:else if variant === 'panel'}
  <div class="latex-export-panel">
    <span class="latex-export-label">Export LaTeX</span>

    <div class="latex-export-options">
      <LatexContentOptions
        bind:includeHints={latex.content.includeHints}
        bind:includeSolutions={latex.content.includeSolutions}
        bind:solutionsAtEnd={latex.content.solutionsAtEnd}
      />
    </div>

    <div class="latex-export-actions">
      <button class="latex-download-btn" onclick={() => latex.download()}>
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Télécharger .tex
      </button>
      <button class="latex-preview-btn" onclick={() => (dialogOpen = true)}>
        Voir la source
      </button>
    </div>

    {#if latex.artifactsLoading}
      <span class="latex-export-loading">Chargement des ressources…</span>
    {/if}
  </div>
{:else}
  <LatexSourceViewer {latex} />
{/if}

<!--
  Les variantes compactes ouvrent la vue complète dans une surcouche : un
  exercice illustré ou une liste entière méritent le même aperçu avant
  téléchargement, quel que soit l'endroit d'où l'export est demandé.
-->
{#if dialogOpen && variant !== 'full'}
  <div
    class="latex-export-dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Export LaTeX"
    tabindex="-1"
  >
    <div class="latex-export-dialog-header">
      <h2>{title || 'Export LaTeX'}</h2>
      <button type="button" class="latex-export-dialog-close" onclick={() => (dialogOpen = false)}>
        Fermer
      </button>
    </div>
    <div class="latex-export-dialog-body">
      <LatexSourceViewer {latex} />
    </div>
  </div>
{/if}

<style>
  /* ── Déclencheur par défaut (variante « button » sans snippet) ── */
  .latex-trigger-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    @apply bg-white text-gray-700 border border-gray-200;
  }

  .latex-trigger-btn:hover {
    @apply bg-gray-50;
  }

  /* ── Variante « panel » ── */
  .latex-export-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem 1rem;
    border-top: 1px solid;
    @apply border-gray-200;
  }

  .latex-export-label {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    @apply text-gray-400;
  }

  .latex-export-options { width: 100%; }

  .latex-export-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .latex-download-btn,
  .latex-preview-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease;
  }

  .latex-download-btn {
    @apply bg-indigo-50 text-indigo-700 border-indigo-200;
  }

  .latex-download-btn:hover {
    @apply bg-indigo-100;
  }

  .latex-preview-btn {
    @apply bg-white text-gray-600 border-gray-200;
  }

  .latex-preview-btn:hover {
    @apply bg-gray-50;
  }

  .latex-export-loading {
    font-size: 0.75rem;
    font-style: italic;
    @apply text-gray-400;
  }

  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  /* ── Surcouche d'aperçu ── */
  .latex-export-dialog {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    @apply bg-white;
  }

  .latex-export-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .latex-export-dialog-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    @apply text-gray-800;
  }

  .latex-export-dialog-close {
    padding: 0.35rem 0.85rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    @apply bg-gray-100 text-gray-700 border border-gray-200;
  }

  .latex-export-dialog-close:hover {
    @apply bg-gray-200;
  }

  .latex-export-dialog-body {
    flex: 1;
    min-height: 0;
  }
</style>
