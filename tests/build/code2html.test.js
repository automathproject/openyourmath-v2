// Rendu des extraits \pythoncode dans le HTML du site.
//
// Pandoc ignore \pythoncode : l'extrait disparaissait du bloc qui l'appelle et
// ne subsistait qu'en bloc séparé, affiché après tout le bloc. Il est désormais
// remplacé par un placeholder que la restauration change en bloc de code, à sa
// place et hors de tout paragraphe.

import { describe, it, expect } from 'vitest';
import {
  replacePythonCodeWithPlaceholders,
  restoreCodeBlocksFromPlaceholders,
} from '../../scripts/utils/code2html-utils.js';

const codeBlocks = new Map([
  ['a.py', { name: 'a.py', language: 'python', content: 'x = "$1" < 2' }],
]);

describe('replacePythonCodeWithPlaceholders', () => {
  it("absorbe le center qui l'entoure et isole le placeholder", () => {
    const { content, replacements } = replacePythonCodeWithPlaceholders(
      'Soit :\n\\begin{center}\\pythoncode{a.py}\\end{center}\nSuite', codeBlocks);

    expect(replacements).toHaveLength(1);
    expect(content).toBe(`Soit :\n\n\n${replacements[0].placeholder}\n\n\nSuite`);
    expect(replacements[0].html).toContain('data-block-name="a.py"');
  });

  it('signale un extrait introuvable', () => {
    const { replacements } = replacePythonCodeWithPlaceholders('\\pythoncode[fontsize=\\tiny]{b.py}', codeBlocks);
    expect(replacements[0].html).toContain('Source Python introuvable');
  });
});

describe('restoreCodeBlocksFromPlaceholders', () => {
  const html = '<div class="code-block">x = "$1" &lt; 2</div>';

  it('remplace le paragraphe qui ne contient que le placeholder', () => {
    expect(restoreCodeBlocksFromPlaceholders('<p>Soit :</p>\n<p>PH1</p>', [{ placeholder: 'PH1', html }]))
      .toBe(`<p>Soit :</p>\n${html}`);
  });

  it("scinde le paragraphe où il est resté, sans <br /> orphelin", () => {
    expect(restoreCodeBlocksFromPlaceholders('<p>Soit :<br />\nPH1 Suite</p>', [{ placeholder: 'PH1', html }]))
      .toBe(`<p>Soit :</p>${html}<p> Suite</p>`);
  });

  it('ne réinterprète pas les $ du code', () => {
    expect(restoreCodeBlocksFromPlaceholders('<div>PH1</div>', [{ placeholder: 'PH1', html }]))
      .toBe(`<div>${html}</div>`);
  });
});
