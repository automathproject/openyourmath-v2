import { test, expect } from '@playwright/test';

// Les fiches vivent dans Ma liste : catalogue quand la liste est vide, panneau
// « Fiches » quand elle est remplie. Une liste remplie n'est jamais remplacée
// sans qu'on l'ait choisi.

test.describe('Fiches dans Ma liste', () => {
  test('la liste vide propose les fiches, et une carte charge la fiche', async ({ page }) => {
    await page.goto('/exercise/list');
    await expect(page.getByRole('heading', { name: 'Partir d\'une fiche' })).toBeVisible();

    const cartes = page.locator('.catalogue--cards .catalogue-item');
    await expect(cartes).toHaveCount(6);

    await page.getByRole('searchbox', { name: 'Filtrer les fiches' }).fill('quadriques');
    await expect(cartes.first()).toContainText('Quadriques');
    await cartes.first().click();

    await expect(page).toHaveURL(/\/exercise\/list\?fiche=fic00133$/);
    await expect(page).toHaveTitle(/^Quadriques \(14\)/);
  });

  test('une fiche s’ajoute à la suite d’une liste remplie, sous son nom', async ({ page }) => {
    await page.goto('/exercise/list?fiche=fic00012');
    await expect(page).toHaveTitle(/\(11\)/);

    await page.getByRole('button', { name: 'Ajouter ou ouvrir une fiche' }).first().click();
    const panneau = page.locator('.fiches-panel');
    await panneau.getByRole('searchbox').fill('quadriques');
    await panneau.locator('.catalogue-item', { hasText: 'Quadriques' }).first().click();

    const choix = page.getByRole('dialog', { name: /Quadriques/ });
    await expect(choix).toContainText('votre liste en contient déjà 11');
    await choix.getByRole('button', { name: /Ajouter à la suite/ }).click();

    await expect(page).toHaveTitle(/\(25\)/);
    await expect(page.locator('.exercise-section-heading', { hasText: 'Quadriques' })).toBeVisible();
    await expect(panneau).toHaveCount(0);
  });

  test('« Remplacer ma liste » ouvre la fiche à la place', async ({ page }) => {
    await page.goto('/exercise/list?fiche=fic00012');
    await expect(page).toHaveTitle(/\(11\)/);

    await page.getByRole('button', { name: 'Ajouter ou ouvrir une fiche' }).first().click();
    const panneau = page.locator('.fiches-panel');
    await panneau.getByRole('searchbox').fill('quadriques');
    await panneau.locator('.catalogue-item', { hasText: 'Quadriques' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Remplacer ma liste/ }).click();

    await expect(page).toHaveURL(/\?fiche=fic00133$/);
    await expect(page).toHaveTitle(/^Quadriques \(14\)/);
  });

  test('Échap referme le panneau sans toucher à la liste', async ({ page }) => {
    await page.goto('/exercise/list?fiche=fic00012');
    await page.getByRole('button', { name: 'Ajouter ou ouvrir une fiche' }).first().click();
    await expect(page.locator('.fiches-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fiches-panel')).toHaveCount(0);
    await expect(page).toHaveTitle(/\(11\)/);
  });
});
