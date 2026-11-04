<!-- src/lib/components/MathRenderer.svelte -->
<script>
  import { katexMacros, prepareMathForKatex } from '../katexCompat.js';
  import { onMount, afterUpdate } from 'svelte';

  export let content = '';
  export let inline = false;
  // Formules déjà composées par le serveur (voir katexRender.js) : rien à faire
  // ici, et KaTeX n'est même pas chargé.
  export let prerendered = false;

  let mathContainer;

  // KaTeX ne se charge qu'au premier texte qui en a besoin : une page qui ne
  // montre que du contenu pré-composé, ou des titres sans formule, ne le télécharge pas.
  let renderMathInElement = null;
  let loading = null;

  const loadAutoRender = () => {
    loading ??= import('katex/contrib/auto-render').then((module) => {
      renderMathInElement = module.default;
    });
    return loading;
  };

  const renderNow = () => {
    if (!mathContainer) return;
    renderMathInElement(mathContainer, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false,
      macros: katexMacros,
      preProcess: prepareMathForKatex,
      strict: false
    });
  };

  const renderMath = () => {
    if (prerendered || !/\$|\\\(|\\\[/.test(content)) return;
    if (renderMathInElement) {
      renderNow();
    } else {
      loadAutoRender().then(renderNow);
    }
  };

  onMount(() => {
    renderMath();
  });

  afterUpdate(() => {
    renderMath();
  });
</script>


{#if inline}
  <span bind:this={mathContainer}>
    {@html content}
  </span>
{:else}
  <div bind:this={mathContainer}>
    {@html content}
  </div>
{/if}

<style></style>
