import { test, expect } from '@playwright/test';

// Signalement d'erreur depuis la page d'exercice : parcours guidé jusqu'à la
// connexion. La connexion elle-même (forge, GitHub) et la création du ticket
// ne sont pas jouées ici : elles passent par des services extérieurs.

test.describe('Signalement d’erreur', () => {
  test('le formulaire guide du type de problème jusqu’à la connexion', async ({ page }) => {
    await page.goto('/exercise/Kme5');
    const encart = page.locator('.signalement');
    // Sans secrets de connexion configurés, le formulaire n'est pas proposé.
    test.skip(!(await encart.count()), 'aucun fournisseur de connexion configuré');

    const dialogue = page.getByRole('dialog', { name: 'Signaler une erreur' });
    // Un clic avant l'hydratation ne fait rien : on recommence jusqu'à l'ouverture.
    await expect(async () => {
      await encart.getByRole('button', { name: 'Signaler une erreur' }).click();
      await expect(dialogue).toBeVisible({ timeout: 1000 });
    }).toPass();

    await dialogue.getByRole('button', { name: 'Suivant' }).click();
    await expect(dialogue.getByRole('alert')).toHaveText('Choisissez le type de problème.');

    await dialogue.getByText('Erreur dans la correction').click();
    await dialogue.getByRole('button', { name: 'Suivant' }).click();
    await dialogue.getByRole('button', { name: 'Suivant' }).click();
    await expect(dialogue.getByRole('alert')).toHaveText('Indiquez la partie de l’exercice concernée.');

    await dialogue.locator('select').selectOption('reponse-1');
    await dialogue.getByPlaceholder(/Ce qui ne va pas/).fill('Le reste de la troisième division est faux.');
    await dialogue.getByRole('button', { name: 'Suivant' }).click();
    await expect(dialogue.getByRole('button', { name: /Se connecter avec/ }).first()).toBeVisible();
  });

  test('Ma liste propose le signalement de l’exercice affiché, pas la vue élève', async ({ page }) => {
    await page.goto('/exercise/list?list=Kme5,1IUZ');
    // L'exercice affiché est chargé côté navigateur.
    await expect(page.locator('.exercise-block')).toBeVisible();
    const lien = page.getByRole('button', { name: 'Signaler une erreur' });
    test.skip(!(await lien.count()), 'aucun fournisseur de connexion configuré');
    await expect(lien).toBeVisible();

    await page.goto('/exercise/list?list=Kme5,1IUZ&view=student');
    await expect(page.locator('.exercise-block')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Signaler une erreur' })).toHaveCount(0);
  });

  test('l’envoi sans connexion est refusé', async ({ request }) => {
    const reponse = await request.post('/api/signalement', {
      data: { uuid: 'Kme5', type: 'autre', message: 'Un message assez long.' }
    });
    expect(reponse.status()).toBe(401);
  });
});
