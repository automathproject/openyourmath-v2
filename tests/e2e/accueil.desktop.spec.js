import { test, expect } from '@playwright/test';

test("la page d'accueil ne bascule qu'à partir de trois caractères", async ({ page }) => {
  await page.goto('/');
  const champ = page.locator('.landing-input-wrap input');
  await expect(champ).toBeVisible();
  // Le champ prend le focus au montage : l'attendre garantit que le composant
  // est hydraté, sinon les premières frappes partent dans le vide.
  await expect(champ).toBeFocused();
  await champ.click();

  // Frappes réelles, une par une : `fill` et `pressSequentially` reposent sur
  // un focus que l'action `use:focusInput` du champ leur dispute.
  // Une seule lettre ramenait les 8000 exercices et faisait disparaître le
  // hero avant que le premier mot soit écrit.
  await page.keyboard.press('s');
  await page.keyboard.press('u');
  await page.waitForTimeout(800);
  await expect(page.locator('.landing-hero')).toBeVisible();
  await expect(champ).toHaveValue('su');

  await page.keyboard.press('i');
  await expect(page.locator('.results-grid')).toBeVisible();
  await expect(page.locator('.landing-hero')).toHaveCount(0);
  await expect(page).toHaveURL(/q=sui/);
});

test('les puces de classification ouvrent la recherche filtrée, avec le filtre dans l’URL', async ({ page }) => {
  // On ne vérifie ici que les filtres, pas les résultats : /api/search est limité
  // à 30 requêtes par minute et par IP, et la suite entière s'en approche déjà.
  await page.route('**/api/search*', route => route.abort());
  await page.goto('/');
  const puces = page.locator('.browse-rows');
  await expect(puces).toBeVisible();
  // Même attente d'hydratation que ci-dessus : sans elle, le clic suit le lien nu.
  await expect(page.locator('.landing-input-wrap input')).toBeFocused();

  await puces.getByRole('link', { name: 'L2', exact: true }).click();
  await expect(page).toHaveURL(/[?&]level=L2/);
  await expect(page.locator('.active-filters')).toContainText('L2');
  await expect(page.locator('.landing-hero')).toHaveCount(0);

  await page.goto('/');
  await expect(page.locator('.landing-input-wrap input')).toBeFocused();
  await page.locator('.browse-rows').getByRole('link', { name: 'PCSI', exact: true }).click();
  await expect(page).toHaveURL(/[?&]filiere=PCSI/);
  await expect(page.locator('.active-filters')).toContainText('Filière : PCSI');
});

test('le lien « Voir les programmes » mène à la vue Prépa du catalogue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Voir les programmes' }).click();
  await expect(page).toHaveURL(/\/browse\?vue=prepa/);
});

test('un clic sur une carte du carrousel ouvre l’exercice, sans filtre implicite', async ({ page }) => {
  await page.goto('/');
  const carte = page.locator('.random-carousel__item .result-card').first();
  await expect(carte).toBeVisible();
  const href = await carte.locator('.result-title-link').getAttribute('href');
  // Le survol arrête le défilement automatique, qui déplacerait la carte sous le curseur.
  await carte.hover();
  await carte.locator('.result-preview').click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test('la page d’accueil annonce qu’aucun compte n’est nécessaire', async ({ page }) => {
  await page.goto('/');
  const faits = page.locator('.landing-facts');
  await expect(faits).toContainText('Sans compte');
  await expect(faits).toContainText('Licences libres');
});
