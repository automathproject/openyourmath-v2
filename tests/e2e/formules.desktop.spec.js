import { test, expect } from '@playwright/test';

// Formules affichées sur ordinateur : une barre de défilement n'apparaît que sous
// une formule réellement plus large que sa colonne.

// Équations numérotées (\tag, \label) ou en gather, qui occupent toute la largeur
// et dont l'exposant final dépassait de 2 px : la barre de défilement s'affichait
// sous une formule qui tient.
const EQUATIONS_QUI_TIENNENT = ['CY3X', 'IU5R', 'Kv8O', 'M5ZZ', 'UFz1', 'r6cP'];

const defilements = page =>
  page.evaluate(() => [...document.querySelectorAll('.katex-display')].map(d => d.scrollWidth - d.clientWidth));

test.describe('Formules affichées sur ordinateur', () => {
  for (const uuid of EQUATIONS_QUI_TIENNENT) {
    test(`aucune barre de défilement sous une équation qui tient (${uuid})`, async ({ page }) => {
      await page.goto(`/exercise/${uuid}`);
      await expect(page.locator('.katex-display').first()).toBeVisible();
      for (const reste of await defilements(page)) expect(reste).toBeLessThanOrEqual(0);
    });
  }

  test('une formule plus large que la colonne défile toujours, sans élargir la page', async ({ page }) => {
    // LUxw : des décompositions en éléments simples de 1000 à 1200 px de large.
    await page.goto('/exercise/LUxw');
    await expect(page.locator('.katex-display').first()).toBeVisible();
    const tailles = await defilements(page);
    expect(tailles.length).toBeGreaterThan(0);
    for (const reste of tailles) expect(reste).toBeGreaterThan(100);

    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(debordement).toBeLessThanOrEqual(1);
  });
});
