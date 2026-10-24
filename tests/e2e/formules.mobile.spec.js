import { test, expect } from '@playwright/test';

// Formules et tableaux larges sur téléphone : ils défilent dans leur bloc au lieu
// d'élargir la page. Les exercices viennent de la base construite ; ils ont été
// choisis pour leurs formules ou leur tableau plus larges que l'écran.
const EXERCICES = [
  { uuid: 'eTUF', cas: 'formules en bloc' },
  { uuid: '6rC0', cas: 'tableau de formules (array) très large' },
  { uuid: 'MX2V', cas: 'tableau HTML large' }
];

const debordement = page =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('Formules larges sur mobile', () => {
  for (const { uuid, cas } of EXERCICES) {
    test(`la page ne déborde pas : ${cas} (${uuid})`, async ({ page }) => {
      await page.goto(`/exercise/${uuid}`);
      await expect(page.locator('.katex').first()).toBeVisible();
      expect(await debordement(page)).toBeLessThanOrEqual(1);
    });
  }

  test('une formule en bloc plus large que l’écran défile dans sa ligne', async ({ page }) => {
    await page.goto('/exercise/eTUF');
    const bloc = page.locator('.katex-display').first();
    await expect(bloc).toBeVisible();
    await expect(bloc).toHaveCSS('overflow-x', 'auto');

    const { visible, total } = await bloc.evaluate(el => ({ visible: el.clientWidth, total: el.scrollWidth }));
    expect(total).toBeGreaterThan(visible);
    // On peut réellement atteindre la fin de la formule.
    await bloc.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    expect(await bloc.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  });

  test('un tableau large défile dans son bloc', async ({ page }) => {
    await page.goto('/exercise/MX2V');
    const table = page.locator('.exercise-content table').first();
    await expect(table).toBeVisible();
    await expect(table).toHaveCSS('overflow-x', 'auto');
    expect(await table.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  });
  // Pas des formules, mais le même symptôme : un mot sans espace élargit la page.
  const MOTS_LONGS = [
    { uuid: '0U2g', cas: 'URL de 61 caractères dans un paragraphe' },
    { uuid: 'DnxY', cas: 'URL de 108 caractères dans un paragraphe' },
    { uuid: 'xheQ', cas: 'ligne de code sans espace' }
  ];
  for (const { uuid, cas } of MOTS_LONGS) {
    test(`un mot sans espace ne fait pas déborder la page : ${cas} (${uuid})`, async ({ page }) => {
      // 360 px, largeur courante des téléphones Android : la ligne de code de
      // xheQ ne dépasse l'écran que de 7 px à 375 px et tient dans les 393 px du Pixel 5.
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(`/exercise/${uuid}`);
      await expect(page.locator('.exercise-content').first()).toBeVisible();
      expect(await debordement(page)).toBeLessThanOrEqual(1);
    });
  }

  test('le retour à la ligne forcé ne touche pas les formules', async ({ page }) => {
    await page.goto('/exercise/eTUF');
    const formule = page.locator('.exercise-content .katex').first();
    await expect(formule).toBeVisible();
    await expect(formule).toHaveCSS('overflow-wrap', 'normal');
    await expect(page.locator('.exercise-content p').first()).toHaveCSS('overflow-wrap', 'anywhere');
  });
});
