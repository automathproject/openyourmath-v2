// Compatibilité KaTeX des formules des sources.
//
// \mbox, \ensuremath et l'option de position d'array existent en LaTeX mais
// pas dans KaTeX 0.18 : ils faisaient échouer plus de 1 700 formules du site.

import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { katexMacros, KATEX_ONLY_MACROS, prepareMathForKatex } from '../../src/lib/katexCompat.js';
import { macros, latexMacroDefinitions } from '../../src/lib/macros.js';

const render = (tex) => katex.renderToString(prepareMathForKatex(tex), {
  throwOnError: true, strict: false, macros: { ...katexMacros },
});

describe('compatibilité KaTeX', () => {
  it('rend \\mbox et \\ensuremath', () => {
    expect(() => render('f(x) = 0 \\mbox{ si } x > 0')).not.toThrow();
    expect(() => render('\\ensuremath{\\alpha} + 1')).not.toThrow();
    // Même rendu ; seule l'annotation, qui recopie la source, diffère.
    const visible = (html) => html.replace(/<annotation[\s\S]*?<\/annotation>/, '');
    expect(visible(render('\\mbox{si}'))).toBe(visible(render('\\text{si}')));
  });

  it('ignore \\label sans en afficher le nom, et rend \\textsc en texte', () => {
    const visible = (html) => html.replace(/<annotation[\s\S]*?<\/annotation>/, '');
    expect(visible(render('x = 1 \\label{eq:un}'))).toBe(visible(render('x = 1')));
    expect(visible(render('\\textsc{Cauchy}'))).toBe(visible(render('\\text{Cauchy}')));
  });

  it("retire l'option de position d'un tableau", () => {
    expect(prepareMathForKatex('\\begin{array}[t]{cc} a & b \\end{array}'))
      .toBe('\\begin{array}{cc} a & b \\end{array}');
    expect(() => render('\\begin{array}[t]{cccc} \\mathcal{C} :& ]a;b[ &\\to&\\R^2 \\end{array}')).not.toThrow();
  });

  it("garde les traductions hors du registre, donc hors de l'export", () => {
    for (const name of Object.keys(KATEX_ONLY_MACROS)) {
      expect(macros).not.toHaveProperty(name);
      expect(latexMacroDefinitions.some(({ def }) => def.includes(`{${name}}`))).toBe(false);
    }
    expect(katexMacros).toMatchObject(macros);
  });
});
