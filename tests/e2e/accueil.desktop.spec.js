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
