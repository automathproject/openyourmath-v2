<script>
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';
  import katex from 'katex';
  import { macros } from '$lib/macros.js';

  export let content = '';
  export let lines = 3;

  let containerEl;
  let isVisible = false;
  let observer;

  function escapeHtml(value = '') {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtml(value = '') {
    return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function tokenizeMath(raw = '') {
    const text = stripHtml(raw);
    const pattern = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      tokens.push({ type: 'math', value: match[0] });
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return tokens;
  }

  function renderMathToken(tokenValue) {
    const isBracketDisplay = tokenValue.startsWith('\\[') && tokenValue.endsWith('\\]');
    const isParenthesizedInline = tokenValue.startsWith('\\(') && tokenValue.endsWith('\\)');
    const isDollarDisplay = tokenValue.startsWith('$$') && tokenValue.endsWith('$$');

    const isDisplay = isBracketDisplay || isDollarDisplay;
    let expr = tokenValue;
    if (isBracketDisplay || isParenthesizedInline) {
      expr = tokenValue.slice(2, -2).trim();
    } else if (isDollarDisplay) {
      expr = tokenValue.slice(2, -2).trim();
    } else {
      expr = tokenValue.slice(1, -1).trim();
    }

    if (!expr) return '';
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode: isDisplay,
      macros,
      strict: false
    });
  }

  $: tokens = tokenizeMath(content);
  $: fallbackText = stripHtml(content);
  $: renderedHtml = isVisible
    ? tokens
      .map((token) => (token.type === 'math' ? renderMathToken(token.value) : escapeHtml(token.value)))
      .join('')
    : escapeHtml(fallbackText);

  onMount(() => {
    if (!browser || !containerEl) return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible = true;
            observer?.disconnect();
          }
        });
      },
      { rootMargin: '180px 0px' }
    );
    observer.observe(containerEl);
  });

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<div class="snippet" style={`--snippet-lines:${lines};`} bind:this={containerEl}>
  <div class="snippet-content">{@html renderedHtml}</div>
  <div class="snippet-fade" aria-hidden="true"></div>
</div>

<style>
  .snippet {
    position: relative;
    overflow: hidden;
  }
  .snippet-content {
    display: -webkit-box;
    -webkit-line-clamp: var(--snippet-lines, 3);
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    @apply text-gray-600;
  }
  .snippet-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.35rem;
    pointer-events: none;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgb(255, 255, 255));
  }
</style>
