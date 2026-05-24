<!-- src/lib/components/search/SearchSemantic.svelte
     Drop-in replacement for <SearchToolbar> with hybrid (FTS5 + vectoriel + rerank) support.

     Swap in +page.svelte :
       1. import SearchSemantic from '$lib/components/search/SearchSemantic.svelte'
       2. Remplacer <SearchToolbar onSearchInput={debouncedSearch} …> par <SearchSemantic …>
          (supprimer le prop onSearchInput ; le composant gère ses propres appels)
       3. Supprimer `const debouncedSearch = useDebounce(…)` devenu inutile.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
  import {
    searchQuery,
    results,
    loading,
    loadingMore,
    error,
    searchMeta,
    filters,
    filterCounts,
    searchActions
  } from '$lib/stores/searchStore.js';
  import { useDebounce } from '$lib/hooks/useDebounce.js';

  // ── Props ─────────────────────────────────────────────────────────────────
  export let filtersExpanded    = true;
  export let onToggleExpanded   = () => {};
  export let canTogglePreview   = false;
  export let previewToggleLabel = '';
  export let isPreviewOpen      = false;
  export let onTogglePreview    = () => {};

  // ── État sémantique ────────────────────────────────────────────────────────
  let mode          = 'fts';   // 'fts' | 'hybrid'
  let hybridLoading = false;
  let hybridLimit   = 20;      // augmenté de 20 à chaque loadMore hybride
  /** @type {AbortController|null} */
  let abortCtrl     = null;
  // Pas d'éviction pour l'instant : acceptable pour une session courte (~20-30 queries).
  // Si des soucis mémoire apparaissent en prod (session longue, 200+ queries), capper à
  // 50-100 entrées avec LRU : remplacer Map par une classe LRUCache(maxSize) qui, à chaque
  // set(), supprime l'entrée la moins récemment utilisée quand maxSize est atteint.
  /** @type {Map<string, {results: any[], meta: any, timing: any}>} */
  const hybridCache = new Map();
  let timingInfo    = null;    // debug: retourné par ?debug=true
  let showSuggest   = false;   // Scénario B : proposer le mode hybride

  $: debugMode = $page.url.searchParams.get('debug') === 'true';

  // ── Construction des paramètres URL vers l'API ─────────────────────────────
  function buildParams({ semantic = false, rerank = false, debug = false, limit = 20 } = {}) {
    const q = get(searchQuery).trim();
    const f = get(filters);
    const p = new URLSearchParams();

    if (q) p.set('q', q);

    if (f.subchapter) {
      p.set('subchapter', f.subchapter);
      if (f.chapter) p.set('chapter', f.chapter);
    } else if (f.chapter) {
      p.set('chapter', f.chapter);
    }
    if (f.level)        p.set('level', f.level);
    if (f.module)       p.set('module', f.module);
    if (f.author)       p.set('author', f.author);
    if (f.organization) p.set('organization', f.organization);
    if (f.difficulty)   p.set('difficulty', f.difficulty);
    if (f.createdFrom)  p.set('createdFrom', f.createdFrom);
    if (f.createdTo)    p.set('createdTo', f.createdTo);
    if (f.updatedFrom)  p.set('updatedFrom', f.updatedFrom);
    if (f.updatedTo)    p.set('updatedTo', f.updatedTo);
    if (f.hasSolution  != null && f.hasSolution  !== '') p.set('hasSolution',  String(f.hasSolution));
    if (f.hasIndication!= null && f.hasIndication !== '') p.set('hasIndication', String(f.hasIndication));
    if (f.hasVideo     != null && f.hasVideo      !== '') p.set('hasVideo',      String(f.hasVideo));

    if (f.sort && f.sort !== 'relevance') {
      p.set('sort', `${f.sort}_${f.sortDirection || 'desc'}`);
    }

    p.set('limit', String(limit));
    p.set('offset', '0');
    if (semantic) p.set('semantic', 'true');
    if (rerank)   p.set('rerank',   'true');
    if (debug)    p.set('debug',    'true');
    return p;
  }

  // ── Synchronisation URL ────────────────────────────────────────────────────
  function syncUrl() {
    const q = get(searchQuery).trim();
    const f = get(filters);
    const u = new URL($page.url.href);

    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    if (mode === 'hybrid') u.searchParams.set('mode', 'hybrid');
    else                   u.searchParams.delete('mode');

    for (const key of ['level', 'module', 'chapter', 'subchapter']) {
      if (f[key]) u.searchParams.set(key, f[key]);
      else        u.searchParams.delete(key);
    }

    goto(u.pathname + u.search, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // ── Mode FTS (rapide) ──────────────────────────────────────────────────────
  async function runFts() {
    const q = get(searchQuery).trim();

    if (!q) {
      results.set([]);
      searchMeta.set(null);
      error.set(null);
      filterCounts.set({ module: {}, level: {}, difficulty: {}, author: {}, organization: {} });
      showSuggest = false;
      syncUrl();
      return;
    }

    abortCtrl?.abort();
    abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    loading.set(true);
    error.set(null);

    try {
      const res = await fetch(`/api/search?${buildParams()}`, { signal });
      if (res.ok) {
        const data = await res.json();
        results.set(data.results || []);
        searchMeta.set(data.meta || null);
        if (data.meta?.filterCounts) filterCounts.set(data.meta.filterCounts);
        // Scénario B : zéro résultat → proposer l'hybride
        showSuggest = (data.results || []).length === 0 && q.length >= 3;
      } else {
        const d = await res.json().catch(() => ({}));
        error.set(d.message || 'Erreur de recherche');
        results.set([]);
      }
    } catch (e) {
      if (e.name !== 'AbortError') { error.set('Erreur de connexion'); results.set([]); }
    } finally {
      loading.set(false);
    }

    syncUrl();
  }

  const debouncedFts = useDebounce(runFts, 250);

  // ── Dérive filterCounts depuis une liste de résultats ────────────────────
  // Utilisé en mode hybride car l'API ne retourne pas filterCounts dans ce mode.
  function deriveFilterCounts(resultsList) {
    const module = {}, level = {}, difficulty = {};
    for (const r of resultsList) {
      if (r.module) module[r.module] = (module[r.module] || 0) + 1;
      if (r.level)  level[r.level]   = (level[r.level]   || 0) + 1;
      if (r.difficulty != null) {
        const dk = String(r.difficulty);
        difficulty[dk] = (difficulty[dk] || 0) + 1;
      }
    }
    return { module, level, difficulty, author: {}, organization: {} };
  }

  // ── Mode hybride (intelligent) ─────────────────────────────────────────────
  async function runHybrid(targetLimit = hybridLimit) {
    const q = get(searchQuery).trim();
    if (!q) return;

    // Cache — même requête + mêmes filtres + même limite → pas de nouvel appel réseau
    const cacheKey = q + '|' + JSON.stringify(get(filters)) + '|' + targetLimit;
    if (hybridCache.has(cacheKey)) {
      const c = hybridCache.get(cacheKey);
      results.set(c.results);
      searchMeta.set(c.meta);
      filterCounts.set(deriveFilterCounts(c.results));
      timingInfo = c.timing;
      mode       = 'hybrid';
      showSuggest = false;
      syncUrl();
      return;
    }

    abortCtrl?.abort();
    abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    hybridLoading = true;
    loading.set(true);
    error.set(null);
    const t0 = Date.now();

    try {
      const res = await fetch(
        `/api/search?${buildParams({ semantic: true, rerank: true, debug: debugMode, limit: targetLimit })}`,
        { signal }
      );

      // Affichage du spinner au moins 200 ms pour éviter un flash
      const elapsed = Date.now() - t0;
      if (elapsed < 200) await new Promise(r => setTimeout(r, 200 - elapsed));

      if (res.ok) {
        const data = await res.json();
        const entry = {
          results: data.results || [],
          meta:    data.meta   || null,
          timing:  data.debug  || null
        };
        hybridCache.set(cacheKey, entry);
        results.set(entry.results);
        searchMeta.set(entry.meta);
        filterCounts.set(deriveFilterCounts(entry.results));
        timingInfo  = entry.timing;
        mode        = 'hybrid';
        showSuggest = false;
      } else {
        const d = await res.json().catch(() => ({}));
        error.set(d.message || 'Erreur de recherche hybride');
        results.set([]);
      }
    } catch (e) {
      if (e.name !== 'AbortError') { error.set('Erreur de connexion'); results.set([]); }
    } finally {
      hybridLoading = false;
      loading.set(false);
    }

    syncUrl();
  }

  // ── Gestionnaire d'entrée (délégué à SearchToolbar via onSearchInput) ──────
  // Svelte passe l'InputEvent quand l'événement vient de `on:input`,
  // et appelle la fonction sans argument depuis handleSubmitKey (Enter).
  function handleSearchInput(event) {
    if (event?.type === 'input') {
      // Frappe au clavier — Scénario A : si hybride actif, revenir en FTS
      if (mode === 'hybrid') {
        mode       = 'fts';
        timingInfo = null;
        showSuggest = false;
      }
      debouncedFts();
    } else {
      // Enter / bouton Clear (pas d'event) → hybride si query non vide
      const q = get(searchQuery).trim();
      if (q) {
        runHybrid();
      } else {
        mode = 'fts';
        results.set([]);
        searchMeta.set(null);
        error.set(null);
        showSuggest = false;
        syncUrl();
      }
    }
  }

  // ── Interception de searchActions.search pour les changements de filtre ────
  //
  // DETTE TECHNIQUE — à formaliser via searchActions.setSearchHandler() un jour.
  //
  // Contexte : les handlers du parent (+page.svelte) qui déclenchent une recherche
  // après un changement de filtre (chips hasSolution/hasIndication, tri, breadcrumb)
  // appellent tous searchActions.search(). Ce store ne connaît pas le mode hybride ;
  // il ferait toujours du FTS5 pur, cassant le Scénario C ("filtre changé en mode hybride
  // → relancer en hybride").
  //
  // Solution retenue : remplacement temporaire de la fonction pendant le montage du
  // composant, avec restauration à la destruction. C'est réversible et transparent
  // pour le parent, mais fragile si plusieurs instances coexistent ou si quelqu'un
  // "nettoie" ce bloc sans comprendre pourquoi il est là.
  //
  // Migration propre à prévoir : ajouter dans searchStore.js —
  //   let _searchHandler = null;
  //   searchActions.setSearchHandler = (fn) => { _searchHandler = fn; };
  //   searchActions.search = (...args) => (_searchHandler ?? _defaultSearch)(...args);
  // Ce composant appellerait alors searchActions.setSearchHandler(ourSearch) au montage
  // et searchActions.setSearchHandler(null) à la destruction.
  // ── Bascule de mode (appelée par le toggle dans SearchToolbar) ────────────
  function handleToggleMode(targetMode) {
    if (targetMode === 'hybrid' && mode !== 'hybrid') {
      runHybrid();
    } else if (targetMode === 'fts' && mode !== 'fts') {
      mode = 'fts';
      timingInfo = null;
      showSuggest = false;
      runFts();
    }
  }

  // Charger plus de résultats hybrides : augmente la limite et relance.
  // Les résultats remplacent la liste courante (pas d'append) car le reranking
  // est global — les rangs 21-40 peuvent différer d'une exécution à l'autre.
  async function loadMoreHybrid() {
    hybridLimit += 20;
    loadingMore.set(true);
    try {
      await runHybrid(hybridLimit);
    } finally {
      loadingMore.set(false);
    }
  }

  const _originalSearch   = searchActions.search.bind(searchActions);
  const _originalLoadMore = searchActions.loadMore.bind(searchActions);

  // Chaque changement de filtre (sidebar, tri…) repart de 20 résultats.
  searchActions.search   = () => { hybridLimit = 20; return mode === 'hybrid' ? runHybrid(20) : runFts(); };
  searchActions.loadMore = () => mode === 'hybrid' ? loadMoreHybrid() : _originalLoadMore();

  // ── Initialisation depuis l'URL ────────────────────────────────────────────
  onMount(() => {
    const u = $page.url;
    const urlQ    = u.searchParams.get('q') || '';
    const urlMode = u.searchParams.get('mode') || '';

    if (urlQ && !get(searchQuery)) searchQuery.set(urlQ);
    if (urlMode === 'hybrid') mode = 'hybrid';

    const level      = u.searchParams.get('level')      || '';
    const chapter    = u.searchParams.get('chapter')    || '';
    const subchapter = u.searchParams.get('subchapter') || '';
    const module_    = u.searchParams.get('module')     || '';
    if (level || chapter || subchapter || module_) {
      filters.update(f => ({ ...f, level, chapter, subchapter, module: module_ }));
    }

    if (urlQ) {
      if (urlMode === 'hybrid') runHybrid();
      else                      runFts();
    }
  });

  onDestroy(() => {
    searchActions.search   = _originalSearch;
    searchActions.loadMore = _originalLoadMore;
    abortCtrl?.abort();
  });
</script>

<!-- ── Barre de recherche ────────────────────────────────────────────────── -->
<SearchToolbar
  searchQueryStore={searchQuery}
  onSearchInput={handleSearchInput}
  loading={$loading || hybridLoading}
  hasResults={$results.length > 0}
  showEnterHint={mode === 'fts' && !!$searchQuery}
  searchMode={mode}
  modeLoading={hybridLoading}
  onToggleMode={handleToggleMode}
  suggestIA={showSuggest}
  {filtersExpanded}
  {onToggleExpanded}
  {canTogglePreview}
  {previewToggleLabel}
  {isPreviewOpen}
  {onTogglePreview}
/>

<!-- ── Panneau debug timing (affiché uniquement si ?debug=true) ────────────── -->
{#if debugMode && timingInfo && mode === 'hybrid'}
  <div class="debug-panel" aria-label="Détails de performance">
    {#each Object.entries(timingInfo) as [key, val]}
      <span class="debug-stat">
        <code>{key}</code>{typeof val === 'number' ? ` ${val} ms` : ` ${val}`}
      </span>
    {/each}
  </div>
{/if}

<style>
  /* ── Panneau debug ─────────────────────────────────────────────────────── */
  .debug-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    padding: 0.3rem 0.6rem;
    margin-top: 0.35rem;
    border-radius: 0.375rem;
    font-size: 0.68rem;
    @apply bg-amber-50 border border-amber-200 text-amber-800;
  }
  .debug-stat {
    display: inline-flex;
    gap: 0.2rem;
    align-items: baseline;
  }
  .debug-stat code {
    font-family: ui-monospace, monospace;
    font-size: 0.67rem;
    color: #92400e;
  }
</style>
