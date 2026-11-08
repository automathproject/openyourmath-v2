// src/lib/widgets/kit.js
// Kit des figures interactives (widgets) d'OpenYourMath.
//
// Script autonome, sans module ni dépendance autre que KaTeX (facultatif) : la
// page /animation/<nom> l'intègre en ligne (voir widgets/page.js), et un
// diaporama ou une autre page peut le recopier de même, avec kit.css. Une figure
// s'enregistre par
//
//   OYMWidgets.define('nom', { title, intro, state, mount(root, { kit, state }) { … } })
//
// et s'affiche dans tout élément <div data-widget="nom">, dont les attributs
// data-* remplacent les valeurs de `state` (data-deg="45" donne state.deg = 45).
// Le kit fournit le repère SVG, les commandes, la mise en page et les couleurs ;
// le fichier de la figure ne contient que ses mathématiques, ses commandes et
// ses textes. Les formules s'écrivent \( … \) et \[ … \] : KaTeX les rend s'il
// est chargé, sinon elles restent en LaTeX.
//
// Le repère (Plot) et les commandes reprennent le noyau des diaporamas OPTRN
// (slides/_commun/kit.js), aux mêmes noms : une figure de diaporama se convertit
// sans réécrire son dessin.

(function (global) {
  'use strict';

  const doc = global.document;
  const SVGNS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  const DELIMITERS = [
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false },
  ];

  /** Rend les formules d'un élément, si KaTeX est là. */
  function math(el) {
    if (typeof global.renderMathInElement === 'function') {
      global.renderMathInElement(el, { delimiters: DELIMITERS, throwOnError: false });
    }
    return el;
  }

  function svg(tag, attrs, parent) {
    const e = doc.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  }

  /** Élément HTML ; `content` est du HTML dont les formules sont rendues. */
  function html(tag, attrs, parent, content) {
    const e = doc.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    if (content != null) put(e, content);
    return e;
  }

  /** Remplace le contenu d'un élément et rend ses formules. */
  function put(el, content) {
    el.innerHTML = content;
    return math(el);
  }

  const SUPERSCRIPTS = { '-': '⁻', '+': '', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

  /** Nombre à la française : virgule décimale, signe moins, notation scientifique hors de [1e-3, 1e5[. */
  function fmt(x, d = 3) {
    if (!Number.isFinite(x)) return x > 0 ? '+∞' : x < 0 ? '−∞' : '—';
    if ((x !== 0 && Math.abs(x) < 1e-3) || Math.abs(x) >= 1e5) {
      const [m, e] = x.toExponential(2).split('e');
      return m.replace('-', '−').replace('.', ',') + '·10' + [...e].map((c) => SUPERSCRIPTS[c]).join('');
    }
    return String(+x.toFixed(d)).replace('-', '−').replace('.', ',');
  }

  /** Nombre pour une formule TeX : virgule décimale « {,} ». */
  const tn = (x, d = 3) => fmt(x, d).replace(',', '{,}');

  // Pointes de flèche : nom → couleur (variables de kit.css).
  const HEADS = { ah: '--oym-accent', ahk: '--oym-ink', aht: '--oym-brand' };

  /**
   * Repère SVG : coordonnées « données » → pixels du viewBox, avec calques
   * découpés au cadre. La figure prend la largeur de son conteneur (au plus
   * `maxWidth` pixels) et garde ses proportions.
   */
  class Plot {
    constructor(parent, { w, h, x, y, margins, labels = [], ticks = {}, grid = true, zero = true, maxWidth, title }) {
      const m = { l: 44, r: 14, t: 14, b: 34, ...margins };
      Object.assign(this, { w, h, xr: x, yr: y, m, gs: {} });
      this.svg = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'plot', role: 'img' }, parent);
      if (title) this.svg.setAttribute('aria-label', title);
      if (maxWidth) this.svg.style.maxWidth = `${maxWidth}px`;
      this.id = `oym-clip${++uid}`;
      const defs = svg('defs', {}, this.svg);
      svg('rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: h - m.t - m.b }, svg('clipPath', { id: this.id }, defs));
      for (const [id, color] of Object.entries(HEADS)) {
        const marker = svg('marker', { id: this.id + id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
        svg('path', { d: 'M0,0 L10,5 L0,10 z', style: `fill:var(${color})` }, marker);
      }
      this.back = svg('g', {}, this.svg); // quadrillage et axes
      this.axes({ xt: ticks.x, yt: ticks.y, xl: labels[0], yl: labels[1], grid, zero });
    }

    X(x) {
      const m = this.m;
      return m.l + ((x - this.xr[0]) / (this.xr[1] - this.xr[0])) * (this.w - m.l - m.r);
    }

    Y(y) {
      const m = this.m;
      return this.h - m.b - ((y - this.yr[0]) / (this.yr[1] - this.yr[0])) * (this.h - m.t - m.b);
    }

    /** Position (en coordonnées données) d'un événement souris ou tactile. */
    at(ev) {
      const p = this.svg.createSVGPoint();
      p.x = ev.clientX;
      p.y = ev.clientY;
      const q = p.matrixTransform(this.svg.getScreenCTM().inverse());
      const m = this.m;
      return [
        this.xr[0] + ((q.x - m.l) / (this.w - m.l - m.r)) * (this.xr[1] - this.xr[0]),
        this.yr[0] + ((this.h - m.b - q.y) / (this.h - m.t - m.b)) * (this.yr[1] - this.yr[0]),
      ];
    }

    /** Calque nommé, vidé à chaque appel (clip : découpé au cadre du repère). */
    layer(name, clip = true) {
      let g = this.gs[name];
      if (!g) g = this.gs[name] = svg('g', clip ? { 'clip-path': `url(#${this.id})` } : {}, this.svg);
      g.replaceChildren();
      return g;
    }

    axes({ xt, yt, xl, yl, grid = true, zero = true } = {}) {
      const g = this.back;
      const m = this.m;
      g.replaceChildren();
      const [x0, x1] = this.xr;
      const [y0, y1] = this.yr;
      const ticks = (a, b) => {
        const out = [];
        const s = Math.pow(10, Math.floor(Math.log10((b - a) / 6)));
        const st = [1, 2, 5, 10].map((k) => k * s).find((k) => (b - a) / k <= 8);
        for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
        return out;
      };
      for (const v of xt || ticks(x0, x1)) {
        if (grid) svg('line', { x1: this.X(v), x2: this.X(v), y1: m.t, y2: this.h - m.b, class: 'grid' }, g);
        svg('text', { x: this.X(v), y: this.h - m.b + 17, 'text-anchor': 'middle', class: 'tick' }, g).textContent = fmt(v, 2);
      }
      for (const v of yt || ticks(y0, y1)) {
        if (grid) svg('line', { y1: this.Y(v), y2: this.Y(v), x1: m.l, x2: this.w - m.r, class: 'grid' }, g);
        svg('text', { x: m.l - 7, y: this.Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, g).textContent = fmt(v, 2);
      }
      svg('rect', { x: m.l, y: m.t, width: this.w - m.l - m.r, height: this.h - m.t - m.b, class: 'axis' }, g);
      if (zero) {
        if (x0 < 0 && x1 > 0) svg('line', { x1: this.X(0), x2: this.X(0), y1: m.t, y2: this.h - m.b, class: 'axis', opacity: 0.5 }, g);
        if (y0 < 0 && y1 > 0) svg('line', { y1: this.Y(0), y2: this.Y(0), x1: m.l, x2: this.w - m.r, class: 'axis', opacity: 0.5 }, g);
      }
      if (xl) this.label(g, this.w - m.r - 4, this.h - m.b - 16, xl, 'end');
      if (yl) this.label(g, m.l + 6, m.t + 14, yl, 'start');
    }

    /** Étiquette HTML (formules permises), position en pixels du viewBox. */
    label(g, px, py, s, anchor = 'start', cls = '') {
      const w = 300;
      const h = 30;
      const x = anchor === 'end' ? px - w : anchor === 'middle' ? px - w / 2 : px;
      const fo = svg('foreignObject', { x, y: py - h / 2, width: w, height: h }, g);
      const justify = anchor === 'end' ? 'flex-end' : anchor === 'middle' ? 'center' : 'flex-start';
      html('div', { class: `fo-in ${cls}`, style: `justify-content:${justify}` }, fo, `<span>${s}</span>`);
      return fo;
    }

    /** Étiquette en coordonnées données, décalée de (dx, dy) pixels. */
    math(g, x, y, s, cls = '', anchor = 'start', dx = 0, dy = 0) {
      return this.label(g, this.X(x) + dx, this.Y(y) + dy, s, anchor, cls);
    }

    /** Nouvelle plage (puis rappeler axes()). */
    range(xr, yr) {
      this.xr = xr;
      this.yr = yr;
    }

    /** Carte de couleur : une cellule par point d'une grille n×n, color(valeur) → couleur CSS. */
    heat(g, f, n, color) {
      const [x0, x1] = this.xr;
      const [y0, y1] = this.yr;
      const dx = (x1 - x0) / n;
      const dy = (y1 - y0) / n;
      const m = this.m;
      const wpx = (this.w - m.l - m.r) / n + 0.6;
      const hpx = (this.h - m.t - m.b) / n + 0.6;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const v = f(x0 + (i + 0.5) * dx, y0 + (j + 0.5) * dy);
          svg('rect', { x: this.X(x0 + i * dx).toFixed(1), y: (this.Y(y0 + (j + 1) * dy) - 0.3).toFixed(1), width: wpx.toFixed(1), height: hpx.toFixed(1), fill: color(v) }, g);
        }
      }
    }

    /** Ligne brisée par les points [[x, y], …] (coordonnées données). */
    poly(g, pts, cls = 'path') {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${this.X(p[0]).toFixed(1)} ${this.Y(p[1]).toFixed(1)}`).join('');
      return svg('path', { d, class: cls }, g);
    }

    /** Graphe de f sur [a, b], d'un seul tenant. */
    fn(g, f, a, b, n = 200, cls = 'curve') {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n;
        pts.push([x, f(x)]);
      }
      return this.poly(g, pts, cls);
    }

    /**
     * Graphe de f sur [a, b], coupé là où f n'est pas définie, part très loin
     * du cadre ou saute de plus d'une hauteur de cadre (asymptotes, sauts).
     */
    graph(g, f, a, b, { n = 400, cls = 'curve' } = {}) {
      const [y0, y1] = this.yr;
      const span = y1 - y0;
      const pieces = [];
      let piece = [];
      const cut = () => {
        if (piece.length > 1) pieces.push(piece);
        piece = [];
      };
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n;
        const v = f(x);
        if (!Number.isFinite(v) || v < y0 - 4 * span || v > y1 + 4 * span) {
          cut();
          continue;
        }
        if (piece.length && Math.abs(v - piece[piece.length - 1][1]) > span) cut();
        piece.push([x, v]);
      }
      cut();
      return pieces.map((p) => this.poly(g, p, cls));
    }

    dot(g, x, y, r = 6, cls = 'pt') {
      return svg('circle', { cx: this.X(x), cy: this.Y(y), r, class: cls }, g);
    }

    line(g, x1, y1, x2, y2, cls = 'ref') {
      return svg('line', { x1: this.X(x1), y1: this.Y(y1), x2: this.X(x2), y2: this.Y(y2), class: cls }, g);
    }

    /** Flèche ; head : 'aht' (vert d'eau), 'ah' (orange), 'ahk' (encre). */
    arrow(g, x1, y1, x2, y2, cls = 'gr', head = 'aht') {
      return svg('line', { x1: this.X(x1), y1: this.Y(y1), x2: this.X(x2), y2: this.Y(y2), class: cls, 'marker-end': `url(#${this.id}${head})` }, g);
    }

    text(g, x, y, s, cls = '', anchor = 'start', dx = 0, dy = 0) {
      const t = svg('text', { x: this.X(x) + dx, y: this.Y(y) + dy, 'text-anchor': anchor, class: cls, 'font-size': 16 }, g);
      t.textContent = s;
      return t;
    }

    /**
     * Lignes de niveau : segments de marching squares, un <path> par niveau.
     * skip(x0, y0, x1, y1) renvoie true pour ignorer une cellule (discontinuité de f).
     */
    contours(g, f, levels, n = 110, cls = 'lvl', skip = null) {
      const [x0, x1] = this.xr;
      const [y0, y1] = this.yr;
      const dx = (x1 - x0) / n;
      const dy = (y1 - y0) / n;
      const v = [];
      for (let j = 0; j <= n; j++) {
        const r = [];
        for (let i = 0; i <= n; i++) r.push(f(x0 + i * dx, y0 + j * dy));
        v.push(r);
      }
      for (const L of levels) {
        let d = '';
        const cut = (a, b, pa, pb) => {
          const t = (L - a) / (b - a);
          return [pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])];
        };
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const a = v[j][i];
            const b = v[j][i + 1];
            const c = v[j + 1][i + 1];
            const e = v[j + 1][i];
            const A = [x0 + i * dx, y0 + j * dy];
            const B = [x0 + (i + 1) * dx, y0 + j * dy];
            const C = [x0 + (i + 1) * dx, y0 + (j + 1) * dy];
            const D = [x0 + i * dx, y0 + (j + 1) * dy];
            if (skip && skip(A[0], A[1], C[0], C[1])) continue;
            const code = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (e > L ? 8 : 0);
            if (code === 0 || code === 15) continue;
            const bot = () => cut(a, b, A, B);
            const rig = () => cut(b, c, B, C);
            const top = () => cut(e, c, D, C);
            const lef = () => cut(a, e, A, D);
            const segments = {
              1: [[lef, bot]], 14: [[lef, bot]], 2: [[bot, rig]], 13: [[bot, rig]],
              3: [[lef, rig]], 12: [[lef, rig]], 4: [[rig, top]], 11: [[rig, top]],
              6: [[bot, top]], 9: [[bot, top]], 7: [[lef, top]], 8: [[lef, top]],
              5: [[lef, top], [bot, rig]], 10: [[lef, bot], [top, rig]],
            }[code];
            for (const [p, q] of segments.map(([s, t]) => [s(), t()])) {
              d += `M${this.X(p[0]).toFixed(1)} ${this.Y(p[1]).toFixed(1)}L${this.X(q[0]).toFixed(1)} ${this.Y(q[1]).toFixed(1)}`;
            }
          }
        }
        if (d) svg('path', { d, class: cls }, g);
      }
    }
  }

  // ---- Mise en page et commandes ------------------------------------------

  /**
   * Deux colonnes, dans les proportions `ratio`, empilées quand la figure a
   * moins de 720 pixels de large (kit.css). Renvoie [gauche, droite].
   */
  function columns(parent, { ratio = [1, 1] } = {}) {
    const box = html('div', { class: 'oym-cols', style: `--oym-cols:minmax(0,${ratio[0]}fr) minmax(0,${ratio[1]}fr)` }, parent);
    return [html('div', {}, box), html('div', {}, box)];
  }

  /** Rangée de commandes (column : les unes sous les autres). */
  function controls(parent, { column = false } = {}) {
    return html('div', { class: column ? 'oym-controls column' : 'oym-controls' }, parent);
  }

  /** Zone de lecture des valeurs, remplie par put(). */
  function output(parent) {
    return html('div', { class: 'oym-readout', 'aria-live': 'polite' }, parent);
  }

  /** Curseur avec sa valeur affichée : renvoie { el, input, set(v), value }. */
  function slider(parent, { label, min, max, step = 'any', value, onInput, show = (v) => fmt(v, 2) }) {
    const lab = html('label', {}, parent);
    html('span', {}, lab, label);
    const input = html('input', { type: 'range', min, max, step, value }, lab);
    const out = html('output', { class: 'oym-value' }, lab);
    const update = () => {
      out.textContent = show(+input.value);
    };
    input.addEventListener('input', () => {
      update();
      onInput(+input.value);
    });
    update();
    return {
      el: lab,
      input,
      set(v) {
        input.value = v;
        update();
      },
      get value() {
        return +input.value;
      },
    };
  }

  function button(parent, content, onClick, cls = 'oym-action') {
    const b = html('button', { type: 'button', class: cls }, parent, content);
    b.addEventListener('click', onClick);
    return b;
  }

  /** Boutons exclusifs : opts = [[valeur, contenu], …] ; renvoie { set(valeur) }. */
  function segmented(parent, opts, onPick) {
    const box = html('span', { class: 'oym-seg', role: 'group' }, parent);
    const buttons = {};
    const pick = (v) => {
      for (const k in buttons) {
        buttons[k].classList.toggle('on', k === String(v));
        buttons[k].setAttribute('aria-pressed', k === String(v));
      }
    };
    for (const [v, content] of opts) {
      buttons[v] = button(box, content, () => {
        pick(v);
        onPick(v);
      }, '');
    }
    return { set: pick };
  }

  const reducedMotion = Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /**
   * Lecture pas à pas, lancée par un bouton : start(tick) appelle tick() toutes
   * les `ms` jusqu'à ce qu'il renvoie false. Avec prefers-reduced-motion, le
   * rythme ralentit de moitié ; la lecture reste à la demande.
   */
  function ticker(ms = 550) {
    let timer = null;
    return {
      start(tick) {
        this.stop();
        timer = setInterval(() => {
          if (tick() === false) this.stop();
        }, reducedMotion ? 2 * ms : ms);
      },
      stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      },
      get on() {
        return timer !== null;
      },
    };
  }

  const kit = {
    svg, html, put, math, fmt, tn,
    plot: (parent, options) => new Plot(parent, options),
    Plot, columns, controls, output, slider, button, segmented, ticker, reducedMotion,
  };

  // ---- Enregistrement et affichage ----------------------------------------

  const registry = new Map();

  function define(name, spec) {
    registry.set(name, spec);
  }

  /** État initial : celui de la figure, remplacé par les attributs data-* de l'élément. */
  function readState(el, base) {
    const state = { ...base };
    for (const [key, raw] of Object.entries(el.dataset)) {
      if (key === 'widget') continue;
      const n = Number(raw);
      state[key] = raw.trim() !== '' && Number.isFinite(n) ? n : raw;
    }
    return state;
  }

  /** Affiche la figure nommée par data-widget dans `el` (une seule fois). */
  function mount(el) {
    if (el.oymWidget) return el.oymWidget;
    const name = el.dataset.widget;
    const spec = registry.get(name);
    if (!spec) {
      el.textContent = `Figure « ${name} » introuvable.`;
      return null;
    }
    el.classList.add('oym-widget');
    el.replaceChildren();
    if (spec.title) el.setAttribute('aria-label', spec.title);
    if (spec.intro) html('div', { class: 'oym-intro' }, el, spec.intro);
    const body = html('div', { class: 'oym-body' }, el);
    el.oymWidget = spec.mount(body, { kit, state: readState(el, spec.state), root: el }) || {};
    return el.oymWidget;
  }

  function mountAll(scope = doc) {
    scope.querySelectorAll('[data-widget]').forEach(mount);
  }

  /**
   * Page d'une seule figure (/animation/<nom>) : affiche la figure quand KaTeX
   * est chargé, puis signale sa hauteur à la page qui l'embarque.
   */
  function page() {
    const start = () => {
      mountAll();
      const first = doc.querySelector('[data-widget]');
      const spec = first && registry.get(first.dataset.widget);
      if (spec && spec.title) doc.title = spec.title;
      if (global.parent === global) return;
      const report = () => {
        const height = Math.ceil(doc.documentElement.getBoundingClientRect().height);
        global.parent.postMessage({ oym: 'animation-size', height }, '*');
      };
      new ResizeObserver(report).observe(doc.body);
      report();
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
    else start();
  }

  global.OYMWidgets = { version: 1, define, mount, mountAll, page, kit };
})(globalThis);
