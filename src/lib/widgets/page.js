// src/lib/widgets/page.js
// Page autonome d'une figure interactive, servie par /animation/<nom> : le kit
// (kit.js, kit.css) et le fichier de la figure, intégrés en ligne, plus KaTeX
// servi par /animation-vendor. La figure s'affiche dans <div data-widget="nom">.

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
</style></head>
<body><div data-widget="${name}"></div>
${inlineScript(kitScript)}
${inlineScript(widgetScript)}
${inlineScript('OYMWidgets.page();')}
</body></html>
`;
}
