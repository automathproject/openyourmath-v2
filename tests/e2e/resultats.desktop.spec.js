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
});
