// Static enrichment for the Browse/Parcourir hi-fi page.
// Keyed by chapter name (case-insensitive match) as it appears in the DB.
// Falls back to empty strings when a chapter isn't listed.

export const CHAPTER_META = {
  // ── Analyse ──────────────────────────────────────────────────
  'intégration': {
    glyph: '∫',
    preview: '\\int_0^{\\infty} x \\, e^{-x^2} \\, dx',
  },
  'suites': {
    glyph: 'uₙ',
    preview: 'u_{n+1} = \\tfrac{1}{2}\\!\\left(u_n + \\tfrac{a}{u_n}\\right)',
  },
  'séries': {
    glyph: 'Σ',
    preview: '\\sum_{n=1}^{\\infty} \\frac{(-1)^{n+1}}{n}',
  },
  'fonctions': {
    glyph: "f'",
    preview: "f(x)=\\sum_{n\\geq 0}\\frac{f^{(n)}(a)}{n!}(x-a)^n",
  },
  'limites': {
    glyph: 'lim',
    preview: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1',
  },
  'développements limités': {
    glyph: 'DL',
    preview: "f(x)=\\sum_{k=0}^{n}\\frac{f^{(k)}(0)}{k!}x^k+o(x^n)",
  },
  // ── Algèbre ───────────────────────────────────────────────────
  'polynômes': {
    glyph: 'P(X)',
    preview: 'P(X) = \\prod_{k=1}^{n}(X - \\alpha_k)',
  },
  'espaces vectoriels': {
    glyph: 'ℝⁿ',
    preview: '\\dim(F + G) = \\dim F + \\dim G - \\dim(F\\cap G)',
  },
  'matrices': {
    glyph: 'A',
    preview: 'A = P D P^{-1}',
  },
  'déterminants': {
    glyph: 'det',
    preview: '\\det(AB) = \\det(A)\\det(B)',
  },
  'applications linéaires': {
    glyph: 'u',
    preview: '\\ker u \\oplus \\operatorname{Im} u = E',
  },
  'structures algébriques': {
    glyph: 'G',
    preview: 'a \\equiv b \\pmod{n}',
  },
  // ── Géométrie ─────────────────────────────────────────────────
  'géométrie affine': {
    glyph: 'G',
    preview: 'G = \\sum \\lambda_i A_i,\\ \\sum \\lambda_i = 1',
  },
  'espaces euclidiens': {
    glyph: '⟨,⟩',
    preview: '\\langle u, v \\rangle = \\|u\\|\\|v\\|\\cos\\theta',
  },
  'coniques': {
    glyph: '●',
    preview: '\\tfrac{x^2}{a^2}+\\tfrac{y^2}{b^2}=1',
  },
  // ── Probabilités ──────────────────────────────────────────────
  'probabilités': {
    glyph: 'ℙ',
    preview: '\\mathbb{P}(A \\cup B) = \\mathbb{P}(A) + \\mathbb{P}(B) - \\mathbb{P}(A\\cap B)',
  },
  'variables aléatoires': {
    glyph: 'X',
    preview: '\\mathbb{P}(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}',
  },
  'statistiques': {
    glyph: 'X̄',
    preview: '\\bar{X}_n \\xrightarrow{p.s.} \\mu',
  },
};

// Module-level blurbs keyed by module name (case-insensitive).
export const MODULE_META = {
  'analyse': {
    blurb: "Fonctions, suites, séries et intégrales — fondements du calcul infinitésimal.",
  },
  'algèbre': {
    blurb: "Structures, polynômes, espaces vectoriels et applications linéaires.",
  },
  'géométrie': {
    blurb: "Géométrie affine, euclidienne et formes quadratiques.",
  },
  'probabilités': {
    blurb: "Variables aléatoires, lois usuelles, convergence en loi.",
  },
  'arithmétique': {
    blurb: "Divisibilité, congruences, entiers et nombres premiers.",
  },
};

export function getChapterMeta(chapterName) {
  const key = chapterName?.toLowerCase().trim() ?? '';
  // Exact match first, then partial match
  if (CHAPTER_META[key]) return CHAPTER_META[key];
  const partialKey = Object.keys(CHAPTER_META).find((k) => key.includes(k) || k.includes(key));
  return partialKey ? CHAPTER_META[partialKey] : {};
}

export function getModuleMeta(moduleName) {
  const key = moduleName?.toLowerCase().trim() ?? '';
  if (MODULE_META[key]) return MODULE_META[key];
  const partialKey = Object.keys(MODULE_META).find((k) => key.includes(k) || k.includes(key));
  return partialKey ? MODULE_META[partialKey] : {};
}
