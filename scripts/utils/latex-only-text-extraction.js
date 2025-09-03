/**
 * Nettoie et simplifie le LaTeX pour l'indexation FTS5
 * @param {string} latex - Le contenu LaTeX brut
 * @returns {string} Le texte nettoyé et lisible
 */
function cleanLatexForSearch(latex) {
  if (!latex) return '';
  
  let text = latex;
  
  // 1. Nettoyer les commandes de mise en forme (garder le contenu)
  text = text
    .replace(/\\textbf\{([^}]+)\}/g, '$1') // Gras
    .replace(/\\textit\{([^}]+)\}/g, '$1') // Italique
    .replace(/\\emph\{([^}]+)\}/g, '$1') // Emphase
    .replace(/\\underline\{([^}]+)\}/g, '$1') // Souligné
    .replace(/\\texttt\{([^}]+)\}/g, '$1') // Monospace
    .replace(/\\text\{([^}]+)\}/g, '$1'); // Texte en mode math
  
  // 2. Traiter les environnements mathématiques (garder le contenu, supprimer délimiteurs)
  text = text
    .replace(/\$\$([^$]+)\$\$/g, ' $1 ') // Display math
    .replace(/\$([^$]+)\$/g, ' $1 ') // Inline math
    .replace(/\\\\?\[([^\]]+)\\\\?\]/g, ' $1 ') // \[ \] ou \\[ \\]
    .replace(/\\\\?\(([^)]+)\\\\?\)/g, ' $1 '); // \( \) ou \\( \\)
  
  // 3. Simplifier les fractions et autres notations mathématiques
  text = text
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 sur $2') // Fractions
    .replace(/\\sqrt\{([^}]+)\}/g, 'racine de $1') // Racines
    .replace(/\\sqrt\[([^]]+)\]\{([^}]+)\}/g, 'racine $1 de $2') // Racines n-ièmes
    .replace(/\^{([^}]+)}/g, ' puissance $1') // Exposants avec accolades
    .replace(/\^(\w)/g, ' puissance $1') // Exposants simples
    .replace(/_\{([^}]+)\}/g, ' indice $1') // Indices avec accolades
    .replace(/_(\w)/g, ' indice $1'); // Indices simples
  
  // 4. Remplacer les symboles mathématiques courants par des mots
  const mathSymbols = {
    '\\alpha': 'alpha',
    '\\beta': 'beta',
    '\\gamma': 'gamma',
    '\\delta': 'delta',
    '\\epsilon': 'epsilon',
    '\\pi': 'pi',
    '\\theta': 'theta',
    '\\lambda': 'lambda',
    '\\mu': 'mu',
    '\\sigma': 'sigma',
    '\\phi': 'phi',
    '\\omega': 'omega',
    '\\infty': 'infini',
    '\\sum': 'somme',
    '\\prod': 'produit',
    '\\int': 'intégrale',
    '\\lim': 'limite',
    '\\sin': 'sinus',
    '\\cos': 'cosinus',
    '\\tan': 'tangente',
    '\\ln': 'logarithme',
    '\\log': 'logarithme',
    '\\exp': 'exponentielle',
    '\\leq': 'inférieur ou égal',
    '\\geq': 'supérieur ou égal',
    '\\neq': 'différent',
    '\\approx': 'approximativement',
    '\\subset': 'inclus dans',
    '\\in': 'appartient à',
    '\\notin': 'n\'appartient pas à',
    '\\cup': 'union',
    '\\cap': 'intersection',
    '\\mathbb{R}': 'réels',
    '\\mathbb{N}': 'entiers naturels',
    '\\mathbb{Z}': 'entiers relatifs',
    '\\mathbb{Q}': 'rationnels',
    '\\mathbb{C}': 'complexes',
    '\\mathcal{N}': 'loi normale',
    '\\PP': 'probabilité'
  };
  
  for (const [symbol, word] of Object.entries(mathSymbols)) {
    text = text.replace(new RegExp(symbol.replace(/[\\{}]/g, '\\$&'), 'g'), ` ${word} `);
  }
  
  // 5. Nettoyer les environnements (supprimer begin/end, garder contenu)
  text = text.replace(/\\begin\{([^}]+)\}|\\end\{([^}]+)\}/g, ' ');
  
  // 6. Supprimer les autres commandes LaTeX non traitées
  text = text
    .replace(/\\item\s*/g, ' ') // Items de liste
    .replace(/\\\\(?:\[[^\]]*\])?/g, ' ') // Sauts de ligne
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ') // Autres commandes
    .replace(/\\./g, ' '); // Autres séquences d'échappement
  
  // 7. Nettoyer la ponctuation et les caractères spéciaux
  text = text
    .replace(/[{}]/g, ' ') // Accolades restantes
    .replace(/&/g, ' et ') // Esperluette
    .replace(/[~^]/g, ' ') // Caractères spéciaux
    .replace(/\s+/g, ' ') // Espaces multiples
    .trim();
  
  return text;
}

/**
 * Extrait le texte pour la recherche en utilisant uniquement le LaTeX
 * @param {Array} contentArray - Le tableau des blocs de contenu
 * @returns {string} Le texte optimisé pour FTS5
 */
function extractSearchTextFromLatex(contentArray) {
  if (!Array.isArray(contentArray)) return '';
  
  return contentArray
    .map(block => {
      if (!block.latex) return '';
      
      const cleanText = cleanLatexForSearch(block.latex);
      
      // Optionnel: ajouter un préfixe selon le type pour améliorer la recherche
      switch (block.type) {
        case 'question':
          return `QUESTION: ${cleanText}`;
        case 'reponse':
          return `RÉPONSE: ${cleanText}`;
        case 'indication':
          return `INDICATION: ${cleanText}`;
        default:
          return cleanText;
      }
    })
    .filter(text => text.trim() !== '')
    .join(' ');
}

/**
 * Version simplifiée sans préfixes (plus compatible)
 * @param {Array} contentArray - Le tableau des blocs de contenu
 * @returns {string} Le texte nettoyé
 */
function extractSearchTextFromLatexSimple(contentArray) {
  if (!Array.isArray(contentArray)) return '';
  
  return contentArray
    .map(block => block.latex ? cleanLatexForSearch(block.latex) : '')
    .filter(text => text.trim() !== '')
    .join(' ');
}

/**
 * Nettoie la preview (qui peut contenir du HTML généré par Pandoc)
 * Mais on peut aussi utiliser le LaTeX si disponible
 * @param {string} preview - Le texte de preview
 * @param {Array} contentArray - Le contenu original (optionnel)
 * @returns {string} Le texte de preview nettoyé
 */
function cleanPreviewFromLatex(preview, contentArray = null) {
  if (!preview) return '';
  
  // Si on a le contenu original, générer une preview directement du LaTeX
  if (contentArray && Array.isArray(contentArray) && contentArray.length > 0) {
    const firstBlock = contentArray.find(block => 
      (block.type === 'text' || block.type === 'question') && block.latex
    );
    
    if (firstBlock) {
      const cleanText = cleanLatexForSearch(firstBlock.latex);
      return cleanText.length > 150 
        ? cleanText.substring(0, 150).trim() + '...'
        : cleanText;
    }
  }
  
  // Fallback: nettoyer la preview HTML existante
  return preview
    .replace(/<[^>]*>/g, ' ') // Supprimer HTML
    .replace(/\s+/g, ' ')
    .trim();
}

// Export des fonctions
export {
  cleanLatexForSearch,
  extractSearchTextFromLatex,
  extractSearchTextFromLatexSimple,
  cleanPreviewFromLatex
};