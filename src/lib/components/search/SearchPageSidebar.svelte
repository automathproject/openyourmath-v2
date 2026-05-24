<script>
  import { filters, filterCounts, suggestions, searchActions } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';

  const LEVELS = ['L1', 'L2', 'L3', 'CPGE'];

  let authorInput = '';
  let organizationInput = '';
  let showAllModules = false;

  // Sync inputs with store on external filter changes (e.g. URL or clear all)
  $: authorInput = $filters.author || '';
  $: organizationInput = $filters.organization || '';

  function setLevel(l) {
    const next = $filters.level === l ? '' : l;
    searchActions.updateFilter('level', next);
    searchActions.updateFilter('module', '');
    searchActions.updateFilter('chapter', '');
    searchActions.updateFilter('subchapter', '');
    searchActions.search();
  }

  function setModule(m) {
    const next = $filters.module === m ? '' : m;
    searchActions.updateFilter('module', next);
    searchActions.updateFilter('chapter', '');
    searchActions.updateFilter('subchapter', '');
    searchActions.search();
  }

  function toggleFlag(key) {
    const cur = $filters[key];
    searchActions.updateFilter(key, cur === '1' ? '' : '1');
    searchActions.search();
  }

  function setDifficulty(e) {
    searchActions.updateFilter('difficulty', e.target.value);
    searchActions.search();
  }

  function applyAuthor() {
    searchActions.updateFilter('author', authorInput.trim());
    searchActions.search();
  }

  function applyOrganization() {
    searchActions.updateFilter('organization', organizationInput.trim());
    searchActions.search();
  }

  function handleTextKey(e, applyFn) {
    if (e.key === 'Enter') { e.preventDefault(); applyFn(); }
    if (e.key === 'Escape') { e.currentTarget.blur(); }
  }

  $: sortedModules = Object.entries($filterCounts?.module ?? {})
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
  $: visibleModules = showAllModules ? sortedModules : sortedModules.slice(0, 6);
  $: hiddenModuleCount = Math.max(0, sortedModules.length - visibleModules.length);

  $: difficultyOptions = (() => {
    const entries = new Set(Object.keys($filterCounts?.difficulty ?? {}).filter(v => v && v !== '0'));
    ($suggestions?.difficulties || []).forEach(e => entries.add(String(e.value ?? e)));
    return Array.from(entries).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  })();

  $: authorSuggestions = ($suggestions?.authors || []).map(e => e.value ?? e).filter(Boolean);
  $: organizationSuggestions = ($suggestions?.organizations || []).map(e => e.value ?? e).filter(Boolean);
</script>

<aside class="sps">
  <!-- Niveau -->
  <div class="sps-section">
    <div class="sps-overline">Niveau</div>
    <div class="sps-level-grid">
      {#each LEVELS as l}
        <button
          type="button"
          class="sps-level-btn"
          class:sps-level-btn--on={$filters.level === l}
          on:click={() => setLevel(l)}
        >{l}</button>
      {/each}
    </div>
  </div>

  <hr class="sps-hr" />

  <!-- Module -->
  <div class="sps-section">
    <div class="sps-overline">Module</div>
    {#if sortedModules.length > 0}
      <div class="sps-module-list">
        {#each visibleModules as [name, count]}
          <button
            type="button"
            class="sps-module-btn"
            class:sps-module-btn--on={$filters.module === name}
            on:click={() => setModule(name)}
          >
            <span class="sps-module-name">{name}</span>
            <span class="sps-module-count">{count}</span>
          </button>
        {/each}
      </div>
      {#if sortedModules.length > 6}
        <button type="button" class="sps-show-more" on:click={() => (showAllModules = !showAllModules)}>
          {showAllModules ? 'Voir moins' : `Voir plus (${hiddenModuleCount})`}
        </button>
      {/if}
    {:else}
      <p class="sps-empty">Lancez une recherche pour filtrer par module.</p>
    {/if}
  </div>

  <hr class="sps-hr" />

  <!-- Contenu -->
  <div class="sps-section">
    <div class="sps-overline">Contenu</div>
    <div class="sps-check-list">
      <button type="button" class="sps-check-row" on:click={() => toggleFlag('hasSolution')}>
        <span class="sps-checkbox" class:sps-checkbox--on={$filters.hasSolution === '1'}>
          {#if $filters.hasSolution === '1'}✓{/if}
        </span>
        <span>Avec solution</span>
      </button>
      <button type="button" class="sps-check-row" on:click={() => toggleFlag('hasIndication')}>
        <span class="sps-checkbox" class:sps-checkbox--on={$filters.hasIndication === '1'}>
          {#if $filters.hasIndication === '1'}✓{/if}
        </span>
        <span>Avec indication</span>
      </button>
      <button type="button" class="sps-check-row" on:click={() => toggleFlag('hasVideo')}>
        <span class="sps-checkbox" class:sps-checkbox--on={$filters.hasVideo === '1'}>
          {#if $filters.hasVideo === '1'}✓{/if}
        </span>
        <span>Avec vidéo</span>
      </button>
    </div>
  </div>

  {#if difficultyOptions.length > 0}
    <hr class="sps-hr" />
    <!-- Difficulté -->
    <div class="sps-section">
      <div class="sps-overline">Difficulté</div>
      <select class="sps-select" value={$filters.difficulty || ''} on:change={setDifficulty}>
        <option value="">Toutes</option>
        {#each difficultyOptions as v}
          <option value={v}>{formatDifficultyLabel(v)}</option>
        {/each}
      </select>
    </div>
  {/if}

  <hr class="sps-hr" />

  <!-- Auteur -->
  <div class="sps-section">
    <div class="sps-overline-row">
      <div class="sps-overline">Auteur</div>
      {#if $filters.author}
        <span class="sps-active-badge">Actif</span>
      {/if}
    </div>
    <div class="sps-input-wrap" class:sps-input-wrap--active={$filters.author}>
      <input
        class="sps-input"
        class:sps-input--active={$filters.author}
        type="text"
        placeholder="Nom de l'auteur…"
        bind:value={authorInput}
        list="sps-author-list"
        on:blur={applyAuthor}
        on:keydown={(e) => handleTextKey(e, applyAuthor)}
      />
      {#if authorInput}
        <button type="button" class="sps-input-clear" on:click={() => { authorInput = ''; applyAuthor(); }} aria-label="Effacer le filtre auteur">×</button>
      {/if}
    </div>
    <datalist id="sps-author-list">
      {#each authorSuggestions as a}<option value={a}></option>{/each}
    </datalist>
  </div>

  <hr class="sps-hr" />

  <!-- Organisation -->
  <div class="sps-section">
    <div class="sps-overline-row">
      <div class="sps-overline">Organisation</div>
      {#if $filters.organization}
        <span class="sps-active-badge">Actif</span>
      {/if}
    </div>
    <div class="sps-input-wrap" class:sps-input-wrap--active={$filters.organization}>
      <input
        class="sps-input"
        class:sps-input--active={$filters.organization}
        type="text"
        placeholder="Nom de l'organisation…"
        bind:value={organizationInput}
        list="sps-org-list"
        on:blur={applyOrganization}
        on:keydown={(e) => handleTextKey(e, applyOrganization)}
      />
      {#if organizationInput}
        <button type="button" class="sps-input-clear" on:click={() => { organizationInput = ''; applyOrganization(); }} aria-label="Effacer le filtre organisation">×</button>
      {/if}
    </div>
    <datalist id="sps-org-list">
      {#each organizationSuggestions as o}<option value={o}></option>{/each}
    </datalist>
  </div>
</aside>

<style>
  .sps {
    padding: 20px 16px 32px;
  }
  @media (min-width: 641px) and (max-width: 1023px) {
    .sps {
      padding: 14px 14px 16px;
    }
  }
  .sps-section { margin-bottom: 2px; }
  .sps-overline {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: theme('colors.interface.text-muted');
    margin-bottom: 10px;
  }
  .sps-overline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .sps-overline-row .sps-overline {
    margin-bottom: 0;
  }
  .sps-active-badge {
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    @apply bg-brand-50 text-brand-700 border border-brand-200;
  }
  .sps-hr {
    border: none;
    border-top: 1px solid theme('colors.interface.border-primary');
    margin: 16px 0;
  }
  @media (min-width: 641px) and (max-width: 1023px) {
    .sps-hr {
      margin: 10px 0;
    }
  }

  /* ── Niveau ── */
  .sps-level-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    overflow: hidden;
    border: 1.5px solid theme('colors.interface.border-secondary');
    border-radius: 6px;
  }
  .sps-level-btn {
    min-width: 0;
    padding: 7px 0;
    border: none;
    border-right: 1px solid theme('colors.interface.border-secondary');
    border-radius: 0;
    background: transparent;
    font-size: 13px;
    font-weight: 500;
    color: theme('colors.interface.text-secondary');
    cursor: pointer;
    text-align: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .sps-level-btn:hover {
    background: theme('colors.interface.bg-tertiary');
  }
  .sps-level-btn:last-child {
    border-right: none;
  }
  .sps-level-btn--on {
    background: theme('colors.interface.text-primary');
    color: white;
  }

  /* ── Module ── */
  .sps-module-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sps-module-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    width: 100%;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    background: transparent;
    font-size: 13px;
    color: theme('colors.interface.text-secondary');
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    text-align: left;
  }
  .sps-module-btn:hover {
    background: theme('colors.interface.bg-tertiary');
  }
  .sps-module-btn--on {
    background: theme('colors.brand.50');
    border-left-color: theme('colors.brand.500');
    color: theme('colors.brand.800');
    font-weight: 600;
  }
  .sps-module-name { flex: 1; min-width: 0; }
  .sps-module-count {
    font-size: 11px;
    color: theme('colors.interface.text-muted');
    flex-shrink: 0;
  }
  .sps-module-btn--on .sps-module-count { color: theme('colors.brand.600'); }
  .sps-show-more {
    margin-top: 0.45rem;
    width: 100%;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    @apply border border-interface-border-primary bg-interface-bg-white text-interface-text-secondary;
  }
  .sps-show-more:hover {
    @apply bg-interface-bg-tertiary text-interface-text-primary;
  }

  /* ── Contenu ── */
  .sps-check-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .sps-check-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border: 1px solid theme('colors.interface.border-secondary');
    border-radius: 9999px;
    font-size: 12px;
    color: theme('colors.interface.text-secondary');
    cursor: pointer;
    background: theme('colors.interface.bg-white');
    text-align: left;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }
  .sps-check-row:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .sps-check-row:has(.sps-checkbox--on) {
    border-color: theme('colors.brand.200');
    background: theme('colors.brand.50');
    color: theme('colors.brand.800');
  }
  .sps-checkbox {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1.5px solid theme('colors.interface.border-secondary');
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    color: white;
    transition: background 0.12s, border-color 0.12s;
  }
  .sps-checkbox--on {
    background: theme('colors.interface.text-primary');
    border-color: theme('colors.interface.text-primary');
  }

  .sps-empty {
    font-size: 12px;
    color: theme('colors.interface.text-muted');
    font-style: italic;
    margin: 0;
  }

  /* ── Difficulté select ── */
  .sps-select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 13px;
    background: theme('colors.interface.bg-white');
    color: theme('colors.interface.text-primary');
    border: 1.5px solid theme('colors.interface.border-secondary');
    cursor: pointer;
    appearance: auto;
  }
  .sps-select:focus { outline: none; border-color: theme('colors.brand.500'); }

  /* ── Text inputs (Auteur / Organisation) ── */
  .sps-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .sps-input-wrap--active::before {
    content: '';
    position: absolute;
    left: 7px;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    z-index: 1;
    @apply bg-brand-600;
  }
  .sps-input {
    width: 100%;
    padding: 6px 28px 6px 8px;
    border-radius: 6px;
    font-size: 13px;
    background: theme('colors.interface.bg-white');
    color: theme('colors.interface.text-primary');
    border: 1.5px solid theme('colors.interface.border-secondary');
  }
  .sps-input--active {
    padding-left: 20px;
    @apply border-brand-300 bg-brand-50 text-brand-800;
  }
  .sps-input::placeholder { color: theme('colors.interface.text-muted'); }
  .sps-input:focus { outline: none; border-color: theme('colors.brand.500'); }
  .sps-input-clear {
    position: absolute;
    right: 6px;
    background: none;
    border: none;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    color: theme('colors.interface.text-muted');
    padding: 2px 4px;
  }
  .sps-input--active + .sps-input-clear {
    color: theme('colors.brand.700');
  }
  .sps-input-clear:hover { color: theme('colors.interface.text-primary'); }
</style>
