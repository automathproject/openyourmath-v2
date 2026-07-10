<!--
  LatexToolbar — assistant LaTeX de l'éditeur d'exercices.
  Palette de snippets par catégorie ; chaque bouton insère `before`/`after`
  autour de la sélection du champ actif (callback `oninsert`).
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {(snippet: { before: string, after: string }) => void} oninsert
   */
  /** @type {Props} */
  let { oninsert } = $props();

  const CATEGORIES = [
    {
      id: 'math',
      label: 'Maths',
      snippets: [
        { label: '$…$', title: 'Math en ligne', before: '$', after: '$' },
        { label: '\\[…\\]', title: 'Formule centrée', before: '\\[\n', after: '\n\\]' },
        { label: 'a/b', title: 'Fraction', before: '\\dfrac{', after: '}{}' },
        { label: '√', title: 'Racine carrée', before: '\\sqrt{', after: '}' },
        { label: 'xⁿ', title: 'Puissance', before: '^{', after: '}' },
        { label: 'xₙ', title: 'Indice', before: '_{', after: '}' },
        { label: '∑', title: 'Somme', before: '\\sum_{k=1}^{n} ', after: '' },
        { label: '∏', title: 'Produit', before: '\\prod_{k=1}^{n} ', after: '' },
        { label: '∫', title: 'Intégrale', before: '\\int_{a}^{b} ', after: ' \\dx' },
        { label: 'lim', title: 'Limite', before: '\\lim_{x \\to 0} ', after: '' },
        { label: 'ln', title: 'Logarithme', before: '\\ln(', after: ')' },
        { label: 'eˣ', title: 'Exponentielle', before: 'e^{', after: '}' },
      ],
    },
    {
      id: 'symbols',
      label: 'Symboles',
      snippets: [
        { label: 'ℝ', title: 'Réels', before: '\\R', after: '' },
        { label: 'ℕ', title: 'Entiers naturels', before: '\\N', after: '' },
        { label: 'ℤ', title: 'Entiers relatifs', before: '\\Z', after: '' },
        { label: 'ℚ', title: 'Rationnels', before: '\\Q', after: '' },
        { label: 'ℂ', title: 'Complexes', before: '\\C', after: '' },
        { label: '∈', title: 'Appartient', before: '\\in ', after: '' },
        { label: '⊂', title: 'Inclus', before: '\\subset ', after: '' },
        { label: '∪', title: 'Union', before: '\\cup ', after: '' },
        { label: '∩', title: 'Intersection', before: '\\cap ', after: '' },
        { label: '∅', title: 'Ensemble vide', before: '\\varnothing', after: '' },
        { label: '∀', title: 'Pour tout', before: '\\forall ', after: '' },
        { label: '∃', title: 'Il existe', before: '\\exists ', after: '' },
        { label: '≤', title: 'Inférieur ou égal', before: '\\leq ', after: '' },
        { label: '≥', title: 'Supérieur ou égal', before: '\\geq ', after: '' },
        { label: '≠', title: 'Différent', before: '\\neq ', after: '' },
        { label: '≈', title: 'Approximativement', before: '\\approx ', after: '' },
        { label: '∞', title: 'Infini', before: '+\\infty', after: '' },
        { label: '→', title: 'Tend vers', before: '\\to ', after: '' },
        { label: '↦', title: 'A pour image', before: '\\mapsto ', after: '' },
        { label: '⟺', title: 'Équivalent', before: '\\Longleftrightarrow ', after: '' },
        { label: '⟹', title: 'Implique', before: '\\Longrightarrow ', after: '' },
      ],
    },
    {
      id: 'greek',
      label: 'Grec',
      snippets: [
        { label: 'α', title: 'alpha', before: '\\alpha', after: '' },
        { label: 'β', title: 'beta', before: '\\beta', after: '' },
        { label: 'γ', title: 'gamma', before: '\\gamma', after: '' },
        { label: 'δ', title: 'delta', before: '\\delta', after: '' },
        { label: 'ε', title: 'epsilon', before: '\\varepsilon', after: '' },
        { label: 'θ', title: 'theta', before: '\\theta', after: '' },
        { label: 'λ', title: 'lambda', before: '\\lambda', after: '' },
        { label: 'μ', title: 'mu', before: '\\mu', after: '' },
        { label: 'π', title: 'pi', before: '\\pi', after: '' },
        { label: 'σ', title: 'sigma', before: '\\sigma', after: '' },
        { label: 'φ', title: 'phi', before: '\\varphi', after: '' },
        { label: 'ω', title: 'omega', before: '\\omega', after: '' },
        { label: 'Δ', title: 'Delta', before: '\\Delta', after: '' },
        { label: 'Ω', title: 'Omega', before: '\\Omega', after: '' },
      ],
    },
    {
      id: 'structures',
      label: 'Structures',
      snippets: [
        {
          label: 'Matrice',
          title: 'Matrice 2×2',
          before: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
          after: '',
        },
        {
          label: 'Système',
          title: "Système d'équations",
          before: '\\left\\{\\begin{array}{l} x + y = 1 \\\\ x - y = 0 \\end{array}\\right.',
          after: '',
        },
        {
          label: 'Align',
          title: 'Calcul aligné',
          before: '\\begin{align*}\n\tf(x) &= \\\\\n\t&=\n\\end{align*}',
          after: '',
        },
        {
          label: 'Cases',
          title: 'Fonction par morceaux',
          before: '\\begin{cases} x & \\text{si } x \\geq 0 \\\\ -x & \\text{sinon} \\end{cases}',
          after: '',
        },
        {
          label: 'Binôme',
          title: 'Coefficient binomial',
          before: '\\binom{n}{k}',
          after: '',
        },
        {
          label: 'Liste 1. 2. 3.',
          title: 'Liste numérotée',
          before: '\\begin{enumerate}\n\t\\item ',
          after: '\n\\end{enumerate}',
        },
        {
          label: 'Liste à puces',
          title: 'Liste à puces',
          before: '\\begin{itemize}\n\t\\item ',
          after: '\n\\end{itemize}',
        },
      ],
    },
    {
      id: 'text',
      label: 'Texte',
      snippets: [
        { label: 'Gras', title: 'Texte en gras', before: '\\textbf{', after: '}' },
        { label: 'Italique', title: 'Texte en italique', before: '\\textit{', after: '}' },
        { label: 'Emphase', title: 'Emphase', before: '\\emph{', after: '}' },
        { label: 'Souligné', title: 'Texte souligné', before: '\\underline{', after: '}' },
        { label: 'Code', title: 'Police machine', before: '\\texttt{', after: '}' },
        { label: '« »', title: 'Guillemets français', before: '\\og ', after: '\\fg{}' },
        { label: 'Saut', title: 'Saut de ligne', before: '\\\\\n', after: '' },
      ],
    },
  ];

  let activeCategory = $state('math');

  let snippets = $derived(CATEGORIES.find((c) => c.id === activeCategory)?.snippets ?? []);
</script>

<div class="latex-toolbar">
  <div class="latex-toolbar-tabs" role="tablist" aria-label="Catégories de symboles LaTeX">
    {#each CATEGORIES as category}
      <button
        type="button"
        role="tab"
        aria-selected={activeCategory === category.id}
        class="latex-toolbar-tab"
        class:is-active={activeCategory === category.id}
        onclick={() => (activeCategory = category.id)}
      >
        {category.label}
      </button>
    {/each}
  </div>
  <div class="latex-toolbar-grid">
    {#each snippets as snippet}
      <button
        type="button"
        class="latex-toolbar-btn"
        title={snippet.title}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => oninsert?.({ before: snippet.before, after: snippet.after })}
      >
        {snippet.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .latex-toolbar {
    @apply border border-gray-200 rounded-lg bg-white overflow-hidden;
  }

  .latex-toolbar-tabs {
    @apply flex gap-1 px-2 pt-2 border-b border-gray-100 flex-wrap;
  }

  .latex-toolbar-tab {
    @apply px-2.5 py-1 text-xs font-medium text-gray-500 rounded-t-md border-b-2 border-transparent
           hover:text-gray-700 transition-colors;
  }

  .latex-toolbar-tab.is-active {
    @apply text-brand-700 border-brand-500;
  }

  .latex-toolbar-grid {
    @apply flex flex-wrap gap-1 p-2;
  }

  .latex-toolbar-btn {
    @apply min-w-[2rem] px-2 py-1 text-sm rounded border border-gray-200 bg-gray-50 text-gray-700
           hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors;
  }
</style>
