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
  import { goto } from '$app/navigation';
  import AppHeader from '$lib/components/AppHeader.svelte';

  const APP_VERSION = env.PUBLIC_APP_VERSION || 'dev';
  const currentYear = new Date().getFullYear();

  onMount(() => {
    function handleKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        goto('/');
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<AppHeader seanceCount={$listCount} />

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

<style>
  /* ==============================================
     MAIN CONTENT
     ============================================== */

  .main-content {
    padding: 0;
  }

  /* ==============================================
     FOOTER
     ============================================== */

  .footer {
    @apply bg-interface-bg-secondary border-t border-interface-border-primary;
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

  @media (max-width: 767px) {
    .footer-content {
      padding: 1.4rem 1.25rem 1rem;
    }

    .footer-grid {
      gap: 1.2rem;
    }

    .footer-identity {
      gap: 0.25rem;
    }

    .footer-tagline {
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .footer-nav {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.45rem 1rem;
    }

    .footer-nav-heading {
      flex-basis: 100%;
      margin-bottom: 0;
    }

    .footer-actions-col {
      gap: 0.65rem;
    }

    .footer-cta {
      padding: 0.4rem 0.75rem;
      font-size: 0.82rem;
    }

    .footer-tech {
      line-height: 1.45;
    }

    .footer-bottom {
      margin-top: 1.25rem;
      padding-top: 0.8rem;
    }
  }

</style>
