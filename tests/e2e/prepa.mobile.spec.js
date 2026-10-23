import { test, expect } from '@playwright/test';

// Vue Prépa sur téléphone : la page d'une section, avec son tableau des
// contenus officiels, tient dans la largeur de l'écran.

test.describe('Vue Prépa sur mobile', () => {
  test('la page d’une sous-section ne déborde pas en largeur', async ({ page }) => {
    await page.goto('/browse?vue=prepa&noeud=pcsi.nombres-complexes.f');
    await expect(page.locator('.prepa-noeud-head h2')).toContainText('Racines');
    await expect(page.locator('.prepa-exercices .exercise-card').first()).toBeVisible();

    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement).toBeLessThanOrEqual(1);
  });
});
