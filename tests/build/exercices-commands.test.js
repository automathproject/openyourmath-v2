// Commandes des sources amscc que fournit le préambule d'Exercices.
//
// Elles compilent dans Exercices mais étaient inconnues de l'export, et pour
// certaines de pandoc : \colonnes s'affichait tel quel sur le site, \numprint
// y disparaissait avec son nombre.

import { describe, it, expect } from 'vitest';
import { expandExercicesCommands } from '../../scripts/utils/tex2html-utils.js';
import { buildLatexExport, normalizeLatexForCompilation } from '../../src/lib/latex/export.js';

const exportOf = (latex) => buildLatexExport(
  [{ uuid: 'cccc', title: 'C', content: [{ type: 'question', order: 1, latex }] }], 'T',
).source;

describe('expandExercicesCommands (HTML du site)', () => {
  it('retire \\colonnes et \\fincolonnes, sans objet sur le site', () => {
    expect(expandExercicesCommands('\\colonnes{\\solution}{3}{1}\n\\begin{enumerate}\n\\fincolonnes{\\solution}{3}{1}'))
      .toBe('\n\\begin{enumerate}\n');
  });

  it('garde le nombre de \\numprint, groupé par milliers', () => {
    expect(expandExercicesCommands('est de \\numprint{28000} euros')).toBe('est de 28\\,000 euros');
    expect(expandExercicesCommands('$\\numprint{1234567,5}$')).toBe('$1\\,234\\,567{,}5$');
    expect(expandExercicesCommands('\\numprint{12}')).toBe('12');
  });
});

describe("buildLatexExport — préambule d'Exercices", () => {
  it('charge les paquets que le document de test d’Exercices fournit', () => {
    const source = exportOf('1\\euro{}, \\numprint{28000}\n\\begin{tcolorbox}Rappel\\end{tcolorbox}');
    expect(source).toContain('\\usepackage{eurosym}');
    expect(source).toContain('\\usepackage[autolanguage]{numprint}');
    expect(source).toContain('\\usepackage{tcolorbox}');
    expect(exportOf('Soit $x$.')).not.toMatch(/eurosym|numprint|tcolorbox/);
  });

  it('charge xy avec luatex85, sans quoi son pilote exige pdfTeX', () => {
    expect(exportOf('$$\\xymatrix{A \\ar[r] & B}$$')).toContain('\\usepackage{luatex85}\n\\usepackage[all]{xy}');
  });

  it('définit vides les commandes de mise en page', () => {
    const source = exportOf('\\similaire{qyPc}\n\\colonnes{\\solution}{3}{1}');
    expect(source).toContain('\\newcommand{\\colonnes}[3]{}');
    expect(source).toContain('\\newcommand{\\similaire}[1]{}');
    expect(source).not.toContain('\\newcommand{\\fincolonnes}');
  });

  it('définit \\cov et \\ii depuis le registre des macros', () => {
    const source = exportOf('$\\cov(X,Y)$ et $e^{\\ii x}$');
    expect(source).toContain('\\newcommand{\\cov}{\\operatorname{Cov}}');
    expect(source).toContain('\\newcommand{\\ii}{\\mathrm{i}}');
  });
});

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
