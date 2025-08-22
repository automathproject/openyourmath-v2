<!-- src/lib/components/MathRenderer.svelte -->
<script>
  import { macros } from '../macros.js';
  import { onMount, afterUpdate } from 'svelte';
  import renderMathInElement from 'katex/contrib/auto-render';
  
  export let content = '';
  export let inline = false;
  
  let mathContainer;

  const renderMath = () => {
    if (mathContainer) {
      renderMathInElement(mathContainer, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
        macros: macros,
        strict: false
      });
    }
  };

  onMount(() => {
    renderMath();
  });

  afterUpdate(() => {
    renderMath();
  });
</script>

<!-- Import du CSS KaTeX -->
<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
</svelte:head>

{#if inline}
  <span bind:this={mathContainer}>
    {@html content}
  </span>
{:else}
  <div bind:this={mathContainer}>
    {@html content}
  </div>
{/if}

<style>
  /* Styles pour les formules KaTeX */
  :global(.katex-display) {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 1em 0;
    margin: 1em 0;
  }

  /* Taille des formules */
  :global(.katex) {
    font-size: 1.1em !important;
  }

  :global(.katex-display > .katex) {
    font-size: 1.2em !important;
  }

  /* Styles pour les tableaux LaTeX */
  :global(table) {
    border-collapse: collapse;
    margin: 1em 0;
    min-width: 100%;
  }

  :global(td), :global(th) {
    border: 1px solid #ddd;
    padding: 0.5em;
    text-align: center;
  }

  :global(.array) {
    border: 1px solid #ddd !important;
  }

  :global(.array td), :global(.array th) {
    border: 1px solid #ddd !important;
    padding: 0.3em 0.6em !important;
  }

  /* Style spécifique pour les matrices */
  :global(.matrix) {
    border: none !important;
  }

  :global(.matrix td) {
    padding: 0.2em 0.5em !important;
  }

  /* Style pour les bordures verticales des tableaux */
  :global(.vline) {
    border-left: 1px solid #ddd !important;
  }

  /* Style pour les bordures horizontales des tableaux */
  :global(.hline) {
    border-top: 1px solid #ddd !important;
  }

  /* Responsive pour mobile */
  @media (max-width: 640px) {
    :global(.katex) {
      font-size: 1em !important;
    }
    
    :global(.katex-display > .katex) {
      font-size: 1.1em !important;
    }
  }
</style>