import { expect } from '@playwright/test';

/** Clé de la préférence « colonne de prévisualisation dépliée » (voir uiStore). */
export const PREVIEW_PANEL_KEY = 'search-ui:preview-panel-open:v2';

/**
 * Fixe la préférence de colonne avant le premier rendu. Elle est persistée,
 * donc sans ça un test hérite de ce qu'a laissé le précédent.
 * @param {import('@playwright/test').Page} page
 * @param {boolean} ouvert
 */
export async function preparerPanneau(page, ouvert) {
  await page.addInitScript(
    ([cle, valeur]) => window.localStorage.setItem(cle, valeur),
    [PREVIEW_PANEL_KEY, ouvert ? 'true' : 'false']
  );
}

/**
 * Ouvre la recherche sur une requête et attend que les résultats soient là.
 * @param {import('@playwright/test').Page} page
 * @param {string} requete
 */
export async function ouvrirRecherche(page, requete) {
  await page.goto(`/?q=${encodeURIComponent(requete)}`);
  await expect(page.locator('.result-card').first()).toBeVisible();
}

/**
 * Glissé tactile réel, envoyé par le protocole du navigateur plutôt que par des
 * événements fabriqués en JavaScript : c'est la seule façon de vérifier que le
 * geste traverse bien la même chaîne que le doigt d'un utilisateur.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{x: number, depart: number, arrivee: number, etapes?: number,
 *          pendant?: (progression: number) => Promise<void>}} options
 */
export async function glisser(page, { x, depart, arrivee, etapes = 6, pendant }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: depart }]
  });

  for (let i = 1; i <= etapes; i += 1) {
    const y = depart + ((arrivee - depart) * i) / etapes;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    if (pendant) await pendant(i / etapes);
  }

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/**
 * Décalage vertical courant d'un élément, lu depuis sa matrice de transformation.
 * @param {import('@playwright/test').Locator} locator
 */
export async function decalageY(locator) {
  return locator.evaluate((el) => {
    const matrice = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.round(matrice.m42);
  });
}
