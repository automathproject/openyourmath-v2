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
  export let compactMobile = false;
  let isModeMenuOpen = false;

  const modes = [
    { id: 'preparer', label: 'Préparer' },
    { id: 'consulter', label: 'Consulter' },
    { id: 'presenter', label: 'Présenter' },
    { id: 'partager', label: 'Partager' },
  ];

  $: activeMode = modes.find((candidate) => candidate.id === mode) ?? modes[0];

  function setMode(id) {
    isModeMenuOpen = false;
    mode = id;
    const url = new URL($page.url);
    url.searchParams.set('mode', id);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<div class="seance-mode-bar" class:seance-mode-bar--compact-mobile={compactMobile}>
  <div class="seance-mode-bar-meta">
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

    <button
      type="button"
      class="seance-mode-menu-trigger"
      aria-label={`Mode actuel : ${activeMode.label}. Changer le mode de la séance`}
      aria-expanded={isModeMenuOpen}
      aria-controls="seance-mode-menu"
      title={`Mode actuel : ${activeMode.label}`}
      on:click={() => isModeMenuOpen = !isModeMenuOpen}
    >
      {#if mode === 'preparer'}
        <svg class="seance-mode-current-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      {:else if mode === 'consulter'}
        <svg class="seance-mode-current-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      {:else if mode === 'presenter'}
        <svg class="seance-mode-current-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="12" rx="2" />
          <path stroke-linecap="round" d="M8 21h8M12 15v6" />
        </svg>
      {:else}
        <svg class="seance-mode-current-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
        </svg>
      {/if}
      <svg class="seance-mode-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 10l5 5 5-5" />
      </svg>
    </button>

    <div id="seance-mode-menu" class="seance-mode-menu" class:seance-mode-menu--open={isModeMenuOpen}>
      <div class="seance-mode-tabs" role="tablist" aria-label="Mode de la séance">
        {#each modes as m}
        <button
          type="button"
          role="tab"
          class="seance-mode-tab"
          class:is-active={mode === m.id}
          aria-selected={mode === m.id}
          aria-label={m.label}
          title={m.label}
          on:click={() => setMode(m.id)}
        >
          {#if m.id === 'preparer'}
            <svg class="seance-mode-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          {:else if m.id === 'consulter'}
            <svg class="seance-mode-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          {:else if m.id === 'presenter'}
            <svg class="seance-mode-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="12" rx="2" />
              <path stroke-linecap="round" d="M8 21h8M12 15v6" />
            </svg>
          {:else}
            <svg class="seance-mode-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
            </svg>
          {/if}
          <span class="seance-mode-tab-label">{m.label}</span>
        </button>
        {/each}
      </div>
      <div class="seance-mode-menu-actions">
        <slot name="menu-actions"></slot>
      </div>
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

  .seance-title {
    font-family: theme('fontFamily.heading');
    font-weight: 800;
    font-size: 22px;
    margin: 0;
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

  .seance-mode-menu-trigger {
    display: none;
    appearance: none;
    border: 1px solid theme('colors.interface.border-primary');
    background: theme('colors.interface.bg-white');
    color: theme('colors.interface.text-secondary');
    border-radius: 9999px;
    cursor: pointer;
  }

  .seance-mode-menu-trigger:hover,
  .seance-mode-menu-trigger[aria-expanded="true"] {
    color: theme('colors.brand.700');
    background: theme('colors.brand.50');
    border-color: theme('colors.brand.200');
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

  .seance-mode-menu-actions { display: none; }

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

  .seance-mode-tab-icon { display: none; }

  @media (max-width: 720px) {
    .seance-mode-bar {
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
    }
    .seance-title { font-size: 18px; }
    .seance-subtitle { display: none; }
    .seance-mode-bar-controls {
      position: relative;
      align-items: center;
      gap: 6px;
    }
    .seance-mode-menu-trigger {
      width: 44px;
      height: 40px;
      justify-content: center;
      padding: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
    }
    .seance-mode-current-icon { width: 17px; height: 17px; }
    .seance-mode-menu-chevron { width: 14px; height: 14px; }
    .seance-mode-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 80;
      display: none;
      width: auto;
      flex-direction: row;
      padding: 4px;
      gap: 4px;
      background: theme('colors.interface.bg-white');
      border: 1px solid theme('colors.interface.border-primary');
      border-radius: theme('borderRadius.pill');
      box-shadow: 0 8px 20px rgb(0 0 0 / 0.14);
    }
    .seance-mode-menu--open { display: flex; }
    .seance-mode-tabs { position: static; border: 0; }
    .seance-mode-menu-actions {
      display: flex;
      gap: 4px;
    }
    .seance-mode-menu-actions :global(.list-action-btn) {
      width: 40px;
      height: 38px;
      justify-content: center;
      padding: 0;
      border-radius: 9999px;
    }
    .seance-mode-bar-controls :global(.list-actions) {
      width: auto;
      flex: 0 0 auto;
    }
    .seance-mode-tab {
      flex: 1;
      min-width: 40px;
      height: 38px;
      padding: 0;
      display: grid;
      place-items: center;
      white-space: nowrap;
    }

    .seance-mode-tab-label { display: none; }
    .seance-mode-tab-icon { display: block; width: 18px; height: 18px; }

  }
</style>
