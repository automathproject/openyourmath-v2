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

  export let mode = 'preparer';
  export let title = '';
  export let subtitle = '';
  export let breadcrumb = [];
  export let compactMobile = false;

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

<div class="seance-mode-bar" class:seance-mode-bar--compact-mobile={compactMobile}>
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
    <slot name="title">
      {#if title}
        <h1 class="seance-title">{title}</h1>
      {/if}
    </slot>
    {#if subtitle}
      <div class="seance-subtitle">{subtitle}</div>
    {/if}
  </div>

  <div class="seance-mode-bar-controls">
    <slot name="actions"></slot>

    <div class="seance-mode-tabs" role="tablist" aria-label="Mode de la séance">
      {#each modes as m}
        <button
          type="button"
          role="tab"
          class="seance-mode-tab"
          class:is-active={mode === m.id}
          aria-selected={mode === m.id}
          on:click={() => setMode(m.id)}
        >
          {m.label}
        </button>
      {/each}
    </div>
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

  .seance-mode-bar-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
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
    .seance-mode-bar-controls { flex-wrap: wrap; }
    .seance-mode-tabs { overflow-x: auto; }

    .seance-mode-bar--compact-mobile {
      gap: 0;
      padding: 8px 10px;
    }

    .seance-mode-bar--compact-mobile .seance-mode-bar-meta {
      display: none;
    }

    .seance-mode-bar--compact-mobile .seance-mode-bar-controls {
      display: block;
    }

    .seance-mode-bar--compact-mobile .seance-mode-tabs {
      width: 100%;
      justify-content: space-between;
      padding: 3px;
    }

    .seance-mode-bar--compact-mobile .seance-mode-tab {
      flex: 1;
      padding: 5px 8px;
      font-size: 12px;
      white-space: nowrap;
    }
  }
</style>
