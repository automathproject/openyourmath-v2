// Découpage d'un exercice en diapos pour le mode Présenter de la séance.
//
// Une diapo porte une question. Un exercice de maths se lit pourtant d'un
// bloc : les données posées en tête (ou entre deux questions, « On suppose
// maintenant… ») servent à toutes les questions qui suivent. Chaque diapo
// porte donc tout le texte d'énoncé qui la précède, réparti en deux :
//   - rappel   : le texte déjà projeté sur une diapo précédente ;
//   - contexte : le texte qui apparaît pour la première fois juste avant
//                la question.
// Aucun bloc n'est perdu :
//   - un bloc de code qui suit une question en fait partie (`complements`) ;
//   - une indication ou une solution posée sur le texte d'énoncé, avant
//     toute question, va à la diapo qui projette ce texte ;
//   - un texte placé après la dernière question va dans `suite`.

const QUESTION_TYPES = new Set(['question', 'enonce']);
const STANDALONE_STATEMENT_TYPES = new Set(['texte', 'text', 'statement']);
const HINT_TYPES = new Set(['hint', 'indication']);
const SOLUTION_TYPES = new Set(['reponse', 'solution', 'answer']);

/** @param {Array<any>} content */
export function buildPresenterSlides(content = []) {
  const blocks = [...content].sort((a, b) => (a?.order || 0) - (b?.order || 0));
  const hasExplicitQuestions = blocks.some((block) => QUESTION_TYPES.has(block?.type || 'text'));
  const slides = [];
  /** Texte d'énoncé déjà porté par une diapo. */
  const projete = [];
  let current = null;
  let pending = [];
  /** Indications et solutions arrivées sans diapo ouverte. */
  let orphelins = { hints: [], solutions: [] };

  function ouvrir(question, contexte) {
    current = {
      question,
      complements: [],
      rappel: [...projete],
      contexte,
      suite: [],
      hints: orphelins.hints,
      solutions: orphelins.solutions,
    };
    orphelins = { hints: [], solutions: [] };
    projete.push(...contexte);
    pending = [];
  }

  function fermer() {
    if (current) slides.push(current);
    current = null;
  }

  for (const block of blocks) {
    const type = block?.type || 'text';

    if (QUESTION_TYPES.has(type)) {
      fermer();
      ouvrir(block, pending);
    } else if (HINT_TYPES.has(type)) {
      (current ?? orphelins).hints.push(block);
    } else if (SOLUTION_TYPES.has(type)) {
      // Sans \question, le texte qui précède une solution en tient lieu.
      if (!hasExplicitQuestions && !current && pending.length) {
        ouvrir(pending[pending.length - 1], pending.slice(0, -1));
      }
      (current ?? orphelins).solutions.push(block);
    } else if (hasExplicitQuestions && current && !STANDALONE_STATEMENT_TYPES.has(type)) {
      current.complements.push(block);
    } else if (!hasExplicitQuestions && !current && STANDALONE_STATEMENT_TYPES.has(type) && pending.length === 0) {
      ouvrir(block, []);
    } else {
      fermer();
      pending.push(block);
    }
  }

  fermer();

  if (!slides.length && pending.length) {
    ouvrir(pending[pending.length - 1], pending.slice(0, -1));
    fermer();
  } else if (pending.length) {
    slides[slides.length - 1].suite.push(...pending);
  }
  if (slides.length) {
    slides[slides.length - 1].hints.push(...orphelins.hints);
    slides[slides.length - 1].solutions.push(...orphelins.solutions);
  }

  return slides;
}

export function getPresenterSlideCount(exercise) {
  const fullExercise = exercise?.fullExercise || exercise;
  return Math.max(buildPresenterSlides(fullExercise?.content || []).length, 1);
}

export function getPresenterBlockContent(block) {
  if (!block) return '';
  if (block.html) return block.html;
  if (block.latex) return block.latex;
  if (block.content) return block.content;
  if (block.body) return block.body;
  if (block.text) return `<p>${block.text}</p>`;
  return '';
}
