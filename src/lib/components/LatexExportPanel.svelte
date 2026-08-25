<!-- src/lib/components/LatexExportPanel.svelte -->
<!--
  Panneau d'export LaTeX pour une liste d'exercices.

  Props:
    exercises  {Object[]}  — liste d'exercices (format listStore)
    title      {string}    — titre de la liste (utilisé dans le document et le nom de fichier)

  Dispatche :
    (rien pour l'instant — autonome)
-->
<script>
  import { generateLatexDocument, downloadTexFile } from '$lib/latex/export.js';
  import LatexContentOptions from '$lib/components/LatexContentOptions.svelte';

  let {
    /** @type {Object[]} */
    exercises = [],
    /** @type {string} */
    title = '',
  } = $props();

  // Options d'export
  let includeHints = $state(true);
  let includeSolutions = $state(true);
  let solutionsAtEnd = $state(false);

  function handleDownload() {
    const content = generateLatexDocument(exercises, title, {
      includeHints,
      includeSolutions,
      solutionsAtEnd,
    });
    downloadTexFile(content, title || 'exercices');
  }
</script>

<div class="latex-export-panel">
  <span class="latex-export-label">Export LaTeX</span>

  <div class="latex-export-options">
    <LatexContentOptions bind:includeHints bind:includeSolutions bind:solutionsAtEnd />
  </div>

  <button class="latex-download-btn" onclick={handleDownload}>
    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    Télécharger .tex
  </button>
</div>

<style>
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

  .latex-download-btn {
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
    align-self: flex-start;
    @apply bg-indigo-50 text-indigo-700 border-indigo-200;
  }

  .latex-download-btn:hover {
    @apply bg-indigo-100;
  }

  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
