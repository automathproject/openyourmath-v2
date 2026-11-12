// src/lib/qcm/source.js
// Lecture d'un contenu qcm d'exobase (content/qcm/FORMAT.md) : en-tête de
// métadonnées, puis \contenu{} au format du paquet LaTeX exo7qcm. Aucune
// dépendance : le module sert à la construction du site comme aux tests.

/** Types de question d'exo7qcm que le site sait jouer. */
export const QCM_TYPES = ['onetoall', 'onlyone', 'zerotoall', 'truefalse'];

const META_COMMANDS = {
  uuid: 'uuid',
  titre: 'title',
  chapitre: 'chapter',
  sousChapitre: 'subchapter',
  theme: 'theme',
  auteur: 'author',
  organisation: 'organization',
  licence: 'license_code',
  datecreate: 'created_at',
  niveau: 'level',
  difficulte: 'difficulty',
  module: 'module',
  serie: 'serie',
  exo7qcmid: 'source_id',
};

const LICENSE_URLS = {
  'CC BY-NC-SA 4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr',
  'CC BY-NC 4.0': 'https://creativecommons.org/licenses/by-nc/4.0/deed.fr',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/deed.fr',
};

/** Adresse de la licence d'un contenu, quand son code est connu. */
export function licenseUrl(code) {
  return LICENSE_URLS[code] ?? null;
}

/** Retire les commentaires LaTeX, lignes vidées comprises. */
export function stripComments(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.replace(/(?<!\\)%.*$/, ''))
    .join('\n');
}

/**
 * Lit le groupe {…} ouvert à `start`.
 * @returns {{ value: string, end: number } | null} contenu et position qui suit la fermeture
 */
export function readBraced(text, start) {
  if (text[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      i++;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return { value: text.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

function readAnswers(block) {
  const answers = [];
  const pattern = /\\(good|bad)\s*\{/g;
  let match;
  while ((match = pattern.exec(block)) !== null) {
    const group = readBraced(block, match.index + match[0].length - 1);
    if (!group) break;
    let latex = group.value;
    let feedback = '';
    const call = /\\feedback\s*\{/.exec(latex);
    if (call) {
      const inner = readBraced(latex, call.index + call[0].length - 1);
      if (inner) {
        feedback = inner.value.trim();
        latex = latex.slice(0, call.index) + latex.slice(inner.end);
      }
    }
    answers.push({ correct: match[1] === 'good', latex: latex.trim(), feedback });
    pattern.lastIndex = group.end;
  }
  return answers;
}

function readQuestion(raw) {
  let body = raw;
  const flags = { keepOrder: false, type: 'onetoall', classification: [], tags: '' };

  body = body.replace(/\\qtype\s*\{([^}]*)\}/g, (_, value) => {
    flags.type = value.trim();
    return '';
  });
  body = body.replace(/\\qclassification\s*\{([^}]*)\}/g, (_, value) => {
    flags.classification = value.split(',').map((code) => code.trim()).filter(Boolean);
    return '';
  });
  body = body.replace(/\\qtags\s*\{([^}]*)\}/g, (_, value) => {
    flags.tags = value.trim();
    return '';
  });
  body = body.replace(/\\qkeeporder\b/g, () => {
    flags.keepOrder = true;
    return '';
  });
  // Mise en page et métadonnées propres au papier : sans objet sur le site.
  body = body.replace(/\\q(oneline|multicols|idontknow)\b/g, '');
  body = body.replace(/\\q(id|num|author|tolerance)\s*\{[^}]*\}/g, '');

  const answersMatch = /\\begin\{answers\}([\s\S]*?)\\end\{answers\}/.exec(body);
  const stem = (answersMatch ? body.slice(0, answersMatch.index) : body).trim();
  const after = answersMatch ? body.slice(answersMatch.index + answersMatch[0].length) : '';
  const explanation = /\\begin\{explanations\}([\s\S]*?)\\end\{explanations\}/.exec(after);

  return {
    ...flags,
    stem,
    answers: answersMatch ? readAnswers(answersMatch[1]) : [],
    explanation: explanation ? explanation[1].trim() : '',
    source: `\\begin{question}${raw}\\end{question}`,
  };
}

/**
 * Analyse la source d'un contenu qcm.
 *
 * @param {string} latex
 * @returns {{
 *   meta: Record<string, string>,
 *   context: string,
 *   ordered: boolean,
 *   questions: Array<{ stem: string, answers: Array<{correct: boolean, latex: string, feedback: string}>,
 *     explanation: string, keepOrder: boolean, type: string, classification: string[], tags: string, source: string }>,
 *   errors: string[]
 * }}
 */
export function parseQcmSource(latex) {
  const text = stripComments(latex);
  const errors = [];
  const meta = {};

  const contentCall = /\\contenu\s*\{/.exec(text);
  const head = contentCall ? text.slice(0, contentCall.index) : text;
  for (const [command, key] of Object.entries(META_COMMANDS)) {
    const call = new RegExp(`\\\\${command}\\s*\\{`).exec(head);
    if (!call) continue;
    const group = readBraced(head, call.index + call[0].length - 1);
    if (group) meta[key] = group.value.trim();
  }

  if (!contentCall) return { meta, context: '', ordered: false, questions: [], errors: ['\\contenu{} absent'] };
  const content = readBraced(text, contentCall.index + contentCall[0].length - 1);
  if (!content) return { meta, context: '', ordered: false, questions: [], errors: ['\\contenu{} non fermé'] };

  let context = '';
  const contextCall = /\\texte\s*\{/.exec(content.value);
  if (contextCall) {
    const group = readBraced(content.value, contextCall.index + contextCall[0].length - 1);
    if (group) context = group.value.trim();
  }

  const questions = [];
  const pattern = /\\begin\{question\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{question\}/g;
  let match;
  while ((match = pattern.exec(content.value)) !== null) questions.push(readQuestion(match[1]));

  if (questions.length === 0) errors.push('aucune question');
  questions.forEach((question, index) => {
    const rank = `question ${index + 1}`;
    if (!QCM_TYPES.includes(question.type)) errors.push(`${rank} : type « ${question.type} » non pris en charge`);
    if (question.answers.length < 2) errors.push(`${rank} : moins de deux réponses`);
    if (!question.answers.some((answer) => answer.correct) && question.type !== 'zerotoall') {
      errors.push(`${rank} : aucune réponse juste`);
    }
  });

  return { meta, context, ordered: meta.serie === 'ordonnee' || questions.length > 1, questions, errors };
}

/** Lettre d'une réponse d'après son rang : A, B, C… */
export function choiceLetter(index) {
  return String.fromCharCode(65 + index);
}

/** « A, C » : les lettres des réponses justes, ou une mention quand il n'y en a pas. */
export function correctLetters(answers) {
  const letters = answers.map((answer, index) => (answer.correct ? choiceLetter(index) : null)).filter(Boolean);
  return letters.length ? letters.join(', ') : 'aucune';
}
