<!-- src/lib/components/search/SearchPageSidebar.svelte
     Left filter sidebar for the search page (Recherche Hi-Fi design)
-->
<script>
  import { onMount } from 'svelte';
  import { filters, searchActions } from '$lib/stores/searchStore.js';

  // Loaded module/chapter tree
  let structure = [];
  let loadingStructure = false;
  // Track which module IDs are expanded
  let expandedModules = {};

  const NIVEAUX = ['L1', 'L2', 'L3', 'CPGE'];

  onMount(() => {
    loadStructure();
  });

  async function loadStructure() {
    loadingStructure = true;
    try {
      const res = await fetch('/api/chapters?type=structure');
      if (res.ok) {
        const data = await res.json();
        // API returns level → modules → chapters; flatten to module → chapters
        const moduleMap = new Map();
        for (const level of data.structure ?? []) {
          for (const mod of level.modules ?? []) {
            if (!moduleMap.has(mod.name)) {
              moduleMap.set(mod.name, { name: mod.name, count: 0, chapterMap: new Map() });
            }
            const m = moduleMap.get(mod.name);
            m.count += mod.exerciseCount ?? 0;
            for (const ch of mod.chapters ?? []) {
              if (!m.chapterMap.has(ch.name)) {
                m.chapterMap.set(ch.name, { name: ch.name, count: 0 });
              }
              m.chapterMap.get(ch.name).count += ch.exerciseCount ?? 0;
            }
          }
        }
        structure = Array.from(moduleMap.values()).map((m) => ({
          name: m.name,
          count: m.count,
          chapters: Array.from(m.chapterMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        })).sort((a, b) => a.name.localeCompare(b.name));

        // Auto-expand the first module
        if (structure.length > 0) {
          expandedModules[structure[0].name] = true;
        }
      }
    } catch (_) {
      // silently fail
    } finally {
      loadingStructure = false;
    }
  }

  function setLevel(lvl) {
    const next = $filters.level === lvl ? '' : lvl;
    searchActions.updateFilter('level', next);
    searchActions.search();
  }

  function setModule(modName) {
    const next = $filters.module === modName ? '' : modName;
    searchActions.updateFilter('module', next);
    searchActions.updateFilter('chapter', '');
    searchActions.updateFilter('subchapter', '');
    searchActions.search();
  }

  function setChapter(chName) {
    const next = $filters.chapter === chName ? '' : chName;
    searchActions.updateFilter('chapter', next);
    searchActions.updateFilter('subchapter', '');
    searchActions.search();
  }

  function toggleExpand(key) {
    expandedModules[key] = !expandedModules[key];
    expandedModules = expandedModules; // trigger reactivity
  }

  function setHasSolution(val) {
    const current = $filters.hasSolution;
    searchActions.updateFilter('hasSolution', current === val ? '' : val);
    searchActions.search();
  }

  function setHasIndication(val) {
    const current = $filters.hasIndication;
    searchActions.updateFilter('hasIndication', current === val ? '' : val);
    searchActions.search();
  }

  function setHasVideo(val) {
    const current = $filters.hasVideo;
    searchActions.updateFilter('hasVideo', current === val ? '' : val);
    searchActions.search();
  }

  // Difficulty: store as max value ('1'..'4') or '' for no filter
  let difficultyMax = 4;
  $: difficultyMax = $filters.difficulty ? parseInt($filters.difficulty, 10) : 4;

  function setDifficulty(val) {
    searchActions.updateFilter('difficulty', val >= 4 ? '' : String(val));
    searchActions.search();
  }

  // Author debounce
  let authorInput = '';
  let authorTimer;
  $: authorInput = $filters.author || '';

  function handleAuthorInput(e) {
    authorInput = e.target.value;
    clearTimeout(authorTimer);
    authorTimer = setTimeout(() => {
      searchActions.updateFilter('author', authorInput.trim());
      searchActions.search();
    }, 400);
  }

  function difficultyStars(n, max = 4) {
    return Array.from({ length: max }, (_, i) => i < n);
  }
</script>

<aside class="filter-sidebar">

  <!-- ── Niveau ────────────────────────────────────────── -->
  <section class="filter-section">
    <div class="filter-label">Niveau</div>
    <div class="niveau-grid">
      {#each NIVEAUX as lvl}
        <button
          class="niveau-btn {$filters.level === lvl ? 'niveau-btn--active' : ''}"
          on:click={() => setLevel(lvl)}
        >{lvl}</button>
      {/each}
    </div>
  </section>

  <div class="dot-divider"></div>

  <!-- ── Module / Chapitre ─────────────────────────────── -->
  <section class="filter-section">
    <div class="filter-label">Module</div>
    {#if loadingStructure}
      <div class="filter-loading">…</div>
    {:else}
      <div class="module-tree">
        {#each structure as mod}
          {@const modKey = mod.name}
          {@const isExpanded = !!expandedModules[modKey]}
          {@const modActive = $filters.module === mod.name}
          <!-- Module row -->
          <div
            class="tree-row tree-row--mod {modActive ? 'tree-row--active' : ''}"
            role="button"
            tabindex="0"
            on:click={() => { setModule(mod.name); if (!isExpanded) toggleExpand(modKey); }}
            on:keydown={(e) => e.key === 'Enter' && setModule(mod.name)}
          >
            <span
              class="tree-chevron"
              role="button"
              tabindex="0"
              aria-label={isExpanded ? 'Réduire' : 'Développer'}
              on:click|stopPropagation={() => toggleExpand(modKey)}
              on:keydown|stopPropagation={(e) => e.key === 'Enter' && toggleExpand(modKey)}
            >{isExpanded ? '▾' : '▸'}</span>
            <span class="tree-name">{mod.name}</span>
            <span class="tree-count">{mod.count ?? ''}</span>
          </div>
          <!-- Chapter rows -->
          {#if isExpanded && mod.chapters}
            {#each mod.chapters as ch}
              {@const chActive = $filters.chapter === ch.name}
              <div
                class="tree-row tree-row--ch {chActive ? 'tree-row--active tree-row--ch-active' : ''}"
                role="button"
                tabindex="0"
                on:click={() => setChapter(ch.name)}
                on:keydown={(e) => e.key === 'Enter' && setChapter(ch.name)}
              >
                <span class="tree-name">{ch.name}</span>
                <span class="tree-count">{ch.count ?? ''}</span>
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    {/if}
  </section>

  <div class="dot-divider"></div>

  <!-- ── Contenu disponible ────────────────────────────── -->
  <section class="filter-section">
    <div class="filter-label">Contenu</div>
    <div class="checkbox-list">
      {#each [
        { label: 'Avec solution',    key: 'hasSolution',   fn: setHasSolution },
        { label: 'Avec indication',  key: 'hasIndication', fn: setHasIndication },
        { label: 'Avec vidéo',       key: 'hasVideo',      fn: setHasVideo },
      ] as item}
        {@const active = $filters[item.key] === '1'}
        <label class="checkbox-row">
          <span
            class="checkbox-box {active ? 'checkbox-box--checked' : ''}"
            role="checkbox"
            tabindex="0"
            aria-checked={active}
            on:click={() => item.fn('1')}
            on:keydown={(e) => e.key === ' ' && item.fn('1')}
          >{active ? '✓' : ''}</span>
          <span class="checkbox-label">{item.label}</span>
        </label>
      {/each}
    </div>
  </section>

  <div class="dot-divider"></div>

  <!-- ── Difficulté max ────────────────────────────────── -->
  <section class="filter-section">
    <div class="filter-label">Difficulté max</div>
    <div class="diff-row">
      <span class="stars" aria-label="difficulté {difficultyMax}/4">
        {#each difficultyStars(difficultyMax) as filled}
          <span class={filled ? 'star-on' : 'star-off'}>★</span>
        {/each}
      </span>
      {#if difficultyMax < 4}
        <span class="diff-hint">et moins</span>
      {/if}
    </div>
    <input
      type="range"
      min="1"
      max="4"
      value={difficultyMax}
      class="diff-slider"
      on:change={(e) => setDifficulty(parseInt(e.target.value, 10))}
    />
  </section>

  <div class="dot-divider"></div>

  <!-- ── Auteur ────────────────────────────────────────── -->
  <section class="filter-section">
    <div class="filter-label">Auteur</div>
    <div class="search-input-wrap">
      <input
        type="text"
        class="author-input"
        placeholder="filtrer par auteur…"
        value={authorInput}
        on:input={handleAuthorInput}
      />
    </div>
  </section>

</aside>

<style>
  .filter-sidebar {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid var(--oym-hairline);
    padding: 20px 18px 40px;
    background: var(--oym-bg);
    overflow-y: auto;
    height: 100%;
  }

  .filter-section {
    margin-bottom: 4px;
  }

  .filter-label {
    font-family: var(--oym-font-sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.1px;
    text-transform: uppercase;
    color: var(--oym-ink-3);
    margin-bottom: 10px;
  }

  /* Niveau buttons */
  .niveau-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-bottom: 4px;
  }

  .niveau-btn {
    padding: 7px 0;
    border-radius: 4px;
    border: 1px solid var(--oym-line-2);
    background: var(--oym-bg);
    color: var(--oym-ink-2);
    font-family: var(--oym-font-sans);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }

  .niveau-btn:hover {
    border-color: var(--oym-ink-3);
    background: var(--oym-bg-elev);
  }

  .niveau-btn--active {
    background: var(--oym-ink);
    color: var(--oym-bg);
    border-color: var(--oym-ink);
  }

  /* Module tree */
  .module-tree {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .filter-loading {
    font-size: 13px;
    color: var(--oym-ink-3);
    padding: 4px 8px;
  }

  .tree-row {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    gap: 6px;
    font-family: var(--oym-font-sans);
    font-size: 13px;
    color: var(--oym-ink-2);
    cursor: pointer;
    border-radius: 4px;
    user-select: none;
    transition: background 0.1s;
  }

  .tree-row:hover {
    background: var(--oym-bg-elev);
  }

  .tree-row--mod {
    font-weight: 500;
  }

  .tree-row--active {
    color: var(--oym-teal-800);
  }

  .tree-row--ch {
    padding-left: 22px;
    font-size: 12.5px;
    font-weight: 400;
    border-left: 2px solid transparent;
    border-radius: 0 4px 4px 0;
  }

  .tree-row--ch-active {
    background: var(--oym-teal-50);
    border-left-color: var(--oym-teal);
    font-weight: 600;
  }

  .tree-chevron {
    color: var(--oym-ink-4);
    font-size: 10px;
    width: 12px;
    flex-shrink: 0;
    line-height: 1;
  }

  .tree-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-count {
    font-size: 11px;
    color: var(--oym-ink-3);
    flex-shrink: 0;
  }

  /* Contenu checkboxes */
  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
  }

  .checkbox-box {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid var(--oym-line-2);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--oym-bg);
    font-size: 11px;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.15s;
  }

  .checkbox-box--checked {
    background: var(--oym-ink);
    border-color: var(--oym-ink);
  }

  .checkbox-label {
    font-family: var(--oym-font-sans);
    font-size: 13.5px;
    color: var(--oym-ink-2);
  }

  /* Difficulty */
  .diff-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .stars {
    display: inline-flex;
    gap: 1px;
    line-height: 1;
  }

  .star-on  { color: var(--oym-gold); font-size: 13px; }
  .star-off { color: var(--oym-ink-5); font-size: 13px; }

  .diff-hint {
    font-size: 11.5px;
    color: var(--oym-ink-3);
    font-family: var(--oym-font-sans);
  }

  .diff-slider {
    width: 100%;
    accent-color: var(--oym-teal-700);
    cursor: pointer;
  }

  /* Author input */
  .search-input-wrap {
    border: 1px solid var(--oym-line);
    border-radius: 6px;
    background: var(--oym-bg);
    padding: 0 10px;
    height: 34px;
    display: flex;
    align-items: center;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .search-input-wrap:focus-within {
    border-color: var(--oym-teal);
    box-shadow: var(--oym-sh-focus);
  }

  .author-input {
    border: 0;
    outline: 0;
    background: transparent;
    font-family: var(--oym-font-sans);
    font-size: 13px;
    color: var(--oym-ink);
    width: 100%;
  }

  .author-input::placeholder {
    color: var(--oym-ink-3);
  }

  /* Dotted divider */
  .dot-divider {
    height: 1px;
    background-image: linear-gradient(to right, var(--oym-line) 50%, transparent 50%);
    background-size: 8px 1px;
    background-repeat: repeat-x;
    margin: 16px 0;
  }
</style>
