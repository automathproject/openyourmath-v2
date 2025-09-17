<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
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
          <a href="/" class="brand-link">OpenYourMath</a>
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
          À propos
        </a>
        
        <!-- LE LIEN VERS LA LISTE A ÉTÉ DÉPLACÉ D'ICI -->
      </nav>

      <!-- NOUVEAU BLOC : Actions du header (liste + menu mobile) -->
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
        <!-- LE LIEN VERS LA LISTE EST MAINTENANT ICI, EN DEHORS DE .desktop-nav -->
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
          
          <!-- LIEN VERS LA LISTE SUPPRIMÉ D'ICI CAR L'ICÔNE EST TOUJOURS VISIBLE -->
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
      <p class="footer-text">OpenYourMath V2 - Exercices de mathématiques</p>
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
    background: white;
    border-bottom: 1px solid #e5e7eb;
    transition: all 0.3s ease;
  }
  
  .header-scrolled {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border-bottom-color: #d1d5db;
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
    color: #111827;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  
  .brand-link:hover {
    color: #2563eb;
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
    color: #6b7280;
    text-decoration: none;
    font-weight: 500;
    padding: 0.5rem 0;
    position: relative;
    transition: color 0.2s ease;
  }
  
  .nav-link:hover {
    color: #111827;
  }
  
  .nav-link--active {
    color: #2563eb;
  }
  
  .nav-link--active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: #2563eb;
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
    background-color: #2563eb;
    color: white;
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
    background: #374151;
    transition: all 0.3s ease;
    transform-origin: center;
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
    background: white;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    animation: slideDown 0.3s ease;
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
    color: #374151;
    text-decoration: none;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    font-weight: 500;
  }
  
  .mobile-nav-link:hover {
    background: #f3f4f6;
    color: #111827;
  }
  
  .mobile-nav-link--active {
    background: #eff6ff;
    color: #2563eb;
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
    padding: 2rem 1rem;
  }
  .footer {
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }
  .footer-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .footer-text {
    text-align: center;
    color: #6b7280;
    margin: 0;
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
      padding: 1.5rem 1rem;
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
      padding: 1.5rem;
    }
  }
  
  /* Desktop: ≥ 1024px */
  @media (min-width: 1024px) {
    .header-content {
      padding: 0 2rem;
    }
    
    .main-content {
      padding: 2rem;
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
      padding: 2rem 1rem;
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
