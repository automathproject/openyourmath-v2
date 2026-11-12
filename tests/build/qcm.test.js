// tests/build/qcm.test.js
// Contenus qcm : lecture de la source exobase (src/lib/qcm/source.js),
// conversion en blocs (scripts/parse-qcm.js) et correction (src/lib/qcm/blocks.js).

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { choiceLetter, correctLetters, parseQcmSource } from '../../src/lib/qcm/source.js';
import {
  choiceMarks,
  correctIndexes,
  isCorrectSelection,
  isQcm,
  mapBlockHtml,
  normalizeSelection,
  qcmQuestionsOf,
} from '../../src/lib/qcm/blocks.js';
import { lettersOf, resultsToCsv } from '../../src/lib/qcm/results.js';
import { parseQcmFile, prepareFragment } from '../../scripts/parse-qcm.js';

const SINGLE = String.raw`\uuid{Ab12}
\titre{Puissances de deux}
\auteur{bodin ; hanani}
\organisation{exo7}
\licence{CC BY-NC-SA 4.0}
\datecreate{2020-01-20}
\niveau{L1}
\module{Algèbre}
\chapitre{Logique, ensemble, raisonnement}
\sousChapitre{Logique}
\difficulte{2}
\theme{puissances, calcul}
\exo7qcmid{lille-1.logique.001}

\contenu{
\begin{question}
\qclassification{100.01,100.03}
\qtags{motcle=puissances}
\qkeeporder
Combien font $2^{10}$ ?
% \bad{un commentaire n'est pas une réponse}
\begin{answers}
    \bad{1000 \feedback{Presque : $10^3$.}}
    \good{$1024$}
    \bad{Aucune des réponses ci-dessus.}
\end{answers}
\begin{explanations}
On a $2^{10} = 1024$.
\end{explanations}
\end{question}
}
`;

const SERIES = String.raw`\uuid{Cd34}
\titre{Deux dés}
\auteur{worms}
\organisation{exo7}
\datecreate{2017-08-28}
\niveau{L2}
\module{Probabilité et statistique}
\chapitre{Probabilité discrète}
\serie{ordonnee}

\contenu{
\texte{
On lance deux dés équilibrés et on note $X$ leur somme.
}

\begin{question}
Que vaut $\mathbb{P}(X=2)$ ?
\begin{answers}
\good{$1/36$}
\bad{$1/18$}
\end{answers}
\end{question}

\begin{question}
\qtype{zerotoall}
En déduire les affirmations vraies.
\begin{answers}
\bad{$\mathbb{P}(X=2) > 1/2$}
\bad{$X$ est constante.}
\end{answers}
\end{question}
}
`;

describe('parseQcmSource', () => {
  it('lit les métadonnées, les réponses et les options d’une question', () => {
    const parsed = parseQcmSource(SINGLE);
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta).toMatchObject({
      uuid: 'Ab12',
      title: 'Puissances de deux',
      author: 'bodin ; hanani',
      license_code: 'CC BY-NC-SA 4.0',
      difficulty: '2',
      source_id: 'lille-1.logique.001',
    });
    expect(parsed.ordered).toBe(false);
    expect(parsed.questions).toHaveLength(1);

    const [question] = parsed.questions;
    expect(question.stem).toBe('Combien font $2^{10}$ ?');
    expect(question.keepOrder).toBe(true);
    expect(question.classification).toEqual(['100.01', '100.03']);
    expect(question.answers.map((answer) => answer.correct)).toEqual([false, true, false]);
    expect(question.answers[0]).toMatchObject({ latex: '1000', feedback: 'Presque : $10^3$.' });
    expect(question.explanation).toBe('On a $2^{10} = 1024$.');
  });

  it('garde l’ordre et le contexte d’une série', () => {
    const parsed = parseQcmSource(SERIES);
    expect(parsed.errors).toEqual([]);
    expect(parsed.ordered).toBe(true);
    expect(parsed.context).toContain('deux dés équilibrés');
    expect(parsed.questions.map((question) => question.stem)).toEqual([
      'Que vaut $\\mathbb{P}(X=2)$ ?',
      'En déduire les affirmations vraies.',
    ]);
    // zerotoall : aucune réponse juste n'est pas une erreur.
    expect(parsed.questions[1].type).toBe('zerotoall');
  });

  it('signale une question sans réponse juste ou sans réponses', () => {
    const broken = SINGLE.replace('\\good{$1024$}', '\\bad{$1024$}');
    expect(parseQcmSource(broken).errors).toEqual(['question 1 : aucune réponse juste']);
    expect(parseQcmSource('\\uuid{X}').errors).toEqual(['\\contenu{} absent']);
  });

  it('nomme les réponses par des lettres', () => {
    expect(choiceLetter(0)).toBe('A');
    expect(correctLetters([{ correct: true }, { correct: false }, { correct: true }])).toBe('A, C');
    expect(correctLetters([{ correct: false }])).toBe('aucune');
  });
});

describe('prepareFragment', () => {
  it('retire la mise en page papier et adapte ce que KaTeX ignore', () => {
    expect(prepareFragment('\\vskip2mm\nTexte \\noindent suite')).toBe('\nTexte  suite');
    expect(prepareFragment('$a \\makebox[1.5cm][c]{ et } b$')).toBe('$a \\quad\\text{et}\\quad  b$');
    expect(prepareFragment('$$x=1.\\leqno{(\\star)}$$')).toBe('$$x=1.\\qquad {(\\star)}$$');
    expect(prepareFragment('\\qimage[height=3cm]{images/png/a-1.png}')).toBe('\\includegraphics[height=3cm]{images/png/a-1.png}');
  });
});

describe('parseQcmFile', () => {
  it('produit des blocs lisibles sans connaître les qcm, et jouables en les connaissant', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oym-qcm-'));
    const file = path.join(root, 'exo7', 'lot', 'Cd34.tex');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, SERIES);

    const { mainData } = await parseQcmFile(file, { qcmRoot: root, contentRoot: root, artifactsRoot: root });
    fs.rmSync(root, { recursive: true, force: true });

    expect(mainData).toMatchObject({
      uuid: 'Cd34',
      content_type: 'qcm',
      source_path: 'exo7/lot/Cd34.tex',
      question_count: 2,
      ordered: true,
    });
    expect(mainData.content.map((block) => block.type)).toEqual(['text', 'question', 'reponse', 'question', 'reponse']);

    const question = mainData.content[1];
    // Forme lisible partout : énoncé puis réponses lettrées, en HTML comme en LaTeX.
    expect(question.html).toContain('<ul class="qcm-choix">');
    expect(question.html).toContain('<span class="qcm-lettre">B.</span>');
    expect(question.latex).toContain('\\item[$\\square$ \\textbf{A.}] $1/36$');
    // Forme jouable.
    expect(question.qcm.choices.map((choice) => choice.correct)).toEqual([true, false]);
    expect(question.qcm.choices[0].html).not.toMatch(/^<p>/);
    expect(mainData.content[2].html).toContain('Réponses justes : A.');
    expect(mainData.content[4].html).toContain('Réponses justes : aucune.');
    // L'aperçu est l'énoncé commun, pas la liste des réponses.
    expect(mainData.preview).toContain('deux dés');
    expect(mainData.preview).not.toContain('qcm-choix');
  });
});

describe('blocs de qcm', () => {
  const exercise = {
    uuid: 'Cd34',
    title: 'Deux dés',
    content_type: 'qcm',
    content: [
      { type: 'question', order: 2, html: '<p>Q1</p>', qcm: { type: 'onetoall', stem_html: '<p>Q1</p>', explanation_html: '<p>E1</p>', choices: [{ html: 'a', correct: true }, { html: 'b', correct: false }, { html: 'c', correct: true }] } },
      { type: 'text', order: 1, html: '<p>Contexte</p>' },
      { type: 'reponse', order: 3, html: '<p>R1</p>' },
      { type: 'question', order: 4, html: '<p>Q2</p>', qcm: { type: 'onlyone', stem_html: '<p>Q2</p>', explanation_html: '', choices: [{ html: 'x', correct: false }, { html: 'y', correct: true }] } },
    ],
  };

  it('reconnaît un qcm et déroule ses questions dans l’ordre', () => {
    expect(isQcm(exercise)).toBe(true);
    expect(isQcm({ content: [{ type: 'question', html: 'x' }] })).toBe(false);
    const questions = qcmQuestionsOf(exercise);
    expect(questions.map((question) => [question.rank, question.of, question.stem_html])).toEqual([[1, 2, '<p>Q1</p>'], [2, 2, '<p>Q2</p>']]);
    // Le contexte de la série accompagne chaque question ; la correction n'en fait pas partie.
    expect(questions.every((question) => question.context_html === '<p>Contexte</p>')).toBe(true);
  });

  it('n’accepte que la sélection exacte des réponses justes', () => {
    const { choices } = exercise.content[0].qcm;
    expect(correctIndexes(choices)).toEqual([0, 2]);
    expect(isCorrectSelection(choices, [2, 0])).toBe(true);
    expect(isCorrectSelection(choices, [0])).toBe(false);
    expect(isCorrectSelection(choices, [0, 1, 2])).toBe(false);
    expect(isCorrectSelection([{ correct: false }, { correct: false }], [])).toBe(true);
    expect(choiceMarks(choices, [0, 1])).toEqual(['good', 'bad', 'missed']);
  });

  it('nettoie une sélection venue du réseau', () => {
    expect(normalizeSelection([2, 2, 0, 9, -1, 1.5, 'a', null], 3)).toEqual([0, 2]);
    expect(normalizeSelection('0,1', 3)).toEqual([]);
  });

  it('transforme tous les fragments HTML d’un bloc', () => {
    const mapped = mapBlockHtml(exercise.content[0], (html) => html.toUpperCase());
    expect(mapped.html).toBe('<P>Q1</P>');
    expect(mapped.qcm.stem_html).toBe('<P>Q1</P>');
    expect(mapped.qcm.choices.map((choice) => choice.html)).toEqual(['A', 'B', 'C']);
    expect(exercise.content[0].qcm.choices[0].html).toBe('a');
  });
});

describe('bilan d’une session', () => {
  it('s’exporte en CSV lisible par un tableur français', () => {
    const csv = resultsToCsv({
      title: 'Essai',
      questions: [
        { title: 'Logique', rank: 1, of: 1, correct: [1] },
        { title: 'Deux dés', rank: 2, of: 4, correct: [0, 2] },
      ],
      participants: [
        { name: 'Ada', answers: [{ selection: [1], correct: true }, null] },
        { name: '=cmd()', answers: [{ selection: [], correct: false }, { selection: [0, 2], correct: true }] },
      ],
    });
    const lines = csv.replace(/^\ufeff/, '').trim().split('\r\n');
    expect(lines[0]).toBe('"Participant";"Q1 – Logique";"Q2 – Deux dés (2/4)";"Score"');
    expect(lines[1]).toBe('"Réponses justes";"B";"A, C";""');
    expect(lines[2]).toBe('"Ada";"B";"";"1/2"');
    // Un pseudonyme ne doit pas pouvoir devenir une formule de tableur.
    expect(lines[3]).toBe('"\'=cmd()";"(aucune)";"A, C";"1/2"');
    expect(lettersOf([0, 3])).toBe('A, D');
  });
});
