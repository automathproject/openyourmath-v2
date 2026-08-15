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
  buildTaskPrompt,
  META_TASKS,
  REVISION_TASK,
} from "$lib/ia/assistPrompts.js";
import { getChapterStructure } from "$lib/db/queries.js";

const VALID_MODES = new Set([
  "text",
  "question",
  "sequence",
  "revise",
  "indication",
  "reponse",
  "metadata",
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

/** Nettoie la sortie du modèle : fences Markdown, wrappers \question{...}, etc. */
function cleanModelOutput(text) {
  let out = (text || "").trim();

  const fence = out.match(/^```(?:latex|tex)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) out = fence[1].trim();

  const wrapper = out.match(
    /^\\(?:texte|question|indication|reponse)\{([\s\S]*)\}$/,
  );
  if (wrapper) out = wrapper[1].trim();

  return out;
}

function parseRevisionOutput(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*\n([\s\S]*?)\n```\s*$/i, "$1");
  const parsed = JSON.parse(cleaned);
  const allowedTypes = new Set(["text", "question", "indication", "reponse"]);
  if (!Array.isArray(parsed?.blocks) || !parsed.blocks.length || parsed.blocks.length > 80) {
    throw new Error("Structure de révision invalide");
  }
  const blocks = parsed.blocks.map((block) => {
    if (!allowedTypes.has(block?.type) || typeof block?.latex !== "string") {
      throw new Error("Bloc de révision invalide");
    }
    return { type: block.type, latex: block.latex.trim() };
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
  } = payload || {};
  if (!VALID_MODES.has(mode)) {
    throw error(400, { message: `Mode invalide : ${mode}` });
  }
  if (mode === "metadata" && !META_TASKS[field]) {
    throw error(400, { message: `Champ de métadonnée invalide : ${field}` });
  }
  if (
    (mode === "indication" || mode === "reponse") &&
    !targetLatex.trim() &&
    !String(taskPrompt).trim()
  ) {
    throw error(400, {
      message: "targetLatex requis pour ce mode (question concernée)",
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

  const context = describeExercise(meta, blocks).slice(0, 20_000);
  // Consigne personnalisée éditée dans l'UI, sinon consigne par défaut
  let task;
  if (mode === "metadata") {
    task = await metadataTask(field, meta);
  } else if (mode === "revise") {
    task = `${REVISION_TASK}\n\nModification demandée par l'auteur : ${String(instruction).trim()}`;
  } else if (String(taskPrompt).trim()) {
    task = String(taskPrompt).trim();
  } else {
    task = buildTaskPrompt(mode, {
      targetLatex: String(targetLatex).slice(0, 8000),
      instruction: String(instruction),
    });
  }

  // Les métadonnées sont une tâche courte de classification : le modèle
  // équilibré suffit et répond plus vite que gpt-oss-120b.
  const generation =
    mode === "metadata"
      ? { model: MODELS.chat, temperature: 0, maxTokens: 80, timeoutMs: 30_000 }
      : {
          model: MODELS.chatLarge,
          temperature: 0.3,
          maxTokens: 2000,
          timeoutMs: 90_000,
        };

  trackAlbertChat();

  try {
    const raw = await withRetry(
      () =>
        chatMessages(
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `${context}\n\n${task}` },
          ],
          generation,
        ),
      { maxAttempts: 2 },
    );

    const revisionBlocks = mode === "revise" ? parseRevisionOutput(raw) : null;
    const latex = mode === "metadata"
      ? cleanMetadataValue(cleanModelOutput(raw), field)
      : mode === "revise" ? "[révision structurée]" : cleanModelOutput(raw);
    if (!latex) throw new Error("Réponse vide du modèle");

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        type: "create-assist",
        mode,
        field: field || undefined,
        latencyMs: Date.now() - t0,
        outputChars: mode === "revise" ? JSON.stringify(revisionBlocks).length : latex.length,
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
