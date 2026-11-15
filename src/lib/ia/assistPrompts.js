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
- N'utilise JAMAIS de Markdown : ni **gras**, ni titres avec #, ni listes à puces (- ou *), ni liens [texte](url), ni code entre \`backticks\` ou \`\`\`blocs\`\`\`. Pour du texte en gras, utilise \\textbf{...} ; pour de l'italique, \\emph{...}.
- N'utilise JAMAIS d'environnement enumerate ou itemize : la plateforme ne les préserve pas (la numérotation des questions vient des blocs eux-mêmes). Rédige UNE seule question à la fois, sauf si la consigne demande explicitement une séquence ; dans ce cas sépare les questions exactement comme demandé. Le nombre de questions indiqué dans la consigne est une contrainte stricte : n'en produis ni plus ni moins, sans titre, préambule ni conclusion hors des questions. N'utilise JAMAIS de sous-questions ni de sous-parties (a), (b), (c) ni d'étapes numérotées : un exercice est une suite LINÉAIRE de blocs — description ou question — et chaque question porte une consigne unique. Ce qui demanderait une sous-partie doit devenir une question à part entière. Dans une solution, enchaîne les étapes en paragraphes.
- Macros disponibles : \\R, \\N, \\Z, \\Q, \\C (ensembles de nombres), \\dx, \\dt (différentielles), \\Vect, \\Ker, \\pgcd.
- Réponds UNIQUEMENT avec le contenu LaTeX demandé, sans préambule, sans commentaire, sans balise englobante (\\question{}, \\reponse{}...), sauf si la consigne demande explicitement du JSON.`;

export const REVISION_TASK = `Répercute la modification demandée par l'auteur sur l'intégralité de l'exercice : introduction, questions, indications et solutions concernées. Conserve les blocs qui ne doivent pas changer et leur ordre pédagogique.

Réponds UNIQUEMENT avec un objet JSON valide, sans Markdown, de la forme :
{"blocks":[{"type":"text","latex":"..."},{"type":"question","latex":"..."},{"type":"indication","latex":"..."},{"type":"reponse","latex":"..."}]}

Les types autorisés sont text, question, indication et reponse. N'inclus aucune explication hors du JSON.`;

/**
 * Relance envoyée quand le modèle a glissé des sous-questions dans un bloc :
 * sous-parties (a), (b) ou étapes numérotées. Elle est jouée avec la réponse
 * fautive en contexte, pour que le modèle voie ce qu'il doit remettre à plat.
 */
export const LINEAR_STRUCTURE_RETRY_TASK = `Ta réponse contient des sous-questions à l'intérieur d'une question : sous-parties (a), (b) ou étapes numérotées. La plateforme n'affiche que des blocs linéaires : c'est interdit. Recommence en respectant le nombre de questions demandé. Si ce nombre permet de répartir ces sous-parties, fais-en des questions séparées par une ligne contenant uniquement --- . S'il ne le permet pas — en particulier lorsqu'une seule question est demandée — fusionne-les en UNE consigne unique et indivisible qui pose les données puis demande directement l'objectif final : aucune étape intermédiaire, aucun résultat intermédiaire, aucun indice sur la méthode ne doit subsister dans l'énoncé. Réponds uniquement avec les énoncés.`;

/**
 * Consigne système du correcteur de syntaxe LaTeX (mode 'fixlatex').
 * Volontairement distincte de SYSTEM_PROMPT : ce mode ne rédige rien, il ne
 * fait que traduire en LaTeX correct ce que l'auteur a écrit en langage
 * naturel ou en notation approximative, sans jamais reformuler le contenu.
 */
export const FIX_LATEX_SYSTEM_PROMPT = `Tu es un correcteur de syntaxe LaTeX pour une plateforme d'exercices de mathématiques (rendu KaTeX).

Ta seule tâche est de transformer la notation mathématique informelle ou mal écrite en LaTeX correct, et de corriger la syntaxe LaTeX déjà présente si elle est invalide. Tu ne dois RIEN changer d'autre.

Règles impératives :
- Ne reformule JAMAIS le texte : aucune paraphrase, aucune correction d'orthographe ou de grammaire hors des formules, aucun ajout ni suppression d'information. Le texte non mathématique doit rester mot pour mot identique.
- Repère les expressions mathématiques écrites en langage naturel ou en notation approximative (ex. "integrale de 0 à x de exp(-t)ln(t) dt", "racine de 2", "f prime de x", "un suite qui tend vers l'infini") et convertis-les en LaTeX correct entre $...$ pour une formule en ligne, ou \\[...\\] si elle occupait déjà toute une ligne isolée.
- Corrige les erreurs de syntaxe LaTeX déjà présentes (parenthèses ou accolades non fermées, macros mal orthographiées, symboles manquants) sans changer les nombres, variables ou opérations données par l'auteur.
- Utilise les macros disponibles quand elles s'appliquent : \\R, \\N, \\Z, \\Q, \\C (ensembles de nombres), \\dx, \\dt (différentielles), \\Vect, \\Ker, \\pgcd. Écris les différentielles avec un d droit, par exemple \\mathrm{d}t ou \\mathrm{d}x si \\dx/\\dt ne conviennent pas.
- N'utilise JAMAIS d'environnement enumerate ou itemize, JAMAIS de Markdown.
- Réponds UNIQUEMENT avec le texte corrigé dans son intégralité, sans préambule, sans commentaire, sans balise englobante.`;

/**
 * Consignes par défaut, par type d'action.
 * `improve` s'applique à tout bloc qui a déjà un contenu (le contenu actuel
 * est joint à la suite de la consigne).
 */
export const DEFAULT_TASKS = {
  text: "Rédige le texte d'introduction de cet exercice : mise en situation, définitions des objets et notations.",
  question:
    "Rédige UNE nouvelle question pour cet exercice, cohérente avec la description et la progression des questions existantes (difficulté croissante, pas de redite). Une seule consigne, sans sous-parties (a), (b), (c) ni étapes numérotées.",
  sequence:
    "Rédige un exercice complet, autonome et publiable sous la forme d'une séquence de questions progressives. Les données, notations, hypothèses et objectif nécessaires doivent être définis dans le contexte déjà fourni ou dans la première question ; ne propose ni simple plan, ni ébauche, ni question reposant sur un énoncé absent. Chaque question doit faire avancer une progression cohérente, sans redite, et l'ensemble doit aboutir à un objectif mathématique identifiable. La structure est strictement linéaire : aucune sous-question, aucune sous-partie (a), (b), (c), aucune étape numérotée à l'intérieur d'une question — ce qui en demanderait une devient une question à part entière, et si le nombre imposé ne le permet pas, l'énoncé doit être conçu autrement. Si une seule question est demandée, elle doit contenir à la fois la mise en place et l'objectif final en une consigne unique et indivisible, sans étape intermédiaire ni résultat donné en cours de route : l'étudiant doit trouver lui-même le chemin. Le nombre de questions imposé dans la consigne de l'auteur est strict : produis exactement ce nombre de blocs, sans question supplémentaire, titre, préambule ou conclusion. Chaque bloc porte une seule consigne. Pas d'environnement enumerate ni de balise LaTeX englobante. Sépare impérativement chaque question par une ligne contenant uniquement --- .",
  indication:
    "Rédige une indication courte (une à trois phrases) pour aider un étudiant bloqué sur la question concernée, sans dévoiler la solution.",
  reponse:
    "Rédige une solution complète, détaillée et rigoureuse de la question concernée. Justifie chaque étape du raisonnement.",
  improve:
    "Améliore la rédaction de ce bloc : clarté, rigueur mathématique, notations cohérentes avec le reste de l'exercice. Conserve le sens, la structure et le niveau de difficulté.",
  fixlatex:
    "Corrige uniquement la syntaxe LaTeX/mathématique de ce texte (notation informelle → LaTeX correct, erreurs de syntaxe existantes) sans changer le contenu, la formulation ni la langue.",
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

/**
 * Consigne pour la correction de syntaxe LaTeX d'un bloc (mode 'fixlatex').
 * Contrairement à buildTaskPrompt, aucun contexte d'exercice n'est joint par
 * l'appelant : seul le texte du bloc est transmis, pour que le modèle se
 * concentre sur la syntaxe sans être tenté de réécrire le contenu.
 *
 * @param {Object} options
 * @param {string} [options.template]    — consigne (défaut : DEFAULT_TASKS.fixlatex)
 * @param {string} [options.content]     — texte du bloc à corriger
 * @param {string} [options.instruction] — précision libre de l'auteur
 * @returns {string}
 */
export function buildFixLatexPrompt({
  template,
  content = "",
  instruction = "",
} = {}) {
  const base = template?.trim() || DEFAULT_TASKS.fixlatex;
  const parts = [base];
  if (String(instruction).trim()) {
    parts.push(`Précision de l'auteur : ${String(instruction).trim()}`);
  }
  parts.push(`Texte à corriger :\n${String(content).trim()}`);
  return parts.join("\n\n");
}

// ── QCM ──────────────────────────────────────────────────────────────────────

/**
 * Consigne système des modes qcm ('qcm' et 'distractors'). Distincte de
 * SYSTEM_PROMPT : la sortie n'est pas du LaTeX libre mais un format balisé
 * (voir QCM_OUTPUT_FORMAT), choisi plutôt que du JSON pour que les
 * contre-obliques du LaTeX n'aient pas à être échappées.
 */
export const QCM_SYSTEM_PROMPT = `Tu es un enseignant de mathématiques du supérieur, expérimenté dans la conception de QCM diagnostiques pour la plateforme OpenYourMath. Tu connais les erreurs que commettent réellement les étudiants et tu construis chaque réponse fausse à partir de l'une d'elles.

Règles de rédaction impératives :
- Rédige en français, en LaTeX compatible KaTeX. Mathématiques en ligne entre $...$ (jamais \\(...\\)), formules centrées entre \\[...\\].
- Seules les formules sont en mode mathématique : une phrase s'écrit en texte courant, jamais dans \\text{...} à l'intérieur d'une formule. Exemple : « Si $(u_n)$ converge, alors $(u_n)$ est bornée. »
- N'utilise JAMAIS de Markdown (ni **gras**, ni titres #, ni puces, ni \`code\`) ni d'environnement enumerate ou itemize.
- Aucune macro personnelle : écris \\mathbb{R}, \\mathbb{N}, \\mathbb{Z}, \\mathbb{Q}, \\mathbb{C}, \\mathrm{d}x.
- Une réponse de QCM est courte et autonome : une formule, une valeur ou une phrase. Elle ne renvoie jamais à une autre réponse.
- Respecte exactement le format de sortie demandé : mêmes balises entre crochets, mêmes noms de champ en majuscules, rien après la dernière réponse.`;

/**
 * Ce qui fait un bon distracteur. Partagé par la génération de distracteurs
 * pour une question existante et par la génération d'une question complète.
 */
export const DISTRACTOR_RULES = `Un distracteur n'est pas une réponse fausse quelconque : c'est la réponse à laquelle aboutit un étudiant qui commet UNE erreur précise et fréquente. Cocher ce distracteur doit révéler cette erreur.

Méthode, dans cet ordre :
1. Résous la question toi-même, complètement, avant d'écrire la moindre réponse.
2. Recense les erreurs que font réellement les étudiants de ce niveau sur cette question précise, par exemple : erreur de signe ou de calcul à une étape identifiable ; hypothèse oubliée ou non vérifiée ; confusion entre deux notions, deux définitions ou deux formules voisines ; réciproque fausse, implication prise pour une équivalence ; condition nécessaire prise pour suffisante ; quantificateurs intervertis ; cas particulier généralisé à tort ; règle appliquée hors de son domaine de validité (linéarité abusive, dérivée d'une composée sans la dérivée intérieure, interversion non justifiée) ; borne, indice ou constante décalés ; inégalité stricte confondue avec une inégalité large.
3. Pour chaque erreur retenue, mène le raisonnement erroné jusqu'au bout : le distracteur est le résultat qu'obtient cet étudiant, ou l'assertion qu'il croirait vraie.
4. Vérifie chaque distracteur avant de le livrer.

Exigences pour chaque distracteur :
- FAUX SANS AMBIGUÏTÉ. Il n'est ni égal à une réponse juste sous une autre écriture (forme factorisée, développée, simplifiée, à une constante d'intégration près), ni vrai dans le cadre de l'énoncé, ni « vrai sous une condition » que l'énoncé n'exclut pas. Pour une assertion, tu dois pouvoir citer un contre-exemple ; pour un résultat, la valeur exacte qui le contredit. Une réponse est juste ou fausse en bloc : jamais de conclusion juste assortie d'une justification fausse, ni l'inverse.
- PLAUSIBLE. Un étudiant qui maîtrise à moitié le cours doit hésiter. Aucune réponse absurde ou hors sujet. Avant de retenir un distracteur, demande-toi si un étudiant attentif peut l'écarter sans faire le calcul : valeur négative pour l'intégrale d'une fonction positive, probabilité hors de $[0,1]$, ordre de grandeur, parité ou nature de l'objet incompatibles avec l'énoncé. Si oui, abandonne-le et vise une autre erreur.
- FIDÈLE À SON ERREUR. La réponse est exactement ce que donne le raisonnement erroné annoncé, mené jusqu'au bout avec les données de l'énoncé : refais ce calcul, ne l'estime pas.
- UNE ERREUR DISTINCTE PAR DISTRACTEUR. Pas deux écritures d'une même valeur, pas deux variantes de la même erreur, pas de variante d'une réponse fausse déjà présente.
- INDISCERNABLE PAR LA FORME. Même nature d'objet, même type d'écriture, même degré de simplification, longueur et précision comparables à celles des réponses justes. Aucun indice de formulation : pas de « toujours » ou « jamais » réservés aux réponses fausses, pas de réponse nettement plus longue, plus vague ou plus détaillée que les autres.
- AUTONOME. Jamais « aucune des réponses », « toutes les réponses », ni de renvoi à une autre réponse : l'ordre des réponses peut changer.
- L'ERREUR VISÉE EST MATHÉMATIQUE. Pas de piège de lecture, de formulation ambiguë ni de coquille déguisée.

Si la question demande de reconnaître des assertions vraies, chaque distracteur est une assertion fausse du même thème, obtenue en altérant un énoncé vrai là où les étudiants se trompent (hypothèse retirée, réciproque, quantificateur, inégalité stricte ou large, borne).

Si la question n'admet pas autant d'erreurs plausibles que demandé, livre moins de distracteurs : deux bons distracteurs valent mieux que quatre dont deux de remplissage.`;

const DISTRACTOR_FIELDS = `ERREUR : l'erreur de l'étudiant qui mène à cette réponse, en une phrase précise (à destination de l'auteur du QCM)
CALCUL : le raisonnement erroné de cet étudiant, mené jusqu'au résultat avec les données de l'énoncé
REPONSE : le distracteur lui-même, en LaTeX, tel qu'il sera affiché ; c'est le résultat du champ CALCUL
VERIFICATION : la preuve que cette réponse est fausse (contre-exemple, ou valeur exacte qui la contredit), et la raison pour laquelle on ne peut pas l'écarter sans calcul
VALIDE : oui si la réponse est fausse, distincte des autres, fidèle à l'erreur annoncée et non éliminable sans calcul ; non sinon
FEEDBACK : une ou deux phrases adressées à l'étudiant qui a coché cette réponse ; elles nomment son erreur et le point de cours à revoir, sans se borner à dire que c'est faux`;

/**
 * Format de sortie des distracteurs. La section [ANALYSE] donne au modèle la
 * place de résoudre la question avant de répondre ; elle n'est pas lue.
 */
export const DISTRACTOR_OUTPUT_FORMAT = `Format de sortie, à respecter exactement :

[ANALYSE]
Résolution brève de la question, puis liste des erreurs d'étudiants retenues (dix lignes au plus).

[DISTRACTEUR]
${DISTRACTOR_FIELDS}

Répète le bloc [DISTRACTEUR] pour chaque distracteur. Un champ par ligne, le nom du champ en majuscules suivi de deux-points. Un distracteur dont la vérification échoue reçoit « VALIDE : non » : il sera écarté.`;

export const DISTRACTOR_TASK = `Rédige les distracteurs (réponses fausses) de la question de QCM ci-dessous.

${DISTRACTOR_RULES}`;

export const QCM_QUESTION_TASK = `Rédige des questions de QCM complètes : énoncé, réponses justes, distracteurs et correction.

Exigences pour chaque question :
- L'énoncé est autonome : il pose toutes les données, les notations et les hypothèses, et demande une seule chose. On doit pouvoir y répondre sans lire les réponses proposées.
- Il appelle naturellement le nombre de réponses demandé : résultat d'un calcul, valeur, objet ou propriété à identifier. Pas de question fermée en oui/non, qui n'admet qu'un seul distracteur.
- Il évalue une compréhension ou une technique du cours, pas la mémorisation d'un détail ni une lecture piégeuse. Pas de tournure négative (« laquelle n'est pas… ») sauf nécessité.
- Les réponses justes le sont sans discussion, les réponses fausses le sont sans ambiguïté.
- Toutes les réponses d'une même question ont la même forme.

Les réponses fausses sont des distracteurs, construits ainsi :

${DISTRACTOR_RULES}`;

export const QCM_OUTPUT_FORMAT = `Format de sortie, à respecter exactement :

[QUESTION]
ENONCE : l'énoncé de la question, en LaTeX
RESOLUTION : la correction rédigée pour l'étudiant, qui établit les réponses justes (elle est écrite avant les réponses : c'est elle qui les détermine)
[JUSTE]
REPONSE : une réponse juste, en LaTeX
[FAUX]
${DISTRACTOR_FIELDS}

Répète [JUSTE] et [FAUX] autant que nécessaire, puis recommence à [QUESTION] pour la question suivante. Un champ par ligne, le nom du champ en majuscules suivi de deux-points. L'ordre des réponses n'a pas d'importance : elles seront mélangées. Une réponse fausse dont la vérification échoue reçoit « VALIDE : non » : elle sera écartée, prévois-en donc une de remplacement.`;

const QCM_TYPE_DESCRIPTIONS = {
  onlyone: "une seule réponse juste (l'étudiant en choisit une)",
  truefalse: "une seule réponse juste (l'étudiant en choisit une)",
  onetoall:
    "une ou plusieurs réponses justes (l'étudiant doit cocher toutes les réponses justes, et elles seules)",
  zerotoall:
    "zéro, une ou plusieurs réponses justes (l'étudiant coche toutes les réponses justes, s'il y en a)",
};

const bulletList = (items) =>
  items.map((item) => `- ${String(item).trim()}`).join("\n");

/**
 * Consigne de génération de distracteurs pour une question déjà rédigée.
 *
 * @param {Object} options
 * @param {{ stem: string, type?: string, choices?: Array<{latex: string, correct: boolean}>, explanation?: string }} options.question
 * @param {number} [options.count]        — nombre de distracteurs souhaités
 * @param {string} [options.instruction]  — précision libre de l'auteur
 * @returns {string}
 */
export function buildDistractorPrompt({
  question,
  count = 3,
  instruction = "",
} = {}) {
  const choices = (question?.choices || []).filter((choice) =>
    String(choice?.latex ?? "").trim(),
  );
  const correct = choices
    .filter((choice) => choice.correct)
    .map((choice) => choice.latex);
  const wrong = choices
    .filter((choice) => !choice.correct)
    .map((choice) => choice.latex);

  const parts = [
    DISTRACTOR_TASK,
    `Question :\n${String(question?.stem ?? "").trim()}`,
    `Type de question : ${QCM_TYPE_DESCRIPTIONS[question?.type] || QCM_TYPE_DESCRIPTIONS.onlyone}.`,
    correct.length
      ? `Réponses justes fournies par l'auteur :\n${bulletList(correct)}`
      : "L'auteur n'a pas encore indiqué de réponse juste : détermine-la toi-même dans l'analyse.",
  ];
  if (wrong.length) {
    parts.push(
      `Réponses fausses déjà présentes (n'en propose ni copie ni variante) :\n${bulletList(wrong)}`,
    );
  }
  if (String(question?.explanation ?? "").trim()) {
    parts.push(
      `Correction rédigée par l'auteur :\n${String(question.explanation).trim()}`,
    );
  }
  if (String(instruction).trim()) {
    parts.push(`Précision de l'auteur : ${String(instruction).trim()}`);
  }
  parts.push(`Nombre de distracteurs attendus : ${count} au plus.`);
  parts.push(DISTRACTOR_OUTPUT_FORMAT);
  return parts.join("\n\n");
}

/**
 * Consigne de génération de questions de QCM complètes à partir d'un brief.
 *
 * @param {Object} options
 * @param {string} [options.instruction]   — brief de l'auteur
 * @param {number} [options.questionCount] — nombre de questions
 * @param {number} [options.answerCount]   — nombre de réponses par question
 * @param {string} [options.type]          — 'onlyone' | 'onetoall'
 * @returns {string}
 */
export function buildQcmPrompt({
  instruction = "",
  questionCount = 1,
  answerCount = 4,
  type = "onlyone",
} = {}) {
  const single = type === "onlyone" || type === "truefalse";
  const parts = [QCM_QUESTION_TASK];
  if (String(instruction).trim()) {
    parts.push(`Demande de l'auteur : ${String(instruction).trim()}`);
  }
  parts.push(
    [
      "Contraintes :",
      questionCount > 1
        ? `- Exactement ${questionCount} questions, qui forment une série ordonnée : elles partagent le contexte déjà fourni, se jouent dans cet ordre, et chacune peut s'appuyer sur les précédentes sans les répéter.`
        : "- Exactement une question, indépendante et lisible seule.",
      `- Type : ${QCM_TYPE_DESCRIPTIONS[type] || QCM_TYPE_DESCRIPTIONS.onlyone}.`,
      single
        ? `- ${answerCount} réponses par question : une seule juste et ${answerCount - 1} distracteurs.`
        : `- ${answerCount} réponses par question, dont au moins une juste et au moins un distracteur ; fais varier le nombre de réponses justes d'une question à l'autre.`,
    ].join("\n"),
  );
  parts.push(QCM_OUTPUT_FORMAT);
  return parts.join("\n\n");
}
