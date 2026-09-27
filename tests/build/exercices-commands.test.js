// Garde-fou \operatorname de l'export : une ligne qui commence par
// \operatorname est entourée de $, pour du texte produit par IA qui aurait
// oublié les délimiteurs, mais pas quand une formule est déjà ouverte.

import { describe, it, expect } from 'vitest';
import { normalizeLatexForCompilation } from '../../src/lib/latex/export.js';

describe('normalizeLatexForCompilation — lignes \\operatorname', () => {
  it("n'ajoute pas de $ dans une formule ouverte plus haut", () => {
    expect(normalizeLatexForCompilation('\\[\n  \\operatorname{Hess}_f = 0\n\\]'))
      .toBe('\\[\n  \\operatorname{Hess}_f = 0\n\\]');
    expect(normalizeLatexForCompilation('\\begin{equation*}\n\\operatorname{rg} A = 2\n\\end{equation*}'))
      .toBe('\\begin{equation*}\n\\operatorname{rg} A = 2\n\\end{equation*}');
  });

  it('les ajoute toujours à une ligne isolée hors formule', () => {
    expect(normalizeLatexForCompilation('$$a$$\n\\operatorname{rg} A = 2'))
      .toBe('$$a$$\n$\\operatorname{rg} A = 2$');
  });
});
