#!/usr/bin/env node
// Extrait une figure d'un diaporama OPTRN en une page autonome, à déposer dans
// le dossier animations/ du dépôt d'édition des exercices (Exercices pour AMSCC),
// d'où elle rejoint exobase puis content/animations/<source>/<nom>.html par les
// synchronisations, comme un extrait Python (voir src/lib/animations.js).
//
//   node scripts/extract-animation.js --deck ../../cours/cours-OPTRN/slides/td1-s1-fonctions \
//     --widget directionnelle --name ebva-directionnelle --out ../../exercices/Exercices/animations
//
// Un diaporama (voir slides/README.md du cours) range ses figures dans widgets.js,
// enregistrées dans W[nom] et appelées par <div data-w="nom"> ; le noyau commun
// (kit.js) et la feuille de style du gabarit sont partagés. La page produite
// réunit ce qu'il faut pour une seule figure, en pleine largeur et sans la
// mise en page 1280×720 de la slide : elle est réduite pour tenir dans son cadre
// et signale sa hauteur à la page qui l'embarque.
//
// KaTeX est chargé depuis /animation-vendor/katex, la copie du site, et non
// depuis un CDN : la page tourne sans origine (voir routes/animation).

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ANIMATION_NAME } from '../src/lib/animations.js';

const NATURAL_WIDTH = 1160;

// Charte d'OpenYourMath (src/app.css, @theme) à la place de celle des diaporamas.
// Les couleurs des diaporamas sont remplacées partout où elles apparaissent : la
// feuille de style, mais aussi le noyau (pointes de flèche) et les figures
// (cartes de couleurs en rgba). Une seule table, donc une seule chose à relire.
export const OYM_PALETTE = {
  '#142b3a': '#0d3c4d', // encre            -> interface-text-primary
  '#59717b': '#557583', // gris des légendes -> proche de text-muted, relevé pour tenir 4,5:1
  '#087f81': '#3a8f8f', // vert d'eau        -> brand-600
  '#e3f0ef': '#f0fafa', // fond vert d'eau   -> brand-50
  '#b96c23': '#b85d3f', // orange            -> accent-600
  '#f8ecdf': '#fbf0eb', // fond orange       -> accent-50
  '#fafaf5': '#fffdf8', // papier            -> fond de la colonne de lecture
  '#cddbdc': '#ead9b8', // filets            -> interface-border-primary
  '#a93232': '#a3322f', // rouge             -> error-600
  '#e5efed': '#e3f5f5', // survol des boutons
  '#f1f7f6': '#f0fafa',
  '#fbeeee': '#fbeeec',
  '#e6eeee': '#efe7d3', // quadrillage chaud, comme les filets du site
  '#9cbfc0': '#8fcaca', // lignes de niveau
  '#dbe8e8': '#efe7d3',
  'rgba(8,127,129,': 'rgba(58,143,143,',
  'rgba(185,108,35,': 'rgba(184,93,63,',
};

const SITE_FONT = '"Source Sans Pro",sans-serif'; // --font-primary du site

/** Remplace la palette et la police des diaporamas par celles du site. */
export function applyOymTheme(text) {
  let themed = text;
  for (const [from, to] of Object.entries(OYM_PALETTE)) {
    themed = themed.replace(new RegExp(from.replace(/[()]/g, '\\$&'), 'gi'), to);
  }
  return themed.replace(/"Noto Sans","Segoe UI",Arial,sans-serif/g, SITE_FONT);
}

// Ce que la palette seule ne règle pas : le texte teinté, qui exige un ton plus
// foncé que les traits (brand-700 et accent-700 tiennent 6:1, brand-600 3,8:1), et
// l'habillage des cartes et des boutons du site (coins de 8 px, ombre légère).
const OYM_OVERRIDES = `
:root{--teal-text:#2b6b6b;--orange-text:#964a32}
.em,.ro .ok,.box h3,.action:not(.on),.seg button:not(.on),.eyebrow{color:var(--teal-text)}
.warn,.ro .wr,.box.o h3{color:var(--orange-text)}
svg.plot text.t{fill:var(--teal-text)}svg.plot text.o{fill:var(--orange-text)}
svg.plot{border-radius:8px;box-shadow:0 2px 8px rgba(13,60,77,.08),0 1px 2px rgba(13,60,77,.04)}
.action,.seg,.box,.controls input[type=text],.controls select{border-radius:8px}
.status{border-radius:0 8px 8px 0}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline-color:var(--teal)}`;

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const read = (file) => fs.readFileSync(file, 'utf8');

/** Texte d'introduction (<template>) que la slide place dans le <div data-w>. */
export function findWidgetIntro(slideSources, widget) {
  const pattern = new RegExp(
    String.raw`<div\s+data-w="${widget}"[^>]*>\s*(<template>[\s\S]*?</template>)?\s*</div>`,
  );
  for (const source of slideSources) {
    const match = pattern.exec(source);
    if (match) return match[1] ?? '';
  }
  return null;
}

/** Assemble la page autonome d'une figure. */
export function buildAnimationPage({ title, widget, intro, css, kit, widgets, source }) {
  return `<!DOCTYPE html>
<!-- Généré par scripts/extract-animation.js (${source}, figure « ${widget} »). Ne pas modifier à la main : régénérer. -->
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/animation-vendor/katex/katex.min.css"/>
<script defer src="/animation-vendor/katex/katex.min.js"></script>
<script defer src="/animation-vendor/katex/contrib/auto-render.min.js"></script>
<style>
${css}
/* page autonome : la figure remplace la slide, réduite pour tenir dans son cadre */
html,body{height:auto;background:#fffdf8;overflow:hidden}
#stage{overflow:hidden;position:relative}
#inner.slide{display:block;position:relative;inset:auto;width:${NATURAL_WIDTH}px;height:auto;padding:12px 16px;overflow:visible;background:transparent;transform-origin:top left}
${OYM_OVERRIDES}
</style></head><body>
<div id="stage"><section class="slide active" id="inner">
<div data-w="${widget}">${intro}</div>
</section></div>
<script>
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const W={};
// Formules : \\( … \\) en ligne, \\[ … \\] en bloc, rendues par KaTeX une fois chargé.
function rm(el){
  if(!window.renderMathInElement)return;
  renderMathInElement(el||document.body,{delimiters:[{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false}],throwOnError:false})}
window.addEventListener('load',()=>{rm(document.body);fit()});
${kit}
${widgets}
// Mise à l'échelle dans la largeur disponible, et hauteur signalée à la page parente.
const NATURAL=${NATURAL_WIDTH},inner=$('#inner'),stage=$('#stage');
function fit(){
  const k=Math.min(2,document.documentElement.clientWidth/NATURAL);
  inner.style.transform='scale('+k+')';
  const h=Math.ceil(inner.offsetHeight*k);
  stage.style.height=h+'px';
  parent.postMessage({oym:'animation-size',height:h},'*')}
const el=$('[data-w]');W[el.dataset.w](el);
new ResizeObserver(fit).observe(inner);window.addEventListener('resize',fit);fit();
</script></body></html>
`;
}

function main() {
  const { values } = parseArgs({
    options: {
      deck: { type: 'string' },
      widget: { type: 'string' },
      name: { type: 'string' },
      title: { type: 'string' },
      out: { type: 'string' },
    },
  });
  if (!values.deck || !values.widget || !values.name || !values.out) {
    console.error('Usage : node scripts/extract-animation.js --deck <dossier du diaporama> --widget <nom> --name <nom de l\'animation> --out <dossier animations/> [--title <titre>]');
    process.exit(1);
  }
  if (!ANIMATION_NAME.test(values.name)) {
    console.error(`Nom d'animation invalide : « ${values.name} » (lettres, chiffres, - et _).`);
    process.exit(1);
  }

  const deck = path.resolve(values.deck);
  const common = path.join(deck, '..', '_commun');
  const template = read(path.join(common, 'template.html'));
  const css = /<style>([\s\S]*?)<\/style>/.exec(template)?.[1];
  if (!css) throw new Error('Feuille de style introuvable dans _commun/template.html');

  const widgets = read(path.join(deck, 'widgets.js'));
  if (!new RegExp(String.raw`W\.${values.widget}\s*=`).test(widgets)) {
    console.error(`La figure « ${values.widget} » n'est pas enregistrée dans ${path.join(deck, 'widgets.js')}.`);
    process.exit(1);
  }
  const slides = fs.readdirSync(path.join(deck, 'src')).filter((f) => /^s.*\.html$/.test(f)).sort()
    .map((f) => read(path.join(deck, 'src', f)));
  const intro = findWidgetIntro(slides, values.widget);
  if (intro === null) {
    console.error(`Aucune slide n'appelle <div data-w="${values.widget}">.`);
    process.exit(1);
  }

  const page = buildAnimationPage({
    title: values.title ?? values.name,
    widget: values.widget,
    intro,
    css: applyOymTheme(css.replace(/@media print\{[\s\S]*?\n\}\n/, '')),
    kit: applyOymTheme(read(path.join(common, 'kit.js'))),
    widgets: applyOymTheme(widgets),
    source: path.basename(deck),
  });
  // --out désigne le dossier, ou directement le fichier <nom>.html.
  const out = values.out.endsWith('.html')
    ? path.resolve(values.out)
    : path.join(path.resolve(values.out), `${values.name}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  console.log(`${out} : ${Math.round(page.length / 1024)} Kio`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
