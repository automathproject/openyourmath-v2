import { test, expect } from '@playwright/test';
import { ouvrirRecherche } from './helpers.js';

test.describe('Autocomplétion du champ de recherche', () => {
  test('la liste propose des entrées du vocabulaire, accents ignorés', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');

    const champ = page.locator('.search-hero-band input[type=search]');
    await champ.fill('integ');

    const liste = page.locator('.typeahead');
    await expect(liste).toBeVisible();
    // « integ » doit trouver « Intégration » : la comparaison se fait sans
    // accents, ce que le LIKE de SQLite ne sait pas faire.
    await expect(liste).toContainText('Intégration');
    await expect(champ).toHaveAttribute('aria-expanded', 'true');
    await expect(liste.locator('[role=option]').first()).toBeVisible();
  });

  test('les flèches parcourent la liste et Entrée applique le filtre', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');

    const champ = page.locator('.search-hero-band input[type=search]');
    await champ.fill('integ');
    await expect(page.locator('.typeahead')).toBeVisible();

    await champ.press('ArrowDown');
    await expect(page.locator('.typeahead-option--active')).toBeVisible();
    await expect(champ).toHaveAttribute('aria-activedescendant', /option-0$/);

    await champ.press('ArrowDown');
    await champ.press('Enter');

    // Une suggestion mène quelque part : elle pose le filtre correspondant au
    // lieu de recopier son libellé dans le champ.
    await expect(page.locator('.typeahead')).toHaveCount(0);
    await expect(page.locator('.active-filters .chip')).toContainText('Chapitre');
    await expect(page).toHaveURL(/chapter=/);
  });

  test('Échap referme la liste sans effacer la requête', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');

    const champ = page.locator('.search-hero-band input[type=search]');
    await champ.fill('integ');
    await expect(page.locator('.typeahead')).toBeVisible();

    await champ.press('Escape');
    await expect(page.locator('.typeahead')).toHaveCount(0);
    await expect(champ).toHaveValue('integ');
  });
});
