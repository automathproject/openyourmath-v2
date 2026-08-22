// src/lib/actions/autoResize.js
// Action Svelte : redimensionne automatiquement un <textarea> à son contenu
// (jusqu'à une hauteur maximale), pour éviter la barre de défilement interne.

/** @param {HTMLTextAreaElement} node */
export function autoResize(node) {
  const resize = () => {
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight + 2, 480)}px`;
  };
  node.addEventListener('input', resize);
  resize();
  return { destroy: () => node.removeEventListener('input', resize) };
}
