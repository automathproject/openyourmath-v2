// Rendu des textes officiels des programmes de CPGE (src/lib/utils/cpgeTexte.js).
import { describe, expect, it } from 'vitest';
import { celluleCpge, markdownCpge } from '../../src/lib/utils/cpgeTexte.js';

describe('markdownCpge', () => {
  it('rend paragraphes et listes à puces', () => {
    const html = markdownCpge('Objectifs :\n\n- l’étude de $\\mathbb{C}$ ;\n- la géométrie.\n\nFin.');
    expect(html).toBe('<p>Objectifs :</p>\n<ul><li>l’étude de $\\mathbb{C}$ ;</li><li>la géométrie.</li></ul>\n<p>Fin.</p>');
  });

  it('rend le gras et l’italique sans toucher aux formules', () => {
    expect(markdownCpge('Le but est **substantiel**, *a priori* : $a*b*c$.'))
      .toBe('<p>Le but est <strong>substantiel</strong>, <em>a priori</em> : $a*b*c$.</p>');
  });

  it('échappe le HTML du texte', () => {
    expect(markdownCpge('<script>alert(1)</script> & $x<y$'))
      .toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; $x&lt;y$</p>');
  });

  it('rend une chaîne vide pour un texte absent', () => {
    expect(markdownCpge(null)).toBe('');
  });
});

describe('celluleCpge', () => {
  it('conserve les <br> et échappe le reste', () => {
    expect(celluleCpge('Notation $\\mathbb{U}_n$.<br>Représentation <b>géométrique</b>.'))
      .toBe('Notation $\\mathbb{U}_n$.<br>Représentation &lt;b&gt;géométrique&lt;/b&gt;.');
  });
});
