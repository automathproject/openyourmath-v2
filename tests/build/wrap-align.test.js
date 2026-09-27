// Mise en formule des environnements d'affichage avant pandoc et KaTeX.
//
// Un align* écrit dans une formule, « $$\left\{\begin{align*}…\end{align*}\right.$$ »,
// était lui aussi entouré de $$ : la formule se retrouvait coupée en morceaux,
// \left séparé de son \right, et KaTeX affichait une erreur à leur place.

import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { wrapAlignWithDollar } from '../../scripts/utils/tex2html-utils.js';

describe('wrapAlignWithDollar', () => {
  it('met en formule un align* écrit dans le texte', () => {
    expect(wrapAlignWithDollar('On a\n\\begin{align*}x&=1\\\\y&=2\\end{align*}\nDonc'))
      .toBe('On a\n$$\\begin{align*}x&=1\\\\y&=2\\end{align*}$$\nDonc');
  });

  it("garde la forme historique d'equation et gather", () => {
    expect(wrapAlignWithDollar('\\begin{equation*}x=1\\end{equation*}'))
      .toBe('$$\\begin{equation}x=1\\end{equation}$$');
    expect(wrapAlignWithDollar('\\begin{gather}x=1\\end{gather}'))
      .toBe('$$\\begin{gather}x=1\\end{gather}$$');
  });

  it("n'ajoute pas de $$ dans une formule, et y écrit aligned", () => {
    const source = '$$\\vec u\\in E_1\\iff\\left\\{\\begin{align*}x&=x\\\\y&=0\\end{align*}\\right.$$';
    const wrapped = wrapAlignWithDollar(source);

    expect(wrapped).toBe('$$\\vec u\\in E_1\\iff\\left\\{\\begin{aligned}x&=x\\\\y&=0\\end{aligned}\\right.$$');
    // La formule reste d'un seul tenant : KaTeX la rend sans erreur.
    expect(() => katex.renderToString(wrapped.slice(2, -2), { displayMode: true, throwOnError: true }))
      .not.toThrow();
  });

  it('reconnaît les formules \\[…\\] et $…$, et les align* imbriqués', () => {
    expect(wrapAlignWithDollar('\\[\\left(\\begin{align*}a\\end{align*}\\right)\\]'))
      .toBe('\\[\\left(\\begin{aligned}a\\end{aligned}\\right)\\]');
    expect(wrapAlignWithDollar('\\begin{align*}u&\\iff\\left\\{\\begin{align*}a\\end{align*}\\right.\\end{align*}'))
      .toBe('$$\\begin{align*}u&\\iff\\left\\{\\begin{aligned}a\\end{aligned}\\right.\\end{align*}$$');
  });

  it('ne prend pas un saut de ligne \\\\[0.5em] pour une formule', () => {
    expect(wrapAlignWithDollar('Texte.\\\\[0.5em]\n\\begin{align*}x\\end{align*}'))
      .toBe('Texte.\\\\[0.5em]\n$$\\begin{align*}x\\end{align*}$$');
  });

  it('laisse intacts les environnements commentés', () => {
    const source = '% $$\\begin{align*}\n% x\n% \\end{align*}$$\nSuite';
    expect(wrapAlignWithDollar(source)).toBe(source);
  });
});
