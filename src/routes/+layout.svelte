<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import { env } from '$env/dynamic/public';
  import { 
    listCount, 
    listActions,
    exerciseList
  } from '$lib/stores/listStore.js';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  
  let listUrl = '/exercise/list';
  let mobileMenuOpen = false;
  let headerScrolled = false;
  const APP_VERSION = env.PUBLIC_APP_VERSION || 'dev';
  const currentYear = new Date().getFullYear();
  
  // Réactivité pour détecter si on est sur la page de liste
  $: isListPage = $page.route.id === '/exercise/list';
  $: isHomePage = $page.route.id === '/';
  
  // Mettre à jour l'URL de la liste de manière réactive
  $: if ($exerciseList && $exerciseList.length > 0) {
    const uuids = $exerciseList.map(ex => ex.uuid).join(',');
    // Ne pas encoder les virgules pour voir "uuid1,uuid2" dans l'URL
    listUrl = `/exercise/list?list=${uuids}`;
  } else {
    listUrl = '/exercise/list';
  }
  
  // Description de la liste pour le tooltip
  $: listDescription = (() => {
    if ($listCount === 0) return 'Aucun exercice dans votre liste';
    if ($listCount === 1) return '1 exercice dans votre liste';
    return `${$listCount} exercices dans votre liste`;
  })();

  // Gestion du scroll pour l'ombrage du header
  function handleScroll() {
    headerScrolled = window.scrollY > 10;
  }

  // Fermer le menu mobile quand on clique ailleurs
  function handleClickOutside(event) {
    if (mobileMenuOpen && !event.target.closest('.mobile-nav')) {
      mobileMenuOpen = false;
    }
  }

  // Fermer le menu mobile lors du changement de page
  $: if ($page) {
    mobileMenuOpen = false;
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<svelte:window on:scroll={handleScroll} />

<div class="min-h-screen">
  <header 
    class="header-container"
    class:header-scrolled={headerScrolled}
  >
    <div class="header-content">
      <div class="header-brand">
        <h1 class="brand-title">
          <a href="/" class="brand-link">
            <span class="brand-icon" aria-hidden="true"></span>
            <span>OpenYourMath</span>
            <span class="brand-version">v{APP_VERSION}</span>
          </a>
        </h1>
      </div>
      
      <!-- Navigation desktop -->
      <nav class="desktop-nav">
        <a 
          href="/" 
          class="nav-link"
          class:nav-link--active={isHomePage}
          aria-label="Rechercher des exercices"
          title="Rechercher des exercices"
        >
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="nav-text">Rechercher</span>
        </a>
        
        <a 
          href="/about"
          class="nav-link"
          class:nav-link--active={$page.route.id === '/about'}
        >
          <span class="nav-text">À propos</span>
        </a>
              </nav>

      <div class="header-actions">
        <!-- Lien recherche visible sur mobile (icône seule) -->
        <a 
          href="/"
          class="nav-link mobile-search-link"
          aria-label="Rechercher des exercices"
          title="Rechercher des exercices"
        >
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="nav-text">Rechercher</span>
        </a>
        <a 
          href={listUrl}
          class="nav-link nav-link--list"
          class:nav-link--active={isListPage}
          title={listDescription}
        >
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          
          <span class="nav-text">Ma liste</span>
          
          {#if $listCount > 0}
            <span class="list-counter">
              {$listCount}
            </span>
          {/if}
        </a>

        <!-- Bouton menu mobile -->
        <button 
          class="mobile-menu-button mobile-nav"
          class:mobile-menu-button--open={mobileMenuOpen}
          on:click={() => mobileMenuOpen = !mobileMenuOpen}
          aria-label="Menu de navigation"
        >
          <div class="hamburger-line"></div>
          <div class="hamburger-line"></div>
          <div class="hamburger-line"></div>
        </button>
      </div>
    </div>

    <!-- Menu mobile -->
    {#if mobileMenuOpen}
      <div class="mobile-menu mobile-nav">
        <div class="mobile-menu-content">
          <a 
            href="/" 
            class="mobile-nav-link"
            class:mobile-nav-link--active={isHomePage}
            on:click={() => mobileMenuOpen = false}
          >
            <svg class="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Recherche</span>
          </a>
          
          <a 
            href="/about"
            class="mobile-nav-link"
            class:mobile-nav-link--active={$page.route.id === '/about'}
            on:click={() => mobileMenuOpen = false}
          >
            <svg class="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>À propos</span>
          </a>
        </div>
      </div>
    {/if}
  </header>

  <main class="main-content">
    <slot />
  </main>

  <footer class="footer print-hidden">
    <div class="footer-content">
      <div class="footer-grid">

        <!-- Zone 1 : Identité -->
        <div class="footer-identity">
          <a href="/" class="footer-brand">
            <span class="brand-dot" aria-hidden="true"></span>
            <span class="footer-brand-name">OpenYourMath</span>
          </a>
          <p class="footer-tagline">
            Exercices de maths libres, sans collecte de données personnelles.
          </p>
          <p class="footer-license">
            Contenus :
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" class="footer-link-subtle" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
          </p>
        </div>

        <!-- Zone 2 : Navigation secondaire -->
        <nav class="footer-nav" aria-label="Liens du pied de page">
          <p class="footer-nav-heading" aria-hidden="true">Navigation</p>
          <a href="/about" class="footer-nav-link">À propos</a>
          <a href="/mentions-legales" class="footer-nav-link">Mentions légales</a>
          <a href="mailto:maxime.nguyen@st-cyr.terre-net.defense.gouv.fr" class="footer-nav-link">Contact</a>
        </nav>

        <!-- Zone 3 : CTA + Infos techniques -->
        <div class="footer-actions-col">
          <a
            href="https://forge.apps.education.fr/automath/openyourmath-v2"
            class="footer-cta"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg class="footer-cta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Contribuer au projet
          </a>
          <div class="footer-tech">
            <p>Hébergement OVH (FR) · HTTPS Caddy</p>
            <p>Version {APP_VERSION}</p>
          </div>
        </div>

      </div>

      <div class="footer-bottom">
        <p class="footer-copyright">
          © {currentYear} OpenYourMath — Partagez, apprenez.
        </p>
      </div>
    </div>
  </footer>

</div>

<style>
  /* ==============================================
     HEADER STYLES
     ============================================== */
  
  .header-container {
    position: sticky;
    top: 0;
    z-index: 50;
    transition: all 0.3s ease;
    @apply bg-interface-bg-primary border-b border-gray-200;
  }
  
  .header-scrolled {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    @apply border-gray-300;
  }
  
  .header-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 4rem;
    transition: height 0.3s ease;
  }
  
  .header-scrolled .header-content {
    height: 3.5rem;
  }
  
  /* ==============================================
     BRAND
     ============================================== */
  
  .header-brand {
    display: flex;
    align-items: center;
    /* On force le brand à ne pas rétrécir pour laisser la place aux actions */
    flex-shrink: 0; 
  }
  
  .brand-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    transition: font-size 0.3s ease;
  }
  
  .header-scrolled .brand-title {
    font-size: 1.25rem;
  }
  
  .brand-link {
    text-decoration: none;
    transition: color 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    @apply text-interface-text-primary hover:text-brand-primary;
  }

  .brand-icon {
    display: inline-block;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    @apply bg-brand-500;
  }
  .brand-version {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.08rem 0.4rem;
    border-radius: 9999px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    @apply bg-gray-100 text-gray-600 border border-gray-200;
  }
  
  /* ==============================================
     DESKTOP NAVIGATION & ACTIONS
     ============================================== */
  
  .desktop-nav {
    display: flex;
    align-items: center;
    gap: 2rem;
  }
  
  /* NOUVEAU STYLE : Conteneur pour les actions à droite */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* Espace entre l'icône liste et le bouton hamburger */
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    font-weight: 500;
    padding: 0.5rem 0;
    position: relative;
    transition: color 0.2s ease;
    @apply text-interface-text-secondary hover:text-interface-text-primary;
  }
  
  .nav-link--active {
    @apply text-brand-primary;
  }
  
  .nav-link--active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: theme('colors.brand.primary');
    border-radius: 1px;
  }
  
  .nav-link--list {
    position: relative;
  }
  
  .nav-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }
  
  .nav-text {
    font-size: 0.875rem;
  }

  .list-counter {
    /* Style pour le compteur, vous pouvez l'ajuster */
    position: absolute;
    top: -2px;
    right: -8px;
    background-color: theme('colors.brand.primary');
    @apply text-white;
    border-radius: 50%;
    width: 1rem;
    height: 1rem;
    font-size: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    border: 1px solid white;
  }
  
  /* ==============================================
     MOBILE MENU BUTTON
     ============================================== */
  
  .mobile-menu-button {
    display: none; /* Caché par défaut */
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 2.5rem;
    height: 2.5rem;
    background: none;
    border: none;
    cursor: pointer;
    gap: 0.25rem;
    transition: all 0.3s ease;
  }
  
  .hamburger-line {
    width: 1.25rem;
    height: 2px;
    transition: all 0.3s ease;
    transform-origin: center;
    @apply bg-gray-700;
  }
  
  .mobile-menu-button--open .hamburger-line:nth-child(1) {
    transform: rotate(45deg) translate(0.25rem, 0.25rem);
  }
  
  .mobile-menu-button--open .hamburger-line:nth-child(2) {
    opacity: 0;
    transform: scale(0);
  }
  
  .mobile-menu-button--open .hamburger-line:nth-child(3) {
    transform: rotate(-45deg) translate(0.25rem, -0.25rem);
  }
  
  /* ==============================================
     MOBILE MENU
     ============================================== */
  
  .mobile-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    animation: slideDown 0.3s ease;
    @apply bg-interface-bg-primary border-b border-gray-200;
  }
  
  .mobile-menu-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .mobile-nav-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    @apply text-gray-700;
    text-decoration: none;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    font-weight: 500;
  }
  
  .mobile-nav-link:hover {
    @apply bg-gray-100 text-interface-text-primary;
  }
  
  .mobile-nav-link--active {
    @apply bg-brand-50 text-brand-primary;
  }
  
  .mobile-nav-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* ==============================================
     MAIN CONTENT & FOOTER
     (Pas de changements ici)
     ============================================== */
  
  .main-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0;
  }
  /* ==============================================
     FOOTER
     ============================================== */

  .footer {
    @apply bg-interface-bg-secondary border-t border-gray-200;
  }

  .footer-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 1.5rem;
  }

  /* Grille responsive */
  .footer-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 768px) {
    .footer-grid {
      grid-template-columns: 1.6fr 1fr 1.2fr;
      gap: 2.5rem;
      align-items: start;
    }
  }

  /* Zone 1 : Identité */
  .footer-identity {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .footer-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    width: fit-content;
    border-radius: 3px;
    transition: color 0.2s;
    @apply text-interface-text-primary hover:text-brand-primary;
  }

  .footer-brand:focus-visible {
    outline: 2px solid theme('colors.brand.primary');
    outline-offset: 3px;
  }

  .brand-dot {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 9999px;
    flex-shrink: 0;
    @apply bg-brand-500;
  }

  .footer-brand-name {
    font-weight: 700;
    font-size: 1rem;
  }

  .footer-tagline {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.55;
    @apply text-interface-text-secondary;
  }

  .footer-license {
    margin: 0;
    font-size: 0.75rem;
    @apply text-gray-400;
  }

  .footer-link-subtle {
    @apply text-gray-400 hover:text-gray-600;
    text-decoration: underline;
    text-underline-offset: 2px;
    border-radius: 2px;
    transition: color 0.2s;
  }

  .footer-link-subtle:focus-visible {
    outline: 2px solid theme('colors.brand.primary');
    outline-offset: 2px;
  }

  /* Zone 2 : Navigation secondaire */
  .footer-nav {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .footer-nav-heading {
    margin: 0 0 0.2rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    @apply text-gray-400;
  }

  .footer-nav-link {
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    width: fit-content;
    border-radius: 3px;
    transition: color 0.2s;
    @apply text-interface-text-secondary hover:text-interface-text-primary;
  }

  .footer-nav-link:focus-visible {
    outline: 2px solid theme('colors.brand.primary');
    outline-offset: 3px;
  }

  /* Zone 3 : CTA + Technique */
  .footer-actions-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .footer-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.5rem;
    text-decoration: none;
    transition: all 0.2s;
    @apply text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200;
  }

  .footer-cta:focus-visible {
    outline: 2px solid theme('colors.brand.primary');
    outline-offset: 3px;
  }

  .footer-cta-icon {
    width: 0.95rem;
    height: 0.95rem;
    flex-shrink: 0;
  }

  .footer-tech {
    font-size: 0.7rem;
    line-height: 1.65;
    @apply text-gray-400;
  }

  .footer-tech p {
    margin: 0;
  }

  /* Bottom bar */
  .footer-bottom {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  .footer-copyright {
    text-align: center;
    font-size: 0.75rem;
    margin: 0;
    @apply text-gray-400;
  }

  
  /* ==============================================
     RESPONSIVE BREAKPOINTS
     ============================================== */
  
  /* Mobile: < 768px */
  @media (max-width: 767px) {
    .desktop-nav {
      display: none;
    }
    
    .mobile-menu-button {
      display: flex; /* Le bouton hamburger devient visible */
    }

    /* MODIFIÉ : On masque le texte du lien de la liste, mais pas l'icône */
    .nav-link--list .nav-text {
      display: none;
    }
    
    .header-content {
      padding: 0 1rem;
      gap: 0.75rem;
    }
    
    .main-content {
      padding: 0;
    }
    
    .brand-title {
      font-size: 1.25rem;
    }
    
    .header-scrolled .brand-title {
      font-size: 1.125rem;
    }

    /* Lien recherche mobile visible (icône), texte masqué */
    .mobile-search-link { display: flex !important; }
    .mobile-search-link .nav-text { display: none; }
  }
  
  /* Tablet: 768px - 1023px */
  @media (min-width: 768px) and (max-width: 1023px) {
    .nav-link--list .nav-text {
      display: none;
    }
    
    .desktop-nav {
      gap: 1.5rem;
    }
    
    .header-content {
      padding: 0 1.5rem;
    }
    
    .main-content {
      padding: 0;
    }
  }
  
  /* Desktop: ≥ 1024px */
  @media (min-width: 1024px) {
    .header-content {
      padding: 0 2rem;
    }
    
    .main-content {
      padding: 0;
    }
  }

  /* Masquer le lien recherche mobile par défaut (affiché via MQ mobile) */
  .mobile-search-link { display: none; }
  
  /* Large screens: ≥ 1280px */
  @media (min-width: 1280px) {
    .header-content {
      padding: 0 1rem;
    }
    
    .main-content {
      padding: 0;
    }
  }
  
  /* Very small screens: < 380px */
  @media (max-width: 379px) {
    .header-content {
      padding: 0 0.75rem;
    }
    
    .brand-title {
      font-size: 1.125rem;
    }
    
    .header-scrolled .brand-title {
      font-size: 1rem;
    }
    
    .mobile-menu-button {
      width: 2rem;
      height: 2rem;
    }
    
    .hamburger-line {
      width: 1rem;
    }
  }
</style>
