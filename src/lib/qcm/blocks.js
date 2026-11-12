// src/lib/qcm/blocks.js
// Lecture des blocs d'un contenu qcm tel qu'il sort de la base : chaque
// question est un bloc « question » portant un champ `qcm` (voir
// scripts/parse-qcm.js). Module sans dépendance, commun au serveur et au
// navigateur.

/** Vrai pour un contenu de type qcm, ou pour tout contenu qui porte une question à cocher. */
export function isQcm(exercise) {
  if (!exercise) return false;
  if (exercise.content_type === 'qcm') return true;
  return Array.isArray(exercise.content) && exercise.content.some((block) => block?.qcm);
}

/** Types de question à réponse unique : boutons radio plutôt que cases à cocher. */
export function isSingleChoice(qcm) {
  return qcm?.type === 'onlyone' || qcm?.type === 'truefalse';
}

/** Consigne affichée sous l'énoncé, selon le type de question. */
export function instructionFor(qcm) {
  if (isSingleChoice(qcm)) return 'Une seule réponse est juste.';
  if (qcm?.type === 'zerotoall') return "Cochez les réponses justes, s'il y en a.";
  return 'Cochez toutes les réponses justes.';
}

/** Applique `fn` à tous les fragments HTML d'un bloc, ceux de son qcm compris. */
export function mapBlockHtml(block, fn) {
  if (!block) return block;
  const mapped = block.html ? { ...block, html: fn(block.html) } : { ...block };
  if (block.qcm) {
    mapped.qcm = {
      ...block.qcm,
      stem_html: fn(block.qcm.stem_html || ''),
      explanation_html: fn(block.qcm.explanation_html || ''),
      choices: (block.qcm.choices || []).map((choice) => ({
        ...choice,
        html: fn(choice.html || ''),
        ...(choice.feedback_html && { feedback_html: fn(choice.feedback_html) }),
      })),
    };
  }
  return mapped;
}

/**
 * Questions d'un contenu qcm, dans l'ordre où elles se jouent. Le contexte
 * d'une série accompagne chacune de ses questions.
 *
 * @returns {Array<{ uuid: string, title: string, rank: number, of: number, ordered: boolean,
 *   context_html: string, stem_html: string, type: string,
 *   choices: Array<{html: string, correct: boolean, feedback_html?: string}>, explanation_html: string }>}
 */
export function qcmQuestionsOf(exercise) {
  const blocks = Array.isArray(exercise?.content) ? [...exercise.content] : [];
  blocks.sort((a, b) => (a?.order || 0) - (b?.order || 0));
  const context = blocks
    .filter((block) => !block?.qcm && (block?.type || 'text') === 'text' && block?.html)
    .map((block) => block.html)
    .join('');
  const questions = blocks.filter((block) => block?.qcm);
  return questions.map((block, index) => ({
    uuid: exercise.uuid,
    title: exercise.title || '',
    rank: index + 1,
    of: questions.length,
    ordered: questions.length > 1,
    context_html: context,
    stem_html: block.qcm.stem_html || '',
    type: block.qcm.type || 'onetoall',
    choices: block.qcm.choices || [],
    explanation_html: block.qcm.explanation_html || '',
  }));
}

/** Rangs (à partir de 0) des réponses justes. */
export function correctIndexes(choices) {
  return (choices || []).map((choice, index) => (choice.correct ? index : -1)).filter((index) => index >= 0);
}

/** Liste triée et sans doublon de rangs valides, quelle que soit l'entrée. */
export function normalizeSelection(selection, choiceCount) {
  if (!Array.isArray(selection)) return [];
  const valid = selection.filter((index) => Number.isInteger(index) && index >= 0 && index < choiceCount);
  return [...new Set(valid)].sort((a, b) => a - b);
}

/** Une réponse est juste quand elle coche toutes les réponses justes, et elles seules. */
export function isCorrectSelection(choices, selection) {
  const expected = correctIndexes(choices);
  const given = normalizeSelection(selection, (choices || []).length);
  return expected.length === given.length && expected.every((index, position) => index === given[position]);
}

/**
 * État de chaque réponse une fois la correction montrée :
 * 'good' cochée à raison, 'bad' cochée à tort, 'missed' juste mais oubliée, '' sinon.
 */
export function choiceMarks(choices, selection) {
  const given = new Set(normalizeSelection(selection, (choices || []).length));
  return (choices || []).map((choice, index) => {
    if (choice.correct) return given.has(index) ? 'good' : 'missed';
    return given.has(index) ? 'bad' : '';
  });
}
