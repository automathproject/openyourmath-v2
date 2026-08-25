// Proxy contrôlé vers TeXLive.net. Le navigateur passe par l'application pour
// éviter les contraintes CORS tout en conservant l'aperçu Blob et les logs.

import { json } from "@sveltejs/kit";
import { checkRateLimit } from "$lib/server/rateLimiter.js";
import { REMOTE_IMAGE_EXTENSIONS } from "$lib/latex/export.js";
import { compileLatexDocument, MAIN_DOCUMENT_NAME } from "$lib/server/latexCompile.js";

const MAX_SOURCE_BYTES = 120_000;
const MAX_ASSETS = 8;
const MAX_ASSET_BYTES = 1_500_000;
const MAX_TOTAL_ASSET_BYTES = 6_000_000;
// TeXLive.net reçoit les fichiers auxiliaires via des champs texte
// `filecontents[]` : les formats binaires (PNG/JPEG/PDF) ne sont donc pas
// transportables de façon fiable avec ce moteur public. Les formats d'image
// viennent de l'export, qui remplace les autres par un encart : les deux côtés
// décrivent ainsi la même contrainte à partir d'une seule liste.
const ALLOWED_EXTENSIONS = new Set([
  ...REMOTE_IMAGE_EXTENSIONS,
  ".tex",
  ".sty",
  ".cls",
  ".bib",
  ".csv",
]);

function clientIp(event) {
  const forwarded = event.request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}

function safeFilename(value, fallback) {
  const name = String(value || fallback)
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(name) ? name : null;
}

export async function POST(event) {
  const rate = checkRateLimit(`latex-compile:${clientIp(event)}`, 6);
  if (!rate.allowed) {
    return json(
      { error: "Trop de compilations, réessayez dans une minute." },
      { status: 429 },
    );
  }

  let form;
  try {
    form = await event.request.formData();
  } catch {
    return json(
      { error: "Le formulaire de compilation est invalide." },
      { status: 400 },
    );
  }

  const source = form.get("source");
  if (
    !(source instanceof File) ||
    source.size === 0 ||
    source.size > MAX_SOURCE_BYTES
  ) {
    return json(
      { error: "Le document .tex est absent ou dépasse 120 Ko." },
      { status: 400 },
    );
  }
  const assets = form.getAll("asset");
  if (
    assets.length > MAX_ASSETS ||
    assets.some((asset) => !(asset instanceof File))
  ) {
    return json(
      { error: `Au plus ${MAX_ASSETS} ressources peuvent être jointes.` },
      { status: 400 },
    );
  }
  if (
    assets.reduce((total, asset) => total + asset.size, 0) >
    MAX_TOTAL_ASSET_BYTES
  ) {
    return json(
      { error: "Les ressources jointes dépassent 6 Mo au total." },
      { status: 413 },
    );
  }
  // Le service exige que la source soit transmise sous le nom document.tex.
  const filenames = new Set([MAIN_DOCUMENT_NAME]);
  for (const asset of assets) {
    const filename = safeFilename(asset.name, "resource");
    const extension = filename?.slice(filename.lastIndexOf(".")).toLowerCase();
    if (
      !filename ||
      !ALLOWED_EXTENSIONS.has(extension) ||
      asset.size === 0 ||
      asset.size > MAX_ASSET_BYTES
    ) {
      return json(
        {
          error:
            "Une ressource est invalide (SVG, EPS, TeX, style, classe, BibTeX ou CSV, 1,5 Mo max).",
        },
        { status: 400 },
      );
    }
    if (filenames.has(filename)) {
      return json(
        {
          error:
            "Chaque ressource doit avoir un nom différent du document et des autres ressources.",
        },
        { status: 400 },
      );
    }
    filenames.add(filename);
  }

  const result = await compileLatexDocument({
    source: await source.text(),
    assets: await Promise.all(
      assets.map(async (asset) => ({
        name: safeFilename(asset.name, "resource"),
        content: await asset.text(),
      })),
    ),
  });

  if (!result.ok) {
    // L'éditeur affiche le journal brut : il alimente les diagnostics ligne à
    // ligne, que l'enrobage JSON rendrait inexploitables.
    if (result.status === 422) {
      return new Response(result.log || "La compilation a échoué sans journal.", {
        status: 422,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return json({ error: result.error }, { status: result.status });
  }

  return new Response(result.pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="document.pdf"',
      "cache-control": "no-store",
    },
  });
}
