<script>
  import { goto } from '$app/navigation';
  import { listActions } from '$lib/stores/listStore.js';
  import ChapterCard from '$lib/components/browse/ChapterCard.svelte';
  import LevelBar from '$lib/components/browse/LevelBar.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  export let data;

  $: ({ programme, chapter, currentChapterData, exercises } = data);

  // ── Landing filters ──────────────────────────────────────────
  let levelFilter = 'all';
  let viewMode = 'library'; // 'library' | 'map'
  let showLevels = true;
  let dense = false;

  // ── Chapter detail ───────────────────────────────────────────
  let selectedExoId = null;
  let topicFilter = 'all';

  $: if (exercises.length > 0 && !selectedExoId) {
    selectedExoId = exercises[0]?.uuid ?? null;
  }
  $: filteredExercises = topicFilter === 'all'
    ? exercises
    : exercises.filter((e) => e.subchapter === topicFilter);

  // ── Map view ─────────────────────────────────────────────────
  const MODULE_COLORS = {
    analyse:   { bg: '#d6ecec', stroke: '#2a9495', ink: '#1f7878' },
    algèbre:   { bg: '#f8e5dc', stroke: '#d97757', ink: '#b85d3f' },
    géométrie: { bg: '#faecb8', stroke: '#c9a233', ink: '#8a6e1c' },
    probabilités: { bg: '#e6e0f0', stroke: '#7f6db6', ink: '#4f4078' },
  };

  function getModuleColor(name) {
    const key = name?.toLowerCase().trim() ?? '';
    return (
      MODULE_COLORS[key] ||
      Object.entries(MODULE_COLORS).find(([k]) => key.includes(k))?.[1] ||
      { bg: '#e8e8e8', stroke: '#888', ink: '#333' }
    );
  }

  function handleBack() {
    goto('/browse');
  }

  function addToList(exo) {
    if (exo?.uuid) {
      listActions.add({ uuid: exo.uuid, title: exo.title });
    }
  }

  // Difficulty stars helper
  function stars(n, max = 4) {
    return Array.from({ length: max }, (_, i) => i < (n ?? 0));
  }

  // Total exercise count across all modules
  $: totalExercises = programme.reduce((s, m) => s + m.count, 0);
  $: totalChapters = programme.reduce((s, m) => s + m.chapters.length, 0);

  // ── Map positioning ──────────────────────────────────────────
  const LEVEL_ORDER = ['L1', 'L2', 'L3', 'CPGE', 'M1', 'M2'];

  // Returns dominant level index (0=L1, 1=L2 …) for x-axis placement
  function dominantLevelIdx(levels) {
    let best = -1, bestCount = 0;
    for (const [l, n] of Object.entries(levels ?? {})) {
      const idx = LEVEL_ORDER.indexOf(l);
      if (idx >= 0 && n > bestCount) { best = idx; bestCount = n; }
    }
    return best >= 0 ? best : 0;
  }

  // Pre-compute bubble positions for the map
  $: bubbles = programme.flatMap((mod, mi) =>
    mod.chapters.map((ch, ci) => {
      const li = dominantLevelIdx(ch.levels);
      const xPct = 12 + li * 23 + (ci % 3) * 4;
      const yPct = 18 + mi * 22 + Math.floor(ci / 3) * 16;
      const r = 18 + Math.min(26, (ch.count - 5) * 0.45);
      return {
        ch, mod,
        x: Math.min(87, Math.max(8, xPct)),
        y: Math.min(87, Math.max(8, yPct)),
        r,
        color: getModuleColor(mod.name),
      };
    })
  );
</script>

<svelte:head>
  <title>{chapter ? `${chapter} — Parcourir — OpenYourMath` : 'Parcourir le programme — OpenYourMath'}</title>
</svelte:head>

<div class="browse-root">

  <!-- ════════════════════════════════════════════════════════
       CHAPTER DETAIL VIEW
       ════════════════════════════════════════════════════════ -->
  {#if chapter}
    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <button class="crumb-link" on:click={handleBack}>Programme</button>
      <span class="crumb-sep">›</span>
      {#if currentChapterData?.moduleName}
        <button class="crumb-link" on:click={handleBack}>{currentChapterData.moduleName}</button>
        <span class="crumb-sep">›</span>
      {/if}
      <span class="crumb-current">{chapter}</span>
    </nav>

    <!-- Chapter hero -->
    <section class="chapter-hero">
      <div class="chapter-hero-left">
        <div class="overline" style="color: var(--oym-teal-800)">
          {currentChapterData?.moduleName ?? ''} · Chapitre
        </div>
        <h1 class="chapter-title">{chapter}</h1>

        <!-- Topic filter chips -->
        <div class="chip-row">
          <button
            class="chip {topicFilter === 'all' ? 'chip--active' : 'chip--soft'}"
            on:click={() => (topicFilter = 'all')}
          >
            Tous ({exercises.length})
          </button>
          {#each (currentChapterData?.subchapters?.slice(0, 6) ?? []) as sub}
            <button
              class="chip {topicFilter === sub.name ? 'chip--active' : 'chip--soft'}"
              on:click={() => (topicFilter = sub.name)}
            >
              {sub.name}
              <span class="chip-count">{sub.exerciseCount}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Stats panel -->
      <aside class="chapter-stats-panel">
        <div>
          <div class="caption" style="margin-bottom: 4px">Exercices</div>
          <div class="stat-number">{exercises.length || (currentChapterData?.count ?? '–')}</div>
        </div>
        {#if currentChapterData?.levels}
          <LevelBar levels={currentChapterData.levels} total={currentChapterData.count} />
        {/if}
        <div class="stat-row">
          <div>
            <div class="caption">Avec solution</div>
            <div class="stat-ok">{exercises.filter((e) => e.hasSolution).length} / {exercises.length}</div>
          </div>
          <div>
            <div class="caption">Avec indication</div>
            <div class="stat-accent">{exercises.filter((e) => e.hasIndication).length} / {exercises.length}</div>
          </div>
        </div>
      </aside>
    </section>

    <!-- Exercise list + right rail -->
    <div class="chapter-body">
      <!-- Main: exercise list -->
      <main class="exercise-list">
        <div class="list-toolbar">
          <h2 class="list-heading">
            Exercices
            <span class="list-count">{filteredExercises.length}</span>
          </h2>
          <span style="flex: 1" />
          <button class="btn btn-sm">
            Niveau croissant <span style="opacity:.6;margin-left:4px">▾</span>
          </button>
          <button class="btn btn-ghost btn-sm" title="Tout ajouter à ma liste"
            on:click={() => filteredExercises.forEach(addToList)}>
            + Tout en liste
          </button>
        </div>

        <div class="exo-cards">
          {#each filteredExercises as exo (exo.uuid)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <article
              class="exo-card {selectedExoId === exo.uuid ? 'exo-card--selected' : ''}"
              on:click={() => (selectedExoId = exo.uuid)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && (selectedExoId = exo.uuid)}
            >
              <div class="exo-meta-row">
                <span class="level-chip {selectedExoId === exo.uuid ? 'level-chip--solid' : ''}">
                  {exo.level ?? '–'}
                </span>
                {#if exo.module}
                  <span class="soft-chip">{exo.module}</span>
                {/if}
                {#if exo.difficulty}
                  <span class="stars" aria-label="difficulté {exo.difficulty}/4">
                    {#each stars(Number(exo.difficulty)) as filled}
                      <span class:star-off={!filled}>★</span>
                    {/each}
                  </span>
                {/if}
                <span style="flex:1" />
                {#if exo.hasSolution}
                  <span class="badge-ok">★ solution</span>
                {/if}
                {#if exo.video_id}
                  <span class="badge-video">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    vidéo
                  </span>
                {/if}
              </div>

              <h3 class="exo-title">
                <MathRenderer content={exo.title} inline={true} />
              </h3>

              {#if exo.preview}
                <p class="exo-excerpt">
                  <MathRenderer content={exo.preview} inline={true} />
                </p>
              {/if}

              <div class="exo-footer">
                <span class="caption">
                  {exo.author ?? ''}
                  {#if exo.author && exo.updated_at} · {/if}
                  {exo.updated_at ? new Date(exo.updated_at).toLocaleDateString('fr-FR', {month:'short', year:'numeric'}) : ''}
                </span>
                <span style="flex:1" />
                <button class="btn btn-ghost btn-sm" on:click|stopPropagation={() => addToList(exo)}>
                  + Liste
                </button>
                <a href="/exercise/{exo.uuid}" class="btn btn-ghost btn-sm">
                  Ouvrir →
                </a>
              </div>
            </article>
          {/each}

          {#if filteredExercises.length === 0}
            <div class="empty">
              <p>Aucun exercice trouvé{topicFilter !== 'all' ? ` pour « ${topicFilter} »` : ''}.</p>
            </div>
          {/if}
        </div>
      </main>

      <!-- Right rail -->
      <aside class="chapter-rail">
        <!-- Objectives / subchapters -->
        {#if currentChapterData?.subchapters?.length}
          <div class="rail-section">
            <div class="overline" style="margin-bottom:10px">Sous-thèmes</div>
            <ol class="objectives-list">
              {#each currentChapterData.subchapters as sub, i}
                <li class="objective-item">
                  <span class="obj-number">{i + 1}</span>
                  <span>{sub.name}</span>
                  <span class="caption" style="margin-left:auto">{sub.exerciseCount}</span>
                </li>
              {/each}
            </ol>
          </div>
        {/if}

        <!-- CTA -->
        <div class="rail-cta">
          <p class="t-italic" style="font-size:14px;color:var(--oym-ink-2);margin:0 0 10px;line-height:1.45">
            Contribuez ! Ajoutez un exercice ou améliorez une correction.
          </p>
          <button class="btn-terracotta">+ Proposer un exercice</button>
        </div>
      </aside>
    </div>

  <!-- ════════════════════════════════════════════════════════
       LANDING VIEW (library or map)
       ════════════════════════════════════════════════════════ -->
  {:else}
    <main class="landing">
      <!-- Page hero -->
      <div class="landing-hero">
        <div style="flex:1">
          <div class="overline" style="margin-bottom:8px">
            Programme · {totalExercises} exercices
          </div>
          <h1 class="display-title">
            Parcourir <em style="font-style:italic;color:var(--oym-teal-800)">le programme</em>
          </h1>
          <p class="hero-subtitle">
            Du L1 à la prépa — {totalChapters} chapitres, rédigés et révisés par la communauté.
          </p>
        </div>

        <div class="hero-controls">
          <div class="overline" style="margin-bottom:8px">Filtrer par niveau</div>
          <div class="level-filter-row">
            {#each [['Tous', 'all'], ['L1','L1'], ['L2','L2'], ['L3','L3'], ['CPGE','CPGE']] as [label, val]}
              <button
                class="btn btn-sm {levelFilter === val ? 'btn-primary' : ''}"
                style="border-color: {levelFilter === val ? 'var(--oym-ink)' : 'var(--oym-line-2)'}"
                on:click={() => (levelFilter = val)}
              >{label}</button>
            {/each}
          </div>

          <div class="view-toggles">
            <button
              class="view-btn {viewMode === 'library' ? 'view-btn--active' : ''}"
              on:click={() => (viewMode = 'library')}
              title="Vue bibliothèque"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              class="view-btn {viewMode === 'map' ? 'view-btn--active' : ''}"
              on:click={() => (viewMode = 'map')}
              title="Vue carte"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="6" cy="8" r="2.5"/><circle cx="18" cy="6" r="2"/>
                <circle cx="9" cy="17" r="2"/><circle cx="17" cy="16" r="2.5"/>
                <path d="M6 8 L12 12 M18 6 L12 12 M9 17 L12 12 M17 16 L12 12"/>
              </svg>
            </button>
            <button
              class="view-btn {dense ? 'view-btn--active' : ''}"
              on:click={() => (dense = !dense)}
              title="Densité"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button
              class="view-btn {showLevels ? 'view-btn--active' : ''}"
              on:click={() => (showLevels = !showLevels)}
              title="Barres de niveau"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="14" width="4" height="7"/><rect x="10" y="9" width="4" height="12"/>
                <rect x="17" y="4" width="4" height="17"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ─── MAP VIEW ──────────────────────────────────────── -->
      {#if viewMode === 'map'}
        <div class="map-hero-text">
          <div class="overline" style="margin-bottom:6px">Vue carte · constellation</div>
          <p class="hero-subtitle" style="margin:0">
            Une bulle par chapitre — taille proportionnelle au nombre d'exercices.
          </p>
        </div>

        <!-- Legend -->
        <div class="map-legend">
          {#each programme as mod}
            {@const c = getModuleColor(mod.name)}
            <span class="legend-entry">
              <span class="legend-dot" style="background:{c.bg};border:1.5px solid {c.stroke}"></span>
              {mod.name}
            </span>
          {/each}
        </div>

        <div class="map-container">
          <!-- Level column labels -->
          {#each ['L1','L2','L3','CPGE'] as l, i}
            <div class="map-col-label" style="left:{12.5 + i*25}%">{l}</div>
          {/each}

          <!-- Bubbles -->
          {#each bubbles as b}
            <button
              class="bubble"
              style="left:{b.x}%;top:{b.y}%;width:{b.r*2}px;height:{b.r*2}px;background:{b.color.bg};border-color:{b.color.stroke};color:{b.color.ink}"
              on:click={() => goto(`/browse?chapter=${encodeURIComponent(b.ch.name)}`)}
            >
              <span class="bubble-name" style="font-size:{b.r>36?13:11}px">{b.ch.name}</span>
              <span class="bubble-count">{b.ch.count}</span>
            </button>
          {/each}

          <p class="map-hint">Cliquez sur une bulle pour explorer le chapitre</p>
        </div>

      <!-- ─── LIBRARY VIEW ───────────────────────────────────── -->
      {:else}
        {#if programme.length === 0}
          <div class="empty" style="margin-top:48px">
            <p>Aucun chapitre trouvé. La base de données est peut-être vide.</p>
          </div>
        {:else}
          <div class="module-sections">
            {#each programme as mod}
              <section>
                <!-- Module header -->
                <header class="module-header">
                  <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
                    <div class="overline" style="color:var(--oym-teal-800)">Module</div>
                    <h2 class="module-name">{mod.name}</h2>
                  </div>
                  {#if mod.blurb}
                    <p class="module-blurb">{mod.blurb}</p>
                  {/if}
                  <div style="text-align:right;white-space:nowrap;flex-shrink:0">
                    <div class="module-count">{mod.count}</div>
                    <div class="caption" style="margin-top:2px">
                      exercices · {mod.chapters.length} chapitres
                    </div>
                  </div>
                </header>

                <!-- Chapter grid -->
                <div class="chapter-grid" style="grid-template-columns: repeat(auto-fill, minmax({dense?'220px':'280px'}, 1fr))">
                  {#each mod.chapters as ch}
                    <ChapterCard chapter={ch} {dense} {showLevels} />
                  {/each}
                </div>
              </section>
            {/each}
          </div>

          <!-- Footer note -->
          <div class="landing-footer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2v20M2 12h20" stroke-linecap="round"/>
            </svg>
            <em class="t-italic" style="font-size:14px">
              Vous enseignez un chapitre absent du programme ? Proposez-en un.
            </em>
            <span style="flex:1" />
            <button class="btn btn-sm">Proposer un chapitre →</button>
          </div>
        {/if}
      {/if}
    </main>
  {/if}
</div>

<style>
  /* ── Root ────────────────────────────────────────────────── */
  .browse-root {
    background: var(--oym-bg);
    color: var(--oym-ink);
    font-family: var(--oym-font-sans);
    min-height: calc(100vh - 4rem);
    display: flex;
    flex-direction: column;
  }

  /* ── Typography helpers ──────────────────────────────────── */
  .overline {
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--oym-ink-3);
  }

  .caption {
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-ink-3);
  }

  .t-italic { font-family: var(--oym-font-serif); font-style: italic; }

  /* ── Buttons ─────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    font-family: var(--oym-font-sans);
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    border-radius: 999px;
    border: 1px solid var(--oym-ink);
    background: var(--oym-bg);
    color: var(--oym-ink);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-decoration: none;
  }

  .btn:hover { background: var(--oym-ink); color: var(--oym-bg); }

  .btn-primary {
    background: var(--oym-ink);
    color: var(--oym-bg);
    border-color: var(--oym-ink);
  }

  .btn-primary:hover { background: var(--oym-teal-700); border-color: var(--oym-teal-700); }

  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--oym-ink-2);
  }

  .btn-ghost:hover { background: var(--oym-bg-elev); color: var(--oym-ink); }

  .btn-sm { padding: 6px 12px; font-size: 12px; }

  .btn-terracotta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 8px 14px;
    font-family: var(--oym-font-sans);
    font-size: 13px;
    font-weight: 500;
    border-radius: 999px;
    border: 1px solid var(--oym-accent);
    background: var(--oym-accent);
    color: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-terracotta:hover { background: var(--oym-accent-700); border-color: var(--oym-accent-700); }

  /* ── Chips ───────────────────────────────────────────────── */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 11px;
    font-family: var(--oym-font-sans);
    font-size: 12px;
    font-weight: 500;
    border-radius: 999px;
    border: 1px solid var(--oym-line-2);
    background: var(--oym-bg);
    color: var(--oym-ink-2);
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.12s;
  }

  .chip--active { background: var(--oym-ink); color: var(--oym-bg); border-color: var(--oym-ink); }
  .chip--soft { background: transparent; color: var(--oym-ink-3); border-color: var(--oym-line); }
  .chip--soft:hover { border-color: var(--oym-ink-3); color: var(--oym-ink-2); }

  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }

  .chip-count { opacity: 0.6; margin-left: 2px; font-size: 11px; }

  /* ── Breadcrumb ──────────────────────────────────────────── */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--oym-font-sans);
    font-size: 13px;
    color: var(--oym-ink-3);
    padding: 14px 48px 0;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .crumb-link {
    color: var(--oym-ink-3);
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    padding: 0;
    transition: color 0.12s;
  }

  .crumb-link:hover { color: var(--oym-teal-700); }
  .crumb-sep { color: var(--oym-ink-4); }
  .crumb-current { color: var(--oym-ink); font-weight: 600; }

  /* ── Chapter hero ────────────────────────────────────────── */
  .chapter-hero {
    padding: 20px 48px 28px;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    gap: 40px;
    align-items: flex-start;
  }

  .chapter-hero-left { flex: 1; min-width: 0; }

  .chapter-title {
    margin: 0 0 14px;
    font-family: var(--oym-font-serif);
    font-size: 36px;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.5px;
    color: var(--oym-ink);
  }

  .chapter-stats-panel {
    width: 240px;
    flex-shrink: 0;
    background: var(--oym-bg-elev);
    border: 1px solid var(--oym-line);
    border-radius: 6px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .stat-number {
    font-family: var(--oym-font-mono);
    font-size: 28px;
    color: var(--oym-ink);
    line-height: 1;
    font-weight: 500;
  }

  .stat-row {
    display: flex;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--oym-line-soft);
  }

  .stat-row > div { flex: 1; }

  .stat-ok {
    font-family: var(--oym-font-mono);
    font-size: 15px;
    color: var(--oym-ok);
    font-weight: 500;
  }

  .stat-accent {
    font-family: var(--oym-font-mono);
    font-size: 15px;
    color: var(--oym-accent-700);
    font-weight: 500;
  }

  /* ── Chapter body ────────────────────────────────────────── */
  .chapter-body {
    flex: 1;
    padding: 8px 48px 80px;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    gap: 36px;
  }

  .exercise-list { flex: 1; min-width: 0; }

  .list-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--oym-hairline);
    margin-bottom: 16px;
  }

  .list-heading {
    margin: 0;
    font-family: var(--oym-font-serif);
    font-size: 22px;
    font-weight: 600;
    color: var(--oym-ink);
  }

  .list-count {
    margin-left: 10px;
    font-family: var(--oym-font-mono);
    font-size: 14px;
    color: var(--oym-ink-3);
    font-weight: 400;
  }

  .exo-cards { display: flex; flex-direction: column; gap: 10px; }

  /* ── Exercise card ───────────────────────────────────────── */
  .exo-card {
    background: var(--oym-bg);
    border: 1px solid var(--oym-line);
    border-radius: 6px;
    padding: 16px 18px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.12s, box-shadow 0.12s;
    outline: none;
  }

  .exo-card:hover { border-color: var(--oym-ink-3); box-shadow: var(--oym-sh-1); }

  .exo-card--selected {
    border-color: var(--oym-teal-700);
    background: var(--oym-teal-50);
    box-shadow: 0 0 0 1px var(--oym-teal-700);
  }

  .exo-card:focus-visible { box-shadow: var(--oym-sh-focus); }

  .exo-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .level-chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 500;
    border-radius: 999px;
    background: var(--oym-teal-100);
    color: var(--oym-teal-800);
    border: 1px solid var(--oym-teal-300);
  }

  .level-chip--solid { background: var(--oym-teal); color: white; border-color: var(--oym-teal); }

  .soft-chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 500;
    border-radius: 999px;
    background: transparent;
    color: var(--oym-ink-3);
    border: 1px solid var(--oym-line);
  }

  .stars { display: inline-flex; gap: 1px; color: var(--oym-gold); font-size: 12px; line-height: 1; }
  :global(.star-off) { color: var(--oym-ink-5) !important; }

  .badge-ok { font-family: var(--oym-font-sans); font-size: 12px; color: var(--oym-ok); }
  .badge-video {
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-accent-700);
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .exo-title {
    margin: 0;
    font-family: var(--oym-font-serif);
    font-size: 17px;
    font-weight: 600;
    color: var(--oym-ink);
    line-height: 1.3;
  }

  .exo-excerpt {
    margin: 0;
    font-family: var(--oym-font-serif);
    font-size: 14px;
    line-height: 1.5;
    color: var(--oym-ink-2);
  }

  .exo-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed var(--oym-line-soft);
  }

  /* ── Right rail ──────────────────────────────────────────── */
  .chapter-rail {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .rail-section { display: flex; flex-direction: column; }

  .objectives-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .objective-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-family: var(--oym-font-serif);
    font-size: 14px;
    line-height: 1.45;
    color: var(--oym-ink-2);
  }

  .obj-number {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--oym-teal-50);
    border: 1px solid var(--oym-teal-300);
    color: var(--oym-teal-800);
    font-family: var(--oym-font-mono);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .rail-cta {
    padding: 16px;
    background: var(--oym-accent-50);
    border: 1px solid var(--oym-accent-100);
    border-radius: 6px;
  }

  /* ── Landing ─────────────────────────────────────────────── */
  .landing {
    flex: 1;
    padding: 32px 48px 80px;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .landing-hero {
    margin-bottom: 32px;
    display: flex;
    align-items: flex-end;
    gap: 32px;
    flex-wrap: wrap;
  }

  .display-title {
    margin: 0 0 10px;
    font-family: var(--oym-font-serif);
    font-size: 36px;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.5px;
    color: var(--oym-ink);
  }

  .hero-subtitle {
    margin: 0;
    color: var(--oym-ink-2);
    font-family: var(--oym-font-serif);
    font-size: 17px;
    max-width: 620px;
  }

  .hero-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .level-filter-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .view-toggles {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .view-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--oym-line-2);
    background: var(--oym-bg);
    color: var(--oym-ink-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
  }

  .view-btn:hover { border-color: var(--oym-ink-3); color: var(--oym-ink); }
  .view-btn--active { border-color: var(--oym-ink); background: var(--oym-bg-elev); color: var(--oym-ink); }

  /* ── Module sections ─────────────────────────────────────── */
  .module-sections {
    display: flex;
    flex-direction: column;
    gap: 56px;
  }

  .module-header {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--oym-hairline);
    margin-bottom: 18px;
    flex-wrap: wrap;
  }

  .module-name {
    margin: 0;
    font-family: var(--oym-font-serif);
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.3px;
    color: var(--oym-ink);
  }

  .module-blurb {
    margin: 0;
    flex: 1;
    color: var(--oym-ink-2);
    font-family: var(--oym-font-serif);
    font-style: italic;
    font-size: 15px;
    max-width: 540px;
    min-width: 200px;
  }

  .module-count {
    font-family: var(--oym-font-mono);
    font-size: 22px;
    color: var(--oym-ink);
    font-weight: 500;
    line-height: 1;
  }

  .chapter-grid {
    display: grid;
    gap: 16px;
  }

  /* ── Map view ─────────────────────────────────────────────── */
  .map-hero-text { margin-bottom: 12px; }

  .map-legend {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 10px 14px;
    background: var(--oym-bg-elev);
    border: 1px solid var(--oym-line-soft);
    border-radius: 6px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .legend-entry {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--oym-font-sans);
    font-size: 12px;
    color: var(--oym-ink-2);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .map-container {
    position: relative;
    background: var(--oym-bg);
    border: 1px solid var(--oym-line);
    border-radius: 6px;
    min-height: 560px;
    overflow: hidden;
    background-image: repeating-linear-gradient(
      to right,
      transparent, transparent calc(25% - 1px),
      var(--oym-line-soft) calc(25% - 1px), var(--oym-line-soft) 25%
    );
  }

  .map-col-label {
    position: absolute;
    top: 12px;
    transform: translateX(-50%);
    font-family: var(--oym-font-serif);
    font-style: italic;
    font-size: 20px;
    font-weight: 600;
    color: var(--oym-ink-4);
    pointer-events: none;
    user-select: none;
  }

  .bubble {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: all 0.18s ease;
    transform: translate(-50%, -50%);
    z-index: 2;
  }

  .bubble:hover { z-index: 4; filter: brightness(0.92); transform: translate(-50%, -50%) scale(1.06); }

  .bubble-name {
    font-family: var(--oym-font-serif);
    font-weight: 600;
    line-height: 1.1;
    text-align: center;
  }

  .bubble-count {
    font-family: var(--oym-font-mono);
    font-size: 10px;
    margin-top: 2px;
    opacity: 0.85;
  }

  .map-hint {
    position: absolute;
    bottom: 12px;
    right: 16px;
    font-family: var(--oym-font-serif);
    font-style: italic;
    font-size: 13px;
    color: var(--oym-ink-3);
    pointer-events: none;
  }

  /* ── Footer ──────────────────────────────────────────────── */
  .landing-footer {
    margin-top: 56px;
    padding-top: 18px;
    border-top: 1px solid var(--oym-hairline);
    display: flex;
    gap: 16px;
    align-items: center;
    color: var(--oym-ink-3);
    font-size: 13px;
  }

  /* ── Empty state ─────────────────────────────────────────── */
  .empty {
    text-align: center;
    padding: 48px 24px;
    color: var(--oym-ink-3);
    font-family: var(--oym-font-serif);
    font-style: italic;
  }

  /* ── Responsive ──────────────────────────────────────────── */
  @media (max-width: 768px) {
    .breadcrumb,
    .chapter-hero,
    .chapter-body,
    .landing { padding-left: 16px; padding-right: 16px; }

    .chapter-hero { flex-direction: column; }
    .chapter-stats-panel { width: 100%; }
    .chapter-body { flex-direction: column; }
    .chapter-rail { width: 100%; }
    .landing-hero { flex-direction: column; align-items: flex-start; }
    .hero-controls { align-items: flex-start; }
    .level-filter-row { justify-content: flex-start; }
  }
</style>
