// tests/build/create-exercise.test.js
// Utilitaires de l'éditeur de création d'exercices :
// - sérialisation / parsing du format .tex source (src/lib/latex/exerciseTex.js)
// - conversion LaTeX → HTML de l'aperçu (src/lib/latex/texPreview.js)

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  buildExerciseTex,
  parseExerciseTex,
  generateShortUuid,
  splitEnumerateItems,
} from '../../src/lib/latex/exerciseTex.js';
import { latexToPreviewHtml, blocksToPreviewContent } from '../../src/lib/latex/texPreview.js';
import { generateLatexDocument } from '../../src/lib/latex/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const META = {
  uuid: 'Ab3d',
  title: 'Suites géométriques',
  level: 'L1',
  module: 'Analyse',
  chapter: 'Suites numériques',
  theme: 'convergence, limite',
  author: 'Maxime Nguyen',
  created_at: '2026-07-09',
  difficulty: '2',
};

describe('buildExerciseTex', () => {
  it('sérialise les métadonnées non vides dans l’ordre du site', () => {
    const tex = buildExerciseTex(META, []);
    expect(tex).toContain('\\uuid{Ab3d}');
    expect(tex).toContain('\\titre{Suites géométriques}');
    expect(tex).toContain('\\niveau{L1}');
    expect(tex).toContain('\\difficulte{2}');
    expect(tex).not.toContain('\\organisation{');
    expect(tex.indexOf('\\uuid{')).toBeLessThan(tex.indexOf('\\titre{'));
  });

  it('emballe les questions multiples dans un enumerate avec \\item', () => {
    const tex = buildExerciseTex(META, [
      { type: 'text', latex: 'Soit $u_n = 2^n$.' },
      { type: 'question', latex: 'Calculer $u_3$.' },
      { type: 'reponse', latex: '$u_3 = 8$.' },
      { type: 'question', latex: 'Étudier la limite.' },
      { type: 'indication', latex: 'Comparer à $2^n$.' },
    ]);
    expect(tex).toContain('\\contenu{');
    expect(tex).toContain('\\begin{enumerate}');
    expect((tex.match(/\\item/g) || []).length).toBe(2);
    expect(tex).toContain('\\end{enumerate}');
    // le bloc texte reste hors enumerate
    expect(tex.indexOf('\\texte{')).toBeLessThan(tex.indexOf('\\begin{enumerate}'));
  });

  it('n’utilise pas d’enumerate pour une question unique', () => {
    const tex = buildExerciseTex(META, [
      { type: 'question', latex: 'Calculer $u_3$.' },
      { type: 'reponse', latex: '$u_3 = 8$.' },
    ]);
    expect(tex).not.toContain('\\begin{enumerate}');
    expect(tex).toContain('\\question{Calculer $u_3$.}');
  });

  it('ignore les blocs vides', () => {
    const tex = buildExerciseTex(META, [
      { type: 'question', latex: 'Q1' },
      { type: 'reponse', latex: '   ' },
    ]);
    expect(tex).not.toContain('\\reponse{');
  });
});

describe('parseExerciseTex', () => {
  it('fait l’aller-retour build → parse', () => {
    const blocks = [
      { type: 'text', latex: 'Soit $f(x) = \\dfrac{1}{x}$ définie sur $\\R^*$.' },
      { type: 'question', latex: 'Montrer que $f$ est décroissante sur $]0, +\\infty[$.' },
      { type: 'indication', latex: 'Étudier le signe de $f\'$.' },
      { type: 'reponse', latex: 'On a\n\\[\nf\'(x) = -\\frac{1}{x^2} < 0.\n\\]\nDonc $f$ est décroissante.' },
      { type: 'question', latex: 'Calculer $\\lim_{x \\to +\\infty} f(x)$.' },
    ];
    const tex = buildExerciseTex(META, blocks);
    const parsed = parseExerciseTex(tex);

    expect(parsed.meta.uuid).toBe('Ab3d');
    expect(parsed.meta.title).toBe('Suites géométriques');
    expect(parsed.meta.difficulty).toBe('2');
    expect(parsed.blocks.map((b) => b.type)).toEqual([
      'text', 'question', 'indication', 'reponse', 'question',
    ]);
    // contenu préservé (aux espaces d'indentation près)
    expect(parsed.blocks[1].latex).toBe(blocks[1].latex);
    expect(parsed.blocks[3].latex.replace(/\s+/g, ' ')).toBe(blocks[3].latex.replace(/\s+/g, ' '));
  });

  it('parse un fichier source réel du site', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'content/exercises/amscc/Tz9w.tex'),
      'utf8'
    );
    const { meta, blocks } = parseExerciseTex(source);

    expect(meta.uuid).toBe('Tz9w');
    expect(meta.title).toContain('Rétropropagation');
    expect(meta.author).toBe('Maxime Nguyen');
    expect(blocks.filter((b) => b.type === 'question').length).toBe(5);
    expect(blocks.filter((b) => b.type === 'reponse').length).toBe(5);
    expect(blocks.filter((b) => b.type === 'indication').length).toBe(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].latex).toContain('h_t = \\tanh');
  });

  it('ignore les commandes commentées', () => {
    const { blocks } = parseExerciseTex('\\contenu{\n% \\question{cachée}\n\\question{visible}\n}');
    expect(blocks.length).toBe(1);
    expect(blocks[0].latex).toBe('visible');
  });
});

describe('splitEnumerateItems', () => {
  it('découpe un enumerate multi-items produit par l’IA en questions distinctes', () => {
    const out = splitEnumerateItems(
      'Soit $f(x) = x^2$.\n\\begin{enumerate}\n\\item Calculer $f(2)$.\n\\item Étudier la parité de $f$.\n\\end{enumerate}'
    );
    expect(out).not.toBeNull();
    expect(out.prefix).toBe('Soit $f(x) = x^2$.');
    expect(out.items).toEqual(['Calculer $f(2)$.', 'Étudier la parité de $f$.']);
  });

  it('gère les labels d’item optionnels', () => {
    const out = splitEnumerateItems(
      '\\begin{enumerate}[label=(\\alph*)]\n\\item[a)] Première.\n\\item Seconde.\n\\end{enumerate}'
    );
    expect(out.items).toEqual(['Première.', 'Seconde.']);
    expect(out.prefix).toBe('');
  });

  it('laisse intact un contenu sans enumerate, à item unique ou imbriqué', () => {
    expect(splitEnumerateItems('Une simple question sur $\\R$.')).toBeNull();
    expect(
      splitEnumerateItems('\\begin{enumerate}\\item Seule question.\\end{enumerate}')
    ).toBeNull();
    expect(
      splitEnumerateItems(
        '\\begin{enumerate}\\item A \\begin{enumerate}\\item B\\end{enumerate}\\item C\\end{enumerate}'
      )
    ).toBeNull();
  });
});

describe('generateShortUuid', () => {
  it('produit 4 caractères base64url', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateShortUuid()).toMatch(/^[A-Za-z0-9_-]{4}$/);
    }
  });
});

describe('generateLatexDocument', () => {
  it('remplace les apostrophes typographiques dans les titres et le contenu', () => {
    const source = generateLatexDocument([{
      uuid: 'Ab3d',
      title: 'L’intégrale',
      content: [{ type: 'question', latex: 'Calculer l’intégrale de $f$.' }],
    }], 'L’intégrale');

    expect(source).toContain("l'intégrale");
    expect(source).not.toContain('l’intégrale');
  });

  it('adapte les indications et solutions aux options de contenu', () => {
    const exercises = [{
      uuid: 'Ab3d',
      title: 'Test',
      content: [
        { type: 'question', latex: 'Question à résoudre.' },
        { type: 'indication', latex: 'Indice réservé.' },
        { type: 'reponse', latex: 'Solution réservée.' },
      ],
    }];

    const withoutExtras = generateLatexDocument(exercises, 'Test', {
      includeHints: false,
      includeSolutions: false,
    });
    expect(withoutExtras).not.toContain('Indice réservé.');
    expect(withoutExtras).not.toContain('Solution réservée.');

    const solutionsAtEnd = generateLatexDocument(exercises, 'Test', {
      includeHints: true,
      includeSolutions: true,
      solutionsAtEnd: true,
    });
    expect(solutionsAtEnd).toContain('Indice réservé.');
    expect(solutionsAtEnd).toContain('\\small\\textbf{Indication.}');
    expect(solutionsAtEnd).toContain('\\section*{Réponses}');
    expect(solutionsAtEnd.indexOf('Solution réservée.')).toBeGreaterThan(
      solutionsAtEnd.indexOf('\\section*{Réponses}'),
    );
  });

  it('normalise les erreurs de délimiteurs fréquentes dans un bloc IA', () => {
    const source = generateLatexDocument([{
      uuid: 'Ab3d',
      title: 'Test',
      content: [{
        type: 'reponse',
        latex: '\\operatorname{cov}(X,Y)=0.\n\\\\textbf{Interprétation.}',
      }],
    }], 'Test');

    expect(source).toContain('$\\operatorname{cov}(X,Y)=0.$');
    expect(source).toContain('\\textbf{Interprétation.}');
    expect(source).not.toContain('\\\\textbf{Interprétation.}');
  });
});

describe('latexToPreviewHtml', () => {
  it('préserve les maths pour KaTeX et échappe le HTML', () => {
    const html = latexToPreviewHtml('Soit $x < 1$ et \\[ \\sum_{k} a_k \\] avec a<b.');
    expect(html).toContain('$x &lt; 1$');
    expect(html).toContain('\\[ \\sum_{k} a_k \\]');
    expect(html).toContain('a&lt;b');
    expect(html).not.toContain('<script');
  });

  it('convertit le balisage texte courant', () => {
    const html = latexToPreviewHtml(
      'Un \\textbf{résultat} \\emph{important}.\n\n\\begin{itemize}\n\\item premier\n\\item second\n\\end{itemize}'
    );
    expect(html).toContain('<strong>résultat</strong>');
    expect(html).toContain('<em>important</em>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>premier</li>');
  });

  it('convertit align* en bloc math KaTeX', () => {
    const html = latexToPreviewHtml('\\begin{align*} x &= 1 \\\\ y &= 2 \\end{align*}');
    expect(html).toContain('$$');
    expect(html).toContain('\\begin{aligned}');
    // le contenu math n'est pas transformé en <br>
    expect(html).not.toContain('<br>');
  });

  it('remplace les artefacts non rendus par des encarts', () => {
    const html = latexToPreviewHtml(
      '\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}\n\n\\includegraphics{fig.png}'
    );
    expect(html).toContain('tex-preview-artifact');
    expect(html).toContain('TikZ');
    expect(html).toContain('fig.png');
    expect(html).not.toContain('tikzpicture');
  });

  it('sépare les paragraphes sur les lignes vides', () => {
    const html = latexToPreviewHtml('Premier paragraphe.\n\nSecond paragraphe.');
    expect((html.match(/<p>/g) || []).length).toBe(2);
  });
});

describe('blocksToPreviewContent', () => {
  it('produit des blocs au format ExerciseContent (type + html + order)', () => {
    const content = blocksToPreviewContent([
      { id: 'a', type: 'text', latex: 'Intro $x$' },
      { id: 'b', type: 'question', latex: 'Question ?' },
      { id: 'c', type: 'reponse', latex: '' }, // vide : filtré
    ]);
    expect(content.length).toBe(2);
    expect(content[0]).toMatchObject({ id: 'a', type: 'text', order: 1 });
    expect(content[0].html).toContain('$x$');
    expect(content[1].order).toBe(2);
  });
});
