// src/routes/api/export/pdf/+server.js
// PDF d'une liste d'exercices, en un lien.
//
// La page liste proposait déjà « feuille de TD » et « corrigé » vers cette
// adresse, qui n'existait pas : les deux cartes renvoyaient un 404. La route
// reprend le contrat d'URL de la liste (?list=uuid1,uuid2&title=…) pour que le
// lien reste partageable et s'ouvre dans un nouvel onglet.

import { json } from '@sveltejs/kit';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import { compileLatexDocument } from '$lib/server/latexCompile.js';
import { getExerciseByUuid } from '$lib/db/queries.js';
import {
  buildLatexExport,
  fetchArtifactsMap,
  latexFileName,
} from '$lib/latex/export.js';

// La compilation est coûteuse et sollicite un service tiers : le quota est
// plus strict que celui de l'éditeur interactif.
const RATE_LIMIT_PER_MINUTE = 3;
const MAX_EXERCISES = 40;
const MAX_ASSETS = 8;

function clientIp(event) {
  const forwarded = event.request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  try {
    return event.getClientAddress();
  } catch {
    return 'unknown';
  }
}

/** Drapeau de requête : présent et non « 0 » vaut vrai. */
function flag(params, name, fallback = false) {
  if (!params.has(name)) return fallback;
  const value = params.get(name);
  return value !== '0' && value !== 'false';
}

export async function GET(event) {
  const params = event.url.searchParams;
  const uuids = (params.get('list') || '')
    .split(',')
    .map((uuid) => uuid.trim())
    .filter(Boolean);

  if (uuids.length === 0) {
    return json(
      { error: 'Indiquez la liste des exercices : ?list=uuid1,uuid2' },
      { status: 400 },
    );
  }
  if (uuids.length > MAX_EXERCISES) {
    return json(
      { error: `Au plus ${MAX_EXERCISES} exercices par document.` },
      { status: 400 },
    );
  }

  // L'ordre de l'URL est celui de la séance : il porte l'intention de
  // l'enseignant et doit être conservé dans le document.
  const loaded = await Promise.all(uuids.map((uuid) => getExerciseByUuid(uuid)));
  const exercises = loaded.filter(Boolean);

  if (exercises.length === 0) {
    return json({ error: 'Aucun exercice trouvé pour cette liste.' }, { status: 404 });
  }

  // Le quota ne se consomme qu'une fois la requête reconnue valide : une URL
  // malformée ne déclenche aucune compilation, elle ne doit donc pas priver
  // l'utilisateur de la suivante.
  const rate = checkRateLimit(`export-pdf:${clientIp(event)}`, RATE_LIMIT_PER_MINUTE);
  if (!rate.allowed) {
    return json(
      { error: 'Trop de compilations, réessayez dans une minute.' },
      { status: 429, headers: { 'retry-after': String(rate.retryAfter ?? 60) } },
    );
  }

  const title = params.get('title') || "Liste d'exercices";
  const includeSolutions = flag(params, 'solutions');
  // Une feuille de TD ne porte pas d'indications ; un corrigé les inclut, sauf
  // demande contraire explicite.
  const includeHints = flag(params, 'hints', includeSolutions);

  const { source, images } = buildLatexExport(exercises, title, {
    includeHints,
    includeSolutions,
    solutionsAtEnd: flag(params, 'solutionsAtEnd'),
    artifactsMap: await fetchArtifactsMap(exercises, event.fetch),
    origin: event.url.origin,
    // Le document part chez le compilateur distant : noms de fichiers aplatis
    // et figures non transportables remplacées par un encart.
    imageMode: 'remote',
  });

  // Les figures joignables sont relues depuis les fichiers statiques du site.
  const assets = (
    await Promise.all(
      images.slice(0, MAX_ASSETS).map(async (image) => {
        try {
          const response = await event.fetch(image.url);
          if (!response.ok) return null;
          return { name: image.localPath, content: await response.text() };
        } catch {
          // Une figure manquante ne doit pas priver l'enseignant de son PDF.
          return null;
        }
      }),
    )
  ).filter(Boolean);

  const result = await compileLatexDocument({ source, assets });

  if (!result.ok) {
    if (result.status === 422) {
      console.error('Export PDF — échec de compilation', result.log?.slice(0, 2000));
    }
    return json(
      {
        error:
          result.status === 422
            ? "La compilation du PDF a échoué. Téléchargez la source .tex depuis l'onglet Partager pour la compiler vous-même."
            : result.error,
      },
      { status: result.status },
    );
  }

  const basename = latexFileName(title, 'seance');
  const suffix = includeSolutions ? '-corrige' : '';

  return new Response(result.pdf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${basename}${suffix}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
