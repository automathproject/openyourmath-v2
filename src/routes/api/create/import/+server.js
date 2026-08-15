// src/routes/api/create/import/+server.js
// Restructuration IA d'un document (pages d'un PDF ou image, envoyées en
// data-URL JPEG/PNG) vers le format .tex source du site. Utilise le modèle
// vision d'Albert (Mistral-Small-3.2, image-text-to-text).
//
// Les pages sont réduites côté client (~1600px, JPEG) pour tenir dans la
// limite de taille du body (BODY_SIZE_LIMIT en production adapter-node).

import { json, error } from "@sveltejs/kit";
import { chatMessages, MODELS, isQuotaExceeded } from "$lib/ia/albert.js";
import { checkRateLimit } from "$lib/server/rateLimiter.js";
import { trackAlbertChat, isChatThrottled } from "$lib/server/albertQuota.js";

const MAX_PAGES = 4;
const MAX_PAGE_BYTES = 1_500_000; // data-URL ≈ 1,1 Mo d'image

const IMPORT_PROMPT = `Tu es un assistant qui transcrit des exercices de mathématiques vers le format LaTeX de la plateforme OpenYourMath.

Transcris fidèlement chaque exercice autonome visible sur ces images (énoncé, questions, indications et solutions si présentes) au format suivant :

\\titre{...}
\\niveau{...}
\\chapitre{...}
\\theme{...}
\\difficulte{...}

\\contenu{
\t\\texte{
\t\tTexte d'introduction, définitions des objets, notations.
\t}
\t\\begin{enumerate}
\t\t\\item
\t\t\\question{Première question.}
\t\t\\indication{Indication éventuelle.}
\t\t\\reponse{Solution éventuelle.}
\t\t\\item
\t\t\\question{Deuxième question.}
\t\\end{enumerate}
}

Règles impératives :
- Mathématiques en LaTeX compatible KaTeX : $...$ en ligne, \\[...\\] pour les formules centrées.
- Transcris TOUT le contenu mathématique, sans le résumer ni le corriger.
- \\niveau : un niveau parmi L1, L2, L3, M1, M2, Terminale (déduis-le du contenu).
- \\difficulte : un entier de 1 à 5 (déduis-le du contenu).
- \\theme : deux à cinq mots-clés séparés par des virgules.
- S'il n'y a qu'une seule question, mets \\question{...} directement dans \\contenu{} sans enumerate.
- N'invente ni indication ni solution : n'inclus \\indication{} et \\reponse{} que si le document en contient.
- Si le document contient une figure, insère à sa place le commentaire % TODO figure.
- Si le document contient plusieurs exercices indépendants, fournis la source complète de chacun et sépare-les uniquement par cette ligne exacte : % === OYM_EXERCISE_BREAK === %. Ne sépare pas les questions d'un même exercice.
- Réponds UNIQUEMENT avec la ou les sources .tex, sans Markdown ni texte explicatif. Le séparateur demandé est le seul commentaire autorisé.`;

function getClientIp(event) {
  const forwarded = event.request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}

function cleanTexOutput(text) {
  let out = (text || "").trim();
  const fence = out.match(/^```(?:latex|tex)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) out = fence[1].trim();
  return out;
}

export async function POST(event) {
  const t0 = Date.now();
  const ip = getClientIp(event);

  const rl = checkRateLimit(`import:${ip}`, 3);
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

  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  if (pages.length === 0) {
    throw error(400, { message: "Aucune page fournie" });
  }
  if (pages.length > MAX_PAGES) {
    throw error(400, { message: `Trop de pages (max ${MAX_PAGES})` });
  }
  for (const page of pages) {
    if (
      typeof page !== "string" ||
      !/^data:image\/(?:jpeg|png|webp);base64,/.test(page)
    ) {
      throw error(400, {
        message: "Chaque page doit être une data-URL image (jpeg, png ou webp)",
      });
    }
    if (page.length > MAX_PAGE_BYTES) {
      throw error(400, { message: "Page trop lourde (max ~1 Mo par image)" });
    }
  }

  const userContent = [
    { type: "text", text: IMPORT_PROMPT },
    ...pages.map((page) => ({ type: "image_url", image_url: { url: page } })),
  ];

  trackAlbertChat();

  try {
    const raw = await chatMessages([{ role: "user", content: userContent }], {
      model: MODELS.chat, // Mistral-Small-3.2 : seul modèle vision de qualité sur Albert
      temperature: 0,
      maxTokens: 6000,
      timeoutMs: 180_000,
    });

    const tex = cleanTexOutput(raw);
    if (!tex.includes("\\contenu{")) {
      console.warn(
        "[create/import] Sortie sans \\contenu{}, renvoyée telle quelle",
      );
    }

    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        type: "create-import",
        pages: pages.length,
        latencyMs: Date.now() - t0,
        outputChars: tex.length,
        ip: ip.slice(0, 7) + "…",
      }),
    );

    return json({ tex, model: MODELS.chat });
  } catch (err) {
    console.error("[create/import] Échec Albert:", err.message);
    if (isQuotaExceeded(err)) {
      return json(
        { error: "Quota journalier Albert dépassé, réessayez demain." },
        { status: 503 },
      );
    }
    return json(
      {
        error:
          "L'import IA a échoué, réessayez (document trop long ou illisible ?).",
      },
      { status: 502 },
    );
  }
}
