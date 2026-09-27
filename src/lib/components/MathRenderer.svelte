<!-- src/lib/components/MathRenderer.svelte -->
<script>
  import { katexMacros, prepareMathForKatex } from '../katexCompat.js';
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
        macros: katexMacros,
        preProcess: prepareMathForKatex,
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
