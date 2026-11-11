// src/lib/widgets/page.js
// Page autonome d'une figure interactive, servie par /animation/<nom> : le kit
// (kit.js, kit.css) et le fichier de la figure, intégrés en ligne, plus KaTeX
// servi par /animation-vendor. La figure s'affiche dans <div data-widget="nom">.
// Ouverte seule (pas dans une iframe), la page ajoute sous la figure un bouton
// qui copie son code d'intégration.

// Politique de sécurité de la page. Le fichier d'une figure est du JavaScript
// arbitraire : « sandbox » sans « allow-same-origin » le fait tourner dans une
// origine opaque, sans accès aux cookies ni à la page qui l'embarque. Pas de
// frame-ancestors : tout document peut intégrer la figure en iframe (CodiMD,
// diaporama HTML, fichier ouvert en file://, que « * » exclurait).
export const WIDGET_CSP = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  'img-src data:',
].join('; ');

/** Code JavaScript placé dans un <script> en ligne : « </script » le fermerait. */
function inlineScript(code) {
  return `<script>\n${String(code).replace(/<\/(script)/gi, '<\\/$1')}\n</script>`;
}

// Barre de la page ouverte seule. Le code produit est celui de embedCode
// (lib/actions/animationFrames.js) : tests/build/widgets-render.test.js compare
// les deux. Le titre est celui que OYMWidgets.page() donne au document.
const EMBED_BAR = `
<div class="oym-widget oym-page-bar" hidden><span class="oym-page-bar__status" role="status"></span><button type="button" class="oym-action" title="Copier le code HTML pour intégrer cette animation dans un autre document">Intégrer</button></div>`;

const EMBED_SCRIPT = `(() => {
  if (window.parent !== window) return;
  const bar = document.querySelector('.oym-page-bar');
  const status = bar.querySelector('.oym-page-bar__status');
  const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let timer;
  bar.hidden = false;
  bar.querySelector('button').addEventListener('click', async () => {
    const name = document.querySelector('[data-widget]').dataset.widget;
    const code = '<iframe src="' + escape(location.origin + '/animation/' + encodeURIComponent(name)) + '" ' +
      'title="' + escape(document.title) + '" style="width:100%; height:700px; border:0"></iframe>';
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = 'Code copié';
      clearTimeout(timer);
      timer = setTimeout(() => { status.textContent = ''; }, 2500);
    } catch {
      let field = document.querySelector('.oym-page-bar__code');
      if (!field) {
        field = document.createElement('textarea');
        field.className = 'oym-page-bar__code';
        field.readOnly = true;
        field.rows = 3;
        field.setAttribute('aria-label', "Code d'intégration de l'animation");
        bar.after(field);
      }
      field.value = code;
      field.focus();
      field.select();
      status.textContent = 'Copiez le code ci-dessous';
    }
  });
})();`;

/**
 * @param {{ name: string, kitScript: string, kitStyle: string, widgetScript: string }} parts
 *   name doit déjà respecter ANIMATION_NAME (aucun échappement ici).
 * @returns {string} le HTML de la page
 */
export function widgetPage({ name, kitScript, kitStyle, widgetScript }) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<link rel="stylesheet" href="/animation-vendor/katex/katex.min.css">
<script defer src="/animation-vendor/katex/katex.min.js"></script>
<script defer src="/animation-vendor/katex/contrib/auto-render.min.js"></script>
<style>
${kitStyle}
html, body { margin: 0; background: #fffdf8; }
body { padding: 12px 16px; }
.oym-page-bar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 16px; }
.oym-page-bar[hidden] { display: none; }
.oym-page-bar__status { color: var(--oym-brand-text); }
.oym-page-bar__code { display: block; box-sizing: border-box; width: 100%; margin-top: 8px; padding: 6px 8px;
  border: 1px solid #ead9b8; border-radius: 6px; font: 13px/1.4 monospace; color: #0d3c4d; resize: vertical; }
</style></head>
<body><div data-widget="${name}"></div>${EMBED_BAR}
${inlineScript(kitScript)}
${inlineScript(widgetScript)}
${inlineScript('OYMWidgets.page();')}
${inlineScript(EMBED_SCRIPT)}
</body></html>
`;
}
