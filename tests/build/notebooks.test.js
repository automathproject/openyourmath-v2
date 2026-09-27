// Liens vers les notebooks archivés dans le dépôt Exercices.

import { describe, it, expect } from 'vitest';
import { expandInsertNotebook, notebookUrl } from '../../src/lib/notebooks.js';
import { buildLatexExport } from '../../src/lib/latex/export.js';

const URL = 'https://github.com/smaxx73/Exercices/blob/main/notebook/aOYg.ipynb';

describe('notebooks', () => {
  it("construit l'adresse du notebook archivé", () => {
    expect(notebookUrl(' aOYg ')).toBe(URL);
  });

  it('remplace \\insertnotebook par un lien, pour pandoc', () => {
    expect(expandInsertNotebook('Voir : \\insertnotebook{aOYg}.'))
      .toBe(`Voir : \\href{${URL}}{Lien vers le notebook}.`);
  });

  it("définit \\insertnotebook dans l'export, avec hyperref", () => {
    const { source } = buildLatexExport([{
      uuid: 'aOYg', title: 'N', content: [{ type: 'reponse', order: 1, latex: '\\insertnotebook{aOYg}' }],
    }], 'T', { includeSolutions: true });

    expect(source).toContain('\\usepackage[hidelinks]{hyperref}');
    expect(source).toContain('\\newcommand{\\insertnotebook}[1]{\\href{https://github.com/smaxx73/Exercices/blob/main/notebook/#1.ipynb}{Lien vers le notebook}}');
    expect(source).toContain('\\insertnotebook{aOYg}');
  });
});
