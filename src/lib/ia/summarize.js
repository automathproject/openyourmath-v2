// src/lib/ia/summarize.js
// Génération de résumés structurés d'exercices mathématiques via LLM.
// Produit un JSON { summary, concepts, methods, objects } utilisé
// pour l'indexation sémantique (embedding + FTS5).

import { chat, withRetry } from './albert.js';

/**
 * Prompt système-style intégré au user message.
 * Conçu pour maximiser la canonicalisation du vocabulaire mathématique français.
 */
const SUMMARY_PROMPT = `Tu es un expert en mathématiques qui indexe une base d'exercices pour un moteur de recherche sémantique destiné à des enseignants et étudiants francophones.

Ton rôle : produire une description CANONIQUE et STANDARDISÉE de l'exercice qui permettra de le retrouver par concept, méthode ou technique, indépendamment de la formulation précise de l'énoncé.

Réponds UNIQUEMENT avec un objet JSON, sans texte avant ni après, sans backticks, sans commentaire :

{
  "summary": "2 à 3 phrases décrivant ce que l'exercice DEMANDE : son objet mathématique central et brièvement son contexte concret si présent. Ne décris pas la méthode de résolution dans le summary.",
  "concepts": ["concept1", "concept2", ...],
  "methods": ["méthode1", "méthode2", ...],
  "objects": ["objet1", "objet2", ...]
}

RÈGLES IMPÉRATIVES :

1. "concepts" = notions théoriques mobilisées. 3 à 8 items.
   Exemples : "théorème central limite", "intervalle de confiance", "convergence en loi", "continuité uniforme", "sous-espace vectoriel", "diagonalisation", "intégrale impropre".
   INTERDIT : abréviations ("TCL"), formulations personnelles, anglais.

2. "methods" = techniques de calcul ou de preuve concrètement appliquées. 2 à 5 items.
   Exemples : "standardisation", "approximation gaussienne", "intégration par parties", "changement de variable", "récurrence", "calcul de polynôme caractéristique".

3. "objects" = objets mathématiques manipulés dans l'énoncé. 2 à 5 items.
   Exemples : "somme de variables iid", "proportion", "matrice 3x3", "suite récurrente", "fonction de deux variables".

4. UTILISATION DU CORRIGÉ : le corrigé, s'il est fourni, révèle les outils théoriques effectivement mobilisés (théorèmes nommés, techniques de calcul appliquées). Utilise-le en priorité pour identifier "concepts" et "methods" avec précision. En revanche, le "summary" décrit ce que l'exercice DEMANDE, pas comment on le résout.

5. Explicite les concepts IMPLICITES : si le corrigé applique un théorème sans le nommer, le nommer dans "concepts". Si une méthode standard est utilisée sans être désignée, la lister dans "methods".

6. Ignore le contexte narratif dans concepts/methods/objects. Pas de "avion", "passagers", "urne", "boule rouge". Garde uniquement ce vocabulaire dans le "summary" en une seule mention brève.

7. N'invente JAMAIS un concept absent du contenu fourni. Dans le doute, ne le liste pas.

8. Concepts/methods/objects utilisent le français mathématique standard (académique), pas de paraphrase populaire.

9. N'utilise PAS de notation LaTeX brute (ex: \int, \lim, \frac{}, \sum...) dans les champs "concepts", "methods", "objects". Décris en prose : "suite numérique" plutôt que "suite (u_n)". Dans le "summary", le LaTeX est toléré s'il apporte une précision essentielle mais privilégie la prose.

EXERCICE À ANALYSER :

{{metadata}}

CONTENU :
{{content}}`;

/**
 * Construit le bloc metadata pour injection dans le prompt.
 */
function buildMetadata(exercise) {
  const lines = [];
  if (exercise.title) lines.push(`Titre : ${exercise.title}`);
  if (exercise.level) lines.push(`Niveau : ${exercise.level}`);
  if (exercise.module) lines.push(`Module : ${exercise.module}`);
  if (exercise.chapter) lines.push(`Chapitre : ${exercise.chapter}`);
  if (exercise.subchapter) lines.push(`Sous-chapitre : ${exercise.subchapter}`);
  if (exercise.theme) lines.push(`Thème : ${exercise.theme}`);
  return lines.join('\n');
}

/**
 * Extrait le contenu textuel d'un exercice depuis son content_json (déjà parsé).
 * Inclut énoncé, questions, indications ET corrigés.
 * Les corrigés sont précieux car ils révèlent les théorèmes/méthodes effectivement
 * mobilisés, souvent implicites dans l'énoncé.
 *
 * @param {Array} contentArray - Tableau de blocs issu de exercise.content
 * @returns {string}
 */
function buildContent(contentArray) {
  if (!Array.isArray(contentArray)) return '';

  const sections = [];

  for (const block of contentArray) {
    const type = (block?.type || '').toLowerCase();
    const latex = block?.latex || '';
    if (!latex.trim()) continue;

    switch (type) {
      case 'texte':
        sections.push(`ÉNONCÉ :\n${latex}`);
        break;
      case 'question':
        sections.push(`QUESTION :\n${latex}`);
        break;
      case 'indication':
      case 'hint':
        sections.push(`INDICATION :\n${latex}`);
        break;
      case 'reponse':
      case 'solution':
      case 'answer':
        sections.push(`CORRIGÉ (révèle les outils mobilisés) :\n${latex}`);
        break;
    }
  }

  return sections.join('\n\n');
}

/**
 * Parse de manière robuste la sortie JSON du LLM.
 * Gère les cas où le LLM ajoute des backticks ou du texte parasite malgré les instructions.
 *
 * @param {string} text - Réponse brute du LLM
 * @returns {object}
 */
function parseSummaryJson(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fallback ci-dessous
  }

  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Dernier recours
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const extracted = cleaned.slice(start, end + 1);
    return JSON.parse(extracted);
  }

  throw new Error(`Impossible de parser la réponse LLM comme JSON :\n${text.slice(0, 300)}`);
}

/**
 * Valide la structure du JSON retourné par le LLM.
 */
function validateSummary(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Résumé invalide : pas un objet');
  }
  if (typeof obj.summary !== 'string' || obj.summary.trim().length < 10) {
    throw new Error(`Résumé invalide : "summary" absent ou trop court`);
  }
  for (const field of ['concepts', 'methods', 'objects']) {
    if (!Array.isArray(obj[field])) {
      throw new Error(`Résumé invalide : "${field}" n'est pas un tableau`);
    }
    if (!obj[field].every(x => typeof x === 'string' && x.trim().length > 0)) {
      throw new Error(`Résumé invalide : "${field}" contient des éléments non-string`);
    }
  }
  return obj;
}

/**
 * Génère un résumé structuré d'un exercice via LLM.
 *
 * @param {object} exercise - Objet exercice avec title, level, module, chapter, content, etc.
 * @param {object} [options]
 * @param {string} [options.model] - Modèle à utiliser (défaut: MODELS.chat)
 * @param {number} [options.maxTokens] - Limite de tokens en sortie (défaut: 800)
 * @returns {Promise<{summary: string, concepts: string[], methods: string[], objects: string[]}>}
 */
export async function summarizeExercise(exercise, { model, maxTokens = 800 } = {}) {
  const metadata = buildMetadata(exercise);
  const content = buildContent(exercise.content);

  if (!content) {
    throw new Error(`Exercice ${exercise.uuid} : contenu vide, impossible de résumer`);
  }

  const prompt = SUMMARY_PROMPT
    .replace('{{metadata}}', metadata)
    .replace('{{content}}', content);

  const rawResponse = await withRetry(
    () => chat(prompt, { model, maxTokens, jsonMode: true, temperature: 0 }),
    { maxAttempts: 3, delayMs: 1500 }
  );

  const parsed = parseSummaryJson(rawResponse);
  return validateSummary(parsed);
}

/**
 * Construit le texte à embedder à partir d'un résumé structuré.
 * Concatène summary + concepts + methods + objects pour maximiser le signal
 * sémantique dans le vecteur final.
 *
 * @param {{summary: string, concepts: string[], methods: string[], objects: string[]}} summaryObj
 * @returns {string}
 */
export function buildEmbeddingText(summaryObj) {
  const parts = [
    summaryObj.summary,
    `Concepts : ${summaryObj.concepts.join(', ')}`,
    `Méthodes : ${summaryObj.methods.join(', ')}`,
    `Objets : ${summaryObj.objects.join(', ')}`
  ];
  return parts.join('\n');
}