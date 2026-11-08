// src/lib/widgets/page.js
// Page autonome d'une figure interactive, servie par /animation/<nom> : le kit
// (kit.js, kit.css) et le fichier de la figure, intégrés en ligne, plus KaTeX
// servi par /animation-vendor. La figure s'affiche dans <div data-widget="nom">.

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

/** Nom déclaré par OYMWidgets.define('nom', …) dans le fichier d'une figure. */
export function definedWidgetNames(source) {
  return [...String(source).matchAll(/OYMWidgets\.define\(\s*(['"])([^'"]*)\1/g)].map((match) => match[2]);
}
