// src/routes/api/create/assist/+server.js
// Assistant IA de rédaction d'exercices : génère une question, une indication,
// une solution ou un texte d'introduction via l'API Albert (openai/gpt-oss-120b).

import { json, error } from "@sveltejs/kit";
import {
  chatMessages,
  MODELS,
  withRetry,
  isQuotaExceeded,
} from "$lib/ia/albert.js";
import { checkRateLimit } from "$lib/server/rateLimiter.js";
import { trackAlbertChat, isChatThrottled } from "$lib/server/albertQuota.js";
import {
  SYSTEM_PROMPT,
  FIX_LATEX_SYSTEM_PROMPT,
  buildTaskPrompt,
  buildFixLatexPrompt,
  META_TASKS,
  REVISION_TASK,
  LINEAR_STRUCTURE_RETRY_TASK,
} from "$lib/ia/assistPrompts.js";
import { getChapterStructure } from "$lib/db/queries.js";
import {
  limitedSequenceLatex,
  questionBlocksFromAi,
} from "$lib/ia/sequence.js";

const VALID_MODES = new Set([
  "text",
  "question",
  "sequence",
  "revise",
  "indication",
  "reponse",
  "metadata",
  "fixlatex",
]);

// ── Taxonomie existante (pour ancrer les suggestions de métadonnées) ─────────

let taxonomyCache = null;
let taxonomyCacheAt = 0;
const TAXONOMY_TTL_MS = 10 * 60_000;

/**
 * Valeurs distinctes de module/chapitre/sous-chapitre présentes en base,
 * avec leurs relations pour pouvoir filtrer selon les champs déjà remplis.
 */
async function getTaxonomy() {
  if (taxonomyCache && Date.now() - taxonomyCacheAt < TAXONOMY_TTL_MS) {
    return taxonomyCache;
  }
  const entries = []; // { module, chapter, subchapter }
  const structure = await getChapterStructure();
  for (const level of structure || []) {
    for (const mod of level.modules || []) {
      if (!mod.chapters?.length) {
        entries.push({ module: mod.name, chapter: null, subchapter: null });
      }
      for (const chap of mod.chapters || []) {
        if (!chap.subchapters?.length) {
          entries.push({
            module: mod.name,
            chapter: chap.name,
            subchapter: null,
          });
        }
        for (const sub of chap.subchapters || []) {
          entries.push({
            module: mod.name,
            chapter: chap.name,
            subchapter: sub.name,
          });
        }
      }
    }
  }
  taxonomyCache = entries;
  taxonomyCacheAt = Date.now();
  return entries;
}

function distinct(values, max = 40) {
  return [...new Set(values.filter(Boolean))].slice(0, max);
}

/**
 * Complète la consigne d'un champ de métadonnée avec les valeurs existantes
 * sur la plateforme (filtrées par les champs déjà renseignés).
 */
async function metadataTask(field, meta) {
  let task = META_TASKS[field];

  if (field === "module" || field === "chapter" || field === "subchapter") {
    try {
      let entries = await getTaxonomy();
      if (field !== "module" && meta?.module) {
        const filtered = entries.filter((e) => e.module === meta.module);
        if (filtered.length) entries = filtered;
      }
      if (field === "subchapter" && meta?.chapter) {
        const filtered = entries.filter((e) => e.chapter === meta.chapter);
        if (filtered.length) entries = filtered;
      }
      const values = distinct(entries.map((e) => e[field]));
      if (values.length) {
        task += `\n\nValeurs déjà utilisées sur la plateforme (privilégie l'une d'elles si elle convient, sinon proposes-en une nouvelle) : ${values.join(" ; ")}`;
      }
    } catch (err) {
      // Base indisponible : la suggestion reste possible sans ancrage
      console.warn("[create/assist] taxonomie indisponible:", err.message);
    }
  }

  return task;
}

/** Normalise une valeur de métadonnée : une seule ligne, sans guillemets. */
function cleanMetadataValue(text, field) {
  let out =
    (text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0] ?? "";
  out = out.replace(/^["'«\s]+|["'»\s.]+$/g, "");
  if (field === "difficulty") {
    const m = out.match(/[1-5]/);
    out = m ? m[0] : "";
  }
  return out;
}

/**
 * Nombre de questions à garantir pour une séquence. Le champ explicite est
 * utilisé par les nouveaux clients ; l'extraction de la consigne préserve la
 * garantie lors d'un déploiement progressif avec un client plus ancien.
 */
function requestedSequenceCount(questionCount, instruction) {
  const explicit = Number(questionCount);
  if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 8)
    return explicit;

  const match = String(instruction).match(/exactement\s+(\d+)\s+questions?/i);
  if (!match) return null;
  const inferred = Number(match[1]);
  return Number.isInteger(inferred) && inferred >= 1 && inferred <= 8
    ? inferred
    : null;
}

/**
 * Vrai quand la réponse doit être réécrite par le modèle plutôt que remise à
 * plat automatiquement : des sous-questions ont été trouvées dans un énoncé
 * ET le nombre demandé oblige à en supprimer. Seul le modèle peut fusionner
 * ce que la troncature perdrait — notamment l'objectif final, souvent relégué
 * en dernière sous-partie.
 *
 * Quand la remise à plat suffit (elle tombe juste sur le nombre demandé), on
 * s'en contente : pas d'appel supplémentaire.
 *
 * @param {string} latex
 * @param {number | null} requestedCount
 * @returns {boolean}
 */
function needsLinearRewrite(latex, requestedCount) {
  const separated = String(latex)
    .split(/\n\s*---\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const { questions } = questionBlocksFromAi(latex);
  if (questions.length <= separated.length) return false;
  return !requestedCount || questions.length > requestedCount;
}

function describeExercise(meta, blocks) {
  const lines = [];
  if (meta?.title) lines.push(`Titre : ${meta.title}`);
  if (meta?.level) lines.push(`Niveau : ${meta.level}`);
  if (meta?.module) lines.push(`Module : ${meta.module}`);
  if (meta?.chapter) lines.push(`Chapitre : ${meta.chapter}`);
  if (meta?.subchapter) lines.push(`Sous-chapitre : ${meta.subchapter}`);
  if (meta?.theme) lines.push(`Thèmes : ${meta.theme}`);
  if (meta?.difficulty) lines.push(`Difficulté : ${meta.difficulty}/5`);

  const labels = {
    text: "Description",
    question: "Question",
    indication: "Indication",
    reponse: "Solution",
  };
  let qNum = 0;
  const contentLines = [];
  for (const block of blocks || []) {
    if (!block?.latex?.trim()) continue;
    let label = labels[block.type] || "Bloc";
    if (block.type === "question") {
      qNum++;
      label = `Question ${qNum}`;
    }
    contentLines.push(`--- ${label} ---\n${block.latex.trim()}`);
  }

  return [
    lines.length ? `Métadonnées de l'exercice :\n${lines.join("\n")}` : "",
    contentLines.length
      ? `Contenu actuel de l'exercice :\n\n${contentLines.join("\n\n")}`
      : "L'exercice est vide pour l'instant.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Filet de sécurité contre le Markdown : la consigne système l'interdit,
 * mais un modèle peut malgré tout en laisser échapper (gras, titres,
 * puces, liens, code inline). On neutralise ces artefacts sans jamais
 * toucher aux zones mathématiques ($...$ et \[...\]), où _ et * ont un
 * sens LaTeX légitime (indices, exposants...).
 */
function stripMarkdownArtifacts(text, { allowDashSeparator = false } = {}) {
  const parts = String(text || "").split(/(\$[^$]*\$|\\\[[\s\S]*?\\\])/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // zone mathématique : inchangée
      let out = part;
      out = out.replace(/^#{1,6}[ \t]+/gm, ""); // # Titre
      out = out.replace(/\*\*([^*\n]+)\*\*/g, "\\textbf{$1}"); // **gras**
      out = out.replace(/__([^_\n]+)__/g, "\\textbf{$1}"); // __gras__
      out = out.replace(/^[ \t]*[-*][ \t]+(?!\*\*)/gm, ""); // - puce / * puce
      out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [texte](url)
      out = out.replace(/`([^`\n]+)`/g, "$1"); // `code`
      // Lignes horizontales Markdown (---, ***, ___) : toujours des
      // artefacts sauf le "---" isolé, qui sert de séparateur protocolaire
      // entre questions en mode séquence (cf. questionBlocksFromAi).
      out = out.replace(/^[ \t]*(?:\*{3,}|_{3,})[ \t]*$/gm, "");
      if (!allowDashSeparator) {
        out = out.replace(/^[ \t]*-{3,}[ \t]*$/gm, "");
      }
      out = out.replace(/\n{3,}/g, "\n\n"); // recolle les lignes vidées
      return out;
    })
    .join("");
}

/** Nettoie la sortie du modèle : fences Markdown, wrappers \question{...}, etc. */
function cleanModelOutput(text, mode) {
  let out = (text || "").trim();

  const fence = out.match(/^```(?:latex|tex)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) out = fence[1].trim();

  const wrapper = out.match(
    /^\\(?:texte|question|indication|reponse)\{([\s\S]*)\}$/,
  );
  if (wrapper) out = wrapper[1].trim();

  return stripMarkdownArtifacts(out, {
    allowDashSeparator: mode === "sequence",
  }).trim();
}

function parseRevisionOutput(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*\n([\s\S]*?)\n```\s*$/i, "$1");
  const parsed = JSON.parse(cleaned);
  const allowedTypes = new Set(["text", "question", "indication", "reponse"]);
  if (
    !Array.isArray(parsed?.blocks) ||
    !parsed.blocks.length ||
    parsed.blocks.length > 80
  ) {
    throw new Error("Structure de révision invalide");
  }
  const blocks = parsed.blocks.map((block) => {
    if (!allowedTypes.has(block?.type) || typeof block?.latex !== "string") {
      throw new Error("Bloc de révision invalide");
    }
    return {
      type: block.type,
      latex: stripMarkdownArtifacts(block.latex.trim()).trim(),
    };
  });
  if (!blocks.some((block) => block.type === "question")) {
    throw new Error("La révision ne contient aucune question");
  }
  return blocks;
}

function getClientIp(event) {
  const forwarded = event.request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}

export async function POST(event) {
  const t0 = Date.now();
  const ip = getClientIp(event);

  const rl = checkRateLimit(`assist:${ip}`, 12);
  if (!rl.allowed) {
    return json(
      {
        error: "Trop de requêtes, réessayez dans une minute.",
        retryAfter: rl.retryAfter,
      },
      { status: 429 },
    );
  }
  if (isChatThrottled()) {
    return json(
      {
        error:
          "L'assistant IA est temporairement saturé, réessayez dans une minute.",
      },
      { status: 503 },
    );
  }

  let payload;
  try {
    payload = await event.request.json();
  } catch {
    throw error(400, { message: "Corps JSON invalide" });
  }

  const {
    mode,
    meta = {},
    blocks = [],
    targetLatex = "",
    instruction = "",
    taskPrompt = "",
    field = "",
    questionCount = null,
  } = payload || {};
  if (!VALID_MODES.has(mode)) {
    throw error(400, { message: `Mode invalide : ${mode}` });
  }
  if (mode === "metadata" && !META_TASKS[field]) {
    throw error(400, { message: `Champ de métadonnée invalide : ${field}` });
  }
  if (
    (mode === "indication" || mode === "reponse" || mode === "fixlatex") &&
    !targetLatex.trim() &&
    !String(taskPrompt).trim()
  ) {
    throw error(400, {
      message: "targetLatex requis pour ce mode",
    });
  }
  if (mode === "revise" && !String(instruction).trim()) {
    throw error(400, { message: "Modification à répercuter requise" });
  }
  if (String(instruction).length > 2000) {
    throw error(400, { message: "Consigne trop longue (max 2000 caractères)" });
  }
  if (String(taskPrompt).length > 12_000) {
    throw error(400, {
      message: "Consigne personnalisée trop longue (max 12000 caractères)",
    });
  }
  const sequenceQuestionCount =
    mode === "sequence"
      ? requestedSequenceCount(questionCount, instruction)
      : null;

  // Le correcteur LaTeX ne doit voir que le texte à corriger : lui joindre
  // tout l'exercice inciterait le modèle à réécrire plutôt qu'à corriger.
  const context =
    mode === "fixlatex" ? "" : describeExercise(meta, blocks).slice(0, 20_000);
  // Consigne personnalisée éditée dans l'UI, sinon consigne par défaut
  let task;
  if (mode === "metadata") {
    task = await metadataTask(field, meta);
  } else if (mode === "revise") {
    task = `${REVISION_TASK}\n\nModification demandée par l'auteur : ${String(instruction).trim()}`;
  } else if (mode === "fixlatex") {
    task =
      String(taskPrompt).trim() ||
      buildFixLatexPrompt({
        content: String(targetLatex).slice(0, 8000),
        instruction: String(instruction),
      });
  } else if (String(taskPrompt).trim()) {
    task = String(taskPrompt).trim();
  } else {
    task = buildTaskPrompt(mode, {
      targetLatex: String(targetLatex).slice(0, 8000),
      instruction: String(instruction),
    });
  }

  // Les métadonnées et la correction LaTeX sont des tâches courtes et
  // mécaniques (classification, conversion de syntaxe) : le modèle
  // équilibré suffit et répond plus vite que gpt-oss-120b, réservé à la
  // rédaction créative. La révision doit reproduire l'exercice complet
  // (blocs inchangés compris) en JSON strict : jsonMode force le format et
  // un budget de tokens plus large évite une troncature sur un gros exercice.
  const generation =
    mode === "metadata"
      ? { model: MODELS.chat, temperature: 0, maxTokens: 80, timeoutMs: 30_000 }
      : mode === "fixlatex"
        ? {
            model: MODELS.chat,
            temperature: 0,
            maxTokens: 1500,
            timeoutMs: 30_000,
          }
        : mode === "revise"
          ? {
              model: MODELS.chatLarge,
              temperature: 0.3,
              maxTokens: 4000,
              timeoutMs: 90_000,
              jsonMode: true,
            }
          : {
              model: MODELS.chatLarge,
              temperature: 0.3,
              maxTokens: 2000,
              timeoutMs: 90_000,
            };

  trackAlbertChat();

  try {
    const systemPrompt =
      mode === "fixlatex" ? FIX_LATEX_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const baseMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [context, task].filter(Boolean).join("\n\n"),
      },
    ];
    const callModel = (messages) =>
      withRetry(() => chatMessages(messages, generation), { maxAttempts: 2 });
    const raw = await callModel(baseMessages);

    let revisionBlocks = null;
    if (mode === "revise") {
      try {
        revisionBlocks = parseRevisionOutput(raw);
      } catch (parseErr) {
        console.error(
          "[create/assist] Révision : réponse non interprétable:",
          parseErr.message,
          "\nRéponse brute (tronquée):",
          String(raw).slice(0, 2000),
        );
        return json(
          {
            error:
              "La réponse de l'IA n'a pas pu être interprétée, réessayez (éventuellement en reformulant la modification).",
          },
          { status: 502 },
        );
      }
    }
    let latex =
      mode === "metadata"
        ? cleanMetadataValue(cleanModelOutput(raw, mode), field)
        : mode === "revise"
          ? "[révision structurée]"
          : cleanModelOutput(raw, mode);
    // Le modèle glisse régulièrement des sous-questions ((a), (b), étapes
    // numérotées) dans un énoncé. La remise à plat côté client en fait des
    // blocs, mais elle ne peut pas fusionner ce qui aurait dû l'être quand le
    // nombre demandé ne permet pas de les répartir : une relance corrective,
    // bornée à un essai, avec la réponse fautive en contexte. Si elle échoue
    // aussi, la réponse initiale est conservée puis remise à plat : mieux vaut
    // un énoncé imparfait qu'une erreur affichée à l'auteur.
    if (
      mode === "sequence" &&
      needsLinearRewrite(latex, sequenceQuestionCount)
    ) {
      trackAlbertChat();
      const retryRaw = await callModel([
        ...baseMessages,
        { role: "assistant", content: raw },
        { role: "user", content: LINEAR_STRUCTURE_RETRY_TASK },
      ]);
      const retryLatex = cleanModelOutput(retryRaw, mode);
      if (retryLatex && !needsLinearRewrite(retryLatex, sequenceQuestionCount))
        latex = retryLatex;
    }
    if (mode === "sequence" && sequenceQuestionCount) {
      latex = limitedSequenceLatex(latex, sequenceQuestionCount);
    }
    if (!latex) throw new Error("Réponse vide du modèle");

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        type: "create-assist",
        mode,
        field: field || undefined,
        latencyMs: Date.now() - t0,
        outputChars:
          mode === "revise"
            ? JSON.stringify(revisionBlocks).length
            : latex.length,
        ip: ip.slice(0, 7) + "…",
      }),
    );

    return mode === "revise"
      ? json({ blocks: revisionBlocks, model: generation.model })
      : json({ latex, model: generation.model });
  } catch (err) {
    console.error("[create/assist] Échec Albert:", err.message);
    if (isQuotaExceeded(err)) {
      return json(
        { error: "Quota journalier Albert dépassé, réessayez demain." },
        { status: 503 },
      );
    }
    return json(
      { error: "L'assistant IA n'a pas pu répondre, réessayez." },
      { status: 502 },
    );
  }
}
