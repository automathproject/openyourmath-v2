/**
 * Formules en ligne qui ne peuvent pas se replier.
 *
 * KaTeX, comme TeX, ne coupe une formule en ligne qu'après une relation ou un
 * opérateur binaire. Une longue liste à virgules, un groupe \left…\right ou un
 * \text{…} de plusieurs mots forment donc un bloc insécable : sur un écran de
 * téléphone il dépasse de la colonne et élargit la page.
 *
 * Ce module repère ces formules (alerte de check-exercise-sources.js) et en
 * réécrit trois familles de façon mécanique (correcteur déterministe) :
 *   - comma-list : « \allowbreak » après les virgules de premier niveau ;
 *   - long-text  : un \text{mot } par mot, séparés par « \allowbreak ».
 * Un troisième motif, left-right, se réécrit en \bigl…\bigr (\Bigl…\Bigr si le
 * contenu est haut), mais seulement sur demande (`leftRight: true`) : \left( est
 * le choix par défaut des auteurs, et \bigl fixe la taille des délimiteurs.
 * Les autres motifs (hskip-layout, inline-array) demandent de repenser la
 * formule : ils sont signalés, jamais réécrits.
 *
 * Le module repère aussi, en formule affichée, les enchaînements de relations
 * (a = b = c ⇒ …) qu'un align* logerait : alerte seule, jamais réécrits (relation-chain).
 *
 * `\allowbreak`, `\bigl` et `\text` sont du LaTeX standard (amsmath) : le PDF
 * n'est pas modifié là où la formule tient déjà sur la ligne.
 */

const MAX_INLINE_LENGTH = 3000;

// Seuils réglés sur la largeur réelle (KaTeX, colonne de 300 px) des 12 204
// formules en ligne de 45 caractères et plus du corpus : 186 y débordent. La
// longueur de la source prédit mal la largeur (une macro de 10 caractères est un
// seul symbole) ; la longueur « visible » du plus long bloc insécable est le
// meilleur indice disponible sans moteur de rendu : au-delà de 60 caractères,
// une formule sur deux déborde.
/** Longueur visible du plus long bloc insécable, au-delà de laquelle on alerte. */
export const UNBREAKABLE_MIN_VISIBLE = 60;
/** Une liste à virgules (insécable à moins d'un \allowbreak) pèse moins : seuil plus bas, la réécriture est inoffensive. */
export const COMMA_LIST_MIN_VISIBLE = 35;
/** Nombre minimal de virgules de premier niveau d'une « liste » à virgules. */
export const COMMA_LIST_MIN_COMMAS = 3;
/** Longueur visible minimale d'un groupe \left…\right pour le réécrire. */
export const LEFT_RIGHT_MIN_VISIBLE = 30;
/** Longueur minimale d'un \text{…} de plusieurs mots pour le couper. */
export const LONG_TEXT_MIN_LENGTH = 35;

const TEXT_COMMANDS = 'text|textrm|textit|textbf|mbox';
const TALL_CONTENT = /\\(?:frac|dfrac|tfrac|binom|dbinom|sum|prod|int|iint|oint|sqrt|begin|bigcup|bigcap|lim|overline|underline|widehat)\b/;

// ---- Repérage des formules en ligne ----

/** Remplace par des espaces ce qui n'est pas du LaTeX à analyser (positions conservées). */
function blankNonMath(source) {
  const blank = text => text.replace(/[^\n]/g, ' ');
  let clean = '';
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '%') {
      let slashes = 0;
      for (let k = i - 1; k >= 0 && source[k] === '\\'; k--) slashes++;
      if (slashes % 2 === 0) {
        let end = source.indexOf('\n', i);
        if (end === -1) end = source.length;
        clean += blank(source.slice(i, end));
        i = end - 1;
        continue;
      }
    }
    clean += source[i];
  }
  return clean
    .replace(/\\begin\{(verbatim\*?|Verbatim|SaveVerbatim|lstlisting|Piton)\}[\s\S]*?\\end\{\1\}/g, blank)
    .replace(/\\verb\*?(.)[^\n]*?\1/g, blank);
}

/**
 * Formules en ligne (`$…$` et `\(…\)`) d'une source, hors `$$…$$`, `\[…\]`,
 * commentaires et blocs verbatim.
 *
 * @param {string} source
 * @returns {{ start: number, end: number, text: string, hasComment: boolean }[]}
 *   `start` et `end` délimitent le contenu, sans les délimiteurs.
 */
export function findInlineMath(source) {
  const clean = blankNonMath(source);
  const found = [];
  let i = 0;

  while (i < clean.length) {
    const c = clean[i];

    if (c === '\\') {
      const next = clean[i + 1];
      if (next === '[') {
        const end = clean.indexOf('\\]', i + 2);
        i = end === -1 ? i + 2 : end + 2;
        continue;
      }
      if (next === '(') {
        const end = clean.indexOf('\\)', i + 2);
        if (end !== -1) {
          found.push({ start: i + 2, end });
          i = end + 2;
          continue;
        }
      }
      i += 2;
      continue;
    }

    if (c === '$') {
      if (clean[i + 1] === '$') {
        const end = clean.indexOf('$$', i + 2);
        i = end === -1 ? i + 2 : end + 2;
        continue;
      }
      let j = i + 1;
      while (j < clean.length && j - i <= MAX_INLINE_LENGTH) {
        if (clean[j] === '\\') {
          j += 2;
          continue;
        }
        if (clean[j] === '$') break;
        j++;
      }
      if (j < clean.length && clean[j] === '$' && j - i <= MAX_INLINE_LENGTH && j > i + 1) {
        found.push({ start: i + 1, end: j });
        i = j + 1;
        continue;
      }
      i++;
      continue;
    }

    i++;
  }

  return found.map(({ start, end }) => ({
    start,
    end,
    text: source.slice(start, end),
    // Un commentaire dans la formule : on la signale, on ne la réécrit pas.
    hasComment: source.slice(start, end) !== clean.slice(start, end)
  }));
}

// ---- Largeur estimée ----

/**
 * Longueur « visible » d'un fragment : un symbole par commande, le texte au
 * complet, ni accolades, ni indices, ni espaces de la source.
 */
export function visibleLength(fragment) {
  return fragment
    .replace(/\\(?:text|textrm|textit|textbf|mbox)\s*\{([^{}]*)\}/g, (match, inner) => '\u0001'.repeat(inner.length))
    .replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|displaystyle|textstyle|limits|nolimits)\b\s*/g, '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\(?:quad|qquad)\b/g, '  ')
    .replace(/\\[a-zA-Z]+/g, 'x')
    .replace(/[{}^_&\s]/g, '')
    .length;
}

// KaTeX ne coupe qu'après une relation ou un opérateur binaire du niveau
// supérieur, hors accolades, \left…\right et environnements (les parenthèses
// ne comptent pas : ce ne sont que des symboles).
const BREAK_COMMANDS = new Set([
  'leq', 'le', 'geq', 'ge', 'neq', 'ne', 'in', 'notin', 'ni', 'subset', 'subseteq', 'supset', 'supseteq',
  'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'rightarrow', 'leftarrow', 'longrightarrow', 'Longrightarrow',
  'to', 'mapsto', 'iff', 'implies', 'impliedby', 'approx', 'sim', 'simeq', 'equiv', 'cong', 'propto', 'll', 'gg',
  'mid', 'parallel', 'perp', 'pm', 'mp', 'times', 'cdot', 'cup', 'cap', 'setminus', 'circ', 'oplus', 'otimes',
  'wedge', 'vee', 'div', 'ast', 'star', 'bullet', 'vdash', 'models', 'prec', 'succ', 'allowbreak'
]);

/** Un \left…\right sans tableau dont le contenu aurait pu se couper sans lui. */
function holdsBackBreaks(group) {
  return !/\\begin\b/.test(group.inner) && unbreakableBlocks(group.inner).length > 1;
}

/** Blocs insécables d'une formule, approximés par ses coupures possibles. */
function unbreakableBlocks(text) {
  const blocks = [];
  let depth = 0;
  let current = '';
  let i = 0;
  const flush = () => {
    if (current.trim()) blocks.push(current);
    current = '';
  };

  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const word = /^\\([a-zA-Z]+)/.exec(text.slice(i, i + 24));
      if (word) {
        const name = word[1];
        current += word[0];
        i += word[0].length;
        if (name === 'left' || name === 'begin') depth++;
        else if (name === 'right' || name === 'end') depth = Math.max(0, depth - 1);
        if (name === 'left' || name === 'right') {
          const skip = delimiterLength(text, i);
          current += text.slice(i, i + skip);
          i += skip;
        }
        if (depth === 0 && BREAK_COMMANDS.has(name)) flush();
        continue;
      }
      current += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    current += c;
    i++;
    if (c === '{') depth++;
    else if (c === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (c === '=' || c === '<' || c === '>' || c === '+' || c === '-')) flush();
  }
  flush();
  return blocks;
}

// ---- Analyse d'une formule ----

/** Longueur du délimiteur qui suit \left ou \right (espaces compris), à partir de `index`. */
function delimiterLength(text, index) {
  let j = index;
  while (text[j] === ' ') j++;
  if (j >= text.length) return j - index;
  if (text[j] === '\\') {
    const word = /^\\[a-zA-Z]+/.exec(text.slice(j));
    return j - index + (word ? word[0].length : 2);
  }
  return j - index + 1;
}

/**
 * Profondeur d'imbrication avant chaque caractère : accolades, parenthèses,
 * crochets, \left…\right, \begin…\end, \llbracket…\rrbracket, \langle…\rangle.
 * Elle ne descend jamais sous zéro : un intervalle « ]0,1[ » ne la fausse pas.
 */
function depthMap(text) {
  const depth = new Array(text.length + 1).fill(0);
  const OPEN = new Set(['left', 'begin', 'llbracket', 'langle', 'lbrace', 'lfloor', 'lceil']);
  const CLOSE = new Set(['right', 'end', 'rrbracket', 'rangle', 'rbrace', 'rfloor', 'rceil']);
  let d = 0;
  let i = 0;

  while (i < text.length) {
    depth[i] = d;
    const c = text[i];

    if (c === '\\') {
      const word = /^\\([a-zA-Z]+)/.exec(text.slice(i, i + 20));
      if (word) {
        const name = word[1];
        const length = word[0].length;
        for (let k = i; k < i + length; k++) depth[k] = d;
        if (OPEN.has(name)) d++;
        else if (CLOSE.has(name)) d = Math.max(0, d - 1);
        i += length;
        if (name === 'left' || name === 'right') {
          const skip = delimiterLength(text, i);
          for (let k = i; k < i + skip; k++) depth[k] = d;
          i += skip;
        }
        continue;
      }
      // \{ \} \, \; \\ … : deux caractères, jamais une virgule de liste (-1 : à ignorer).
      const escaped = text[i + 1];
      depth[i + 1] = -1;
      if (escaped === '{') d++;
      else if (escaped === '}') d = Math.max(0, d - 1);
      i += 2;
      continue;
    }

    if (c === '{' || c === '(' || c === '[') d++;
    else if (c === '}' || c === ')' || c === ']') d = Math.max(0, d - 1);
    i++;
  }

  depth[text.length] = d;
  return depth;
}

/**
 * Positions des virgules de premier niveau. En mode mathématique une virgule
 * est toujours une ponctuation (elle est suivie d'une espace) : une virgule
 * décimale s'écrit « 3{,}14 », donc entre accolades, jamais ici.
 */
function topLevelCommas(text) {
  const depth = depthMap(text);
  const positions = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ',' && depth[i] === 0) positions.push(i);
  }
  return positions;
}

/** Longueur d'un groupe, espaces et retours à la ligne réduits (comme dans l'analyse). */
function groupSpan(text, group) {
  return text.slice(group.leftIndex, group.end).replace(/\s+/g, ' ').length;
}

/** Groupes \left…\right de premier niveau. */
function topLevelLeftRightGroups(text) {
  const groups = [];
  const stack = [];
  const regex = /\\(left|right)(?![a-zA-Z])/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1] === 'left') {
      stack.push({ leftIndex: match.index, leftEnd: match.index + match[0].length });
      continue;
    }
    const open = stack.pop();
    if (!open) continue;
    const rightEnd = match.index + match[0].length;
    const delimEnd = rightEnd + delimiterLength(text, rightEnd);
    if (stack.length === 0) {
      groups.push({
        leftIndex: open.leftIndex,
        leftEnd: open.leftEnd,
        rightIndex: match.index,
        rightEnd,
        end: delimEnd,
        inner: text.slice(open.leftEnd, match.index)
      });
    }
  }

  return groups;
}

/** \text{…} de plusieurs mots, sans commande ni formule imbriquée. */
function multiWordTextGroups(text) {
  const regex = new RegExp(`\\\\(${TEXT_COMMANDS})\\s*\\{([^{}$\\\\]*)\\}`, 'g');
  const groups = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (/\S\s+\S/.test(match[2].trim())) {
      groups.push({ index: match.index, end: match.index + match[0].length, command: match[1], inner: match[2] });
    }
  }
  return groups;
}

/**
 * Mesures d'une formule en ligne, d'où viennent les seuils de l'analyse.
 *
 * @param {string} text contenu de la formule, sans délimiteurs
 */
export function inlineMathFeatures(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return {
    length: compact.length,
    hskips: (compact.match(/\\hskip\b/g) || []).length,
    arrayLike: /\\begin\{(?:array|cases|[pbvBV]?matrix|smallmatrix)\}/.test(compact),
    hasBreakingEnvironment: /\\begin|\\\\/.test(compact),
    topLevelCommas: topLevelCommas(compact).length,
    longestLeftRight: Math.max(0, ...topLevelLeftRightGroups(compact).map(group => groupSpan(compact, group))),
    // Un groupe qui contient un tableau reste un bloc : changer ses délimiteurs n'y change rien.
    // Ne compte que les groupes où \left…\right retient une coupure : sans tableau
    // à l'intérieur et avec une relation ou un opérateur binaire (sinon le groupe
    // serait insécable de toute façon).
    longestLeftRightVisible: Math.max(0, ...topLevelLeftRightGroups(compact)
      .filter(group => holdsBackBreaks(group))
      .map(group => visibleLength(compact.slice(group.leftIndex, group.end)))),
    textLength: multiWordTextGroups(compact).reduce((sum, group) => sum + group.inner.length, 0),
    unbreakableVisible: Math.max(0, ...unbreakableBlocks(compact).map(visibleLength))
  };
}

/**
 * Problèmes de repli d'une formule en ligne.
 *
 * @param {string} text contenu de la formule, sans délimiteurs
 * @returns {{ code: string, message: string, fixable: boolean, fixableWithOption?: boolean }[]}
 */
export function analyzeInlineMath(text) {
  const features = inlineMathFeatures(text);
  const issues = [];

  if (features.hskips >= 4) {
    issues.push({
      code: 'hskip-layout',
      fixable: false,
      message: `Formule en ligne qui sert de tableau (${features.hskips} \\hskip) : un bloc insécable. Utiliser une \\begin{pmatrix}…\\end{pmatrix} par objet, ou des formules séparées.`
    });
  }

  // Un texte de plusieurs mots est insécable même dans une formule courte.
  if (features.textLength > LONG_TEXT_MIN_LENGTH) {
    issues.push({
      code: 'long-text',
      fixable: true,
      message: 'Texte de plusieurs mots dans une formule : un bloc insécable. Le couper mot à mot avec \\allowbreak, ou le sortir de la formule.'
    });
  }

  if (
    !features.hasBreakingEnvironment
    && features.topLevelCommas >= COMMA_LIST_MIN_COMMAS
    && features.unbreakableVisible > COMMA_LIST_MIN_VISIBLE
  ) {
    issues.push({
      code: 'comma-list',
      fixable: true,
      message: `Liste à virgules (${features.topLevelCommas} virgules, bloc insécable d'environ ${features.unbreakableVisible} caractères) : ajouter \\allowbreak après les virgules.`
    });
  }

  // \left…\right qui retient une coupure : signalé dès 30 caractères, même sous le
  // seuil général, car la réécriture est sûre et la formule se coupait sans lui.
  if (features.longestLeftRightVisible >= LEFT_RIGHT_MIN_VISIBLE) {
    issues.push({
      code: 'left-right',
      // Jamais réécrit par défaut : voir `fixInlineMathLayout`.
      fixable: false,
      fixableWithOption: !/\\middle\b/.test(text),
      message: `Groupe \\left…\\right de ${features.longestLeftRightVisible} caractères : KaTeX ne le coupe pas, alors que son contenu le permettrait. Garder \\left( et afficher la formule en \\[ … \\] (elle défile sur mobile), ou, si la taille des délimiteurs importe peu, \\bigl…\\bigr (fix:tex:det --left-right).`
    });
  }

  if (features.unbreakableVisible > UNBREAKABLE_MIN_VISIBLE && features.hskips < 4) {
    const blockSize = `bloc insécable d'environ ${features.unbreakableVisible} caractères`;
    let explained = issues.some(issue => issue.code === 'left-right');

    if (features.arrayLike) {
      explained = true;
      issues.push({
        code: 'inline-array',
        fixable: false,
        message: `Tableau ou système dans une formule en ligne (${blockSize}). Le passer en formule affichée \\[ … \\], ou le remplacer par des formules séparées.`
      });
    }
    if (!explained && features.textLength <= LONG_TEXT_MIN_LENGTH && !issues.some(issue => issue.code === 'comma-list')) {
      issues.push({
        code: 'long-block',
        fixable: false,
        message: `Formule en ligne qui forme un ${blockSize} : elle dépassera de la colonne sur un téléphone. La couper (relation, \\allowbreak) ou l'afficher en \\[ … \\].`
      });
    }
  }

  return issues;
}

// ---- Formules affichées : enchaînements de relations ----

// KaTeX ne coupe jamais une formule affichée : un enchaînement « a = b = c = … »
// ou « A ⇒ B ⇒ C ⇒ … » trop long sort de la colonne et défile. Dans un align*, le
// même enchaînement se lit ligne à ligne, aligné sur sa première relation.
/** Nombre minimal de relations de premier niveau d'un enchaînement. */
export const RELATION_CHAIN_MIN_RELATIONS = 2;
// Réglé sur la largeur mesurée (KaTeX) des 2 476 enchaînements en formule affichée du
// corpus. Avec ces deux seuils, 367 sont signalés ; 60 % d'entre eux dépassent 560 px (la
// largeur d'une colonne de lecture sur ordinateur : 592 à 720 px selon la fenêtre) et
// tiennent dans un align*, et 106 des 137 enchaînements qui dépassent 664 px et que
// logerait un align* sont repérés. Tous dépassent la colonne d'un téléphone (300 px).
/** Longueur visible d'un enchaînement au-delà de laquelle on alerte. */
export const RELATION_CHAIN_MIN_VISIBLE = 60;
/** Longueur visible maximale de la plus longue ligne une fois l'enchaînement aligné. */
export const RELATION_CHAIN_MAX_ALIGNED_VISIBLE = 60;

// Groupes qui s'ouvrent et se ferment par une commande : une relation à l'intérieur n'est pas de premier niveau.
const GROUP_OPENERS = new Set(['llbracket', 'langle', 'lbrace', 'lfloor', 'lceil']);
const GROUP_CLOSERS = new Set(['rrbracket', 'rangle', 'rbrace', 'rfloor', 'rceil']);

const RELATION_COMMANDS = new Set([
  'leq', 'le', 'leqslant', 'geq', 'ge', 'geqslant', 'neq', 'ne', 'Leftrightarrow', 'iff', 'Rightarrow', 'implies',
  'Leftarrow', 'impliedby', 'equiv', 'sim', 'simeq', 'approx', 'cong', 'propto', 'subset', 'subseteq', 'supset',
  'supseteq', 'll', 'gg'
]);

/**
 * Formules affichées (`$$…$$`, `\[…\]`, `equation`) d'une source, hors commentaires
 * et blocs verbatim.
 *
 * @param {string} source
 * @returns {{ start: number, end: number, text: string, kind: string, hasComment: boolean }[]}
 */
export function findDisplayMath(source) {
  const clean = blankNonMath(source);
  const found = [];
  const add = (start, end, kind) => found.push({ start, end, kind });
  let i = 0;

  while (i < clean.length) {
    const c = clean[i];
    if (c === '\\') {
      if (clean[i + 1] === '[') {
        const end = clean.indexOf('\\]', i + 2);
        if (end !== -1) {
          add(i + 2, end, '\\[');
          i = end + 2;
          continue;
        }
      }
      const env = /^\\begin\{(equation\*?)\}/.exec(clean.slice(i, i + 20));
      if (env) {
        const endTag = `\\end{${env[1]}}`;
        const end = clean.indexOf(endTag, i);
        if (end !== -1) {
          add(i + env[0].length, end, env[1]);
          i = end + endTag.length;
          continue;
        }
      }
      i += 2;
      continue;
    }
    if (c === '$') {
      if (clean[i + 1] === '$') {
        const end = clean.indexOf('$$', i + 2);
        if (end !== -1) {
          add(i + 2, end, '$$');
          i = end + 2;
          continue;
        }
      }
      // Formule en ligne : on saute jusqu'à son délimiteur fermant.
      let j = i + 1;
      while (j < clean.length && clean[j] !== '$') {
        if (clean[j] === '\\') j++;
        j++;
      }
      i = j + 1;
      continue;
    }
    i++;
  }

  return found.map(({ start, end, kind }) => ({
    start,
    end,
    kind,
    text: source.slice(start, end),
    hasComment: source.slice(start, end) !== clean.slice(start, end)
  }));
}

/**
 * Découpe une formule aux relations de premier niveau (hors accolades, parenthèses,
 * crochets, \left…\right et environnements).
 *
 * @param {string} text
 * @param {((relation: string) => boolean) | null} [keep] ne coupe qu'aux relations acceptées
 * @returns {{ members: string[], relations: string[] }}
 */
export function splitAtRelations(text, keep = null) {
  const members = [];
  const relations = [];
  let brace = 0;
  let paren = 0;
  let current = '';
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      const word = /^\\([a-zA-Z]+)/.exec(text.slice(i, i + 24));
      if (word) {
        const name = word[1];
        if (name === 'left' || name === 'begin') brace++;
        else if (name === 'right' || name === 'end') brace = Math.max(0, brace - 1);
        else if (GROUP_OPENERS.has(name)) paren++;
        else if (GROUP_CLOSERS.has(name)) paren = Math.max(0, paren - 1);
        if (brace === 0 && paren === 0 && RELATION_COMMANDS.has(name) && (!keep || keep(word[0]))) {
          members.push(current);
          relations.push(word[0]);
          current = '';
          i += word[0].length;
          continue;
        }
        current += word[0];
        i += word[0].length;
        if (name === 'left' || name === 'right') {
          const skip = delimiterLength(text, i);
          current += text.slice(i, i + skip);
          i += skip;
        }
        continue;
      }
      // \{ et \} : accolades affichées, qui délimitent un ensemble ; \, \; … : de l'espace.
      if (text[i + 1] === '{') paren++;
      else if (text[i + 1] === '}') paren = Math.max(0, paren - 1);
      current += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === '{') brace++;
    else if (c === '}') brace = Math.max(0, brace - 1);
    else if (c === '(' || c === '[') paren++;
    else if (c === ')' || c === ']') paren = Math.max(0, paren - 1);
    if (brace === 0 && paren === 0 && (c === '=' || c === '<' || c === '>') && (!keep || keep(c))) {
      members.push(current);
      relations.push(c);
      current = '';
      i++;
      continue;
    }
    current += c;
    i++;
  }
  members.push(current);
  return { members: members.map(member => member.trim()), relations };
}

const LOGICAL_ARROW = /^\\(?:Leftrightarrow|iff|Rightarrow|implies|Leftarrow|impliedby)$/;

/**
 * Découpe d'un enchaînement tel qu'un align* l'écrirait. Quand la formule enchaîne des
 * implications ou des équivalences, chaque membre est un énoncé (« x = 0 ⇒ y = 0 ⇒ … ») :
 * on ne coupe qu'aux flèches, et les égalités restent dans leur énoncé. Sinon on coupe à
 * toutes les relations.
 *
 * @param {string} text
 * @returns {{ members: string[], relations: string[] }}
 */
export function splitForAlign(text) {
  const all = splitAtRelations(text);
  return all.relations.some(relation => LOGICAL_ARROW.test(relation))
    ? splitAtRelations(text, relation => LOGICAL_ARROW.test(relation))
    : all;
}

/** Une virgule ou un \quad de premier niveau : plusieurs énoncés côte à côte, pas une chaîne. */
function hasListSeparator(member) {
  let brace = 0;
  let paren = 0;
  let i = 0;
  while (i < member.length) {
    const c = member[i];
    if (c === '\\') {
      const word = /^\\([a-zA-Z]+)/.exec(member.slice(i, i + 12));
      if (word) {
        const name = word[1];
        if (name === 'left' || name === 'begin') brace++;
        else if (name === 'right' || name === 'end') brace = Math.max(0, brace - 1);
        else if (GROUP_OPENERS.has(name)) paren++;
        else if (GROUP_CLOSERS.has(name)) paren = Math.max(0, paren - 1);
        if (brace === 0 && paren === 0 && (name === 'quad' || name === 'qquad')) return true;
        i += word[0].length;
        continue;
      }
      if (member[i + 1] === '{') paren++;
      else if (member[i + 1] === '}') paren = Math.max(0, paren - 1);
      i += 2;
      continue;
    }
    if (c === '{') brace++;
    else if (c === '}') brace = Math.max(0, brace - 1);
    else if (c === '(' || c === '[') paren++;
    else if (c === ')' || c === ']') paren = Math.max(0, paren - 1);
    else if (c === ',' && brace === 0 && paren === 0 && member.slice(i + 1).trim() !== '') return true;
    i++;
  }
  return false;
}

/**
 * Mesures d'un enchaînement de relations en formule affichée, ou null si ce n'en
 * est pas un (environnement, \tag, énoncés côte à côte, une seule relation).
 *
 * @param {string} text contenu de la formule, sans délimiteurs
 */
export function relationChainFeatures(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (/\\begin|\\\\|&|\\tag|\\label|\\cr\b/.test(compact)) return null;
  const { members, relations } = splitForAlign(compact);
  if (relations.length < RELATION_CHAIN_MIN_RELATIONS) return null;
  if (members.some(member => !member) || members.some(hasListSeparator)) return null;

  const visible = members.map(visibleLength);
  const [first, ...others] = visible;
  return {
    relations: relations.length,
    visible: visibleLength(compact),
    // Plus longue ligne d'un align* : le premier membre, la relation, puis un membre.
    alignedVisible: first + 1 + Math.max(...others)
  };
}

/**
 * L'enchaînement réécrit en align* : le premier membre, la première relation et le
 * deuxième membre sur la première ligne, puis une relation et un membre par ligne,
 * alignés sur la première relation. Null si la formule n'est pas un enchaînement.
 *
 * @param {string} text contenu de la formule affichée, sans délimiteurs
 * @returns {string | null}
 */
export function relationChainToAlign(text) {
  if (!relationChainFeatures(text)) return null;
  const { members, relations } = splitForAlign(text.replace(/\s+/g, ' ').trim());
  return '\\begin{align*}\n'
    + `${members[0]} &${relations[0]} ${members[1]}`
    + relations.slice(1).map((relation, k) => ` \\\\\n&${relation} ${members[k + 2]}`).join('')
    + '\n\\end{align*}';
}

/**
 * Enchaînement de relations qu'un align* logerait : trop long pour la colonne en
 * formule affichée, mais dont chaque ligne tiendrait une fois alignée.
 *
 * @param {string} text contenu de la formule affichée, sans délimiteurs
 * @returns {{ code: string, message: string, fixable: boolean }[]}
 */
export function analyzeDisplayMath(text) {
  const features = relationChainFeatures(text);
  if (!features) return [];
  if (features.visible <= RELATION_CHAIN_MIN_VISIBLE) return [];
  if (features.alignedVisible > RELATION_CHAIN_MAX_ALIGNED_VISIBLE) return [];

  return [{
    code: 'relation-chain',
    fixable: false,
    message: `Enchaînement de ${features.relations} relations en formule affichée (environ ${features.visible} caractères visibles) : KaTeX ne le coupe pas, il sort de la colonne. L'écrire dans un \\begin{align*} … \\end{align*}, une relation par ligne, aligné sur la première.`
  }];
}

// ---- Réécritures ----

/** `\allowbreak` après chaque virgule de premier niveau. */
export function allowBreakAfterTopLevelCommas(text) {
  const positions = topLevelCommas(text);
  let result = '';
  let last = 0;
  for (const position of positions) {
    result += text.slice(last, position + 1);
    last = position + 1;
    if (!/^\s*\\allowbreak\b/.test(text.slice(last))) result += '\\allowbreak ';
  }
  return result + text.slice(last);
}

/**
 * \left…\right → \bigl…\bigr ; \Bigl…\Bigr quand le contenu est haut.
 * Les groupes qui contiennent un tableau ou un \middle restent tels quels.
 * Répété jusqu'à stabilité : un groupe imbriqué n'est de premier niveau qu'une
 * fois son parent réécrit.
 */
export function leftRightToBig(text) {
  let result = text;
  for (let pass = 0; pass < 6; pass++) {
    const groups = topLevelLeftRightGroups(result).filter(
      group => visibleLength(result.slice(group.leftIndex, group.end)) >= LEFT_RIGHT_MIN_VISIBLE
        && !/\\middle\b/.test(group.inner)
        && holdsBackBreaks(group)
    );
    if (groups.length === 0) break;
    for (const group of groups.sort((a, b) => b.leftIndex - a.leftIndex)) {
      const size = TALL_CONTENT.test(group.inner) ? 'Big' : 'big';
      result = result.slice(0, group.leftIndex) + `\\${size}l` + result.slice(group.leftEnd, group.rightIndex)
        + `\\${size}r` + result.slice(group.rightIndex + '\\right'.length);
    }
  }
  return result;
}

/** Un \text{mot } par mot, séparés par \allowbreak. */
export function splitLongText(text) {
  const groups = multiWordTextGroups(text).filter(group => group.inner.length >= 10);
  let result = text;
  for (const group of groups.sort((a, b) => b.index - a.index)) {
    const words = group.inner.split(/(?<= )/);
    const split = words.map(word => `\\${group.command}{${word}}`).join('\\allowbreak ');
    result = result.slice(0, group.index) + split + result.slice(group.end);
  }
  return result;
}

/**
 * Applique, aux seules formules signalées, les réécritures de leur famille.
 *
 * `\left…\right` n'est réécrit que sur demande : c'est la notation que les
 * auteurs préfèrent, et `\bigl` en change la taille.
 *
 * @param {string} source source .tex complète
 * @param {{ leftRight?: boolean }} [options]
 * @returns {string}
 */
export function fixInlineMathLayout(source, { leftRight = false } = {}) {
  const replacements = [];

  for (const formula of findInlineMath(source)) {
    if (formula.hasComment) continue;
    const codes = new Set(analyzeInlineMath(formula.text).map(issue => issue.code));
    let fixed = formula.text;
    if (codes.has('comma-list')) fixed = allowBreakAfterTopLevelCommas(fixed);
    if (leftRight && codes.has('left-right')) fixed = leftRightToBig(fixed);
    if (codes.has('long-text')) fixed = splitLongText(fixed);
    if (fixed !== formula.text) replacements.push({ start: formula.start, end: formula.end, text: fixed });
  }

  let result = source;
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, r.start) + r.text + result.slice(r.end);
  }
  return result;
}
