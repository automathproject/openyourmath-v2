// src/lib/actions/figureViewer.js
// Visionneuse des figures d'un exercice : un clic (ou Entrée) ouvre la figure
// dans une boîte modale où l'on zoome à la molette ou en pinçant, où l'on se
// déplace en glissant, et où un double clic alterne entre vue d'ensemble et gros plan.
//
// La figure est affichée sur le papier du site (fond clair) : les tracés TikZ
// sont noirs sur transparent et disparaîtraient sur le fond sombre de la boîte.

const SELECTOR = 'img.includegraphics-image, img.tikz-svg-image';
const FIT_MARGIN = 0.94; // part de la zone occupée par la vue d'ensemble
const CLICK_SLOP = 6; // déplacement (px) en deçà duquel un appui reste un clic
const ZOOM_STEP = 1.5;
const DOUBLE_CLICK_ZOOM = 2.5; // gros plan, en multiple de la vue d'ensemble

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(label, text, onClick) {
  const node = element('button', 'oym-viewer__button', text);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.title = label;
  node.addEventListener('click', onClick);
  return node;
}

function openViewer(source) {
  // Un seul visionneur à la fois : un clic reçu deux fois ne doit pas en empiler deux.
  if (document.querySelector('dialog.oym-viewer')) return;
  const isVector = /\.svg(\?|$)/i.test(source.currentSrc || source.src);
  const dialog = element('dialog', 'oym-viewer');
  dialog.setAttribute('aria-label', source.alt || 'Figure agrandie');
  const stage = element('div', 'oym-viewer__stage');
  const image = element('img', 'oym-viewer__image');
  image.alt = source.alt || '';
  image.draggable = false;
  image.src = source.currentSrc || source.src;

  const readout = element('span', 'oym-viewer__readout');
  readout.setAttribute('aria-live', 'polite');

  // Image : taille naturelle (en px CSS) ; la vue en est l'échelle `scale` et le décalage (x, y) du centre.
  let natural = { width: 0, height: 0 };
  let scale = 1;
  let x = 0;
  let y = 0;
  let fit = 1;

  const bounds = () => stage.getBoundingClientRect();
  const maxScale = () => Math.max(fit * 1.5, isVector ? 16 : 4);

  function clampPan() {
    const { width, height } = bounds();
    const overflowX = Math.max(0, (natural.width * scale - width) / 2);
    const overflowY = Math.max(0, (natural.height * scale - height) / 2);
    x = Math.min(overflowX, Math.max(-overflowX, x));
    y = Math.min(overflowY, Math.max(-overflowY, y));
  }

  function apply() {
    clampPan();
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    readout.textContent = `${Math.round((scale / fit) * 100)} %`;
  }

  /** Change l'échelle en gardant fixe le point (px, py), mesuré depuis le centre de la zone. */
  function zoomTo(next, px = 0, py = 0) {
    const target = Math.min(maxScale(), Math.max(fit * 0.5, next));
    const ratio = target / scale;
    x = px - (px - x) * ratio;
    y = py - (py - y) * ratio;
    scale = target;
    apply();
  }

  function fitToStage() {
    const { width, height } = bounds();
    // Une figure vectorielle peut être agrandie sans perte ; un bitmap, au plus du double.
    const limit = isVector ? 4 : 2;
    fit = Math.min((width * FIT_MARGIN) / natural.width, (height * FIT_MARGIN) / natural.height, limit);
    scale = fit;
    x = 0;
    y = 0;
    apply();
  }

  function layout() {
    natural = {
      width: image.naturalWidth || Number(source.getAttribute('width')) || 800,
      height: image.naturalHeight || Number(source.getAttribute('height')) || 600,
    };
    image.style.width = `${natural.width}px`;
    image.style.height = `${natural.height}px`;
    image.style.margin = `${-natural.height / 2}px 0 0 ${-natural.width / 2}px`;
    fitToStage();
  }

  const centerOffset = (clientX, clientY) => {
    const rect = bounds();
    return [clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2];
  };

  // Un doigt ou la souris déplacent ; deux doigts pincent.
  const pointers = new Map();
  let pinchDistance = 0;
  let travelled = 0;
  let pressedBackdrop = false;
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  stage.addEventListener('pointerdown', (event) => {
    // Une souris n'a qu'un pointeur : tout autre est un reste.
    if (event.pointerType === 'mouse') pointers.clear();
    // La capture fait de la zone la cible de toute la suite du geste : on retient ici ce qui a été touché.
    if (pointers.size === 0) pressedBackdrop = event.target === stage;
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // geste déjà terminé : le suivi par la zone suffit
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) travelled = 0;
    if (pointers.size === 2) pinchDistance = distance();
  });
  stage.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, current);
    travelled += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    if (pointers.size === 1) {
      x += current.x - previous.x;
      y += current.y - previous.y;
      apply();
    } else if (pointers.size === 2 && pinchDistance > 0) {
      const [a, b] = [...pointers.values()];
      const next = distance();
      zoomTo(scale * (next / pinchDistance), ...centerOffset((a.x + b.x) / 2, (a.y + b.y) / 2));
      pinchDistance = next;
    }
  });
  const release = (event) => {
    const wasAlone = pointers.size === 1;
    pointers.delete(event.pointerId);
    pinchDistance = 0;
    // Un appui qui n'a pas bougé sur le fond referme la boîte.
    if (wasAlone && event.type === 'pointerup' && travelled < CLICK_SLOP && pressedBackdrop) dialog.close();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // Un geste dont la fin n'a pas été reçue ne doit pas rester compté comme un doigt posé.
  stage.addEventListener('lostpointercapture', (event) => {
    pointers.delete(event.pointerId);
    pinchDistance = 0;
  });

  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomTo(scale * Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0015)), ...centerOffset(event.clientX, event.clientY));
    },
    { passive: false },
  );

  stage.addEventListener('dblclick', (event) => {
    const [px, py] = centerOffset(event.clientX, event.clientY);
    zoomTo(scale > fit * 1.05 ? fit : fit * DOUBLE_CLICK_ZOOM, px, py);
    if (scale <= fit * 1.05) {
      x = 0;
      y = 0;
      apply();
    }
  });

  dialog.addEventListener('keydown', (event) => {
    const pan = 60;
    if (event.key === '+' || event.key === '=') zoomTo(scale * ZOOM_STEP);
    else if (event.key === '-') zoomTo(scale / ZOOM_STEP);
    else if (event.key === '0') fitToStage();
    else if (event.key === 'ArrowLeft') ((x += pan), apply());
    else if (event.key === 'ArrowRight') ((x -= pan), apply());
    else if (event.key === 'ArrowUp') ((y += pan), apply());
    else if (event.key === 'ArrowDown') ((y -= pan), apply());
    else return;
    event.preventDefault();
  });

  const toolbar = element('div', 'oym-viewer__toolbar');
  toolbar.append(
    button('Zoom arrière', '−', () => zoomTo(scale / ZOOM_STEP)),
    readout,
    button('Zoom avant', '+', () => zoomTo(scale * ZOOM_STEP)),
    button("Ajuster à l'écran", 'Ajuster', fitToStage),
    button('Fermer', '✕', () => dialog.close()),
  );

  stage.append(image);
  dialog.append(stage, toolbar);
  document.body.append(dialog);

  const onResize = () => {
    // La vue d'ensemble est recalculée pour la nouvelle taille ; le grossissement relatif est conservé.
    const relative = scale / fit;
    layout();
    if (relative > 1.0001) zoomTo(fit * relative);
  };
  window.addEventListener('resize', onResize);
  dialog.addEventListener('close', () => {
    window.removeEventListener('resize', onResize);
    dialog.remove();
    source.focus({ preventScroll: true });
  });

  dialog.showModal();
  if (image.complete && image.naturalWidth) layout();
  else image.addEventListener('load', layout, { once: true });
  // Sans dimensions (SVG sans width ni viewBox) le chargement peut ne jamais renseigner naturalWidth.
  image.addEventListener('error', layout, { once: true });
  dialog.querySelector('.oym-viewer__button:last-child')?.focus({ preventScroll: true });
}

/** Rend agrandissables les figures sous `root`, une seule fois chacune. */
export function mountFigureViewer(root) {
  if (!root) return;
  for (const image of root.querySelectorAll(`${SELECTOR}:not([data-viewer])`)) {
    image.dataset.viewer = '';
    image.classList.add('oym-figure-zoomable');
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-haspopup', 'dialog');
    image.setAttribute('aria-label', `Agrandir la figure${image.alt ? ` : ${image.alt}` : ''}`);
    image.addEventListener('click', () => openViewer(image));
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openViewer(image);
      }
    });
  }
}
