// src/routes/api/search/+server.js
import { json, error } from '@sveltejs/kit';
import { searchExercises, getExerciseCount, getContextualFilterCounts } from '$lib/db/queries.js';
import { hybridSearch } from '$lib/db/hybridSearch.js';
import { checkRateLimit } from '$lib/server/rateLimiter.js';
import { trackAlbertEmbed, trackAlbertRerank, isEmbedThrottled, isRerankThrottled } from '$lib/server/albertQuota.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOT_RE = /bot|crawler|spider|slurp|bingbot|googlebot|facebookexternalhit/i;

function isBot(ua) {
  return BOT_RE.test(ua ?? '');
}

function parseBool(v, defaultVal = false) {
  if (v === null || v === undefined || v === '') return defaultVal;
  return v === '1' || v === 'true';
}

/** Supprime les caractères de contrôle et tronque pour les logs. */
function sanitizeLog(s) {
  return String(s ?? '').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200);
}

function getClientIp(event) {
  // Caddy transmet l'IP réelle via X-Forwarded-For
  const forwarded = event.request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  try { return event.getClientAddress(); } catch { return 'unknown'; }
}

/** Retire les champs de scores des résultats pour le payload public. */
function stripScores(results) {
  return results.map(({ score, scoreBM25, scoreVector, rerankScore, summary, ...rest }) => rest);
}

/** Reformate les scores en sous-objet debug. */
function addDebugScores(results) {
  return results.map(({ score, scoreBM25, scoreVector, rerankScore, ...rest }) => ({
    ...rest,
    scores: {
      rrfScore:    score      ?? null,
      bm25Rank:    scoreBM25  ?? null,
      vecScore:    scoreVector ?? null,
      rerankScore: rerankScore ?? null
    }
  }));
}

// ─── Handler GET ──────────────────────────────────────────────────────────────

export async function GET(event) {
  const { url, request, setHeaders } = event;
  const t0 = Date.now();

  // ── Paramètres de base ────────────────────────────────────────────────────
  const rawQ  = url.searchParams.get('q') ?? '';
  const q     = rawQ.trim();

  if (q.length > 500) {
    throw error(400, { message: 'Paramètre q trop long (max 500 caractères)' });
  }

  const ua         = request.headers.get('user-agent') ?? '';
  const debugMode  = parseBool(url.searchParams.get('debug'));
  const botRequest = isBot(ua);

  // Modes — les bots sont forcés en FTS5 pur
  let semantic = parseBool(url.searchParams.get('semantic')) && !botRequest;
  let rerankEnabled = parseBool(url.searchParams.get('rerank')) && semantic;

  // Pagination et filtres
  // Le mode hybride peut demander jusqu'à 100 résultats ; le FTS reste limité à 50.
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '20');
  const semanticRequested = parseBool(url.searchParams.get('semantic'));
  let limit  = Math.max(1, Math.min(rawLimit, semanticRequested ? 100 : 50));
  let offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0'));

  const filters = {};
  const chapter     = url.searchParams.get('chapter')?.trim()      || '';
  const subchapter  = url.searchParams.get('subchapter')?.trim()   || '';
  const level       = url.searchParams.get('level')?.trim()        || '';
  const module      = url.searchParams.get('module')?.trim()       || '';
  const author      = url.searchParams.get('author')?.trim()       || '';
  const organization = url.searchParams.get('organization')?.trim() || '';
  const difficultyRaw = url.searchParams.get('difficulty')?.trim() || '';
  const sort        = url.searchParams.get('sort')?.trim()         || '';
  const createdFrom = url.searchParams.get('createdFrom')?.trim()  || '';
  const createdTo   = url.searchParams.get('createdTo')?.trim()    || '';
  const updatedFrom = url.searchParams.get('updatedFrom')?.trim()  || '';
  const updatedTo   = url.searchParams.get('updatedTo')?.trim()    || '';
  const hasSolutionParam  = url.searchParams.get('hasSolution');
  const hasIndicationParam = url.searchParams.get('hasIndication');
  const hasVideoParam     = url.searchParams.get('hasVideo');

  if (chapter)      filters.chapter      = chapter;
  if (subchapter)   filters.subchapter   = subchapter;
  if (level)        filters.level        = level;
  if (module)       filters.module       = module;
  if (author)       filters.author       = author;
  if (organization) filters.organization = organization;
  if (createdFrom)  filters.createdFrom  = createdFrom;
  if (createdTo)    filters.createdTo    = createdTo;
  if (updatedFrom)  filters.updatedFrom  = updatedFrom;
  if (updatedTo)    filters.updatedTo    = updatedTo;
  if (sort)         filters.sort         = sort;

  if (difficultyRaw) {
    if (difficultyRaw === 'null') {
      filters.difficulty = 'null';
    } else {
      const d = parseInt(difficultyRaw, 10);
      if (!isNaN(d) && d >= 1 && d <= 5) filters.difficulty = d;
    }
  }
  for (const [param, key] of [[hasSolutionParam, 'hasSolution'], [hasIndicationParam, 'hasIndication'], [hasVideoParam, 'hasVideo']]) {
    if (param !== null && param !== undefined && param !== '') {
      const v = param.toLowerCase();
      if (v === '1' || v === 'true')  filters[key] = true;
      else if (v === '0' || v === 'false') filters[key] = false;
    }
  }

  const hasEffectiveFilters = Object.keys(filters).some((key) => key !== 'sort');
  if (!q && !hasEffectiveFilters) {
    throw error(400, { message: 'Paramètre q ou filtre requis' });
  }

  if (!q) {
    semantic = false;
    rerankEnabled = false;
  }

  // ── Quota Albert → dégradation gracieuse ─────────────────────────────────
  if (semantic && isEmbedThrottled()) {
    console.warn('[search] Quota embed Albert atteint, fallback FTS5');
    semantic = false;
    rerankEnabled = false;
  } else if (rerankEnabled && isRerankThrottled()) {
    console.warn('[search] Quota rerank Albert atteint, désactivation rerank');
    rerankEnabled = false;
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip         = getClientIp(event);
  const rateLimit  = semantic ? 10 : 30;
  const rl         = checkRateLimit(ip, rateLimit);
  if (!rl.allowed) {
    setHeaders({ 'Retry-After': String(rl.retryAfter) });
    return json(
      { error: 'Trop de requêtes', retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  // ── Exécution ──────────────────────────────────────────────────────────────
  const mode = rerankEnabled ? 'hybrid+rerank' : semantic ? 'hybrid' : 'fts';
  let results, totalCount = null, filterCounts = null;
  let fallback = false;
  const timing = {};

  try {
    if (semantic) {
      // Mode hybride (avec ou sans rerank)
      trackAlbertEmbed();
      if (rerankEnabled) trackAlbertRerank();

      try {
        results = await hybridSearch({
          query: q,
          filters,
          limit,
          retrievalK: 50,
          rerank: rerankEnabled,
          rerankCandidates: 50,
          _timing: debugMode ? timing : null
        });
      } catch (hybridErr) {
        // Fallback FTS5 si l'embed échoue (timeout, quota dépassé, etc.)
        console.error('[search] hybridSearch échoué, fallback FTS5:', hybridErr.message);
        fallback = true;
        const t1 = Date.now();
        results = await searchExercises(q, filters, { limit: limit + 1, offset, sort });
        if (debugMode) timing.hydrateMs = Date.now() - t1;
      }
    } else {
      // Mode FTS5 pur — comportement d'origine préservé
      const t1 = Date.now();
      results = await searchExercises(q, filters, { limit: limit + 1, offset, sort });
      if (debugMode) timing.hydrateMs = Date.now() - t1;

      if (offset === 0) {
        try { totalCount = await getExerciseCount(q, filters); } catch { /* non bloquant */ }
        try { filterCounts = await getContextualFilterCounts(q, filters); } catch { /* non bloquant */ }
      }
    }
  } catch (err) {
    console.error('[search] Erreur interne:', { query: sanitizeLog(q), mode, error: err.message });
    throw error(500, { message: 'Erreur de recherche' });
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  // FTS : on demande limit+1 pour détecter s'il y a une page suivante.
  // Hybride : le pool est borné par retrievalK ; hasMore = on a rempli le quota demandé.
  const hasMore      = semantic ? (results.length >= limit) : (results.length > limit);
  const finalResults = (!semantic && hasMore) ? results.slice(0, limit) : results;

  // ── Format réponse ─────────────────────────────────────────────────────────
  const latencyMs = Date.now() - t0;

  // Scores : sous-objet en debug, absents en prod
  const publicResults = debugMode
    ? addDebugScores(finalResults)
    : stripScores(finalResults);

  const response = {
    results: publicResults,
    meta: {
      query:     q,
      mode:      fallback ? 'fts' : mode,
      semantic:  semantic && !fallback,
      rerank:    rerankEnabled && !fallback,
      fallback:  fallback || undefined,
      latencyMs,
      ...(semantic && !fallback
        ? { count: finalResults.length, hasMore, limit }
        : {
            filters,
            pagination: {
              limit,
              offset,
              count:      finalResults.length,
              hasMore,
              totalCount
            },
            filterCounts,
            timestamp: new Date().toISOString()
          }
      )
    },
    ...(debugMode && Object.keys(timing).length > 0 ? { debug: timing } : {})
  };

  // ── Cache HTTP ─────────────────────────────────────────────────────────────
  const maxAge = (semantic && !fallback) ? 30 : 60;
  setHeaders({
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=300`
  });

  // ── Log structuré ──────────────────────────────────────────────────────────
  console.log(JSON.stringify({
    ts:          new Date().toISOString(),
    type:        'search',
    query:       sanitizeLog(q),
    mode:        response.meta.mode,
    latencyMs,
    resultCount: finalResults.length,
    fallback:    fallback,
    bot:         botRequest,
    ip:          ip.slice(0, 7) + '…'
  }));

  return json(response);
}
