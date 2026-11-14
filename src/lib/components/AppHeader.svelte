<!--
  AppHeader — barre de navigation persistante sur toutes les routes.
  PAS de bouton Connexion (pas de compte utilisateur).

  Deux zones :
    - à gauche, les rubriques : Parcourir, Créer ;
    - à droite, les outils : Rechercher (Ctrl K, ouvre la fenêtre de
      recherche par-dessus la page), Rejoindre une session en direct, Ma liste
      (avec son compteur), À propos.

  Les fiches n'ont plus d'entrée propre : Ma liste les propose quand elle est
  vide, et par son bouton « Fiches » quand elle est remplie. Sur téléphone, il
  reste Rechercher, Ma liste et un menu qui regroupe le reste.

  Usage dans +layout.svelte :
    <AppHeader seanceCount={…} listHref={…} onsearch={…} />
-->

<script>
  import { page } from '$app/stores';

  /**
   * @typedef {Object} Props
   * @property {number} [seanceCount] - badge sur "Ma liste"
   * @property {string} [listHref] - URL de la liste courante avec ses paramètres
   * @property {() => void} [onsearch] - ouvre la fenêtre de recherche
   */
  /** @type {Props} */
  let { seanceCount = 0, listHref = '/exercise/list', onsearch } = $props();

  // Un vrai lien vers l'accueil (clic du milieu, sans JavaScript) ; le clic
  // simple ouvre la fenêtre de recherche sans quitter la page.
  function openSearch(event) {
    if (!onsearch || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onsearch();
  }

  let pathname = $derived($page.url.pathname);
  let menuOpen = $state(false);
  let menuRoot = $state();

  // Le menu se referme dès qu'on change de page.
  $effect(() => {
    pathname;
    menuOpen = false;
  });

  function isActive(...prefixes) {
    return prefixes.some((prefix) => pathname.startsWith(prefix));
  }

  let listActive = $derived(isActive('/exercise/list', '/fiches'));
  let listLabel = $derived(
    `Ma liste${seanceCount > 0 ? `, ${seanceCount} élément${seanceCount > 1 ? 's' : ''}` : ''}`
  );

  // composedPath et non contains : le bouton change d'icône en s'ouvrant, et
  // la cible du clic est déjà retirée du DOM quand l'événement arrive ici.
  function onwindowclick(event) {
    if (menuOpen && menuRoot && !event.composedPath().includes(menuRoot)) menuOpen = false;
  }

  function onwindowkeydown(event) {
    if (menuOpen && event.key === 'Escape') menuOpen = false;
  }
</script>

<svelte:window onclick={onwindowclick} onkeydown={onwindowkeydown} />

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
      <a href="/browse" class:is-active={isActive('/browse')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
        Parcourir
      </a>
      <a href="/create" class:is-active={isActive('/create')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        Créer
        <span class="beta-badge">bêta</span>
      </a>
    </nav>
  </div>

  <div class="app-header-right">
    <!-- L'accueil porte déjà la grande barre de recherche. -->
    {#if pathname !== '/'}
      <a href="/" class="tool tool-search" aria-label="Rechercher" title="Rechercher (Ctrl K)" aria-haspopup="dialog" onclick={openSearch}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <span class="tool-search-label">Rechercher</span>
        <kbd class="tool-search-kbd" aria-hidden="true">Ctrl K</kbd>
      </a>
    {/if}

    <a href="/classe" class="tool tool-wide" class:is-active={isActive('/classe')} aria-label="Rejoindre une session en direct" title="Rejoindre une session de QCM en direct">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.6 4.6a10.5 10.5 0 000 14.8M19.4 4.6a10.5 10.5 0 010 14.8"/>
      </svg>
      <span class="tool-label">Rejoindre</span>
    </a>

    <a href={listHref} class="tool tool-list" class:is-active={listActive} aria-label={listLabel} title="Ma liste">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
      <span class="tool-label">Ma liste</span>
      {#if seanceCount > 0}
        <span class="list-counter">{seanceCount}</span>
      {/if}
    </a>

    <a href="/about" class="tool tool-wide tool-icon about-link" class:is-active={isActive('/about')} aria-label="À propos et aide" title="À propos et aide">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
      </svg>
    </a>

    <!-- Téléphone : les rubriques et les accès secondaires passent dans un menu. -->
    <div class="app-menu" bind:this={menuRoot}>
      <button
        type="button"
        class="tool tool-icon"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls="app-menu-panel"
        onclick={() => (menuOpen = !menuOpen)}
      >
        {#if menuOpen}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12"/></svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        {/if}
      </button>

      {#if menuOpen}
        <nav id="app-menu-panel" class="app-menu-panel" aria-label="Menu">
          <a href="/browse" class:is-active={isActive('/browse')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Parcourir
          </a>
          <a href="/classe" class:is-active={isActive('/classe')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.6 4.6a10.5 10.5 0 000 14.8M19.4 4.6a10.5 10.5 0 010 14.8"/></svg>
            Rejoindre une session
          </a>
          <a href="/create" class:is-active={isActive('/create')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Créer <span class="beta-badge">bêta</span>
          </a>
          <hr />
          <a href="/about" class="app-menu-muted" class:is-active={isActive('/about')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
            À propos et aide
          </a>
        </nav>
      {/if}
    </div>
  </div>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--spacing-header);
    padding: 0 20px;
    background: var(--color-interface-bg-primary);
    border-bottom: 1px solid var(--color-interface-border-primary);
    flex-shrink: 0;
  }

  .app-header-left,
  .app-header-right {
    display: flex;
    align-items: center;
  }

  .app-header-left { gap: 24px; }
  .app-header-right { gap: 6px; }

  .app-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--color-interface-text-primary);
    text-decoration: none;
  }

  .app-brand-mark {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-brand-500);
    display: grid;
    place-items: center;
    color: white;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 14px;
  }

  .app-brand-name {
    font-family: "Avenir Next", "Nunito", "Segoe UI", system-ui, sans-serif;
    font-weight: 650;
    font-size: 17px;
    line-height: 1;
    letter-spacing: 0;
    color: var(--color-interface-text-primary);
    text-transform: lowercase;
  }

  .app-brand-name-accent { color: var(--color-brand-500); }

  /* Rubriques (gauche) et outils (droite) partagent le même lien de base. */
  .app-nav {
    display: flex;
    gap: 2px;
  }

  .app-nav a,
  .tool {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--color-interface-text-secondary);
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .app-nav a:hover,
  .tool:hover {
    background: var(--color-interface-bg-tertiary);
    color: var(--color-interface-text-primary);
  }

  .app-nav a.is-active,
  .tool.is-active {
    background: var(--color-brand-50);
    color: var(--color-brand-700);
  }

  .tool-icon {
    width: 32px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  /* Recherche : un faux champ, qui mène à l'accueil (comme Ctrl K). */
  .tool-search {
    min-width: 190px;
    justify-content: flex-start;
    border-color: var(--color-interface-border-primary);
    border-radius: 8px;
    background: var(--color-interface-bg-white);
    color: var(--color-interface-text-muted);
    font-weight: 400;
  }

  .tool-search-kbd {
    margin-left: auto;
    padding: 0 5px;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 4px;
    font-family: inherit;
    font-size: 11px;
    line-height: 16px;
    color: var(--color-interface-text-muted);
  }

  /* Ma liste : l'objet de travail, cerclé comme un panier. */
  .tool-list {
    border-color: var(--color-interface-border-primary);
    color: var(--color-interface-text-primary);
  }

  .tool-list.is-active { border-color: var(--color-brand-200, transparent); }

  .tool .list-counter {
    margin-left: 2px;
    position: static;
    box-shadow: none;
  }

  .beta-badge {
    margin-left: 2px;
    padding: 1px 5px;
    border-radius: 9999px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.4;
    color: var(--color-amber-700);
    background: var(--color-amber-50);
    border: 1px solid var(--color-amber-200);
  }

  /* Menu : téléphone seulement. */
  .app-menu { display: none; }

  .app-menu-panel {
    position: fixed;
    top: calc(var(--spacing-header-mobile) + 4px);
    right: 8px;
    z-index: 90;
    display: flex;
    flex-direction: column;
    min-width: 230px;
    padding: 6px;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 12px;
    background: var(--color-interface-bg-primary);
    box-shadow: 0 12px 28px rgb(0 0 0 / 0.14);
  }

  .app-menu-panel a {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    color: var(--color-interface-text-primary);
    text-decoration: none;
  }

  .app-menu-panel a:hover { background: var(--color-interface-bg-tertiary); }
  .app-menu-panel a.is-active { background: var(--color-brand-50); color: var(--color-brand-700); }
  .app-menu-panel .app-menu-muted { color: var(--color-interface-text-secondary); }

  .app-menu-panel hr {
    margin: 4px 6px;
    border: 0;
    border-top: 1px solid var(--color-interface-border-primary);
  }

  /* Tablette : le nom de la marque, redondant avec le logo, cède la place. */
  @media (max-width: 900px) {
    .app-brand-name { display: none; }
    .app-header-left { gap: 16px; }
    .tool-search { min-width: 0; }
    .tool-search-kbd { display: none; }
  }

  /* Petite tablette : Rejoindre et Rechercher gardent leur icône seule. */
  @media (max-width: 760px) {
    .tool-search,
    .tool-wide {
      width: 32px;
      padding: 0;
      justify-content: center;
    }
    .tool-search { border-radius: 50%; }
    .tool-search-label,
    .tool-wide .tool-label { display: none; }
  }

  /* Téléphone : logo, recherche, Ma liste et le menu. */
  @media (max-width: 640px) {
    .app-header {
      height: var(--spacing-header-mobile);
      padding: 0 12px;
    }

    .app-nav,
    .tool-wide { display: none; }

    .app-menu { display: block; }

    .tool {
      height: 40px;
      min-width: 40px;
    }

    .tool-search,
    .tool-icon {
      width: 40px;
      border-radius: 50%;
    }

    .tool-list {
      padding: 0 12px;
      border-radius: 9999px;
    }

    .tool-list .tool-label { display: none; }
  }
</style>
