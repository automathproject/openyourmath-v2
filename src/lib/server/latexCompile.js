// src/lib/server/latexCompile.js
// Appel au service de compilation LaTeX distant.
//
// Deux routes en dépendent : le compilateur interactif (/api/latex/compile),
// qui reçoit une source déjà rédigée par l'utilisateur, et l'export PDF d'une
// liste (/api/export/pdf), qui la génère lui-même. Le contrat multipart et la
// détection d'échec sont décrits ici une seule fois.

const TEXLIVE_URL = 'https://texlive.net/cgi-bin/latexcgi';

/** Le service exige que la source soit transmise sous ce nom. */
export const MAIN_DOCUMENT_NAME = 'document.tex';

/**
 * Compile un document et ses ressources auprès du service distant.
 *
 * @param {Object}   params
 * @param {string}   params.source   — contenu du document principal
 * @param {{ name: string, content: string }[]} [params.assets] — fichiers joints
 * @param {number}   [params.timeoutMs=60000]
 * @returns {Promise<
 *   { ok: true, pdf: ArrayBuffer } |
 *   { ok: false, status: number, error: string, log?: string }
 * >}
 */
export async function compileLatexDocument({ source, assets = [], timeoutMs = 60_000 }) {
  // Contrat multipart documenté par TeXLive.net.
  const upstream = new FormData();
  upstream.append('filename[]', MAIN_DOCUMENT_NAME);
  upstream.append('filecontents[]', source);
  for (const asset of assets) {
    upstream.append('filename[]', asset.name);
    upstream.append('filecontents[]', asset.content);
  }
  upstream.append('engine', 'lualatex');
  upstream.append('return', 'pdf');

  let response;
  try {
    response = await fetch(TEXLIVE_URL, {
      method: 'POST',
      body: upstream,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error:
        error?.name === 'TimeoutError'
          ? 'Le compilateur a dépassé le délai autorisé.'
          : 'Le compilateur distant est indisponible.',
    };
  }

  const output = await response.arrayBuffer();
  // Le service répond 200 même en cas d'erreur LaTeX : seule la signature du
  // fichier distingue un PDF d'un journal de compilation.
  const isPdf =
    output.byteLength >= 5 &&
    new TextDecoder().decode(output.slice(0, 5)) === '%PDF-';

  if (!response.ok || !isPdf) {
    return {
      ok: false,
      status: 422,
      error: 'La compilation LaTeX a échoué.',
      log: new TextDecoder().decode(output).slice(0, 60_000),
    };
  }

  return { ok: true, pdf: output };
}
