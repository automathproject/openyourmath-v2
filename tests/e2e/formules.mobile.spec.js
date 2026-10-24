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
});
