// src/lib/macros.js
// Registre unique des macros OpenYourMath.
//
// Une macro décrite ici est connue des deux chemins de rendu du site :
//   - KaTeX, pour l'affichage en ligne (voir MathRenderer.svelte) ;
//   - l'export .tex, qui en dérive les \newcommand du préambule
//     (voir src/lib/latex/export.js).
//
// Champs :
//   name   nom de la commande, sans l'antislash
//   value  corps de la macro — la même chaîne sert à KaTeX et au \newcommand
//   mode   'math' (défaut) ou 'text' : une macro de mode texte s'écrit hors
//          des délimiteurs mathématiques et n'est donc jamais passée à KaTeX
//   args   arité, pour les macros à paramètres (#1, #2, …)
//   renew  vrai si la commande existe déjà en LaTeX standard (\AA)
//
// Ajouter une entrée ici suffit : l'affichage et l'export la connaissent tous
// les deux. tests/build/macros.test.js vérifie que chaque macro de mode math
// est acceptée par KaTeX et que son arité déclarée correspond au corps.

/** @type {{ name: string, value: string, mode?: 'math'|'text', args?: number, renew?: boolean }[]} */
export const MACRO_REGISTRY = [
  // Ensembles de nombres
  { name: "N", value: "\\mathbb{N}" },
  { name: "Nn", value: "\\mathbb{N}" },
  { name: "R", value: "\\mathbb{R}" },
  { name: "Rr", value: "\\mathbb{R}" },
  { name: "Z", value: "\\mathbb{Z}" },
  { name: "Zz", value: "\\mathbb{Z}" },
  { name: "Kk", value: "\\mathbb{K}" },
  { name: "Q", value: "\\mathbb{Q}" },
  { name: "Qq", value: "\\mathbb{Q}" },
  { name: "Cp", value: "\\mathbb{C}" },
  { name: "CC", value: "\\mathbb{C}" },
  { name: "Cc", value: "\\mathbb{C}" },
  { name: "C", value: "\\mathbb{C}" },
  { name: "BB", value: "\\mathbb{B}" },
  { name: "DD", value: "\\mathbb{D}" },
  { name: "EE", value: "\\mathbb{E}" },
  // \AA est déjà définie par LaTeX (l'anneau Å) : l'export doit la redéfinir.
  { name: "AA", value: "\\mathbb{A}", renew: true },

  // Analyse complexe
  { name: "RRe", value: "\\mathrm{Re}" },
  { name: "IIm", value: "\\mathrm{Im}" },
  { name: "im", value: "\\mathrm{i}" },

  // Probabilités
  { name: "E", value: "\\mathbb{E}" },
  { name: "EX", value: "\\mathbb{E}(X)" },
  { name: "var", value: "\\mathrm{Var}" },
  { name: "V", value: "\\mathrm{V}" },
  { name: "PP", value: "\\mathrm{P}" },
  { name: "prob", value: "\\mathrm{P}" },
  { name: "p", value: "\\mathrm{P}" },
  { name: "va", value: "variable aléatoire", mode: "text" },
  { name: "vas", value: "variables aléatoires", mode: "text" },

  // Opérateurs
  { name: "pgcd", value: "\\mathrm{pgcd}" },
  { name: "ppcm", value: "\\mathrm{ppcm}" },
  { name: "card", value: "\\mathrm{card}" },
  { name: "Vect", value: "\\mathrm{Vect}" },
  { name: "Ker", value: "\\mathrm{Ker}" },
  { name: "id", value: "\\mathrm{id}" },
  { name: "Id", value: "\\mathrm{Id}" },

  // Fonctions trigonométriques / hyperboliques
  { name: "cotan", value: "\\mathrm{cotan}" },
  { name: "Arccos", value: "\\mathrm{Arccos}" },
  { name: "Arcsin", value: "\\mathrm{Arcsin}" },
  { name: "Arctan", value: "\\mathrm{Arctan}" },
  { name: "Argch", value: "\\mathrm{Argch}" },
  { name: "Argsh", value: "\\mathrm{Argsh}" },
  { name: "Argth", value: "\\mathrm{Argth}" },

  // Géométrie / vecteurs
  { name: "uu", value: "\\overrightarrow{u}" },
  { name: "vv", value: "\\overrightarrow{v}" },
  { name: "ww", value: "\\overrightarrow{w}" },
  // Valeur d'origine tronquée (« ($O$;$\overrightarrow{\imath} »), complétée
  // ici en repère du plan. Macro inutilisée dans content/ : à valider avant
  // de s'en servir.
  {
    name: "OIJ",
    value: "($O$ ; $\\overrightarrow{\\imath}$, $\\overrightarrow{\\jmath}$)",
    mode: "text",
  },

  // Intégrales / différentielles
  { name: "dx", value: "\\hspace{.6mm}\\mathrm{d}x" },
  { name: "dy", value: "\\hspace{.6mm}\\mathrm{d}y" },
  { name: "dz", value: "\\hspace{.6mm}\\mathrm{d}z" },
  { name: "dt", value: "\\hspace{.6mm}\\mathrm{d}t" },
  { name: "du", value: "\\hspace{.6mm}\\mathrm{d}u" },
  { name: "dv", value: "\\hspace{.6mm}\\mathrm{d}v" },
  { name: "dd", value: "\\textup{d}" },

  // Dérivées partielles
  { name: "dpa", value: "\\frac{\\partial #1}{\\partial #2}", args: 2 },
  {
    name: "dpsm",
    value: "\\frac{\\partial^2 #1}{\\partial #2 \\, \\partial #3}",
    args: 3,
  },
  { name: "dpsp", value: "\\frac{\\partial^2 #1}{\\partial #2^2}", args: 2 },

  // Ensembles solutions / parties
  { name: "Sol", value: "\\mathscr{S}" },
  { name: "Pn", value: "\\mathscr{P}" },
  { name: "Pnn", value: "\\mathscr{P}" },

  // Norme triple
  { name: "vvvert", value: "\\vert\\!\\vert\\!\\vert" },

  // Indices usuels
  { name: "1", value: "\\mathbf{1}" },
  { name: "n", value: "_{n\\in\\N}" },
  { name: "nstar", value: "_{n\\in\\N^*}" },

  // Abréviations de logique (mode math)
  { name: "et", value: "\\text{ et }" },
  { name: "ou", value: "\\text{ ou }" },
  { name: "qeq", value: "\\quad\\text{et}\\quad" },
  { name: "eq", value: "\\;\\Leftrightarrow\\;" },
  { name: "impl", value: "\\;\\Rightarrow\\;" },
  { name: "lr", value: "\\longrightarrow" },
  { name: "vide", value: "\\varnothing" },
  { name: "ep", value: "\\varepsilon" },
  { name: "dlim", value: "\\displaystyle\\lim" },

  // Abréviations rédactionnelles (mode texte)
  { name: "nd", value: "\\noindent", mode: "text" },
  { name: "ssi", value: "si, et seulement si,", mode: "text" },
  { name: "mq", value: "Montrer que", mode: "text" },
  { name: "cad", value: "c'est-à-dire", mode: "text" },
];

/**
 * Table passée à l'option `macros` de KaTeX.
 *
 * Seules les macros de mode math y figurent : les abréviations
 * rédactionnelles s'écrivent hors des délimiteurs mathématiques, KaTeX ne les
 * rencontre jamais et les y déclarer masquait les erreurs plutôt que de les
 * révéler.
 *
 * @type {Record<string, string>}
 */
export const macros = Object.fromEntries(
  MACRO_REGISTRY.filter((m) => m.mode !== "text").map((m) => [
    `\\${m.name}`,
    m.value,
  ]),
);

/**
 * Définitions `\newcommand` correspondantes, pour le préambule des documents
 * exportés. L'ordre suit celui du registre.
 *
 * @type {{ name: string, def: string }[]}
 */
export const latexMacroDefinitions = MACRO_REGISTRY.map((m) => {
  const command = m.renew ? "renewcommand" : "newcommand";
  const arity = m.args ? `[${m.args}]` : "";

  // LaTeX absorbe l'espace qui suit un nom de macro : « les \vas $X_i$ »
  // donnerait « les variables aléatoiresX_i ». `\xspace` le rétablit, sauf
  // devant une ponctuation. Il ne concerne que les macros dont le corps est du
  // texte littéral : celles qui commencent par une commande (\noindent) le
  // gèrent elles-mêmes, et un espace y serait néfaste.
  const literalText = m.mode === "text" && !m.value.startsWith("\\");
  const body = literalText ? `${m.value}\\xspace` : m.value;

  return { name: m.name, def: `\\${command}{\\${m.name}}${arity}{${body}}` };
});
