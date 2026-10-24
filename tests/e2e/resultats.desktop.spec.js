import { test, expect } from '@playwright/test';
import { ouvrirRecherche, preparerPanneau } from './helpers.js';

test.describe('Résultats de recherche', () => {
  test("le titre d'un résultat est un lien vers la page de l'exercice", async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');

    const titres = page.locator('.result-card .result-title-link');
    await expect(titres.first()).toHaveAttribute('href', /^\/exercise\/.+/);

    // Aucune carte ne doit retomber en simple <div> cliquable : c'est ce qui
    // privait la page de clic milieu, de « copier l'adresse » et d'indexation.
    const cartes = await page.locator('.result-card').count();
    expect(await titres.count()).toBe(cartes);
  });

  test('un clic simple sur le titre prévisualise sans quitter la page', async ({ page }) => {
    await preparerPanneau(page, true);
    await ouvrirRecherche(page, 'matrice');

    const url = page.url();
    await page.locator('.result-card .result-title-link').nth(1).click();

    await expect(page.locator('.result-card--selected')).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('re-cliquer le résultat déjà prévisualisé ne ferme pas le panneau', async ({ page }) => {
    await preparerPanneau(page, true);
    await ouvrirRecherche(page, 'matrice');

    const titre = page.locator('.result-card .result-title-link').nth(1);
    await titre.click();
    await expect(page.locator('.preview-section')).toBeVisible();

    // La sélection était une bascule : le second clic refermait tout, et les
    // cartes repassaient de compact à détaillé sous le curseur.
    await titre.click();
    await titre.click();
    await expect(page.locator('.preview-section')).toBeVisible();
  });

  test('la barre de recherche reste entièrement visible au défilement', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');
    await page.mouse.wheel(0, 1500);
    await expect(page.locator('.result-card').nth(5)).toBeVisible();

    const champ = await page.locator('.search-hero-band input[type=search]').boundingBox();
    const entete = await page.locator('.header-shell').boundingBox();

    // La bande collante glissait sous l'en-tête, lui aussi collant : le champ
    // était amputé de la hauteur de l'en-tête dès qu'on faisait défiler.
    expect(champ.y).toBeGreaterThanOrEqual(entete.y + entete.height);
  });

  test("le bandeau de filtres actifs n'apparaît qu'avec au moins un filtre", async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');
    await expect(page.locator('.active-filters')).toHaveCount(0);

    await page.locator('.sps-level-btn', { hasText: 'L2' }).click();
    await expect(page.locator('.active-filters .chip')).toContainText('L2');
  });

  test('une seule instance de la colonne de filtres est rendue', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');
    // Les variantes desktop et mobile coexistaient dans le DOM, dupliquant les
    // contrôles et les régions aria-live.
    await expect(page.locator('aside.sps')).toHaveCount(1);
  });

  test('le chapitre est atteignable depuis la recherche', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');

    const fil = page.locator('.sidebar-breadcrumb');
    await expect(fil).toBeVisible();
    await expect(fil.locator('.crumb-btn')).toHaveCount(4);

    await fil.locator('.crumb-btn').first().click();
    await page.locator('.crumb-menu button', { hasText: 'L2' }).click();
    await expect(page).toHaveURL(/level=L2/);
  });

  test("« Ouvrir l'exercice » vise un nouvel onglet sur ordinateur", async ({ page }) => {
    // Le pied de carte n'existe qu'en mode détaillé, lui-même conditionné à la
    // colonne de prévisualisation repliée.
    await preparerPanneau(page, false);
    await ouvrirRecherche(page, 'matrice');
    const lien = page.locator('.rc-footer-open').first();
    await expect(lien).toHaveAttribute('target', '_blank');
    await expect(lien).toHaveAttribute('aria-label', /nouvel onglet/);
  });
  test('l’en-tête des résultats reste dans sa colonne quand la prévisualisation est ouverte', async ({ page }) => {
    // Réponse simulée : la colonne n'est étroite qu'avec le panneau ouvert, et
    // /api/search est limité à 30 requêtes par minute (la suite s'en approche).
    const resultats = Array.from({ length: 20 }, (_, i) => ({
      uuid: `FAKE${i}`, title: `Exercice ${i}`, level: 'L2', module: 'Analyse', preview: 'Énoncé.'
    }));
    await page.route('**/api/search*', route => route.fulfill({
      json: {
        results: resultats,
        meta: { mode: 'fts', filters: {}, filterCounts: {}, pagination: { limit: 20, offset: 0, count: 20, hasMore: true, totalCount: 3691 } }
      }
    }));
    await preparerPanneau(page, true);
    await page.setViewportSize({ width: 1150, height: 800 });
    await page.goto('/?level=L2');
    await expect(page.locator('.load-more-header-btn')).toBeVisible();

    const colonne = await page.locator('.search-page-main').boundingBox();
    const panneau = await page.locator('.preview-section').boundingBox();
    for (const sel of ['.load-more-header-btn', '.view-mode-toggle']) {
      const b = await page.locator(sel).boundingBox();
      expect(b.x + b.width, `${sel} dépasse la colonne des résultats`).toBeLessThanOrEqual(colonne.x + colonne.width + 1);
      expect(b.x + b.width, `${sel} passe sous le panneau`).toBeLessThanOrEqual(panneau.x + 1);
    }
  });
  test('un titre générique devient une référence discrète, pas un intertitre', async ({ page }) => {
    // Réponse simulée : /api/search est limité à 30 requêtes par minute.
    await page.route('**/api/search*', route => route.fulfill({
      json: {
        results: [
          { uuid: 'GEN1', title: 'exo7 2440', level: 'L2', module: 'Algèbre', preview: 'Soit G un groupe.' },
          { uuid: 'REAL', title: 'Produit matriciel', level: 'L1', module: 'Algèbre', preview: 'On considère la matrice.' }
        ],
        meta: { mode: 'fts', filters: {}, filterCounts: {}, pagination: { limit: 20, offset: 0, count: 2, hasMore: false, totalCount: 2 } }
      }
    }));
    await preparerPanneau(page, false);
    await page.goto('/?q=matrice');
    const generique = page.locator('.result-card', { hasText: 'exo7 2440' });
    const reel = page.locator('.result-card', { hasText: 'Produit matriciel' });
    await expect(generique).toBeVisible();

    // La référence reste un lien, mais n'est plus un titre de section.
    await expect(generique.locator('p.result-title a[href="/exercise/GEN1"]')).toBeVisible();
    await expect(generique.locator('h3')).toHaveCount(0);
    await expect(generique.locator('.result-title')).toHaveCSS('font-size', '12px');

    // Un vrai titre ne change pas.
    await expect(reel.locator('h3.result-title')).toBeVisible();
    await expect(reel.locator('.result-title')).not.toHaveCSS('font-size', '12px');
  });
});
