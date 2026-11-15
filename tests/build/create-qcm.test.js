// tests/build/create-qcm.test.js
// Création de qcm dans l'éditeur /create :
// - brouillon, export et relecture au format des sources (src/lib/qcm/editor.js)
// - consignes envoyées à l'IA (src/lib/ia/assistPrompts.js)
// - lecture des réponses de l'IA (src/lib/ia/qcmAssist.js)

import { describe, it, expect } from 'vitest';

import {
  buildQcmTex,
  isQcmSource,
  newQcmQuestion,
  normalizeAnswer,
  qcmDraftFromSource,
  qcmFragments,
  qcmIssues,
  qcmToBlocks,
  reviveQcmDraft,
  shuffledChoices,
} from '../../src/lib/qcm/editor.js';
import { parseQcmSource } from '../../src/lib/qcm/source.js';
import { isCorrectSelection, qcmQuestionsOf } from '../../src/lib/qcm/blocks.js';
import { latexToPreviewHtml } from '../../src/lib/latex/texPreview.js';
import {
  DISTRACTOR_RULES,
  buildDistractorPrompt,
  buildQcmPrompt,
} from '../../src/lib/ia/assistPrompts.js';
import { parseDistractorOutput, parseQcmOutput, unwrapTextSentence } from '../../src/lib/ia/qcmAssist.js';

const META = {
  uuid: 'Qc1m',
  title: 'Dérivée d’une composée',
  level: 'L1',
  module: 'Analyse',
  chapter: 'Dérivation',
  author: 'Ada Lovelace',
  organization: 'OYM',
  created_at: '2026-11-14',
  difficulty: '2',
  video_id: 'abc',
};

function draftOf(...questions) {
  return reviveQcmDraft({ context: '', questions });
}

const DERIVATIVE = {
  stem: 'Quelle est la dérivée de $x \\mapsto \\sin(x^2)$ ?',
  type: 'onlyone',
  explanation: 'Par dérivation d’une composée : $2x\\cos(x^2)$.',
  choices: [
    { latex: '$\\cos(x^2)$', correct: false, feedback: 'La dérivée intérieure $2x$ manque.', note: 'oubli de la dérivée intérieure' },
    { latex: '$2x\\cos(x^2)$', correct: true },
    { latex: '$2x\\cos(2x)$', correct: false },
    { latex: '', correct: false },
  ],
};

describe('buildQcmTex', () => {
  it('écrit une source que le lecteur de qcm du site relit sans erreur', () => {
    const tex = buildQcmTex(META, draftOf(DERIVATIVE));
    const parsed = parseQcmSource(tex);

    expect(parsed.errors).toEqual([]);
    expect(parsed.meta).toMatchObject({ uuid: 'Qc1m', title: 'Dérivée d’une composée', chapter: 'Dérivation', difficulty: '2' });
    expect(parsed.questions).toHaveLength(1);
    const [question] = parsed.questions;
    expect(question.type).toBe('onlyone');
    expect(question.stem).toBe(DERIVATIVE.stem);
    expect(question.explanation).toBe(DERIVATIVE.explanation);
    expect(question.answers.map((answer) => [answer.latex, answer.correct])).toEqual([
      ['$\\cos(x^2)$', false],
      ['$2x\\cos(x^2)$', true],
      ['$2x\\cos(2x)$', false],
    ]);
    expect(question.answers[0].feedback).toBe('La dérivée intérieure $2x$ manque.');
  });

  it("n'exporte ni les notes d'auteur, ni les champs propres aux exercices, ni les réponses vides", () => {
    const tex = buildQcmTex(META, draftOf(DERIVATIVE));
    expect(tex).not.toContain('oubli de la dérivée intérieure');
    expect(tex).not.toContain('\\video');
    expect(tex.match(/\\(?:good|bad)\{/g)).toHaveLength(3);
    expect(tex).not.toContain('\\serie');
  });

  it('marque une série ordonnée dès deux questions et place l’énoncé commun avant elles', () => {
    const draft = draftOf(DERIVATIVE, { ...DERIVATIVE, stem: 'Et sa dérivée seconde ?' });
    draft.context = 'On pose $f(x) = \\sin(x^2)$.';
    const tex = buildQcmTex(META, draft);
    const parsed = parseQcmSource(tex);

    expect(tex).toContain('\\serie{ordonnee}');
    expect(parsed.errors).toEqual([]);
    expect(parsed.context).toBe('On pose $f(x) = \\sin(x^2)$.');
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.ordered).toBe(true);
  });

  it('omet \\qtype pour le type par défaut et garde l’ordre quand une réponse en désigne d’autres', () => {
    const tex = buildQcmTex(META, draftOf({
      stem: 'Quelles sont les assertions vraies ?',
      type: 'onetoall',
      choices: [
        { latex: 'Toute suite convergente est bornée.', correct: true },
        { latex: 'Toute suite bornée converge.', correct: false },
        { latex: 'Aucune des réponses ci-dessus.', correct: false },
      ],
    }));
    expect(tex).not.toContain('\\qtype');
    expect(tex).toContain('\\qkeeporder');
    expect(parseQcmSource(tex).questions[0].keepOrder).toBe(true);
  });

  it('fait l’aller-retour source → brouillon → source', () => {
    const tex = buildQcmTex(META, draftOf(DERIVATIVE));
    expect(isQcmSource(tex)).toBe(true);
    expect(isQcmSource('\\contenu{\\question{Calculer $1+1$.}}')).toBe(false);
    const { meta, draft, errors } = qcmDraftFromSource(tex);
    expect(errors).toEqual([]);
    expect(buildQcmTex({ ...META, ...meta }, draft)).toBe(tex);
  });
});

describe('qcmIssues', () => {
  it('ne signale rien pour une question bien formée', () => {
    expect(qcmIssues(draftOf(DERIVATIVE), META)).toEqual([]);
  });

  it('signale réponse juste manquante, réponses en double et réponses justes en trop', () => {
    const none = qcmIssues(draftOf({ ...DERIVATIVE, choices: DERIVATIVE.choices.map((c) => ({ ...c, correct: false })) }));
    expect(none.join(' ')).toMatch(/aucune réponse n'est marquée juste/);

    const twice = qcmIssues(draftOf({
      ...DERIVATIVE,
      choices: [
        { latex: '$2x\\cos(x^2)$', correct: true },
        { latex: '$ 2x \\cos( x^2 ) $', correct: false },
      ],
    }));
    expect(twice.join(' ')).toMatch(/identiques/);

    const several = qcmIssues(draftOf({ ...DERIVATIVE, choices: DERIVATIVE.choices.map((c) => ({ ...c, correct: true })) }));
    expect(several.join(' ')).toMatch(/une seule est attendue/);
  });

  it('signale ce qui casserait la source : accolade ouverte, % non échappé, difficulté hors barème', () => {
    const issues = qcmIssues(
      draftOf({ ...DERIVATIVE, stem: 'Soit $\\frac{1}{2$ et 50 % des cas.' }),
      { ...META, difficulty: '5' },
    );
    expect(issues.join(' ')).toMatch(/accolades/);
    expect(issues.join(' ')).toMatch(/\\%/);
    expect(issues.join(' ')).toMatch(/de 1 à 3/);
  });
});

describe('qcmToBlocks', () => {
  it('produit les blocs que le site sait jouer et corriger', () => {
    const draft = draftOf(DERIVATIVE);
    const content = qcmToBlocks(draft, latexToPreviewHtml);
    expect(content.map((block) => block.type)).toEqual(['question', 'reponse']);

    const [question] = qcmQuestionsOf({ uuid: 'Qc1m', content });
    expect(question.type).toBe('onlyone');
    expect(question.choices).toHaveLength(3);
    expect(question.choices[0].feedback_html).toContain('dérivée intérieure');
    expect(question.choices[0].html).not.toMatch(/^<p>/);
    expect(isCorrectSelection(question.choices, [1])).toBe(true);
    expect(isCorrectSelection(question.choices, [0])).toBe(false);

    expect(content[0].latex).toContain('\\item[$\\square$ \\textbf{B.}] $2x\\cos(x^2)$');
    expect(content[1].latex).toContain('Réponses justes :} B.');
  });

  it('liste chaque fragment à convertir une seule fois', () => {
    const draft = draftOf(DERIVATIVE, DERIVATIVE);
    expect(qcmFragments(draft)).toEqual([
      DERIVATIVE.stem,
      DERIVATIVE.explanation,
      '$\\cos(x^2)$',
      'La dérivée intérieure $2x$ manque.',
      '$2x\\cos(x^2)$',
      '$2x\\cos(2x)$',
    ]);
  });
});

describe('shuffledChoices', () => {
  it('mélange sans perdre de réponse, sauf quand l’ordre fait partie de la question', () => {
    const question = newQcmQuestion(DERIVATIVE);
    const shuffled = shuffledChoices(question, () => 0);
    expect(shuffled.map((c) => c.id).sort()).toEqual(question.choices.map((c) => c.id).sort());
    expect(shuffled.map((c) => c.id)).not.toEqual(question.choices.map((c) => c.id));

    const ordered = newQcmQuestion({ ...DERIVATIVE, keepOrder: true });
    expect(shuffledChoices(ordered, () => 0).map((c) => c.id)).toEqual(ordered.choices.map((c) => c.id));
  });
});

describe('normalizeAnswer', () => {
  it('ignore espaces, délimiteurs et variantes de \\frac', () => {
    expect(normalizeAnswer('$\\dfrac{1}{2}$')).toBe(normalizeAnswer('$ \\frac{1}{2} $.'));
    expect(normalizeAnswer('$\\left(x+1\\right)^2$')).toBe(normalizeAnswer('$(x+1)^2$'));
    expect(normalizeAnswer('$x+1$')).not.toBe(normalizeAnswer('$x-1$'));
  });
});

describe('consignes de génération', () => {
  it('fonde chaque distracteur sur une erreur d’étudiant vérifiée fausse', () => {
    expect(DISTRACTOR_RULES).toMatch(/UNE erreur précise et fréquente/);
    expect(DISTRACTOR_RULES).toMatch(/FAUX SANS AMBIGUÏTÉ/);
    expect(DISTRACTOR_RULES).toMatch(/PLAUSIBLE/);
    expect(DISTRACTOR_RULES).toMatch(/FIDÈLE À SON ERREUR/);
    expect(DISTRACTOR_RULES).toMatch(/INDISCERNABLE PAR LA FORME/);
    expect(DISTRACTOR_RULES).toMatch(/livre moins de distracteurs/);
  });

  it('transmet la question, les réponses justes, les fausses déjà là et le format de sortie', () => {
    const prompt = buildDistractorPrompt({ question: DERIVATIVE, count: 2, instruction: 'viser la confusion avec $\\sin^2$' });
    expect(prompt).toContain(DERIVATIVE.stem);
    expect(prompt).toMatch(/Réponses justes fournies par l'auteur :\n- \$2x\\cos\(x\^2\)\$/);
    expect(prompt).toMatch(/Réponses fausses déjà présentes[^\n]*\n- \$\\cos\(x\^2\)\$\n- \$2x\\cos\(2x\)\$/);
    expect(prompt).toContain(DERIVATIVE.explanation);
    expect(prompt).toContain('viser la confusion avec $\\sin^2$');
    expect(prompt).toContain('Nombre de distracteurs attendus : 2 au plus.');
    expect(prompt.trim().endsWith('il sera écarté.')).toBe(true);
    expect(prompt).toContain('[DISTRACTEUR]');
  });

  it('laisse le modèle trouver la réponse juste quand l’auteur ne l’a pas donnée', () => {
    const prompt = buildDistractorPrompt({ question: { stem: 'Calculer $1+1$.', choices: [] } });
    expect(prompt).toMatch(/détermine-la toi-même/);
    expect(prompt).not.toMatch(/Réponses fausses déjà présentes/);
  });

  it('impose nombre de questions, de réponses et type pour une question complète', () => {
    const single = buildQcmPrompt({ instruction: 'intégration par parties', questionCount: 1, answerCount: 4, type: 'onlyone' });
    expect(single).toContain('intégration par parties');
    expect(single).toMatch(/Exactement une question/);
    expect(single).toMatch(/une seule juste et 3 distracteurs/);
    expect(single).toContain(DISTRACTOR_RULES);

    const series = buildQcmPrompt({ questionCount: 3, answerCount: 5, type: 'onetoall' });
    expect(series).toMatch(/Exactement 3 questions, qui forment une série ordonnée/);
    expect(series).toMatch(/5 réponses par question, dont au moins une juste/);
  });
});

const DISTRACTOR_REPLY = `[ANALYSE]
La dérivée est $2x\\cos(x^2)$.
ERREUR : cette ligne d'analyse ne doit pas être lue comme un distracteur.

[DISTRACTEUR]
ERREUR : oubli de la dérivée intérieure
CALCUL : $(\\sin u)' = \\cos u$ avec $u = x^2$,
sans multiplier par $u'$.
REPONSE : $\\cos(x^2)$
VERIFICATION : en $x=1$, la dérivée vaut $2\\cos 1$.
VALIDE : oui
FEEDBACK : Il manque le facteur $2x$.

**[DISTRACTEUR]**
**ERREUR :** dérive l'intérieur à la place de l'argument
RÉPONSE : \\bad{$2x\\cos(2x)$}
VÉRIFICATION : en $x=1$ on trouve $2\\cos 2 \\neq 2\\cos 1$.
VALIDE : oui
FEEDBACK : L'argument du cosinus reste $x^2$,
sur deux lignes.

[DISTRACTEUR]
ERREUR : écriture équivalente
REPONSE : $2x \\cos( x^2 )$
VERIFICATION : c'est la réponse juste.
VALIDE : non
FEEDBACK : —

[DISTRACTEUR]
ERREUR : signe
REPONSE : $-2x\\cos(x^2)$
VALIDE : oui
FEEDBACK : La dérivée de $\\sin$ est $+\\cos$.

[DISTRACTEUR]
ERREUR : doublon du premier
REPONSE : $ \\cos(x^2) $
VALIDE : oui
FEEDBACK : idem
`;

describe('parseDistractorOutput', () => {
  it('lit les distracteurs, leur erreur visée et leur commentaire', () => {
    const distractors = parseDistractorOutput(DISTRACTOR_REPLY);
    expect(distractors.map((d) => d.latex)).toEqual(['$\\cos(x^2)$', '$2x\\cos(2x)$', '$-2x\\cos(x^2)$']);
    expect(distractors[0]).toEqual({
      latex: '$\\cos(x^2)$',
      correct: false,
      feedback: 'Il manque le facteur $2x$.',
      note: 'oubli de la dérivée intérieure',
    });
    expect(distractors[1].note).toBe("dérive l'intérieur à la place de l'argument");
    expect(distractors[1].feedback).toBe("L'argument du cosinus reste $x^2$,\nsur deux lignes.");
  });

  it('écarte ce que le modèle invalide, les doublons et les réponses déjà présentes', () => {
    const distractors = parseDistractorOutput(DISTRACTOR_REPLY, { existing: ['$2x\\cos(x^2)$', '$-2x \\cos(x^2)$'] });
    expect(distractors.map((d) => d.latex)).toEqual(['$\\cos(x^2)$', '$2x\\cos(2x)$']);
  });

  it('respecte le nombre demandé et rend une liste vide sur une réponse sans balise', () => {
    expect(parseDistractorOutput(DISTRACTOR_REPLY, { count: 1 })).toHaveLength(1);
    expect(parseDistractorOutput('Voici trois réponses fausses : 1, 2 et 3.')).toEqual([]);
  });
});

describe('unwrapTextSentence', () => {
  it('sort du mode mathématique une phrase enfermée dans \\text{}', () => {
    expect(unwrapTextSentence('$\\text{Si }(u_n)\\text{ est bornée, alors }(u_n)\\text{ converge.}$'))
      .toBe('Si $(u_n)$ est bornée, alors $(u_n)$ converge.');
    const reply = '[DISTRACTEUR]\nREPONSE : \\(\\text{Toute suite bornée converge.}\\)\nVALIDE : oui';
    expect(parseDistractorOutput(reply)[0].latex).toBe('Toute suite bornée converge.');
  });

  it('laisse les vraies formules intactes', () => {
    for (const latex of ['$x \\text{ pair}$', '$\\frac{1}{2}$', 'Si $x>0$ alors $\\text{e}^x>1$.', '$\\text{rg}(A) = 2$', '$\\text{dim Im}(f) = 2$']) {
      expect(unwrapTextSentence(latex)).toBe(latex);
    }
  });
});

const QCM_REPLY = `[QUESTION]
ENONCE : Quelle est la dérivée de $x \\mapsto \\sin(x^2)$ ?
RESOLUTION : On dérive une composée :
\\[ (\\sin(x^2))' = 2x\\cos(x^2). \\]
[JUSTE]
REPONSE : $2x\\cos(x^2)$
[FAUX]
ERREUR : oubli de la dérivée intérieure
REPONSE : $\\cos(x^2)$
VERIFICATION : faux en $x=1$.
VALIDE : oui
FEEDBACK : Il manque $2x$.
[FAUX]
ERREUR : écriture équivalente
REPONSE : $\\cos(x^2)\\cdot 2x$
VERIFICATION : égale à la réponse juste.
VALIDE : non
FEEDBACK : —
[FAUX]
ERREUR : signe
REPONSE : $-2x\\cos(x^2)$
VALIDE : oui
FEEDBACK : Signe.

[QUESTION]
ENONCE : Question sans réponse juste.
[FAUX]
ERREUR : x
REPONSE : $1$
VALIDE : oui
FEEDBACK : y
`;

describe('parseQcmOutput', () => {
  it('assemble les questions exploitables et écarte les autres', () => {
    const questions = parseQcmOutput(QCM_REPLY, { type: 'onlyone', random: () => 0.99 });
    expect(questions).toHaveLength(1);
    const [question] = questions;
    expect(question.stem).toBe('Quelle est la dérivée de $x \\mapsto \\sin(x^2)$ ?');
    expect(question.type).toBe('onlyone');
    expect(question.explanation).toContain("\\[ (\\sin(x^2))' = 2x\\cos(x^2). \\]");
    expect(question.choices.map((c) => c.latex).sort()).toEqual(['$-2x\\cos(x^2)$', '$2x\\cos(x^2)$', '$\\cos(x^2)$']);
    expect(question.choices.filter((c) => c.correct).map((c) => c.latex)).toEqual(['$2x\\cos(x^2)$']);
    expect(question.choices.find((c) => c.latex === '$\\cos(x^2)$').note).toBe('oubli de la dérivée intérieure');
  });

  it('ne laisse pas la réponse juste systématiquement en tête', () => {
    const [question] = parseQcmOutput(QCM_REPLY, { random: () => 0 });
    expect(question.choices[0].correct).toBe(false);
  });

  it('refuse plusieurs réponses justes quand une seule est attendue, les accepte sinon', () => {
    const reply = QCM_REPLY.replace('[FAUX]\nERREUR : signe', '[JUSTE]\nREPONSE : $2x\\cos\\left(x^2\\right)+0$\n[FAUX]\nERREUR : signe');
    expect(parseQcmOutput(reply, { type: 'onlyone' })).toEqual([]);
    expect(parseQcmOutput(reply, { type: 'onetoall' })).toHaveLength(1);
  });

  it('donne un brouillon exportable', () => {
    const draft = reviveQcmDraft({ questions: parseQcmOutput(QCM_REPLY) });
    expect(qcmIssues(draft)).toEqual([]);
    expect(parseQcmSource(buildQcmTex(META, draft)).errors).toEqual([]);
  });
});
