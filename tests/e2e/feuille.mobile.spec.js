import { test, expect } from '@playwright/test';
import { ouvrirRecherche, glisser, decalageY } from './helpers.js';

test.describe('Feuille de prévisualisation mobile', () => {
  test('elle épouse son contenu au lieu d’occuper tout l’écran', async ({ page }) => {
    await ouvrirRecherche(page, 'intégrale par parties');
    await page.locator('.result-card .result-title-link').first().click();

    const feuille = page.locator('.mobile-preview');
    await expect(feuille).toBeVisible();

    const boite = await feuille.boundingBox();
    const hauteurEcran = page.viewportSize().height;

    // Un exercice d'une seule question occupait autant de place qu'un exercice
    // de huit : tout l'écran, dont un grand vide sous l'énoncé.
    expect(boite.height).toBeLessThan(hauteurEcran * 0.88 + 2);
    await expect(page.locator('.mobile-preview__backdrop')).toBeVisible();
  });

  test('le glissé suit le doigt et revient en place sous le seuil', async ({ page }) => {
    await ouvrirRecherche(page, 'intégrale par parties');
    await page.locator('.result-card .result-title-link').first().click();

    const feuille = page.locator('.mobile-preview');
    await expect(feuille).toBeVisible();
    const boite = await feuille.boundingBox();
    const depart = boite.y + 40;

    const decalages = [];
    await glisser(page, {
      x: boite.x + boite.width / 2,
      depart,
      arrivee: depart + 60,
      pendant: async () => {
        // Laisser le rendu appliquer la position avant de la lire, sinon on
        // échantillonne des états intermédiaires sans signification.
        await page.waitForTimeout(40);
        decalages.push(await decalageY(feuille));
      }
    });

    // Le geste n'était pris en compte qu'au relâchement : rien ne bougeait
    // pendant le mouvement, donc rien n'indiquait qu'il était en cours.
    const suivis = decalages.filter((valeur) => valeur > 0);
    expect(suivis.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...suivis)).toBeGreaterThanOrEqual(45);
    expect(suivis).toEqual([...suivis].sort((a, b) => a - b));

    // Sous le seuil de 80 px : retour élastique, feuille conservée.
    await expect(feuille).toBeVisible();
    await expect.poll(async () => decalageY(feuille)).toBe(0);
  });

  test('le glissé au-delà du seuil ferme la feuille', async ({ page }) => {
    await ouvrirRecherche(page, 'intégrale par parties');
    await page.locator('.result-card .result-title-link').first().click();

    const feuille = page.locator('.mobile-preview');
    await expect(feuille).toBeVisible();
    const boite = await feuille.boundingBox();
    const depart = boite.y + 40;

    await glisser(page, {
      x: boite.x + boite.width / 2,
      depart,
      arrivee: depart + 180
    });

    await expect(feuille).toHaveCount(0);
    await expect(page.locator('.mobile-preview__backdrop')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .not.toBe('hidden');
  });

  test('le glissé est ignoré quand l’énoncé est déjà défilé', async ({ page }) => {
    await ouvrirRecherche(page, 'intégrale par parties');
    // Un exercice long, dont le corps déborde et défile.
    await page.locator('.result-card .result-title-link').nth(2).click();

    const feuille = page.locator('.mobile-preview');
    await expect(feuille).toBeVisible();
    await page.locator('.mobile-preview__body').evaluate((el) => {
      el.scrollTop = Math.max(40, el.scrollHeight - el.clientHeight);
    });

    const boite = await feuille.boundingBox();
    const depart = boite.y + boite.height / 2;
    await glisser(page, { x: boite.x + boite.width / 2, depart, arrivee: depart + 180 });

    // Sinon remonter dans un énoncé long refermerait la prévisualisation.
    await expect(feuille).toBeVisible();
  });

  test('le fond referme la feuille', async ({ page }) => {
    await ouvrirRecherche(page, 'intégrale par parties');
    await page.locator('.result-card .result-title-link').first().click();
    await expect(page.locator('.mobile-preview')).toBeVisible();

    await page.locator('.mobile-preview__backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.mobile-preview')).toHaveCount(0);
  });
});

test.describe('Contrôles mobiles', () => {
  test('le commutateur Rapide/IA est atteignable', async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');

    const commutateur = page.locator('.mobile-mode-switch');
    await expect(commutateur).toBeVisible();

    // Il débordait d'un conteneur à défilement masqué : la fonctionnalité
    // différenciante du produit était invisible sur téléphone.
    const boite = await commutateur.boundingBox();
    expect(boite.x).toBeGreaterThanOrEqual(0);
    expect(boite.x + boite.width).toBeLessThanOrEqual(page.viewportSize().width);
  });

  test("« Ouvrir l'exercice » navigue dans l'onglet courant", async ({ page }) => {
    await ouvrirRecherche(page, 'matrice');
    const lien = page.locator('.rc-footer-open').first();
    await expect(lien).toHaveAttribute('href', /^\/exercise\//);
    await expect(lien).not.toHaveAttribute('target', '_blank');
  });
});
