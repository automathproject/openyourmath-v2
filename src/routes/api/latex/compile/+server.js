// Proxy contrôlé vers TeXLive.net. Le navigateur passe par l'application pour
// éviter les contraintes CORS tout en conservant l'aperçu Blob et les logs.

import { json } from "@sveltejs/kit";
import { checkRateLimit } from "$lib/server/rateLimiter.js";

const TEXLIVE_URL = "https://texlive.net/cgi-bin/latexcgi";
const MAX_SOURCE_BYTES = 120_000;
const MAX_ASSETS = 8;
const MAX_ASSET_BYTES = 1_500_000;
const MAX_TOTAL_ASSET_BYTES = 6_000_000;
// TeXLive.net reçoit les fichiers auxiliaires via des champs texte
// `filecontents[]` : les formats binaires (PNG/JPEG/PDF) ne sont donc pas
// transportables de façon fiable avec ce moteur public.
const ALLOWED_EXTENSIONS = new Set([
  ".svg",
  ".eps",
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
  const filenames = new Set(["document.tex"]);
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

  // Contrat multipart documenté par TeXLive.net.
  const upstream = new FormData();
  upstream.append("filename[]", "document.tex");
  upstream.append("filecontents[]", await source.text());
  for (const asset of assets) {
    upstream.append("filename[]", safeFilename(asset.name, "resource"));
    upstream.append("filecontents[]", await asset.text());
  }
  upstream.append("engine", "lualatex");
  upstream.append("return", "pdf");

  let response;
  try {
    response = await fetch(TEXLIVE_URL, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message =
      error?.name === "TimeoutError"
        ? "Le compilateur a dépassé le délai autorisé."
        : "Le compilateur distant est indisponible.";
    return json({ error: message }, { status: 502 });
  }

  const output = await response.arrayBuffer();
  const isPdf =
    output.byteLength >= 5 &&
    new TextDecoder().decode(output.slice(0, 5)) === "%PDF-";
  if (!response.ok || !isPdf) {
    const log = new TextDecoder().decode(output).slice(0, 60_000);
    return new Response(log || "La compilation a échoué sans journal.", {
      status: 422,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(output, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="document.pdf"',
      "cache-control": "no-store",
    },
  });
}
