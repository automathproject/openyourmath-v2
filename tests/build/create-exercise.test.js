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
import {
  generateLatexDocument,
  buildLatexExport,
  latexFileName,
} from '../../src/lib/latex/export.js';
import {
  limitedSequenceBlocksFromAi,
  limitedSequenceLatex,
  splitNumberedQuestions,
  splitSubQuestionParts,
  questionBlocksFromAi,
} from '../../src/lib/ia/sequence.js';
import { DEFAULT_TASKS, SYSTEM_PROMPT } from '../../src/lib/ia/assistPrompts.js';

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

describe('limitedSequenceBlocksFromAi', () => {
  it('ne conserve jamais plus de questions que demandé', () => {
    const result = limitedSequenceBlocksFromAi(
      'Première question.\n---\nDeuxième question.\n---\nTroisième question.',
      1,
    );

    expect(result).toEqual({ text: null, questions: ['Première question.'] });
  });

  it('applique aussi la limite à un enumerate produit par le modèle', () => {
    const result = limitedSequenceBlocksFromAi(
      'Contexte.\n\\begin{enumerate}\n\\item Question 1.\n\\item Question 2.\n\\end{enumerate}',
      1,
    );

    expect(result).toEqual({ text: 'Contexte.', questions: ['Question 1.'] });
  });

  it('limite aussi une séquence que le modèle a numérotée lui-même', () => {
    const result = limitedSequenceBlocksFromAi(
      'Soit $f(x)=x^2$.\n\n1. Calculer $f(2)$.\n\n2. Étudier $f$.\n\n3. Conclure.',
      1,
    );

    expect(result).toEqual({ text: 'Soit $f(x)=x^2$.', questions: ['Calculer $f(2)$.'] });
  });

  it('sérialise une réponse API à une question sans conserver un enumerate', () => {
    const result = limitedSequenceLatex(
      'Considérer la série $\\sum a_n$.\n\\begin{enumerate}\n\\item\nMontrer que $a_n \\to 0$.\n\\item\nÉtudier la convergence.\n\\end{enumerate}',
      1,
    );

    expect(result).toBe('Considérer la série $\\sum a_n$.\n\nMontrer que $a_n \\to 0$.');
  });
});

describe('splitNumberedQuestions', () => {
  it('découpe une numérotation écrite par le modèle dans un bloc unique', () => {
    const result = splitNumberedQuestions(
      'Soit $f(x)=x^2$.\n\n1. Calculer $f(2)$.\n\n2. Étudier les variations.\n\n3. Tracer la courbe.',
    );

    expect(result).toEqual({
      prefix: 'Soit $f(x)=x^2$.',
      items: ['Calculer $f(2)$.', 'Étudier les variations.', 'Tracer la courbe.'],
    });
  });

  it('reconnaît les marqueurs Question et \\textbf', () => {
    const result = splitNumberedQuestions(
      '\\textbf{Question 1.} Calculer $f(2)$.\n\\textbf{Question 2.} Conclure.',
    );

    expect(result).toEqual({ prefix: '', items: ['Calculer $f(2)$.', 'Conclure.'] });
  });

  it('ne découpe pas des sous-parties (a), (b), (c)', () => {
    expect(
      splitNumberedQuestions('Soit $u_n$.\n(a) Montrer que $u_n>0$.\n(b) Calculer la limite.'),
    ).toBeNull();
  });

  it('ne découpe pas une numérotation incomplète ou désordonnée', () => {
    expect(
      splitNumberedQuestions('Résoudre le système.\n2. Vérifier.\n5. Conclure.'),
    ).toBeNull();
  });

  it('ignore les lignes numérotées situées dans une zone mathématique', () => {
    expect(
      splitNumberedQuestions(
        'Résoudre :\n\\[\n\\begin{cases}\n1. x + y = 2\n2. x - y = 0\n\\end{cases}\n\\]',
      ),
    ).toBeNull();
  });
});

describe('splitSubQuestionParts', () => {
  it('remet à plat une question découpée en (a), (b)', () => {
    const result = splitSubQuestionParts(
      "Soit $f$ définie sur $\\R$.\n\n(a) Montrer que $f$ est croissante.\n\n(b) En déduire sa limite.",
    );

    expect(result).toEqual({
      prefix: 'Soit $f$ définie sur $\\R$.',
      items: ['Montrer que $f$ est croissante.', 'En déduire sa limite.'],
    });
  });

  it('découpe aussi les sous-parties à l\'intérieur d\'un bloc séparé par ---', () => {
    const { text, questions } = questionBlocksFromAi(
      'Soit $u_n$ une suite.\n(a) Montrer $u_n>0$.\n(b) Calculer la limite.\n---\nConclure sur la convergence.',
    );

    expect(text).toBeNull();
    expect(questions).toEqual([
      'Soit $u_n$ une suite.\n\nMontrer $u_n>0$.',
      'Calculer la limite.',
      'Conclure sur la convergence.',
    ]);
  });
});

describe('splitSubQuestionParts (cas limites)', () => {
  it('reconnaît les sous-parties mises en forme par \\textbf', () => {
    expect(
      splitSubQuestionParts('\\textbf{(a)} Calculer $f(2)$.\n\\textbf{(b)} Conclure.'),
    ).toEqual({ prefix: '', items: ['Calculer $f(2)$.', 'Conclure.'] });
  });

  it('ne découpe pas sur une simple référence à un point (b) dans le texte', () => {
    expect(
      splitSubQuestionParts("Montrer que la solution (b) de l'équation est unique."),
    ).toBeNull();
  });

  it('ne découpe pas une suite de lettres incomplète', () => {
    expect(splitSubQuestionParts('Soit $f$.\n(b) Calculer.\n(d) Conclure.')).toBeNull();
  });
});

describe('prompt de séquence IA', () => {
  it('demande un exercice complet et le respect strict du nombre de questions', () => {
    expect(DEFAULT_TASKS.sequence).toContain('exercice complet, autonome et publiable');
    expect(DEFAULT_TASKS.sequence).toContain('une seule question est demandée');
    expect(DEFAULT_TASKS.sequence).toContain('exactement ce nombre de blocs');
    expect(DEFAULT_TASKS.sequence).toContain('structure est strictement linéaire');
    expect(DEFAULT_TASKS.sequence).toContain('devient une question à part entière');
    expect(SYSTEM_PROMPT).toContain('suite LINÉAIRE de blocs');
    expect(DEFAULT_TASKS.sequence).toContain('ligne contenant uniquement ---');
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

  it('déplie les macros OpenYourMath restées dans un bloc texte', () => {
    const source = generateLatexDocument([{
      uuid: 'Ab3d',
      title: 'Test',
      content: [{
        type: 'text',
        latex: '\\begin{itemize}\n\\item \\question{Une sous-question $\\frac{1}{2}$.}\n\\indication{Une piste.}\n\\reponse{Une réponse.}\n\\end{itemize}',
      }],
    }], 'Test');

    expect(source).not.toMatch(/\\\\(?:question|indication|reponse)\s*\{/);
    expect(source).toContain('Une sous-question $\\frac{1}{2}$.');
    expect(source).toContain('Une piste.');
    expect(source).toContain('Une réponse.');
    expect(source).toContain('\\small\\textbf{Indication.}');
    expect(source).toContain('\\small\\textbf{Solution.}');
  });

  it('referme une liste laissée ouverte dans un bloc partiellement parsée', () => {
    const source = generateLatexDocument([{
      uuid: 'Ab3d',
      title: 'Test',
      content: [{ type: 'text', latex: '\\begin{itemize}\n\\item Élément.' }],
    }], 'Test');

    expect(source).toContain('\\begin{itemize}\n\\item Élément.\n\\end{itemize}');
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

// Les figures suivent deux chemins distincts : le .tex téléchargé garde ses
// \includegraphics pour une compilation locale, tandis que le document envoyé
// au compilateur en ligne doit composer avec un service qui n'accepte que des
// fichiers texte et range tout dans un répertoire unique.
describe('buildLatexExport — traitement des images', () => {
  const exercises = [{
    uuid: 'zzzz',
    title: 'Figures',
    content: [{
      type: 'question',
      order: 1,
      latex:
        'Photo : \\includegraphics[width=6cm]{fig/photo.jpg}\n' +
        'Schéma : \\includegraphics{fig/plan.svg}',
    }],
  }];

  const artifactsMap = {
    zzzz: {
      images: [
        { originalPath: 'fig/photo.jpg', url: '/artifacts/images/zzzz/photo.jpg' },
        { originalPath: 'fig/plan.svg', url: '/artifacts/images/zzzz/plan.svg' },
      ],
    },
  };

  it('conserve toutes les figures en mode fichiers (compilation locale)', () => {
    const result = buildLatexExport(exercises, 'T', { artifactsMap });

    expect(result.source).toContain('\\includegraphics[width=6cm]{images/zzzz/photo.jpg}');
    expect(result.source).toContain('\\includegraphics{images/zzzz/plan.svg}');
    expect(result.skippedImages).toEqual([]);
    expect(result.images.map((i) => i.localPath)).toEqual([
      'images/zzzz/photo.jpg',
      'images/zzzz/plan.svg',
    ]);
  });

  it('aplatit les noms acceptés et remplace les autres en mode distant', () => {
    const result = buildLatexExport(exercises, 'T', { artifactsMap, imageMode: 'remote' });

    // Le service range tous les fichiers côte à côte : le chemin disparaît.
    expect(result.source).toContain('\\includegraphics{zzzz_plan.svg}');
    expect(result.images.map((i) => i.localPath)).toEqual(['zzzz_plan.svg']);

    // Le JPEG ne survivrait pas au transport : encart plutôt qu'échec. Plus
    // aucune inclusion ne doit le référencer — l'encart, lui, en cite l'URL.
    expect(result.source).not.toMatch(/\\includegraphics[^\n]*photo\.jpg/);
    expect(result.source).toContain('\\imageEnLigne{/artifacts/images/zzzz/photo.jpg}');
    expect(result.skippedImages).toEqual([
      { url: '/artifacts/images/zzzz/photo.jpg', extension: '.jpg' },
    ]);
  });

  it("ne déclare la macro d'encart que lorsqu'elle sert", () => {
    const local = buildLatexExport(exercises, 'T', { artifactsMap });
    const remote = buildLatexExport(exercises, 'T', { artifactsMap, imageMode: 'remote' });

    expect(local.source).not.toContain('\\newcommand{\\imageEnLigne}');
    expect(remote.source).toContain('\\newcommand{\\imageEnLigne}');
  });

  it('retire graphicx quand toutes les figures ont été remplacées', () => {
    const onlyJpeg = [{
      uuid: 'yyyy',
      title: 'Photo seule',
      content: [{ type: 'question', order: 1, latex: '\\includegraphics{fig/photo.jpg}' }],
    }];
    const map = {
      yyyy: { images: [{ originalPath: 'fig/photo.jpg', url: '/artifacts/images/yyyy/photo.jpg' }] },
    };

    const remote = buildLatexExport(onlyJpeg, 'T', { artifactsMap: map, imageMode: 'remote' });
    expect(remote.source).not.toContain('\\usepackage{graphicx}');
    expect(remote.images).toEqual([]);
  });
});

describe('latexFileName', () => {
  it('conserve les lettres accentuées sous leur forme ASCII', () => {
    expect(latexFileName('Probabilités TD3')).toBe('probabilites_td3');
    expect(latexFileName('Algèbre linéaire (L2)')).toBe('algebre_lineaire_l2');
  });

  it("ne perd plus l'initiale d'un titre commençant par une majuscule accentuée", () => {
    // Le É devenait « _ », que le nettoyage des bords supprimait : le fichier
    // s'appelait « quations… ».
    expect(latexFileName('Équations différentielles')).toBe('equations_differentielles');
  });

  it('translittère les ligatures, que la normalisation ne décompose pas', () => {
    expect(latexFileName('Théorie des nœuds')).toBe('theorie_des_noeuds');
    expect(latexFileName('Cœur & âme')).toBe('coeur_ame');
  });

  it('réduit la ponctuation à des séparateurs simples', () => {
    expect(latexFileName('Suites — révisions : partie 2')).toBe('suites_revisions_partie_2');
  });

  it('retombe sur le nom de secours si rien ne subsiste', () => {
    expect(latexFileName('///', 'seance')).toBe('seance');
    expect(latexFileName('')).toBe('exercices');
  });
});
