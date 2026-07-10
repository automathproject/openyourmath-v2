// src/lib/latex/exerciseTex.js
// Sérialisation / parsing du format .tex source des exercices du site
// (content/exercises/**/*.tex). Utilisable côté client et côté serveur.
// Le format est celui consommé par scripts/parse-latex.js.

/** Champs de métadonnées, dans l'ordre d'écriture des sources du site. */
export const META_FIELDS = [
  { key: "uuid", cmd: "uuid", label: "UUID" },
  { key: "title", cmd: "titre", label: "Titre" },
  { key: "level", cmd: "niveau", label: "Niveau" },
  { key: "module", cmd: "module", label: "Module" },
  { key: "chapter", cmd: "chapitre", label: "Chapitre" },
  { key: "subchapter", cmd: "sousChapitre", label: "Sous-chapitre" },
  { key: "theme", cmd: "theme", label: "Thèmes" },
  { key: "author", cmd: "auteur", label: "Auteur" },
  { key: "created_at", cmd: "datecreate", label: "Date de création" },
  { key: "organization", cmd: "organisation", label: "Organisation" },
  { key: "difficulty", cmd: "difficulte", label: "Difficulté" },
  { key: "video_id", cmd: "video", label: "Vidéo (id YouTube)" },
];

export const BLOCK_TYPES = [
  { type: "text", cmd: "texte", label: "Description" },
  { type: "question", cmd: "question", label: "Question" },
  { type: "indication", cmd: "indication", label: "Indication" },
  { type: "reponse", cmd: "reponse", label: "Solution" },
];

const CMD_BY_TYPE = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.cmd]));
const TYPE_BY_CMD = Object.fromEntries(BLOCK_TYPES.map((b) => [b.cmd, b.type]));

/** UUID court (4 caractères base64url), même format que scripts/parse-latex.js. */
export function generateShortUuid() {
  const bytes = new Uint8Array(3);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 3; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Indente chaque ligne non vide de `text` avec `indent`. */
function indentLines(text, indent) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? indent + line : ""))
    .join("\n");
}

/**
 * Construit une source .tex complète au format du site.
 *
 * Convention des sources : les questions (avec leurs indications et réponses)
 * sont numérotées dans un environnement enumerate dès qu'il y a au moins deux
 * questions ; les blocs \texte{} restent au niveau du contenu.
 *
 * @param {Object} meta   — { uuid, title, level, module, chapter, ... }
 * @param {{ type: string, latex: string }[]} blocks
 * @returns {string}
 */
export function buildExerciseTex(meta, blocks) {
  const lines = [];

  for (const field of META_FIELDS) {
    const raw = meta?.[field.key];
    const value = raw === null || raw === undefined ? "" : String(raw).trim();
    if (!value) continue;
    lines.push(`\\${field.cmd}{${value}}`);
  }

  const contentBlocks = (blocks || []).filter((b) => b.latex && b.latex.trim());
  const questionCount = contentBlocks.filter(
    (b) => b.type === "question",
  ).length;
  const useEnumerate = questionCount >= 2;

  lines.push("");
  lines.push("\\contenu{");

  let inEnumerate = false;
  const isQuestionRun = (type) =>
    type === "question" || type === "indication" || type === "reponse";

  for (const block of contentBlocks) {
    const cmd = CMD_BY_TYPE[block.type] || "texte";
    const body = block.latex.trim();

    if (useEnumerate) {
      if (isQuestionRun(block.type) && !inEnumerate) {
        lines.push("\t\\begin{enumerate}");
        inEnumerate = true;
      } else if (!isQuestionRun(block.type) && inEnumerate) {
        lines.push("\t\\end{enumerate}");
        inEnumerate = false;
      }
    }

    const baseIndent = inEnumerate ? "\t\t" : "\t";
    if (inEnumerate && block.type === "question") {
      lines.push(`${baseIndent}\\item`);
    }

    if (body.includes("\n")) {
      lines.push(`${baseIndent}\\${cmd}{`);
      lines.push(indentLines(body, baseIndent + "\t"));
      lines.push(`${baseIndent}}`);
    } else {
      lines.push(`${baseIndent}\\${cmd}{${body}}`);
    }
  }

  if (inEnumerate) {
    lines.push("\t\\end{enumerate}");
  }

  lines.push("}");

  return lines.join("\n") + "\n";
}

/**
 * Détecte une sortie d'assistant IA constituée d'un environnement enumerate
 * de plusieurs items (plusieurs questions produites en une seule réponse).
 *
 * La plateforme ne préserve pas les enumerate : dans les sources, ils ne
 * servent que d'échafaudage aux \item \question{} et la conversion les
 * transforme en blocs question numérotés. Chaque item doit donc devenir un
 * bloc distinct dans l'éditeur.
 *
 * @param {string} latex
 * @returns {{ prefix: string, items: string[] } | null}
 *   `prefix` : texte précédant l'enumerate (introduction éventuelle),
 *   `items`  : contenu de chaque \item. `null` si la sortie n'est pas un
 *   enumerate exploitable (absent, imbriqué, ou moins de deux items).
 */
export function splitEnumerateItems(latex) {
  const m = String(latex ?? "")
    .trim()
    .match(
      /^([\s\S]*?)\\begin\{enumerate\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{enumerate\}\s*$/,
    );
  if (!m) return null;

  const [, prefix, body] = m;
  // Enumerate imbriqué ou prefix contenant lui-même une liste : ne pas toucher
  if (body.includes("\\begin{enumerate}") || prefix.includes("\\begin{")) {
    return null;
  }

  const items = body
    .split(/\\item\s*(?:\[[^\]]*\])?/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length < 2) return null;

  return { prefix: prefix.trim(), items };
}

/** Supprime les commentaires LaTeX (% non échappés). */
function stripTexComments(str) {
  return str.replace(/(?<!\\)%.*$/gm, "").trim();
}

/**
 * Parse une source .tex au format du site en { meta, blocks }.
 * Reprend la logique d'appariement d'accolades de scripts/parse-latex.js.
 *
 * @param {string} source
 * @returns {{ meta: Object, blocks: { type: string, latex: string }[] }}
 */
export function parseExerciseTex(source) {
  const meta = {};
  const blocks = [];

  const metaByCmd = Object.fromEntries(META_FIELDS.map((f) => [f.cmd, f.key]));
  const allCommands = [
    ...META_FIELDS.map((f) => f.cmd),
    ...BLOCK_TYPES.map((b) => b.cmd),
    "code",
  ];
  const commandRegex = new RegExp(
    `(?<!\\\\)\\\\(${allCommands.join("|")})\\s*\\{`,
    "g",
  );

  let match;
  while ((match = commandRegex.exec(source)) !== null) {
    const commandName = match[1];

    // Commande commentée ?
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const linePrefix = source.slice(lineStart, match.index);
    if (/(?<!\\)%/.test(linePrefix)) continue;

    // Extraction du contenu entre accolades (imbrication gérée)
    let index = match.index + match[0].length;
    let braceCount = 1;
    let content = "";
    while (braceCount > 0 && index < source.length) {
      const char = source[index];
      if (char === "\\") {
        content += char + (source[index + 1] ?? "");
        index++;
      } else if (char === "{") {
        braceCount++;
        content += char;
      } else if (char === "}") {
        braceCount--;
        if (braceCount > 0) content += char;
      } else {
        content += char;
      }
      index++;
    }

    if (commandName === "code") {
      blocks.push({ type: "code", latex: content.trim() });
    } else if (TYPE_BY_CMD[commandName]) {
      blocks.push({
        type: TYPE_BY_CMD[commandName],
        latex: stripTexComments(content.trim()),
      });
    } else if (metaByCmd[commandName]) {
      meta[metaByCmd[commandName]] = stripTexComments(content.trim());
    }
  }

  return { meta, blocks };
}
