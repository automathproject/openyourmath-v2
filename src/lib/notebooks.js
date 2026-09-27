// src/lib/notebooks.js
// Notebooks Jupyter associés aux exercices.
//
// Exercices (github.com/smaxx73/Exercices), source des exercices amscc,
// archive ses notebooks dans son dossier notebook/ ; \insertnotebook{nom} y
// renvoie par un lien, comme le définit son préambule (\pathnotebook). Le
// parseur, pour le HTML du site, et l'export LaTeX construisent ce lien à partir
// de cette seule adresse.

export const NOTEBOOK_BASE_URL = 'https://github.com/smaxx73/Exercices/blob/main/notebook/';
export const NOTEBOOK_LINK_LABEL = 'Lien vers le notebook';

/** Adresse du notebook archivé sous ce nom, extension .ipynb exclue. */
export function notebookUrl(name) {
  return `${NOTEBOOK_BASE_URL}${encodeURIComponent(String(name).trim())}.ipynb`;
}

/** Remplace chaque \insertnotebook{nom} par le lien \href équivalent. */
export function expandInsertNotebook(latex) {
  return String(latex || '').replace(
    /\\insertnotebook\s*\{([^}]+)\}/g,
    (_, name) => `\\href{${notebookUrl(name)}}{${NOTEBOOK_LINK_LABEL}}`,
  );
}
