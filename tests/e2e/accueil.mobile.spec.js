import { test, expect } from '@playwright/test';

// Page d'accueil sur téléphone : les accès par classification doivent tenir en
// peu de place et rester utilisables au toucher.

test.describe('Accueil sur mobile', () => {
  test('la page ne déborde pas et le carrousel est visible sans défiler', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.landing-hero')).toBeVisible();

    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement).toBeLessThanOrEqual(1);

    const titre = page.getByRole('heading', { name: 'À découvrir' });
    const boite = await titre.boundingBox();
    expect(boite.y + boite.height).toBeLessThanOrEqual(page.viewportSize().height);
  });

  test('les filières se choisissent dans une liste déroulante, sans rangée de puces', async ({ page }) => {
    // Seuls les filtres sont vérifiés : /api/search est limité à 30 requêtes par minute.
    await page.route('**/api/search*', route => route.abort());
    await page.goto('/');
    await expect(page.locator('.prepa-chips')).toBeHidden();
    await expect(page.locator('.carousel-nav-btn').first()).toBeHidden();

    // Le focus du champ prouve que la page est hydratée : sans cela, le choix ne ferait rien.
    await expect(page.locator('.landing-input-wrap input')).toBeFocused();
    await page.locator('#landing-filiere').selectOption('PCSI');
    await expect(page).toHaveURL(/[?&]filiere=PCSI/);
    await expect(page.locator('.active-filters')).toContainText('Filière : PCSI');
  });

  test('les cartes du carrousel gardent leur cadre et ne défilent pas seules', async ({ page }) => {
    await page.goto('/');
    const carte = page.locator('.random-carousel__item .result-card').first();
    await expect(carte).toBeVisible();
    // Sur mobile, les lignes de liste perdent leurs bords latéraux : pas les cartes du carrousel.
    await expect(carte).toHaveCSS('border-left-width', '1px');

    const piste = page.locator('.random-carousel__track');
    const avant = await piste.evaluate(el => el.scrollLeft);
    await page.waitForTimeout(4800);
    expect(await piste.evaluate(el => el.scrollLeft)).toBe(avant);
  });
});

test.describe('En-tête sur mobile', () => {
  test('les rubriques passent dans un menu qui se referme en changeant de page', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.locator('.app-nav')).toBeHidden();

    const menu = page.getByRole('button', { name: 'Menu' });
    // Un clic avant l'hydratation ne fait rien : on recommence jusqu'à l'ouverture.
    await expect(async () => {
      if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true', { timeout: 500 });
    }).toPass();
    await page.locator('.app-menu-panel').getByRole('link', { name: /Créer/ }).click();

    await expect(page).toHaveURL(/\/create$/);
    await expect(page.locator('.app-menu-panel')).toHaveCount(0);
  });
});
