// src/lib/latex/texPreview.js
// Conversion LaTeX → HTML côté client pour l'aperçu en direct de l'éditeur
// d'exercices. Version allégée du pipeline pandoc de scripts/parse-latex.js :
// le texte est converti par règles simples, les mathématiques sont laissées
// telles quelles pour KaTeX (MathRenderer / auto-render).

/** Supprime les commentaires LaTeX (% non échappés). */
export function stripComments(str) {
  return str.replace(/(?<!\\)%.*$/gm, "").trim();
}

/** Enveloppe les environnements math display avec $$ pour KaTeX. */
function wrapMathEnvironments(content) {
  return content
    .replace(
      /\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
      "$$$\\begin{aligned}$1\\end{aligned}$$$",
    )
    .replace(
      /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
      "$$$$1$$$",
    )
    .replace(
      /\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g,
      "$$$\\begin{gathered}$1\\end{gathered}$$$",
    );
}

const PH_OPEN = "\uE000"; // caractere prive : absent des sources LaTeX
const PH_CLOSE = "\uE001";

/**
 * Remplace les segments mathématiques ($…$, $$…$$, \[…\], \(…\)) par des
 * placeholders pour les protéger des transformations HTML.
 */
function protectMath(src, store) {
  let out = "";
  let i = 0;
  const push = (segment) => {
    out += PH_OPEN + (store.push(segment) - 1) + PH_CLOSE;
  };

  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      const two = src.slice(i, i + 2);
      if (two === "\\[" || two === "\\(") {
        const closer = two === "\\[" ? "\\]" : "\\)";
        const end = src.indexOf(closer, i + 2);
        if (end !== -1) {
          push(src.slice(i, end + 2));
          i = end + 2;
          continue;
        }
      }
      // Commande ou caractère échappé : copier tel quel
      out += src.slice(i, i + 2);
      i += 2;
    } else if (ch === "$") {
      const isDisplay = src[i + 1] === "$";
      const delim = isDisplay ? "$$" : "$";
      let end = i + delim.length;
      while (end < src.length) {
        const found = src.indexOf(delim, end);
        if (found === -1) {
          end = -1;
          break;
        }
        if (src[found - 1] === "\\") {
          end = found + 1;
          continue;
        }
        end = found;
        break;
      }
      if (end !== -1 && end < src.length) {
        push(src.slice(i, end + delim.length));
        i = end + delim.length;
      } else {
        out += ch;
        i++;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Remplace un environnement complet (avec gestion de l'imbrication du même
 * environnement) par le résultat de `render(body)`.
 */
function replaceEnvironment(src, name, render) {
  const re = new RegExp(
    `\\\\begin\\{${name}\\}(?:\\[[^\\]]*\\])?((?:(?!\\\\begin\\{${name}\\})[\\s\\S])*?)\\\\end\\{${name}\\}`,
  );
  let result = src;
  let guard = 0;
  while (re.test(result) && guard < 50) {
    result = result.replace(re, (_, body) => render(body));
    guard++;
  }
  return result;
}

/** Convertit itemize/enumerate (imbrications gérées de l'intérieur vers l'extérieur). */
function convertLists(src) {
  const innerListRe =
    /\\begin\{(itemize|enumerate)\}(?:\[[^\]]*\])?((?:(?!\\begin\{(?:itemize|enumerate)\})[\s\S])*?)\\end\{\1\}/;
  let result = src;
  let guard = 0;
  while (innerListRe.test(result) && guard < 50) {
    result = result.replace(innerListRe, (_, env, body) => {
      const tag = env === "itemize" ? "ul" : "ol";
      const items = body
        .split(/\\item\s*(?:\[[^\]]*\])?/)
        .map((s) => s.trim())
        .filter((s, idx) => !(idx === 0 && s === ""));
      const lis = items.map((item) => `<li>${item}</li>`).join("\n");
      return `<${tag}>\n${lis}\n</${tag}>`;
    });
    guard++;
  }
  return result;
}

// Regex d'argument acceptant un niveau d'accolades imbriquées
const ARG = "\\{((?:[^{}]|\\{[^{}]*\\})*)\\}";

function applyInlineCommands(src) {
  const rules = [
    [new RegExp(`\\\\textbf${ARG}`, "g"), "<strong>$1</strong>"],
    [new RegExp(`\\\\textit${ARG}`, "g"), "<em>$1</em>"],
    [new RegExp(`\\\\emph${ARG}`, "g"), "<em>$1</em>"],
    [new RegExp(`\\\\underline${ARG}`, "g"), "<u>$1</u>"],
    [new RegExp(`\\\\texttt${ARG}`, "g"), "<code>$1</code>"],
    [
      new RegExp(`\\\\textsc${ARG}`, "g"),
      '<span style="font-variant: small-caps">$1</span>',
    ],
    [
      new RegExp(`\\\\href${ARG}${ARG}`, "g"),
      '<a href="$1" target="_blank" rel="noopener">$2</a>',
    ],
    [
      new RegExp(`\\\\url${ARG}`, "g"),
      '<a href="$1" target="_blank" rel="noopener">$1</a>',
    ],
    [
      new RegExp(`\\\\mbox${ARG}`, "g"),
      '<span style="white-space: nowrap">$1</span>',
    ],
  ];
  let result = src;
  // Deux passes pour gérer les commandes imbriquées (\textbf{\textit{…}})
  for (let pass = 0; pass < 2; pass++) {
    for (const [re, replacement] of rules) {
      result = result.replace(re, replacement);
    }
  }
  return result;
}

/** Encart d'information pour les artefacts non rendus dans l'aperçu. */
function artifactNotice(label) {
  return `<div class="tex-preview-artifact">${label}</div>`;
}

/**
 * Convertit le LaTeX d'un bloc d'exercice en HTML d'aperçu.
 * Les maths restent en délimiteurs $…$ / \[…\] pour KaTeX auto-render.
 * @param {string} latex
 * @returns {string}
 */
export function latexToPreviewHtml(latex) {
  if (!latex || !latex.trim()) return "";

  let src = stripComments(latex);

  // Artefacts non rendus côté client
  src = src.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, () =>
    artifactNotice("🖼️ Figure TikZ — rendue lors de la construction du site"),
  );
  src = src.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g, (_, p) =>
    artifactNotice(`🖼️ Image : ${escapeHtml(p)}`),
  );
  src = src.replace(/\\geogebra\{([^}]*)\}/g, (_, id) =>
    artifactNotice(`📐 Animation GeoGebra : ${escapeHtml(id)}`),
  );
  src = src.replace(/\\BUseVerbatim\{([^}]*)\}/g, (_, name) =>
    artifactNotice(`💻 Bloc de code : ${escapeHtml(name)}`),
  );

  src = wrapMathEnvironments(src);

  const mathStore = [];
  src = protectMath(src, mathStore);
  src = escapeHtml(src);

  // Environnements de mise en page
  src = replaceEnvironment(
    src,
    "center",
    (body) => `<div style="text-align: center">${body}</div>`,
  );
  src = replaceEnvironment(src, "minipage", (body) => `<div>${body}</div>`);
  src = replaceEnvironment(src, "multicols", (body) => `<div>${body}</div>`);
  src = replaceEnvironment(
    src,
    "quote",
    (body) => `<blockquote>${body}</blockquote>`,
  );
  src = convertLists(src);

  src = applyInlineCommands(src);

  // Commandes simples / typographie
  src = src
    .replace(/\\og\b\s*/g, "« ")
    .replace(/\\fg\b\{?\}?/g, " »")
    .replace(/\\(?:ldots|dots)\b(\{\})?/g, "…")
    .replace(/\\\\(\[[^\]]*\])?/g, "<br>")
    .replace(/\\(?:newline|linebreak)\b/g, "<br>")
    .replace(/\\par\b/g, "\n\n")
    .replace(
      /\\(?:noindent|smallskip|medskip|bigskip|hfill|indent|centering|clearpage|newpage)\b(\{\})?/g,
      "",
    )
    .replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, "")
    .replace(/\\setcounter\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/(?<!\\)~/g, " ")
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/\\#/g, "#")
    .replace(/\\&amp;/g, "&amp;");

  // Paragraphes : séparation sur ligne vide, sans envelopper les blocs
  const BLOCK_START = /^\s*<(?:ul|ol|div|blockquote|h\d|pre|table)\b/;
  const html = src
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (BLOCK_START.test(chunk) ? chunk : `<p>${chunk}</p>`))
    .join("\n");

  // Restauration des maths (échappées pour rester du texte brut dans le DOM)
  return html.replace(
    new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, "g"),
    (_, idx) => escapeHtml(mathStore[Number(idx)] ?? ""),
  );
}

/**
 * Convertit les blocs de l'éditeur au format attendu par ExerciseContent.
 * @param {{ id: string, type: string, latex: string }[]} blocks
 * @returns {{ id: string, type: string, latex: string, html: string, order: number }[]}
 */
export function blocksToPreviewContent(blocks) {
  return (blocks || [])
    .filter((b) => b.latex && b.latex.trim())
    .map((b, i) => ({
      id: b.id || `block_${i + 1}`,
      type: b.type,
      latex: b.latex,
      html:
        b.type === "code"
          ? `<pre class="tex-preview-code"><code>${escapeHtml(b.latex)}</code></pre>`
          : latexToPreviewHtml(b.latex),
      order: i + 1,
    }));
}
