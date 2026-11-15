// src/lib/ia/qcmAssist.js
// Lecture des réponses de l'assistant IA pour les qcm (modes 'qcm' et
// 'distractors' de /api/create/assist). Le modèle répond dans un format
// balisé — sections [QUESTION], [JUSTE], [FAUX], [DISTRACTEUR] et champs
// « NOM : valeur » — décrit dans assistPrompts.js. Module sans dépendance.

import { normalizeAnswer } from "../qcm/editor.js";

const SECTION_LINE =
  /^\s*(?:\*\*)?\[\s*(ANALYSE|DISTRACTEUR|QUESTION|JUSTE|FAUX)\s*\](?:\*\*)?\s*$/i;
const FIELD_LINE =
  /^\s*(?:\*\*)?(ERREUR|CALCUL|R[ÉE]PONSE|V[ÉE]RIFICATION|VALIDE|FEEDBACK|[ÉE]NONC[ÉE]|R[ÉE]SOLUTION)\s*(?:\*\*)?\s*:\s*(?:\*\*)?\s?(.*)$/;

const FIELD_KEYS = {
  ERREUR: "error",
  CALCUL: "work",
  REPONSE: "latex",
  VERIFICATION: "check",
  VALIDE: "valid",
  FEEDBACK: "feedback",
  ENONCE: "stem",
  RESOLUTION: "explanation",
};

const fieldKey = (name) => FIELD_KEYS[name.toUpperCase().replace(/É/g, "E")];

/**
 * Découpe la réponse en sections, chacune avec ses champs. Le texte libre
 * d'une section (l'analyse) et les champs inconnus sont ignorés.
 * @returns {Array<{ kind: string, fields: Record<string, string> }>}
 */
function readSections(text) {
  const sections = [];
  let section = null;
  let key = null;
  for (const line of String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")) {
    const sectionMatch = line.match(SECTION_LINE);
    if (sectionMatch) {
      section = { kind: sectionMatch[1].toUpperCase(), fields: {}, text: "" };
      sections.push(section);
      key = null;
      continue;
    }
    if (!section) continue;
    const fieldMatch = line.match(FIELD_LINE);
    if (fieldMatch) {
      key = fieldKey(fieldMatch[1]);
      section.fields[key] = fieldMatch[2];
    } else if (key) {
      section.fields[key] += `\n${line}`;
    } else {
      section.text += `${line}\n`;
    }
  }
  return sections;
}

/**
 * Remet en texte courant une phrase que le modèle a enfermée dans une formule :
 * « $\text{Si }(u_n)\text{ converge.}$ » devient « Si $(u_n)$ converge. ».
 * Ne touche qu'une réponse faite d'une seule formule qui commence par \text{.
 */
export function unwrapTextSentence(latex) {
  const match = String(latex ?? "")
    .trim()
    .match(/^\$\s*(\\text\{[^$]*)\$$/);
  if (!match) return latex;
  // Indices impairs : contenu d'un \text{} ; pairs : formule entre deux textes.
  const parts = match[1].split(/\\text\{([^{}]*)\}/);
  if (parts.some((part, index) => index % 2 === 0 && /\\text\b/.test(part)))
    return latex;
  // Une phrase, pas un opérateur nommé comme \text{rg} ou \text{dim Im}.
  const words = parts
    .filter((_, index) => index % 2 === 1)
    .join(" ")
    .trim()
    .split(/\s+/);
  if (!/\s/.test(parts[1]) || words.length < 3) return latex;
  return parts
    .map((part, index) =>
      index % 2 === 1 ? part : part.trim() ? `$${part.trim()}$` : "",
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Retire ce qu'un modèle ajoute autour d'une réponse : \bad{…}, lettre, puce. */
function cleanAnswer(latex) {
  // \( … \) : même formule, écrite comme le reste du site.
  let out = String(latex ?? "")
    .trim()
    .replace(/\\[()]/g, "$");
  const wrapper = out.match(/^\\(?:good|bad)\s*\{([\s\S]*)\}$/);
  if (wrapper) out = wrapper[1].trim();
  return unwrapTextSentence(
    out.replace(/^(?:[-*•]\s+|[A-F][.)]\s+)/, "").trim(),
  );
}

function readDistractor(fields, clean) {
  const latex = cleanAnswer(clean(fields.latex ?? ""));
  if (!latex) return null;
  // Le modèle se relit : une réponse qu'il juge lui-même juste ou douteuse est écartée.
  if (/^\s*non\b/i.test(fields.valid ?? "")) return null;
  return {
    latex,
    correct: false,
    feedback: clean(fields.feedback ?? "").trim(),
    note: clean(fields.error ?? "").trim(),
  };
}

/** Écarte les réponses déjà présentes (à l'écriture près) et les doublons. */
function withoutDuplicates(answers, existing = []) {
  const seen = new Set(existing.map(normalizeAnswer));
  return answers.filter((answer) => {
    const key = normalizeAnswer(answer.latex);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Distracteurs proposés pour une question existante.
 *
 * @param {string} text — réponse brute du modèle
 * @param {Object} [options]
 * @param {string[]} [options.existing] — réponses déjà présentes dans la question
 * @param {number} [options.count]      — nombre maximal de distracteurs
 * @param {(text: string) => string} [options.clean] — nettoyage d'un champ
 * @returns {Array<{ latex: string, correct: false, feedback: string, note: string }>}
 */
export function parseDistractorOutput(
  text,
  { existing = [], count = 6, clean = (value) => value } = {},
) {
  const distractors = readSections(text)
    .filter(
      (section) => section.kind === "DISTRACTEUR" || section.kind === "FAUX",
    )
    .map((section) => readDistractor(section.fields, clean))
    .filter(Boolean);
  return withoutDuplicates(distractors, existing).slice(0, count);
}

function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Questions complètes proposées par le modèle. Une question inexploitable
 * (sans énoncé, sans réponse juste, sans distracteur, ou avec plusieurs
 * réponses justes quand une seule est attendue) est écartée. Les réponses
 * sont mélangées : le modèle écrit la réponse juste en premier.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.type]        — type imposé aux questions
 * @param {number} [options.count]       — nombre maximal de questions
 * @param {number} [options.answerCount] — nombre maximal de réponses par question
 * @param {(text: string) => string} [options.clean]
 * @param {() => number} [options.random]
 * @returns {Array<{ stem: string, type: string, explanation: string,
 *   choices: Array<{ latex: string, correct: boolean, feedback: string, note: string }> }>}
 */
export function parseQcmOutput(
  text,
  {
    type = "onlyone",
    count = 8,
    answerCount = 6,
    clean = (value) => value,
    random = Math.random,
  } = {},
) {
  const single = type === "onlyone" || type === "truefalse";
  const questions = [];
  let current = null;
  for (const section of readSections(text)) {
    if (section.kind === "QUESTION") {
      current = {
        stem: clean(section.fields.stem ?? "").trim(),
        explanation: clean(section.fields.explanation ?? "").trim(),
        good: [],
        bad: [],
      };
      questions.push(current);
    } else if (!current) {
      continue;
    } else if (section.kind === "JUSTE") {
      // Tolère une réponse juste écrite sans son champ REPONSE.
      const latex = cleanAnswer(clean(section.fields.latex ?? section.text));
      if (latex)
        current.good.push({ latex, correct: true, feedback: "", note: "" });
    } else if (section.kind === "FAUX" || section.kind === "DISTRACTEUR") {
      const distractor = readDistractor(section.fields, clean);
      if (distractor) current.bad.push(distractor);
    }
  }

  return questions
    .map((question) => {
      const good = withoutDuplicates(question.good);
      const bad = withoutDuplicates(
        question.bad,
        good.map((answer) => answer.latex),
      ).slice(0, Math.max(1, answerCount - good.length));
      if (!question.stem || good.length === 0 || bad.length === 0) return null;
      if (single && good.length !== 1) return null;
      return {
        stem: question.stem,
        type,
        explanation: question.explanation,
        choices: shuffle([...good, ...bad], random),
      };
    })
    .filter(Boolean)
    .slice(0, count);
}
