import { test, expect } from '@playwright/test';
import { ouvrirRecherche } from './helpers.js';

test('le retour arrière restaure les résultats chargés et la position', async ({ page }) => {
  await ouvrirRecherche(page, 'matrice');

  await page.locator('.load-more-header-btn').click();
  await expect(page.locator('.result-card')).toHaveCount(40);

  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(400);
  const defilement = await page.evaluate(() => Math.round(window.scrollY));
  expect(defilement).toBeGreaterThan(2000);

  // L'URL porte la requête et les filtres, mais ni la pagination ni le
  // défilement : sans mémorisation on retombait sur 20 résultats, en haut.
  await page.locator('a', { hasText: 'Parcourir' }).first().click();
  await expect(page).toHaveURL(/\/browse/);

  await page.goBack();
  await expect(page.locator('.result-card')).toHaveCount(40);
  await expect
    .poll(async () => page.evaluate(() => Math.round(window.scrollY)))
    .toBeGreaterThan(2000);
});
