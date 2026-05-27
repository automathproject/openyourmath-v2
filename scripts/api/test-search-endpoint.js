// scripts/api/test-search-endpoint.js
// Lance le serveur dev (pnpm dev) avant d'exécuter ce script.
// Usage : BASE_URL=http://localhost:5173 node scripts/api/test-search-endpoint.js

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, headers: Object.fromEntries(res.headers), body };
}

function assert(cond, msg) {
  if (!cond) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }
  else        console.log(`  ✅ ${msg}`);
}

// ── Test 1 : FTS5 basique ────────────────────────────────────────────────────
async function testFts() {
  console.log('\n=== Test 1 : FTS5 basique ===');
  const { status, headers, body } = await get('/api/search?q=intégrale&limit=5');
  assert(status === 200, `status 200 (got ${status})`);
  assert(Array.isArray(body?.results), 'results est un tableau');
  assert(body?.results.length > 0, 'au moins un résultat');
  assert(body?.meta?.mode === 'fts', `meta.mode=fts (got ${body?.meta?.mode})`);
  assert(body?.meta?.semantic === false, 'meta.semantic=false');
  assert(typeof body?.meta?.latencyMs === 'number', 'meta.latencyMs est un nombre');
  assert(body?.meta?.pagination !== undefined, 'meta.pagination présent en mode FTS');
  const cc = headers['cache-control'] ?? '';
  assert(cc.includes('max-age=60'), `Cache-Control max-age=60 (got "${cc}")`);
  // Scores absents en prod
  const hasScores = body?.results?.some(r => 'scores' in r || 'score' in r || 'scoreBM25' in r);
  assert(!hasScores, 'scores absents du payload public');
}

// ── Test 2 : mode hybride ────────────────────────────────────────────────────
async function testHybrid() {
  console.log('\n=== Test 2 : mode hybride (?semantic=true) ===');
  const { status, body } = await get('/api/search?q=théorème+central+limite&semantic=true&limit=5');
  assert(status === 200, `status 200 (got ${status})`);
  assert(body?.meta?.mode === 'hybrid', `meta.mode=hybrid (got ${body?.meta?.mode})`);
  assert(body?.meta?.semantic === true, 'meta.semantic=true');
  assert(Array.isArray(body?.results) && body.results.length > 0, 'résultats présents');
  assert(body?.meta?.pagination !== undefined, 'meta.pagination présent en mode hybride');
  assert(typeof body?.meta?.pagination?.totalCount === 'number', 'meta.pagination.totalCount est un nombre');
  assert(body?.meta?.pagination?.hasMore === (body.meta.pagination.totalCount > body.results.length), 'hasMore cohérent avec totalCount');
  const cc = (await get('/api/search?q=test&semantic=true')).headers['cache-control'] ?? '';
  assert(cc.includes('max-age=30'), `Cache-Control max-age=30 en mode hybrid (got "${cc}")`);
}

// ── Test 3 : mode hybrid+rerank ───────────────────────────────────────────────
async function testRerank() {
  console.log('\n=== Test 3 : mode hybrid+rerank (?semantic=true&rerank=true) ===');
  const { status, body } = await get('/api/search?q=passagers+avion+poids&semantic=true&rerank=true&limit=5');
  assert(status === 200, `status 200 (got ${status})`);
  assert(body?.meta?.mode === 'hybrid+rerank', `meta.mode=hybrid+rerank (got ${body?.meta?.mode})`);
  assert(body?.meta?.rerank === true, 'meta.rerank=true');
  assert(body?.results?.[0]?.uuid !== undefined, 'premier résultat a un uuid');
}

// ── Test 4 : query vide → 400 ────────────────────────────────────────────────
async function testEmptyQuery() {
  console.log('\n=== Test 4 : query vide → 400 ===');
  const { status } = await get('/api/search');
  assert(status === 400, `status 400 (got ${status})`);
  const { status: s2 } = await get('/api/search?q=');
  assert(s2 === 400, `status 400 sur q="" (got ${s2})`);
  const longQ = 'a'.repeat(501);
  const { status: s3 } = await get(`/api/search?q=${encodeURIComponent(longQ)}`);
  assert(s3 === 400, `status 400 sur q trop long (got ${s3})`);
}

// ── Test 5 : mode debug → scores intermédiaires ───────────────────────────────
async function testDebug() {
  console.log('\n=== Test 5 : mode debug (?debug=true) ===');
  const { status, body } = await get('/api/search?q=matrice&semantic=true&debug=true&limit=3');
  assert(status === 200, `status 200 (got ${status})`);
  const firstResult = body?.results?.[0];
  assert('scores' in (firstResult ?? {}), 'scores présent sur le premier résultat');
  assert(typeof firstResult?.scores?.rrfScore === 'number', 'scores.rrfScore est un nombre');
  assert(body?.debug !== undefined, 'bloc debug présent dans la réponse');
  assert(typeof body?.debug?.embedMs === 'number', 'debug.embedMs présent');
}

// ── Test 6 : rate limit (burst FTS5) ───────────────────────────────────────
// Utilise X-Forwarded-For avec une IP fictive pour isoler la fenêtre du burst
// et ne pas polluer le compteur des autres tests (qui arrivent depuis 127.0.0.1).
async function testRateLimit() {
  console.log('\n=== Test 6 : rate limit (burst FTS5) ===');
  const BURST_IP = '10.99.99.1';
  const requests = Array.from({ length: 35 }, (_, i) =>
    fetch(`${BASE}/api/search?q=suite+${i}`, {
      headers: { 'X-Forwarded-For': BURST_IP }
    }).then(async res => ({
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: await res.json().catch(() => null)
    }))
  );
  const results = await Promise.all(requests);
  const statuses = results.map(r => r.status);
  const ok429 = statuses.some(s => s === 429);
  const retryAfterHeaders = results
    .filter(r => r.status === 429)
    .map(r => r.headers['retry-after']);
  assert(ok429, '429 déclenché après 30 req/min');
  assert(retryAfterHeaders.every(h => h !== undefined), 'Retry-After header présent sur les 429');
  console.log(`  (${statuses.filter(s => s === 200).length} × 200, ${statuses.filter(s => s === 429).length} × 429)`);
}

// ── Test 7 : rerank=true sans semantic → ignoré (pas de rerank) ──────────────
async function testRerankWithoutSemantic() {
  console.log('\n=== Test 7 : rerank=true sans semantic=true ===');
  const { status, body } = await get('/api/search?q=intégrale&rerank=true&limit=3');
  assert(status === 200, `status 200 (got ${status})`);
  assert(body?.meta?.mode === 'fts', `mode FTS (rerank ignoré) — got ${body?.meta?.mode}`);
  assert(body?.meta?.rerank === false, 'meta.rerank=false');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Testing ${BASE}/api/search\n`);
  try {
    await get('/api/search?q=ping'); // warm-up
  } catch {
    console.error(`❌ Impossible de joindre ${BASE} — lance d'abord : pnpm dev`);
    process.exit(1);
  }

  await testFts();
  await testHybrid();
  await testRerank();
  await testEmptyQuery();
  await testDebug();
  await testRateLimit();
  await testRerankWithoutSemantic();

  console.log('\n' + (process.exitCode === 1 ? '❌ Certains tests ont échoué.' : '✅ Tous les tests passés.'));
}

main();
