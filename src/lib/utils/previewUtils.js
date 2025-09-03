// lib/utils/previewUtils.js

/**
 * Extrait et nettoie le contenu HTML pour créer une preview
 * @param {string} htmlContent - Le contenu HTML à traiter
 * @param {number} maxLength - Longueur maximale de la preview (en caractères)
 * @returns {string} - HTML nettoyé pour la preview
 */
export function generatePreview(htmlContent, maxLength = 200) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }

  try {
    // Créer un élément temporaire pour parser le HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Supprimer les éléments indésirables (scripts, styles, etc.)
    const unwantedElements = tempDiv.querySelectorAll('script, style, iframe, video, audio');
    unwantedElements.forEach(el => el.remove());

    // Extraire le texte brut pour calculer la longueur
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    if (textContent.length <= maxLength) {
      return tempDiv.innerHTML;
    }

    // Trouver un point de coupure naturel
    const truncatedText = textContent.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncatedText.lastIndexOf('.'),
      truncatedText.lastIndexOf('!'),
      truncatedText.lastIndexOf('?')
    );

    let cutoffPoint = lastSentenceEnd > maxLength * 0.7 ? lastSentenceEnd + 1 : maxLength;
    
    // Si pas de fin de phrase trouvée, couper au dernier espace
    if (cutoffPoint === maxLength) {
      const lastSpace = truncatedText.lastIndexOf(' ');
      cutoffPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
    }

    // Reconstruire le HTML tronqué
    return truncateHTMLContent(tempDiv, cutoffPoint);
  } catch (error) {
    console.warn('Erreur lors de la génération de preview:', error);
    return htmlContent.substring(0, maxLength) + '...';
  }
}

/**
 * Tronque le contenu HTML tout en préservant les balises
 * @param {HTMLElement} element - Élément DOM à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - HTML tronqué
 */
function truncateHTMLContent(element, maxLength) {
  let currentLength = 0;
  const result = document.createElement('div');

  function processNode(node, parent) {
    if (currentLength >= maxLength) return false;

    if (node.nodeType === Node.TEXT_NODE) {
      const remainingLength = maxLength - currentLength;
      const text = node.textContent;
      
      if (text.length <= remainingLength) {
        parent.appendChild(node.cloneNode(true));
        currentLength += text.length;
      } else {
        const truncatedText = text.substring(0, remainingLength);
        const textNode = document.createTextNode(truncatedText + '...');
        parent.appendChild(textNode);
        currentLength = maxLength;
        return false;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const clonedElement = document.createElement(node.tagName.toLowerCase());
      
      // Copier les attributs importants
      const importantAttrs = ['class', 'href', 'src', 'alt', 'title'];
      importantAttrs.forEach(attr => {
        if (node.hasAttribute(attr)) {
          clonedElement.setAttribute(attr, node.getAttribute(attr));
        }
      });

      parent.appendChild(clonedElement);

      // Traiter les enfants
      for (const child of node.childNodes) {
        if (!processNode(child, clonedElement)) {
          break;
        }
      }
    }

    return currentLength < maxLength;
  }

  for (const child of element.childNodes) {
    if (!processNode(child, result)) {
      break;
    }
  }

  return result.innerHTML;
}

/**
 * Extrait la preview à partir d'un objet exercice complet
 * @param {Object} exercise - L'objet exercice
 * @returns {string} - Preview HTML
 */
export function extractExercisePreview(exercise) {
  if (!exercise || !exercise.content_json) {
    return '';
  }

  try {
    const content = typeof exercise.content_json === 'string' 
      ? JSON.parse(exercise.content_json) 
      : exercise.content_json;

    // Priorité d'extraction du contenu
    const contentSources = [
      content.main_content,
      content.statement,
      content.context,
      content.description,
      content.question,
      content.questions?.[0]?.question,
      content.content
    ].filter(Boolean);

    if (contentSources.length === 0) {
      return '';
    }

    // Utiliser la première source de contenu disponible
    const mainContent = contentSources[0];
    return generatePreview(mainContent, 180);
  } catch (error) {
    console.warn('Erreur lors de l\'extraction de la preview:', error);
    return '';
  }
}

/**
 * Nettoie et améliore le contenu de preview pour l'affichage
 * @param {string} preview - Le contenu de preview
 * @returns {string} - Preview nettoyée
 */
export function cleanPreviewContent(preview) {
  if (!preview) return '';

  return preview
    // Supprimer les balises vides
    .replace(/<([a-z]+)>\s*<\/\1>/gi, '')
    // Normaliser les espaces multiples
    .replace(/\s+/g, ' ')
    // Nettoyer les débuts/fins d'espaces
    .trim();
}

/**
 * Détermine si le contenu contient des mathématiques
 * @param {string} content - Le contenu à vérifier
 * @returns {boolean} - True si contient des maths
 */
export function containsMath(content) {
  if (!content) return false;
  
  // Rechercher des indicateurs de contenu mathématique
  const mathIndicators = [
    /\$\$.*\$\$/,  // Formules block LaTeX
    /\$.*\$/,      // Formules inline LaTeX
    /\\[a-zA-Z]+/,  // Commandes LaTeX
    /\\\(/,        // Début de formule LaTeX
    /\\\[/,        // Début de bloc LaTeX
    /katex/,       // Classes KaTeX
    /math-/        // Classes de maths
  ];

  return mathIndicators.some(pattern => pattern.test(content));
}