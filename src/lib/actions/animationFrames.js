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
// Hauteur du code d'intégration : hors du site, la figure ne transmet pas la sienne.
const EMBED_HEIGHT = 700;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function escapeAttribute(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Code HTML qui intègre l'animation `name` du site `origin` dans un autre document. */
export function embedCode(origin, name, caption) {
  return `<iframe src="${escapeAttribute(`${origin}/animation/${encodeURIComponent(name)}`)}" ` +
    `title="${escapeAttribute(caption)}" style="width:100%; height:${EMBED_HEIGHT}px; border:0"></iframe>`;
}

// Copie le code d'intégration ; si le presse-papiers est refusé, l'affiche dans
// un champ déjà sélectionné, sous la barre.
function embedButton(host, name, caption) {
  const button = element('button', 'oym-animation__action', 'Intégrer');
  button.type = 'button';
  button.title = 'Copier le code HTML pour intégrer cette animation dans un autre document';
  const status = element('span', 'oym-animation__status');
  status.setAttribute('role', 'status');
  let timer;
  button.addEventListener('click', async () => {
    const code = embedCode(window.location.origin, name, caption);
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = 'Code copié';
      clearTimeout(timer);
      timer = setTimeout(() => { status.textContent = ''; }, 2500);
    } catch {
      let field = host.querySelector('.oym-animation__embed');
      if (!field) {
        field = element('textarea', 'oym-animation__embed');
        field.readOnly = true;
        field.rows = 3;
        field.setAttribute('aria-label', "Code d'intégration de l'animation");
        host.querySelector('.oym-animation__bar').after(field);
      }
      field.value = code;
      field.focus();
      field.select();
      status.textContent = 'Copiez le code ci-dessous';
    }
  });
  return [status, button];
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
  bar.append(...embedButton(host, name, caption), fullscreen, standalone);

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
