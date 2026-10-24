import { test, expect } from '@playwright/test';

// Vue CPGE : navigation par programme dans /browse, badges de la page
// d'exercice et filtres de la recherche. Les données sont celles de la base
// construite (rattachements \cpge{} des sources).

test.describe('Vue Prépa de /browse', () => {
  test('on descend d’un programme à une section, puis on cherche dans la section', async ({ page }) => {
    await page.goto('/browse');
    await page.getByRole('link', { name: 'Prépa (CPGE)' }).click();
    await expect(page).toHaveURL(/vue=prepa/);
    await expect(page.getByRole('heading', { name: 'Première année' })).toBeVisible();

    await page.locator('.prepa-card', { hasText: 'PCSI' }).first().click();
    await expect(page).toHaveURL(/programme=pcsi/);
    await expect(page.locator('.prepa-arbre')).toBeVisible();

    await page.locator('.prepa-section', { hasText: 'Nombres complexes' }).click();
    await expect(page).toHaveURL(/noeud=pcsi\.nombres-complexes/);
    await expect(page.locator('.prepa-noeud-head h2')).toContainText('Nombres complexes');
    const carte = page.locator('.prepa-exercices .result-card').first();
    await expect(carte).toBeVisible();
    // Comme dans la recherche : identifiant visible et ajout à la liste en cours.
    await expect(carte.locator('.result-uuid')).toHaveText(/^\w{4}$/);
    await expect(carte.locator('.rc-footer-actions button').first()).toBeVisible();
    // Le titre de la section courante est marqué dans l'arbre.
    await expect(page.locator('.prepa-arbre a[aria-current="page"]')).toContainText('Nombres complexes');

    await page.getByRole('link', { name: 'Rechercher dans cette partie du programme' }).click();
    await expect(page).toHaveURL(/cpge=pcsi\.nombres-complexes/);
    await expect(page.locator('.active-filters')).toContainText('Programme : pcsi.nombres-complexes');
    await expect(page.locator('.result-card').first()).toBeVisible();
  });

  test('une section inconnue affiche un message plutôt qu’une erreur', async ({ page }) => {
    await page.goto('/browse?vue=prepa&noeud=pcsi.inexistant');
    await expect(page.getByRole('heading', { name: 'Partie du programme introuvable' })).toBeVisible();
  });
});

test.describe('Rattachements sur la page d’exercice', () => {
  test('les badges Prépa mènent à la section du programme', async ({ page }) => {
    await page.goto('/exercise/1IUZ');
    const badge = page.locator('.chip-cpge', { hasText: 'PCSI' });
    await expect(badge).toBeVisible();
    await expect(page.locator('#lecture-cpge-title')).toBeVisible();

    await badge.click();
    await expect(page).toHaveURL(/vue=prepa&noeud=pcsi\.nombres-complexes/);
    await expect(page.locator('.prepa-noeud-head h2')).toContainText('Nombres complexes');
  });
});

test.describe('Filtres CPGE de la recherche', () => {
  test('une filière restreint les résultats et passe dans l’URL', async ({ page }) => {
    await page.goto('/?q=racines');
    await expect(page.locator('.result-card').first()).toBeVisible();
    const total = async () => Number((await page.getByText(/résultats? affichés? sur \d+/).textContent()).match(/sur (\d+)/)[1]);
    const avant = await total();

    await page.locator('.sps-filiere-btn', { hasText: 'PCSI' }).click();
    await expect(page).toHaveURL(/filiere=PCSI/);
    await expect(page.locator('.active-filters')).toContainText('Filière : PCSI');
    await expect.poll(total).toBeLessThan(avant);
  });
});

test.describe('Catalogue par niveau', () => {
  test('les cartes montrent l’identifiant et mènent à l’exercice', async ({ page }) => {
    await page.goto('/browse?level=L1&module=Alg%C3%A8bre');
    const carte = page.locator('.exercise-list .result-card').first();
    await expect(carte).toBeVisible();
    const uuid = (await carte.locator('.result-uuid').textContent()).trim();
    await expect(carte.locator('.rc-footer-actions button').first()).toBeVisible();

    await carte.locator('.result-title-link').click();
    await expect(page).toHaveURL(new RegExp(`/exercise/${uuid}`));
  });
});
