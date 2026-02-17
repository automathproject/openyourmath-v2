// scripts/utils/previewUtils.js

/**
 * Génère une preview d'un contenu en respectant la syntaxe LaTeX
 * @param {string} content - Le contenu à tronquer
 * @param {number} maxLength - La longueur maximale souhaitée
 * @returns {string} La preview tronquée
 */
function getPreview(content, maxLength = 150) {
    if (!content) return '';
    if (content.length <= maxLength) return content;

    let safeEnd = maxLength;
    const truncated = content.slice(0, maxLength);

    // PRIORITÉ 1: Vérifier qu'on ne coupe pas au milieu d'une balise HTML
    const lastOpenBracket = truncated.lastIndexOf('<');
    const lastCloseBracket = truncated.lastIndexOf('>');

    // Si le dernier '<' est après le dernier '>', on est au milieu d'une balise
    if (lastOpenBracket > lastCloseBracket) {
      safeEnd = Math.min(safeEnd, lastOpenBracket);
    }

    // PRIORITÉ 2: Vérifier les balises <span class="math"> ouvertes non fermées
    const mathSpanRegex = /<span[^>]*class=["']math[^"']*["'][^>]*>/g;
    const closingSpanRegex = /<\/span>/g;

    let mathOpenCount = 0;
    let mathCloseCount = 0;
    let lastMathSpanPos = -1;

    // Compter les balises math ouvertes
    let match;
    const testTruncated = truncated.slice(0, safeEnd);
    while ((match = mathSpanRegex.exec(testTruncated)) !== null) {
      mathOpenCount++;
      lastMathSpanPos = match.index;
    }

    // Compter les balises span fermées après la dernière balise math
    if (lastMathSpanPos !== -1) {
      const afterLastMath = testTruncated.substring(lastMathSpanPos);
      const closeMatches = afterLastMath.match(closingSpanRegex);
      mathCloseCount = closeMatches ? closeMatches.length : 0;

      // Si on a une balise math ouverte non fermée, couper avant
      if (mathCloseCount === 0) {
        safeEnd = Math.min(safeEnd, lastMathSpanPos);
      }
    }

    // PRIORITÉ 3: Vérifier les expressions LaTeX ouvertes
    const finalTruncated = content.slice(0, safeEnd);

    // Gestion des double dollars $$
    const lastDoubleDollar = finalTruncated.lastIndexOf('$$');
    if (lastDoubleDollar !== -1) {
      const doubleDollarMatches = finalTruncated.match(/\$\$/g) || [];
      if (doubleDollarMatches.length % 2 !== 0) {
        safeEnd = Math.min(safeEnd, lastDoubleDollar);
      }
    }

    // Gestion des dollars simples $
    const lastSingleDollar = finalTruncated.lastIndexOf('$');
    if (lastSingleDollar !== -1) {
      const contentWithoutDoubleDollar = finalTruncated.replace(/\$\$/g, '##');
      const singleDollarCount = (contentWithoutDoubleDollar.match(/\$/g) || []).length;
      if (singleDollarCount % 2 !== 0) {
        safeEnd = Math.min(safeEnd, lastSingleDollar);
      }
    }

    // Gestion des \[ et \]
    const lastBracketOpen = finalTruncated.lastIndexOf('\\[');
    const lastBracketClose = finalTruncated.lastIndexOf('\\]');
    if (lastBracketOpen !== -1 && (lastBracketClose === -1 || lastBracketClose < lastBracketOpen)) {
      safeEnd = Math.min(safeEnd, lastBracketOpen);
    }

    // Gestion des \( et \)
    const lastParenOpen = finalTruncated.lastIndexOf('\\(');
    const lastParenClose = finalTruncated.lastIndexOf('\\)');
    if (lastParenOpen !== -1 && (lastParenClose === -1 || lastParenClose < lastParenOpen)) {
      safeEnd = Math.min(safeEnd, lastParenOpen);
    }

    return content.slice(0, safeEnd) + ' ...';
  }

  function getBlockHtml(block) {
    if (!block || typeof block !== 'object') return '';
    if (typeof block.html === 'string') return block.html;
    if (typeof block.value?.html === 'string') return block.value.html;
    return '';
  }

  function getBlockType(block) {
    if (!block || typeof block !== 'object') return '';
    return String(block.type || '').toLowerCase();
  }
  
  /**
   * Génère une preview pour un exercice
   * @param {Object} exercise - L'exercice complet
   * @returns {string} La preview générée
   */
  function generatePreview(exercise) {
    if (!exercise || typeof exercise !== 'object') return '';

    const blocks = Array.isArray(exercise.content)
      ? exercise.content
      : Array.isArray(exercise.contenu)
        ? exercise.contenu
        : [];

    if (blocks.length === 0) return '';

    const firstContent = blocks.find((item) => {
      const type = getBlockType(item);
      return (
        (type === 'text' || type === 'description' || type === 'question') &&
        getBlockHtml(item).trim()
      );
    });
    
    if (firstContent) {
      return getPreview(getBlockHtml(firstContent));
    }

    const fallbackContent = blocks.find((item) => getBlockHtml(item).trim());
    if (fallbackContent) {
      return getPreview(getBlockHtml(fallbackContent));
    }
    
    return '';
  }
  
  export {
    getPreview,
    generatePreview
  };
