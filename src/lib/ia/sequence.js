// Utilitaires de découpage des séquences produites par l'assistant IA.
//
// Le modèle doit séparer chaque question avec `---`, mais cette règle peut
// occasionnellement ne pas être respectée. Ces fonctions normalisent les
// formes attendues (séparateurs, enumerate, numérotation manuelle) avant que
// l'éditeur crée ses blocs.

import { splitEnumerateItems } from "$lib/latex/exerciseTex.js";

/**
 * Début de question numérotée par le modèle : « 1. », « 2) »,
 * « Question 3. », « \textbf{Q4.} »... Le marqueur est capturé en entier pour
 * pouvoir être retiré : la numérotation affichée vient des blocs eux-mêmes.
 */
const NUMBERED_QUESTION_LINE =
  /^[ \t]*(?:\\(?:textbf|emph|textit)\{[ \t]*)?(?:(?:Question|Exercice|Q)[ \t]*(\d{1,2})[ \t]*[.):]?|(\d{1,2})[ \t]*[.)])[ \t]*\}?[ \t]*/i;

/**
 * Découpe un bloc unique dans lequel le modèle a numéroté lui-même ses
 * questions au lieu d'utiliser les séparateurs `---`. Sans ce découpage, une
 * séquence limitée à une question laisserait passer un énoncé qui en contient
 * plusieurs : la limite ne compte que des blocs.
 *
 * La numérotation n'est reconnue que si elle est complète et ordonnée
 * (1, 2, 3... sans trou) et hors des zones mathématiques : les sous-parties
 * (a), (b), (c) et les nombres isolés en début de ligne ne déclenchent donc
 * aucun découpage.
 *
 * @param {string} latex
 * @returns {{ prefix: string, items: string[] } | null}
 */
export function splitNumberedQuestions(latex) {
  return splitOnMarkedLines(latex, NUMBERED_QUESTION_LINE, (match) =>
    Number(match[1] ?? match[2]),
  );
}

/**
 * Découpe un texte sur les lignes portant un marqueur de séquence, en exigeant
 * une suite complète et ordonnée (1, 2, 3... ou a, b, c...) : c'est ce qui
 * distingue une vraie liste de questions d'une coïncidence de mise en forme.
 * Les marqueurs situés dans une formule centrée ou un environnement LaTeX
 * (array, cases, align...) sont ignorés.
 *
 * @param {string} latex
 * @param {RegExp} markerPattern — ancré en début de ligne, capture le rang
 * @param {(match: RegExpMatchArray) => number} rankOf — rang lu dans le marqueur
 * @returns {{ prefix: string, items: string[] } | null}
 */
function splitOnMarkedLines(latex, markerPattern, rankOf) {
  const lines = String(latex ?? "").split("\n");
  const starts = [];
  let mathDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (mathDepth === 0) {
      const match = line.match(markerPattern);
      if (match) {
        starts.push({ line: i, rank: rankOf(match), marker: match[0].length });
      }
    }
    mathDepth += countOccurrences(line, /\\\[|\\begin\{/g);
    mathDepth -= countOccurrences(line, /\\\]|\\end\{/g);
    if (mathDepth < 0) mathDepth = 0;
  }

  if (starts.length < 2) return null;
  if (starts.some((start, index) => start.rank !== index + 1)) return null;

  const prefix = lines.slice(0, starts[0].line).join("\n").trim();
  const items = starts
    .map((start, index) => {
      const end =
        index + 1 < starts.length ? starts[index + 1].line : lines.length;
      const body = lines.slice(start.line, end).join("\n");
      return body.slice(start.marker).trim();
    })
    .filter(Boolean);
  if (items.length < 2) return null;

  return { prefix, items };
}

function countOccurrences(text, pattern) {
  return (text.match(pattern) || []).length;
}

/**
 * Marqueur de sous-partie écrit par le modèle : « (a) », « a) »,
 * « \\textbf{(b)} »... en début de ligne. La plateforme n'affiche que des
 * blocs linéaires : une sous-partie est donc une question à part entière.
 */
const SUB_PART_LINE =
  /^[ \t]*(?:\\(?:textbf|emph|textit)\{[ \t]*)?\(?([a-h])\)[ \t]*\}?[ \t]*/;

/**
 * Découpe une question que le modèle a subdivisée en sous-parties (a), (b)...
 * Le texte qui précède la première sous-partie devient la description, chaque
 * sous-partie devient une question.
 *
 * Comme pour la numérotation, la suite doit être complète et ordonnée
 * (a, b, c...) et hors zone mathématique : une référence isolée à un point (b)
 * dans un énoncé ne déclenche aucun découpage.
 *
 * @param {string} latex
 * @returns {{ prefix: string, items: string[] } | null}
 */
export function splitSubQuestionParts(latex) {
  return splitOnMarkedLines(
    latex,
    SUB_PART_LINE,
    (match) => match[1].charCodeAt(0) - 96,
  );
}

/**
 * Aplatit un bloc produit par le modèle : enumerate, numérotation manuelle ou
 * sous-parties (a), (b)... deviennent des questions distinctes. La plateforme
 * n'affiche qu'une suite linéaire de blocs et fournit elle-même la
 * numérotation : rien ne doit rester imbriqué dans un énoncé.
 *
 * @param {string} latex
 * @returns {{ prefix: string, items: string[] } | null}
 */
function flattenQuestionBlock(latex) {
  return (
    splitEnumerateItems(latex) ||
    splitNumberedQuestions(latex) ||
    splitSubQuestionParts(latex)
  );
}

/**
 * Répartit une réponse IA de type question en blocs linéaires. Le découpage
 * s'applique aussi à l'intérieur de chaque bloc séparé par `---` : le modèle
 * peut respecter les séparateurs tout en glissant des sous-parties dans une
 * question.
 */
export function questionBlocksFromAi(latex) {
  const separated = String(latex)
    .split(/\n\s*---\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (separated.length > 1) {
    // Un préfixe apparu au milieu de la séquence n'est plus une introduction
    // d'exercice : il est recollé à la question qu'il présente.
    const questions = separated.flatMap((part) => {
      const split = flattenQuestionBlock(part);
      if (!split) return [part];
      const [first, ...rest] = split.items;
      return [split.prefix ? `${split.prefix}\n\n${first}` : first, ...rest];
    });
    return { text: null, questions };
  }

  const split = flattenQuestionBlock(latex);
  if (!split) return { text: null, questions: [latex] };
  return { text: split.prefix || null, questions: split.items };
}

/**
 * Limite strictement une séquence au nombre de questions choisi par l'auteur.
 * Le prompt guide le modèle, mais cette limite côté client est la garantie
 * effective avant l'ajout des blocs dans l'exercice.
 */
export function limitedSequenceBlocksFromAi(latex, requestedCount) {
  const count = Math.max(1, Math.floor(Number(requestedCount) || 1));
  const { text, questions } = questionBlocksFromAi(latex);
  return { text, questions: questions.slice(0, count) };
}

/**
 * Sérialise une séquence limitée pour la réponse de l'API. Une éventuelle
 * introduction est fusionnée à la première question : ainsi, même un ancien
 * client qui ne connaît que le champ `latex` ne peut pas recréer une question
 * de trop en interprétant cette introduction comme un bloc séparé.
 */
export function limitedSequenceLatex(latex, requestedCount) {
  const { text, questions } = limitedSequenceBlocksFromAi(
    latex,
    requestedCount,
  );
  if (!questions.length) return "";

  return questions
    .map((question, index) =>
      index === 0 && text ? `${text}\n\n${question}` : question,
    )
    .join("\n---\n");
}
