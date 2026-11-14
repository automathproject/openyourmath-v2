import { test, expect } from '@playwright/test';

// « Rechercher » dans l'en-tête et Ctrl K ouvrent une fenêtre de recherche
// par-dessus la page courante, au lieu de renvoyer à l'accueil.

test.describe('Fenêtre de recherche', () => {
  test('s’ouvre par-dessus la page et se referme sans la quitter', async ({ page }) => {
    await page.goto('/exercise/list?fiche=fic00012');
    await expect(page).toHaveTitle(/\(11\)/);

    const fenetre = page.getByRole('dialog', { name: 'Rechercher des exercices' });
    const bouton = page.locator('.app-header').getByRole('link', { name: 'Rechercher' });
    // Avant l'hydratation, le clic suivrait le lien : on recommence jusqu'à l'ouverture.
    await expect(async () => {
      if (!(await fenetre.isVisible())) await bouton.click();
      await expect(fenetre).toBeVisible({ timeout: 500 });
    }).toPass();
    await expect(page).toHaveURL(/\/exercise\/list\?fiche=fic00012$/);
    await expect(fenetre.getByRole('searchbox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(fenetre).toBeHidden();
    await expect(page).toHaveTitle(/\(11\)/);
  });

  test('Ctrl K puis Entrée mène aux résultats et garde la recherche en mémoire', async ({ page }) => {
    // Seule la navigation est vérifiée : /api/search est limité à 30 requêtes par minute.
    await page.route('**/api/search*', route => route.abort());
    await page.goto('/browse');

    const fenetre = page.getByRole('dialog', { name: 'Rechercher des exercices' });
    await expect(async () => {
      if (!(await fenetre.isVisible())) await page.keyboard.press('Control+k');
      await expect(fenetre).toBeVisible({ timeout: 500 });
    }).toPass();
    await page.keyboard.type('théorème de Rolle');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/\?q=th%C3%A9or%C3%A8me(\+|%20)de(\+|%20)Rolle/);
    await expect(page.locator('.search-page input[type="search"]')).toHaveValue('théorème de Rolle');

    await page.goto('/browse');
    await expect(async () => {
      if (!(await fenetre.isVisible())) await page.keyboard.press('Control+k');
      await expect(fenetre).toBeVisible({ timeout: 500 });
    }).toPass();
    await expect(fenetre.getByRole('option', { name: 'théorème de Rolle' })).toBeVisible();
  });
});
