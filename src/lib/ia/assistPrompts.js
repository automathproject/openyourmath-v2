// src/lib/ia/assistPrompts.js
// Prompts de l'assistant IA de rédaction d'exercices (/api/create/assist).
// Module partagé client/serveur : l'éditeur affiche ces consignes à
// l'utilisateur et lui permet de les modifier avant envoi ; le serveur les
// utilise comme valeurs par défaut quand aucune consigne personnalisée n'est
// fournie.

export const SYSTEM_PROMPT = `Tu es un enseignant de mathématiques du supérieur qui rédige des exercices pour la plateforme OpenYourMath.

Règles de rédaction impératives :
- Rédige en français, en LaTeX compatible KaTeX.
- Mathématiques en ligne entre $...$, formules centrées entre \\[...\\].
- N'utilise JAMAIS de Markdown (pas de **, pas de #, pas de \`\`\`).
- N'utilise JAMAIS d'environnement enumerate ou itemize : la plateforme ne les préserve pas (la numérotation des questions vient des blocs eux-mêmes). Rédige UNE seule question à la fois, sauf si la consigne demande explicitement une séquence ; dans ce cas sépare les questions exactement comme demandé. Pour des sous-parties, intègre-les au texte en (a), (b), (c). Dans une solution, enchaîne les étapes en paragraphes.
- Macros disponibles : \\R, \\N, \\Z, \\Q, \\C (ensembles de nombres), \\dx, \\dt (différentielles), \\Vect, \\Ker, \\pgcd.
- Réponds UNIQUEMENT avec le contenu LaTeX demandé, sans préambule, sans commentaire, sans balise englobante (\\question{}, \\reponse{}...).`;

/**
 * Consignes par défaut, par type d'action.
 * `improve` s'applique à tout bloc qui a déjà un contenu (le contenu actuel
 * est joint à la suite de la consigne).
 */
export const DEFAULT_TASKS = {
  text: "Rédige le texte d'introduction de cet exercice : mise en situation, définitions des objets et notations.",
  question:
    "Rédige UNE nouvelle question pour cet exercice, cohérente avec la description et la progression des questions existantes (difficulté croissante, pas de redite).",
  sequence:
    "Conçois une séquence de questions progressives et cohérentes pour cet exercice. Chaque question doit être autonome, sans environnement enumerate ni balise LaTeX englobante. Sépare impérativement chaque question par une ligne contenant uniquement --- .",
  indication:
    "Rédige une indication courte (une à trois phrases) pour aider un étudiant bloqué sur la question concernée, sans dévoiler la solution.",
  reponse:
    "Rédige une solution complète, détaillée et rigoureuse de la question concernée. Justifie chaque étape du raisonnement.",
  improve:
    "Améliore la rédaction de ce bloc : clarté, rigueur mathématique, notations cohérentes avec le reste de l'exercice. Conserve le sens, la structure et le niveau de difficulté.",
};

/**
 * Consignes de suggestion des métadonnées (mode 'metadata' de l'API assist).
 * Auteur et organisation sont volontairement exclus : ils ne se déduisent
 * pas du contenu.
 */
export const META_TASKS = {
  title:
    "Propose un titre court et descriptif pour cet exercice (8 mots maximum). Réponds uniquement par le titre, sans guillemets ni ponctuation finale.",
  level:
    "Indique le niveau d'études adapté à cet exercice, parmi : Seconde, Première, Terminale, L1, L2, L3, M1, M2. Réponds uniquement par le niveau.",
  module:
    "Indique le grand domaine (module) dont relève cet exercice. Réponds uniquement par le nom du module.",
  chapter:
    "Indique le chapitre de cours dont relève cet exercice. Réponds uniquement par le nom du chapitre.",
  subchapter:
    "Indique le sous-chapitre précis dont relève cet exercice. Réponds uniquement par le nom du sous-chapitre.",
  theme:
    "Liste deux à cinq mots-clés décrivant les notions mobilisées par cet exercice, séparés par des virgules. Réponds uniquement par ces mots-clés.",
  difficulty:
    "Évalue la difficulté de cet exercice sur une échelle de 1 (application directe du cours) à 5 (très difficile). Réponds uniquement par un entier de 1 à 5.",
};

/**
 * Assemble la consigne complète envoyée au modèle (après le contexte de
 * l'exercice) : consigne + question concernée + contenu actuel + consigne
 * libre de l'auteur.
 *
 * @param {string} mode — 'text' | 'question' | 'indication' | 'reponse'
 * @param {Object} options
 * @param {string} [options.template]     — consigne (défaut : DEFAULT_TASKS)
 * @param {string} [options.targetLatex]  — question concernée (indication/solution)
 * @param {string} [options.currentLatex] — contenu actuel du bloc (amélioration)
 * @param {string} [options.instruction]  — consigne libre de l'auteur
 * @returns {string}
 */
export function buildTaskPrompt(
  mode,
  { template, targetLatex = "", currentLatex = "", instruction = "" } = {},
) {
  const isImprove = Boolean(String(currentLatex).trim());
  const base =
    template?.trim() ||
    (isImprove ? DEFAULT_TASKS.improve : DEFAULT_TASKS[mode]) ||
    DEFAULT_TASKS.text;

  const parts = [base];
  if (
    (mode === "indication" || mode === "reponse") &&
    String(targetLatex).trim()
  ) {
    parts.push(`Question concernée :\n${String(targetLatex).trim()}`);
  }
  if (isImprove) {
    parts.push(`Contenu actuel du bloc :\n${String(currentLatex).trim()}`);
  }
  if (String(instruction).trim()) {
    parts.push(`Consigne de l'auteur : ${String(instruction).trim()}`);
  }
  return parts.join("\n\n");
}
