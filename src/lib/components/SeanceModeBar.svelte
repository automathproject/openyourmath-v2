<!--
  SeanceModeBar — barre de modes pour la route /exercise/list.
  4 modes : preparer, consulter, presenter, partager.

  Lie le state au query param ?mode= (SvelteKit goto).

  Usage dans /exercise/list/+page.svelte :
    <script>
      import { page } from '$app/stores';
      let mode = $derived($page.url.searchParams.get('mode') ?? 'preparer');
    </script>
    <SeanceModeBar bind:mode title="DM3 — Intégration avancée" subtitle="L1 · 8 exos · 1h30" />

  Référence DS : #header dans OpenYourMath Design System.html + mode bar dans Hi-Fi v2 Séance.
-->

<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  /**
   * @typedef {Object} Props
   * @property {'preparer'|'consulter'|'presenter'|'partager'} mode
   * @property {string} [title]
   * @property {string} [subtitle]
   * @property {{ label: string; href?: string }[]} [breadcrumb]
   */
  /** @type {Props} */
  let { mode = $bindable('preparer'), title = '', subtitle = '', breadcrumb = [] } = $props();

  const modes = [
    { id: 'preparer', label: 'Préparer' },
    { id: 'consulter', label: 'Consulter' },
    { id: 'presenter', label: 'Présenter' },
    { id: 'partager', label: 'Partager' },
  ];

  function setMode(id) {
    mode = id;
    const url = new URL($page.url);
    url.searchParams.set('mode', id);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<div class="seance-mode-bar">
  <div class="seance-mode-bar-meta">
    {#if breadcrumb.length}
      <nav class="seance-breadcrumb" aria-label="Fil d'ariane">
        {#each breadcrumb as crumb, i}
          {#if i < breadcrumb.length - 1}
            <a href={crumb.href ?? '#'}>{crumb.label}</a>
            <span class="sep" aria-hidden="true">›</span>
          {:else}
            <span class="current">{crumb.label}</span>
          {/if}
        {/each}
      </nav>
    {/if}
    {#if title}
      <h1 class="seance-title">{title}</h1>
    {/if}
    {#if subtitle}
      <div class="seance-subtitle">{subtitle}</div>
    {/if}
  </div>

  <div class="seance-mode-tabs" role="tablist" aria-label="Mode de la séance">
    {#each modes as m}
      <button
        type="button"
        role="tab"
        class="seance-mode-tab"
        class:is-active={mode === m.id}
        aria-selected={mode === m.id}
        onclick={() => setMode(m.id)}
      >
        {m.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .seance-mode-bar {
    padding: 14px 28px;
    background: theme('colors.interface.bg-secondary');
    border-bottom: 1px solid theme('colors.interface.border-primary');
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .seance-mode-bar-meta { min-width: 0; flex: 1; }

  .seance-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: theme('colors.interface.text-muted');
  }
  .seance-breadcrumb a {
    color: theme('colors.interface.text-secondary');
    text-decoration: none;
    padding: 3px 6px;
    border-radius: 4px;
  }
  .seance-breadcrumb a:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .seance-breadcrumb .sep { color: theme('colors.interface.text-disabled'); }
  .seance-breadcrumb .current {
    color: theme('colors.interface.text-primary');
    font-weight: 600;
    padding: 3px 6px;
  }

  .seance-title {
    font-family: theme('fontFamily.heading');
    font-weight: 800;
    font-size: 22px;
    margin: 6px 0 0;
    color: theme('colors.interface.text-primary');
    letter-spacing: -0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .seance-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: theme('colors.interface.text-muted');
  }

  .seance-mode-tabs {
    display: flex;
    gap: 4px;
    background: theme('colors.interface.bg-white');
    padding: 4px;
    border-radius: theme('borderRadius.pill');
    border: 1px solid theme('colors.interface.border-primary');
    flex-shrink: 0;
  }

  .seance-mode-tab {
    appearance: none;
    border: 0;
    background: transparent;
    color: theme('colors.interface.text-secondary');
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: theme('borderRadius.pill');
    cursor: pointer;
    transition: background 0.15s, color 0.15s, font-weight 0.15s;
  }
  .seance-mode-tab:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .seance-mode-tab.is-active {
    background: theme('colors.brand.500');
    color: white;
    font-weight: 600;
  }

  @media (max-width: 720px) {
    .seance-mode-bar { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 16px; }
    .seance-mode-tabs { overflow-x: auto; }
  }
</style>
