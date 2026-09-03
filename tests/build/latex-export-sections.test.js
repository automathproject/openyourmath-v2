// tests/build/latex-export-sections.test.js
// Export LaTeX d'une liste sectionnée (src/lib/latex/export.js).
//
// Une fiche apporte des sections au-dessus des exercices ; une liste ordinaire
// n'en apporte aucune. Le premier cas doit produire une vraie hiérarchie, le
// second doit rester exactement ce qu'il était.

import { describe, it, expect } from 'vitest';
import { buildLatexExport, generateLatexDocument } from '../../src/lib/latex/export.js';

const exercise = (uuid, title, extra = {}) => ({
  uuid,
  title,
  content: [{ type: 'question', latex: `Énoncé de ${title}.` }],
  ...extra
});

/** Titres de sectionnement produits, dans l'ordre. */
const headings = (source) =>
  source
    .split('\n')
    .filter((line) => /^\\(?:section|subsection|subsubsection|paragraph)\*\{/.test(line))
    .map((line) => line.trim());

describe('export LaTeX — liste sans section', () => {
  const plain = [exercise('aaaa', 'Premier'), exercise('bbbb', 'Second')];

  it('garde les exercices en \\section*, comme avant les fiches', () => {
    expect(headings(generateLatexDocument(plain, 'Ma liste'))).toEqual([
      '\\section*{Exercice 1 — Premier}',
      '\\section*{Exercice 2 — Second}'
    ]);
  });

  it("n'annonce aucune section dans l'en-tête", () => {
    expect(generateLatexDocument(plain, 'Ma liste')).not.toMatch(/en \d+ sections?/);
  });
});

describe('export LaTeX — fiche à un niveau', () => {
  const fiche = [
    exercise('aaaa', 'Continuité', { section: 'Pratique', sectionPath: ['Pratique'] }),
    exercise('bbbb', 'Limites', { section: 'Pratique', sectionPath: ['Pratique'] }),
    exercise('cccc', 'Théorème', { section: 'Théorie', sectionPath: ['Théorie'] })
  ];
  const source = generateLatexDocument(fiche, 'Fonctions continues');

  it('place les sections au-dessus des exercices', () => {
    expect(headings(source)).toEqual([
      '\\section*{Pratique}',
      '\\subsection*{Exercice 1 — Continuité}',
      '\\subsection*{Exercice 2 — Limites}',
      '\\section*{Théorie}',
      '\\subsection*{Exercice 3 — Théorème}'
    ]);
  });

  it('ne réimprime pas le titre d’une section pour chacun de ses exercices', () => {
    expect(source.match(/\\section\*\{Pratique\}/g)).toHaveLength(1);
  });

  it('numérote les exercices sur la liste entière, pas par section', () => {
    expect(source).toContain('Exercice 3 — Théorème');
  });

  it('annonce le nombre de sections dans l’en-tête', () => {
    expect(source).toMatch(/3 exercices en 2 sections/);
  });
});

describe('export LaTeX — fiche à plusieurs niveaux', () => {
  const fiche = [
    exercise('aaaa', 'Un', { sectionPath: ['Géométrie', 'Coniques'] }),
    exercise('bbbb', 'Deux', { sectionPath: ['Géométrie', 'Coniques', 'Parabole'] }),
    exercise('cccc', 'Trois', { sectionPath: ['Géométrie', 'Coniques', 'Ellipse'] }),
    exercise('dddd', 'Quatre', { sectionPath: ['Géométrie', 'Quadriques'] })
  ];
  const source = generateLatexDocument(fiche, 'Quercia');

  it('descend d’un cran par niveau et n’émet que ce qui change', () => {
    expect(headings(source)).toEqual([
      '\\section*{Géométrie}',
      '\\subsection*{Coniques}',
      '\\paragraph*{Exercice 1 — Un}',
      '\\subsubsection*{Parabole}',
      '\\paragraph*{Exercice 2 — Deux}',
      '\\subsubsection*{Ellipse}',
      '\\paragraph*{Exercice 3 — Trois}',
      '\\subsection*{Quadriques}',
      '\\paragraph*{Exercice 4 — Quatre}'
    ]);
  });

  it('représente un titre portant à la fois des exercices et des sous-titres', () => {
    // « Coniques » précède son premier exercice propre autant que sa première
    // sous-section : c'est le cas réel de fic00080.
    const order = headings(source);
    expect(order.indexOf('\\subsection*{Coniques}')).toBeLessThan(order.indexOf('\\paragraph*{Exercice 1 — Un}'));
    expect(order.indexOf('\\paragraph*{Exercice 1 — Un}')).toBeLessThan(order.indexOf('\\subsubsection*{Parabole}'));
  });
});

describe('export LaTeX — cas limites du sectionnement', () => {
  it('réimprime un titre lorsqu’on remonte d’un niveau', () => {
    // Sans garde, l'exercice 2 se retrouverait imprimé sous « Détails ».
    // Les exercices sont ici en \subsubsection* : le niveau des exercices se
    // règle sur la section la plus profonde de la liste, pas sur la leur.
    const source = generateLatexDocument([
      exercise('aaaa', 'Un', { sectionPath: ['Algèbre', 'Détails'] }),
      exercise('bbbb', 'Deux', { sectionPath: ['Algèbre'] })
    ], 'Retour');
    expect(headings(source)).toEqual([
      '\\section*{Algèbre}',
      '\\subsection*{Détails}',
      '\\subsubsection*{Exercice 1 — Un}',
      '\\section*{Algèbre}',
      '\\subsubsection*{Exercice 2 — Deux}'
    ]);
  });

  it('accepte une entrée ne portant que `section`, sans `sectionPath`', () => {
    const source = generateLatexDocument([exercise('aaaa', 'Un', { section: 'Pratique' })], 'Liste');
    expect(headings(source)).toEqual(['\\section*{Pratique}', '\\subsection*{Exercice 1 — Un}']);
  });

  it('ignore une section vide et traite la liste comme plate', () => {
    const source = generateLatexDocument([
      exercise('aaaa', 'Un', { section: '   ', sectionPath: ['  '] })
    ], 'Liste');
    expect(headings(source)).toEqual(['\\section*{Exercice 1 — Un}']);
  });

  it('laisse le LaTeX d’un titre de section intact, sans l’échapper', () => {
    // Un titre de fiche est du LaTeX ; un titre d'exercice est du texte.
    const source = generateLatexDocument([
      exercise('aaaa', 'Un & deux', { sectionPath: ['Propriétés de $\\Nn$'] })
    ], 'Liste');
    expect(source).toContain('\\section*{Propriétés de $\\Nn$}');
    expect(source).toContain('\\subsection*{Exercice 1 — Un \\& deux}');
  });

  it('mentionne le chemin complet en commentaire au-dessus du titre', () => {
    const source = generateLatexDocument([
      exercise('aaaa', 'Un', { sectionPath: ['Géométrie', 'Coniques'] })
    ], 'Liste');
    expect(source).toContain('% Géométrie > Coniques');
  });
});

describe('export LaTeX — les sections n’altèrent pas le reste', () => {
  const fiche = [
    exercise('aaaa', 'Un', { sectionPath: ['Pratique'] }),
    exercise('bbbb', 'Deux', { sectionPath: ['Théorie'] })
  ];

  it('garde les ancres alignées sur les lignes réelles du document', () => {
    const { source, anchors } = buildLatexExport(fiche, 'Fiche');
    const lines = source.split('\n');
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      // L'ancre pointe la ligne du séparateur qui ouvre le bloc de l'exercice.
      expect(lines.slice(anchor.line - 1, anchor.line + 2).join('\n')).toContain(anchor.uuid);
    }
  });

  it('regroupe toujours les réponses en fin de document si demandé', () => {
    const withSolutions = fiche.map((ex) => ({
      ...ex,
      content: [...ex.content, { type: 'reponse', latex: 'La réponse.' }]
    }));
    const source = generateLatexDocument(withSolutions, 'Fiche', {
      includeSolutions: true,
      solutionsAtEnd: true
    });
    expect(source).toContain('\\section*{Réponses}');
    expect(source.indexOf('\\section*{Réponses}')).toBeGreaterThan(source.indexOf('\\section*{Théorie}'));
  });
});
