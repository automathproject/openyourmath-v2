// src/lib/actions/animationFrames.js
// Transforme les emplacements d'animation d'un exercice (voir lib/animations.js)
// en lecteurs : une vignette avec un bouton, qui n'ouvre l'iframe, donc ne
// charge la page de l'animation, qu'à la demande.
//
// L'iframe est isolée (sandbox sans allow-same-origin) : la page de l'animation
// ne peut pas lire la nôtre. Elle ne peut que lui signaler sa hauteur par
// postMessage, que l'on accepte uniquement de cette iframe.

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 1400;
const INITIAL_HEIGHT = 440;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function openPlayer(host, name, caption) {
  const frame = element('iframe', 'oym-animation__frame');
  frame.src = `/animation/${encodeURIComponent(name)}`;
  frame.title = caption;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.style.height = `${INITIAL_HEIGHT}px`;

  const onMessage = (event) => {
    if (event.source !== frame.contentWindow || event.data?.oym !== 'animation-size') return;
    const height = Number(event.data.height);
    if (Number.isFinite(height)) {
      frame.style.height = `${Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height))}px`;
    }
  };
  window.addEventListener('message', onMessage);

  const bar = element('div', 'oym-animation__bar');
  const fullscreen = element('button', 'oym-animation__action', 'Plein écran');
  fullscreen.type = 'button';
  fullscreen.addEventListener('click', () => frame.requestFullscreen?.());
  const standalone = element('a', 'oym-animation__action', 'Ouvrir seule');
  standalone.href = `/animation/${encodeURIComponent(name)}`;
  standalone.target = '_blank';
  standalone.rel = 'noopener';
  bar.append(fullscreen, standalone);

  host.replaceChildren(frame, bar, element('figcaption', 'oym-animation__caption', caption));
  host.classList.add('oym-animation--open');
  // L'emplacement quitte le document avec son contenu : on retire l'écouteur.
  const observer = new MutationObserver(() => {
    if (!host.isConnected) {
      window.removeEventListener('message', onMessage);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Rend interactifs les emplacements d'animation sous `root`, une seule fois chacun. */
export function mountAnimations(root) {
  if (!root) return;
  for (const host of root.querySelectorAll('.oym-animation[data-animation]:not([data-enhanced])')) {
    host.dataset.enhanced = '';
    const name = host.dataset.animation;
    const caption = host.dataset.caption || 'Animation interactive';

    const play = element('button', 'oym-animation__play');
    play.type = 'button';
    play.append(element('span', 'oym-animation__icon', '▶\uFE0E'));
    const label = element('span', 'oym-animation__label');
    label.append(element('strong', null, 'Animation interactive'), element('span', null, caption));
    play.append(label);
    play.addEventListener('click', () => openPlayer(host, name, caption));
    host.replaceChildren(play);

    // L'image fixe de l'animation, quand la source en donne une, sert de
    // vignette : un clic dessus ouvre aussi l'animation. Elle double la légende,
    // d'où un texte alternatif vide.
    if (host.dataset.poster) {
      const poster = element('img', 'oym-animation__poster');
      poster.src = host.dataset.poster;
      poster.alt = '';
      poster.loading = 'lazy';
      poster.decoding = 'async';
      poster.addEventListener('click', () => openPlayer(host, name, caption));
      host.prepend(poster);
    }
  }
}
