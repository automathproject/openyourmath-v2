<!--
  AppHeader — barre de navigation persistante sur toutes les routes.
  PAS de bouton Connexion (pas de compte utilisateur).
  Les "Mes séances" sont locales (localStorage) ; le compteur reflète ce stockage.

  Usage dans +layout.svelte :
    <AppHeader />

  L'état "actif" est calculé automatiquement depuis $page.url.pathname.

  Référence DS : #header dans OpenYourMath Design System.html
-->

<script>
  import { page } from '$app/stores';

  /**
   * @typedef {Object} Props
   * @property {number} [seanceCount] - badge sur "Mes séances", calculé depuis localStorage ou store
   */
  /** @type {Props} */
  let { seanceCount = 0 } = $props();

  let pathname = $derived($page.url.pathname);

  function isActive(prefix) {
    if (prefix === '/') return pathname === '/';
    return pathname.startsWith(prefix);
  }
</script>

<header class="app-header">
  <div class="app-header-left">
    <a class="app-brand" href="/" aria-label="OpenYourMath — accueil">
      <span class="app-brand-mark">O</span>
      <span class="app-brand-name" aria-hidden="true">
        <span>open</span><span class="app-brand-name-accent">your</span><span>math</span>
      </span>
      <span class="sr-only">OpenYourMath</span>
    </a>

    <nav class="app-nav" aria-label="Navigation principale">
      <a href="/" class:is-active={isActive('/') && !isActive('/browse') && !isActive('/exercise')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        Recherche
      </a>
      <a href="/browse" class:is-active={isActive('/browse')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        Parcourir
      </a>
      <a href="/exercise/list" class:is-active={isActive('/exercise/list')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        Mes séances
        {#if seanceCount > 0}
          <span class="list-counter">{seanceCount}</span>
        {/if}
      </a>
    </nav>
  </div>

  <div class="app-header-right">
    <a href="/about" class="btn btn-ghost btn-sm">À propos</a>
    <a href="/docs" class="btn btn-ghost btn-sm">Documentation</a>
    <button type="button" class="btn-icon" aria-label="Aide">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
      </svg>
    </button>
  </div>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: theme('spacing.header');
    padding: 0 20px;
    background: theme('colors.interface.bg-primary');
    border-bottom: 1px solid theme('colors.interface.border-primary');
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .app-header { height: theme('spacing.header-mobile'); padding: 0 12px; }
  }

  .app-header-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .app-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: theme('colors.interface.text-primary');
    text-decoration: none;
  }

  .app-brand-mark {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: theme('colors.brand.500');
    display: grid;
    place-items: center;
    color: white;
    font-family: theme('fontFamily.heading');
    font-weight: 800;
    font-size: 14px;
  }

  .app-brand-name {
    font-family: "Avenir Next", "Nunito", "Segoe UI", system-ui, sans-serif;
    font-weight: 650;
    font-size: 17px;
    line-height: 1;
    letter-spacing: 0;
    color: theme('colors.interface.text-primary');
    text-transform: lowercase;
  }

  .app-brand-name-accent {
    color: theme('colors.brand.500');
  }

  .app-nav {
    display: flex;
    gap: 2px;
  }

  .app-nav a {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: theme('colors.interface.text-secondary');
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }

  .app-nav a:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }

  .app-nav a.is-active {
    background: theme('colors.brand.50');
    color: theme('colors.brand.700');
  }

  .app-nav .list-counter {
    margin-left: 4px;
    position: static;
    box-shadow: none;
  }

  .app-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: transparent;
    color: theme('colors.interface.text-secondary');
    border: 0;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .btn-icon:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }

  @media (max-width: 640px) {
    .app-header-right :global(.btn-sm) { display: none; }
    .app-brand-name { display: none; }
    .app-nav a { padding: 6px 8px; font-size: 12px; }
  }
</style>
