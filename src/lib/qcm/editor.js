// src/lib/qcm/editor.js
// Brouillon de qcm de l'éditeur /create : état d'édition, export au format
// des sources (content/qcm, voir docs/qcm.md), relecture d'une source et
// conversion en blocs pour l'aperçu. Module sans dépendance au navigateur.

import { choiceLetter, correctLetters, parseQcmSource } from './source.js';

/** Types de question proposés dans l'éditeur. */
export const QCM_EDITOR_TYPES = [
  { type: 'onlyone', label: 'Une seule réponse juste' },
  { type: 'onetoall', label: 'Une ou plusieurs réponses justes' },
  { type: 'zerotoall', label: 'Zéro, une ou plusieurs réponses justes' },
  { type: 'truefalse', label: 'Vrai / faux' },
];

/** En-tête d'un contenu qcm, dans l'ordre des sources. */
const QCM_META_FIELDS = [
  ['uuid', 'uuid'],
  ['title', 'titre'],
  ['author', 'auteur'],
  ['organization', 'organisation'],
  ['license_code', 'licence'],
  ['created_at', 'datecreate'],
  ['level', 'niveau'],
  ['module', 'module'],
  ['chapter', 'chapitre'],
  ['subchapter', 'sousChapitre'],
  ['difficulty', 'difficulte'],
  ['theme', 'theme'],
];

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `q${Date.now()}${Math.random().toString(36).slice(2)}`;
}

/**
 * Une réponse. `note` est le diagnostic d'un distracteur proposé par l'IA
 * (l'erreur qu'il vise) : affiché à l'auteur, jamais exporté.
 */
export function newQcmChoice({ latex = '', correct = false, feedback = '', note = '' } = {}) {
  return { id: newId(), latex, correct, feedback, note };
}

export function newQcmQuestion({ stem = '', type = 'onlyone', choices = null, explanation = '', keepOrder = false } = {}) {
  return {
    id: newId(),
    stem,
    type,
    keepOrder,
    choices: (choices ?? [{ correct: true }, {}, {}, {}]).map((choice) => newQcmChoice(choice)),
    explanation,
  };
}

export function emptyQcmDraft() {
  return { context: '', questions: [newQcmQuestion()] };
}

/** Reconstruit un brouillon à partir de données enregistrées ou reçues, en tolérant les champs absents. */
export function reviveQcmDraft(data) {
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  return {
    context: typeof data?.context === 'string' ? data.context : '',
    questions: questions.length
      ? questions.map((question) =>
          newQcmQuestion({
            stem: String(question?.stem ?? ''),
            type: QCM_EDITOR_TYPES.some((entry) => entry.type === question?.type) ? question.type : 'onlyone',
            keepOrder: Boolean(question?.keepOrder),
            explanation: String(question?.explanation ?? ''),
            choices: (Array.isArray(question?.choices) ? question.choices : []).map((choice) => ({
              latex: String(choice?.latex ?? ''),
              correct: Boolean(choice?.correct),
              feedback: String(choice?.feedback ?? ''),
              note: String(choice?.note ?? ''),
            })),
          }),
        )
      : [newQcmQuestion()],
  };
}

const filled = (value) => Boolean(String(value ?? '').trim());

/** Réponses effectivement rédigées d'une question. */
export function filledChoices(question) {
  return (question?.choices || []).filter((choice) => filled(choice.latex));
}

/** Questions qui ont un énoncé ou au moins une réponse : les seules exportées. */
export function filledQuestions(draft) {
  return (draft?.questions || []).filter((question) => filled(question.stem) || filledChoices(question).length > 0);
}

export function qcmHasContent(draft) {
  return filled(draft?.context) || filledQuestions(draft).length > 0;
}

/** Une réponse qui en désigne d'autres impose de garder l'ordre des réponses. */
const REFERS_TO_OTHERS = /ci-dessus|ci-dessous|précédentes?|suivantes?|aucune des|toutes les (?:réponses|assertions|propositions)|les autres réponses/i;

function keepsOrder(question) {
  return Boolean(question.keepOrder) || filledChoices(question).some((choice) => REFERS_TO_OTHERS.test(choice.latex));
}

function indent(text, prefix) {
  return String(text)
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? prefix + line.trimEnd() : ''))
    .join('\n');
}

function answerTex(choice) {
  const command = choice.correct ? 'good' : 'bad';
  const body = choice.latex.trim();
  const feedback = filled(choice.feedback) ? `\\feedback{${choice.feedback.trim()}}` : '';
  if (!body.includes('\n') && !feedback) return `    \\${command}{${body}}`;
  const lines = [`    \\${command}{`, indent(body, '      ')];
  if (feedback) lines.push(indent(feedback, '      '));
  lines.push('    }');
  return lines.join('\n');
}

/**
 * Source .tex d'un contenu qcm, au format lu par scripts/parse-qcm.js.
 * Plusieurs questions font une série ordonnée (\serie{ordonnee}).
 *
 * @param {Object} meta
 * @param {{ context: string, questions: Array }} draft
 * @returns {string}
 */
export function buildQcmTex(meta, draft) {
  const questions = filledQuestions(draft);
  const lines = [];
  for (const [key, command] of QCM_META_FIELDS) {
    const value = String(meta?.[key] ?? '').trim();
    if (value) lines.push(`\\${command}{${value}}`);
  }
  if (questions.length > 1) lines.push('\\serie{ordonnee}');

  lines.push('', '\\contenu{');
  if (filled(draft?.context)) {
    lines.push('\\texte{', indent(draft.context, '  '), '}', '');
  }
  questions.forEach((question, index) => {
    if (index > 0) lines.push('');
    lines.push('\\begin{question}');
    if (question.type && question.type !== 'onetoall') lines.push(`\\qtype{${question.type}}`);
    if (keepsOrder(question)) lines.push('\\qkeeporder');
    if (filled(question.stem)) lines.push(question.stem.trim());
    lines.push('\\begin{answers}');
    lines.push(filledChoices(question).map(answerTex).join('\n\n'));
    lines.push('\\end{answers}');
    if (filled(question.explanation)) {
      lines.push('\\begin{explanations}', indent(question.explanation, '  '), '\\end{explanations}');
    }
    lines.push('\\end{question}');
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** Vrai quand une source .tex est un contenu qcm plutôt qu'un exercice. */
export function isQcmSource(tex) {
  return /\\begin\{question\}/.test(String(tex ?? '')) && /\\begin\{answers\}/.test(String(tex ?? ''));
}

/**
 * Relit une source qcm en brouillon d'éditeur.
 * @returns {{ meta: Object, draft: { context: string, questions: Array }, errors: string[] }}
 */
export function qcmDraftFromSource(tex) {
  const parsed = parseQcmSource(tex);
  const { serie: _serie, source_id: _sourceId, ...meta } = parsed.meta;
  const draft = reviveQcmDraft({
    context: parsed.context,
    questions: parsed.questions.map((question) => ({
      stem: question.stem,
      type: question.type,
      keepOrder: question.keepOrder,
      explanation: question.explanation,
      choices: question.answers,
    })),
  });
  return { meta, draft, errors: parsed.errors };
}

function bracesBalanced(text) {
  let depth = 0;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\\') i++;
    else if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth < 0) return false;
  }
  return depth === 0;
}

/** Forme canonique d'une réponse, pour repérer deux réponses identiques. */
export function normalizeAnswer(latex) {
  return String(latex ?? '')
    .replace(/\\(?:left|right|displaystyle|,|;|!|:)(?![a-zA-Z])/g, '')
    .replace(/\\[dt]frac/g, '\\frac')
    .replace(/[\s$.]/g, '')
    .toLowerCase();
}

/**
 * Ce qui empêche le qcm d'être publié tel quel : affiché à l'auteur, sans
 * bloquer l'export d'un brouillon.
 * @returns {string[]}
 */
export function qcmIssues(draft, meta = null) {
  const issues = [];
  const questions = filledQuestions(draft);
  if (questions.length === 0) return ['Rédigez au moins une question.'];
  // Les sources de qcm notent la difficulté de 1 à 3 (content/qcm/FORMAT.md d'exobase).
  if (Number(meta?.difficulty) > 3) issues.push('Difficulté : un QCM se note de 1 à 3.');

  const checkField = (text, where) => {
    if (!bracesBalanced(text)) issues.push(`${where} : accolades non appariées.`);
    if (/(?<!\\)%/.test(String(text ?? ''))) issues.push(`${where} : « % » doit s'écrire « \\% ».`);
  };
  checkField(draft.context, 'Énoncé commun');

  questions.forEach((question, index) => {
    const rank = questions.length > 1 ? `Question ${index + 1}` : 'Question';
    const choices = filledChoices(question);
    const correct = choices.filter((choice) => choice.correct).length;
    if (!filled(question.stem)) issues.push(`${rank} : énoncé manquant.`);
    if (choices.length < 2) issues.push(`${rank} : il faut au moins deux réponses.`);
    if (correct === 0 && question.type !== 'zerotoall') issues.push(`${rank} : aucune réponse n'est marquée juste.`);
    if (correct > 1 && (question.type === 'onlyone' || question.type === 'truefalse')) {
      issues.push(`${rank} : plusieurs réponses sont marquées justes alors qu'une seule est attendue.`);
    }
    if (choices.length > 0 && correct === choices.length && choices.length > 1 && question.type !== 'onlyone') {
      issues.push(`${rank} : toutes les réponses sont justes, il manque des distracteurs.`);
    }
    const seen = new Set();
    for (const choice of choices) {
      const key = normalizeAnswer(choice.latex);
      if (seen.has(key)) issues.push(`${rank} : deux réponses sont identiques.`);
      seen.add(key);
    }
    checkField(question.stem, `${rank}, énoncé`);
    checkField(question.explanation, `${rank}, explications`);
    choices.forEach((choice, position) => {
      checkField(choice.latex, `${rank}, réponse ${choiceLetter(position)}`);
      checkField(choice.feedback, `${rank}, commentaire de la réponse ${choiceLetter(position)}`);
    });
  });
  return [...new Set(issues)];
}

/** Fragments LaTeX d'un brouillon, sans doublon : ce que le rendu doit convertir. */
export function qcmFragments(draft) {
  const fragments = new Set();
  const add = (text) => filled(text) && fragments.add(String(text).trim());
  add(draft?.context);
  for (const question of filledQuestions(draft)) {
    add(question.stem);
    add(question.explanation);
    for (const choice of filledChoices(question)) {
      add(choice.latex);
      add(choice.feedback);
    }
  }
  return [...fragments];
}

function unwrapParagraph(html) {
  const match = /^<p>([\s\S]*)<\/p>$/.exec(String(html ?? '').trim());
  return match && !match[1].includes('<p>') ? match[1] : String(html ?? '');
}

/**
 * Blocs de contenu d'un brouillon, de la même forme que ceux que
 * scripts/parse-qcm.js écrit en base : l'aperçu (ExerciseContent) et l'export
 * LaTeX papier les lisent sans rien savoir de l'éditeur.
 *
 * @param {{ context: string, questions: Array }} draft
 * @param {(latex: string) => string} render — LaTeX → HTML
 */
export function qcmToBlocks(draft, render = () => '') {
  const html = (text) => (filled(text) ? render(String(text).trim()) : '');
  const content = [];
  const push = (block) => content.push({ ...block, order: content.length + 1 });

  if (filled(draft?.context)) {
    push({ id: 'qcm-context', type: 'text', latex: draft.context.trim(), html: html(draft.context) });
  }
  for (const question of filledQuestions(draft)) {
    const answers = filledChoices(question);
    const stemHtml = html(question.stem);
    const explanationHtml = html(question.explanation);
    const choices = answers.map((answer) => {
      const feedbackHtml = unwrapParagraph(html(answer.feedback));
      return { html: unwrapParagraph(html(answer.latex)), correct: answer.correct, ...(feedbackHtml && { feedback_html: feedbackHtml }) };
    });
    const letters = correctLetters(answers);
    const items = answers.map((answer, index) => `  \\item[$\\square$ \\textbf{${choiceLetter(index)}.}] ${answer.latex.trim()}`);
    const list = items.length ? `\\begin{itemize}\n${items.join('\n')}\n\\end{itemize}` : '';
    push({
      id: question.id,
      type: 'question',
      latex: `${question.stem.trim()}\n${list}`.trim(),
      html: `${stemHtml}<ul class="qcm-choix">${choices
        .map((choice, index) => `<li><span class="qcm-lettre">${choiceLetter(index)}.</span> ${choice.html}</li>`)
        .join('')}</ul>`,
      qcm: { type: question.type, keepOrder: keepsOrder(question), stem_html: stemHtml, choices, explanation_html: explanationHtml },
    });
    push({
      id: `${question.id}-reponse`,
      type: 'reponse',
      latex: `\\textbf{Réponses justes :} ${letters}.${filled(question.explanation) ? `\n\n${question.explanation.trim()}` : ''}`,
      html: `<p><strong>Réponses justes : ${letters}.</strong></p>${explanationHtml}`,
      qcmAnswer: true,
    });
  }
  return content;
}

/**
 * Mélange les réponses (Fisher-Yates). Sans effet quand une réponse en désigne
 * d'autres : l'ordre fait alors partie de la question.
 */
export function shuffledChoices(question, random = Math.random) {
  const choices = [...(question?.choices || [])];
  if (keepsOrder(question)) return choices;
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
