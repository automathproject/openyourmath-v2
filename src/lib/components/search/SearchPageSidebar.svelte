<script>
  import { filters, filterCounts, suggestions, searchActions } from '$lib/stores/searchStore.js';
  import { formatDifficultyLabel } from '$lib/utils/filterUtils.js';

  const LEVELS = ['L1', 'L2', 'L3', 'CPGE'];

  let showAllModules = false;
  let showAllAuthors = false;
  let showAllOrganizations = false;
  let authorSearch = '';
  let organizationSearch = '';

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

  function clearModule() {
    searchActions.updateFilter('module', '');
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

  function setFacetFilter(key, value) {
    const next = $filters[key] === value ? '' : value;
    searchActions.updateFilter(key, next);
    searchActions.search();
  }

  function clearFacetFilter(key) {
    searchActions.updateFilter(key, '');
    searchActions.search();
  }

  function buildFacetItems(counts = {}, suggestionEntries = [], activeValue = '') {
    const byValue = new Map();

    for (const entry of suggestionEntries || []) {
      const value = String(entry?.value ?? entry ?? '').trim();
      if (!value) continue;
      byValue.set(value, {
        value,
        count: Number(entry?.count ?? 0) || 0
      });
    }

    for (const [value, count] of Object.entries(counts || {})) {
      const trimmed = String(value).trim();
      if (!trimmed) continue;
      byValue.set(trimmed, {
        value: trimmed,
        count: Number(count) || byValue.get(trimmed)?.count || 0
      });
    }

    if (activeValue && !byValue.has(activeValue)) {
      byValue.set(activeValue, { value: activeValue, count: 0 });
    }

    return Array.from(byValue.values())
      .sort((a, b) => (b.count - a.count) || a.value.localeCompare(b.value, 'fr', { sensitivity: 'base' }));
  }

  function filterFacetItems(items, searchTerm) {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.value.toLowerCase().includes(term));
  }

  function handleFacetSearchKey(event, key, items) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = items[0]?.value;
      if (first) setFacetFilter(key, first);
    } else if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  }

  $: sortedModules = (() => {
    const byName = new Map();

    for (const [name, count] of Object.entries($filterCounts?.module ?? {})) {
      const trimmed = String(name).trim();
      if (!trimmed || count <= 0) continue;
      byName.set(trimmed, Number(count) || 0);
    }

    for (const entry of $suggestions?.modules || []) {
      const name = String(entry?.value ?? entry ?? '').trim();
      if (!name || byName.has(name)) continue;
      byName.set(name, Number(entry?.count ?? 0) || 0);
    }

    if ($filters.module && !byName.has($filters.module)) {
      byName.set($filters.module, 0);
    }

    return Array.from(byName.entries()).sort((a, b) => {
      if (a[0] === $filters.module) return -1;
      if (b[0] === $filters.module) return 1;
      return (b[1] - a[1]) || a[0].localeCompare(b[0], 'fr', { sensitivity: 'base' });
    });
  })();
  $: visibleModules = showAllModules ? sortedModules : sortedModules.slice(0, 6);
  $: hiddenModuleCount = Math.max(0, sortedModules.length - visibleModules.length);

  $: difficultyOptions = (() => {
    const entries = new Set(Object.keys($filterCounts?.difficulty ?? {}).filter(v => v && v !== '0'));
    ($suggestions?.difficulties || []).forEach(e => entries.add(String(e.value ?? e)));
    return Array.from(entries).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  })();

  $: authorItems = buildFacetItems($filterCounts?.author, $suggestions?.authors, $filters.author);
  $: organizationItems = buildFacetItems($filterCounts?.organization, $suggestions?.organizations, $filters.organization);
  $: filteredAuthorItems = filterFacetItems(authorItems, authorSearch);
  $: filteredOrganizationItems = filterFacetItems(organizationItems, organizationSearch);
  $: visibleAuthors = showAllAuthors ? filteredAuthorItems : filteredAuthorItems.slice(0, 8);
  $: visibleOrganizations = showAllOrganizations ? filteredOrganizationItems : filteredOrganizationItems.slice(0, 8);
  $: hiddenAuthorCount = Math.max(0, filteredAuthorItems.length - visibleAuthors.length);
  $: hiddenOrganizationCount = Math.max(0, filteredOrganizationItems.length - visibleOrganizations.length);
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
    <div class="sps-overline-row">
      <div class="sps-overline">Module</div>
      {#if $filters.module}
        <button type="button" class="sps-clear-link" on:click={clearModule}>Effacer</button>
      {/if}
    </div>
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
      <button
        type="button"
        class="sps-check-row"
        class:sps-check-row--on={$filters.hasSolution === '1'}
        aria-pressed={$filters.hasSolution === '1'}
        on:click={() => toggleFlag('hasSolution')}
      >
        Solution
      </button>
      <button
        type="button"
        class="sps-check-row"
        class:sps-check-row--on={$filters.hasIndication === '1'}
        aria-pressed={$filters.hasIndication === '1'}
        on:click={() => toggleFlag('hasIndication')}
      >
        Indication
      </button>
      <button
        type="button"
        class="sps-check-row"
        class:sps-check-row--on={$filters.hasVideo === '1'}
        aria-pressed={$filters.hasVideo === '1'}
        on:click={() => toggleFlag('hasVideo')}
      >
        Vidéo
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
        <button type="button" class="sps-clear-link" on:click={() => clearFacetFilter('author')}>Effacer</button>
      {/if}
    </div>
    <div class="sps-facet-search">
      <input
        type="text"
        placeholder="Chercher un auteur"
        bind:value={authorSearch}
        on:keydown={(e) => handleFacetSearchKey(e, 'author', filteredAuthorItems)}
      />
      {#if authorSearch}
        <button type="button" on:click={() => (authorSearch = '')} aria-label="Vider la recherche auteur">×</button>
      {/if}
    </div>
    {#if visibleAuthors.length > 0}
      <div class="sps-facet-list">
        {#each visibleAuthors as item}
          <button
            type="button"
            class="sps-facet-btn"
            class:sps-facet-btn--on={$filters.author === item.value}
            on:click={() => setFacetFilter('author', item.value)}
          >
            <span class="sps-facet-name">{item.value}</span>
            {#if item.count > 0}<span class="sps-facet-count">{item.count}</span>{/if}
          </button>
        {/each}
      </div>
      {#if filteredAuthorItems.length > 8}
        <button type="button" class="sps-show-more" on:click={() => (showAllAuthors = !showAllAuthors)}>
          {showAllAuthors ? 'Voir moins' : `Voir plus (${hiddenAuthorCount})`}
        </button>
      {/if}
    {:else}
      <p class="sps-empty">Aucun auteur disponible avec ces filtres.</p>
    {/if}
  </div>

  <hr class="sps-hr" />

  <!-- Organisation -->
  <div class="sps-section">
    <div class="sps-overline-row">
      <div class="sps-overline">Organisation</div>
      {#if $filters.organization}
        <button type="button" class="sps-clear-link" on:click={() => clearFacetFilter('organization')}>Effacer</button>
      {/if}
    </div>
    {#if organizationItems.length > 8 || organizationSearch}
      <div class="sps-facet-search">
        <input
          type="text"
          placeholder="Chercher une organisation"
          bind:value={organizationSearch}
          on:keydown={(e) => handleFacetSearchKey(e, 'organization', filteredOrganizationItems)}
        />
        {#if organizationSearch}
          <button type="button" on:click={() => (organizationSearch = '')} aria-label="Vider la recherche organisation">×</button>
        {/if}
      </div>
    {/if}
    {#if visibleOrganizations.length > 0}
      <div class="sps-facet-list">
        {#each visibleOrganizations as item}
          <button
            type="button"
            class="sps-facet-btn"
            class:sps-facet-btn--on={$filters.organization === item.value}
            on:click={() => setFacetFilter('organization', item.value)}
          >
            <span class="sps-facet-name">{item.value}</span>
            {#if item.count > 0}<span class="sps-facet-count">{item.count}</span>{/if}
          </button>
        {/each}
      </div>
      {#if filteredOrganizationItems.length > 8}
        <button type="button" class="sps-show-more" on:click={() => (showAllOrganizations = !showAllOrganizations)}>
          {showAllOrganizations ? 'Voir moins' : `Voir plus (${hiddenOrganizationCount})`}
        </button>
      {/if}
    {:else}
      <p class="sps-empty">Aucune organisation disponible avec ces filtres.</p>
    {/if}
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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    overflow: hidden;
    border: 1.5px solid theme('colors.interface.border-secondary');
    border-radius: 6px;
  }
  .sps-check-row {
    min-width: 0;
    padding: 7px 4px;
    border: none;
    border-right: 1px solid theme('colors.interface.border-secondary');
    border-radius: 0;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    color: theme('colors.interface.text-secondary');
    cursor: pointer;
    text-align: center;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
    white-space: nowrap;
  }
  .sps-check-row:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .sps-check-row:last-child {
    border-right: none;
  }
  .sps-check-row--on {
    background: theme('colors.interface.text-primary');
    color: white;
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

  /* ── Auteur / Organisation ── */
  .sps-clear-link {
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 11px;
    font-weight: 700;
    color: theme('colors.brand.700');
    cursor: pointer;
  }
  .sps-clear-link:hover {
    color: theme('colors.brand.900');
    text-decoration: underline;
  }
  .sps-facet-search {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    padding: 0 6px;
    border: 1.5px solid theme('colors.interface.border-secondary');
    border-radius: 6px;
    background: theme('colors.interface.bg-white');
  }
  .sps-facet-search:focus-within {
    border-color: theme('colors.brand.500');
  }
  .sps-facet-search input {
    min-width: 0;
    flex: 1;
    padding: 6px 0;
    border: 0;
    outline: 0;
    font-size: 13px;
    background: transparent;
    color: theme('colors.interface.text-primary');
  }
  .sps-facet-search input::placeholder {
    color: theme('colors.interface.text-muted');
  }
  .sps-facet-search button {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: none;
    color: theme('colors.interface.text-muted');
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .sps-facet-search button:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .sps-facet-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .sps-facet-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-height: 30px;
    padding: 6px 10px;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    background: transparent;
    color: theme('colors.interface.text-secondary');
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }
  .sps-facet-btn:hover {
    background: theme('colors.interface.bg-tertiary');
    color: theme('colors.interface.text-primary');
  }
  .sps-facet-btn--on {
    background: theme('colors.brand.50');
    border-left-color: theme('colors.brand.500');
    color: theme('colors.brand.800');
    font-weight: 600;
  }
  .sps-facet-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sps-facet-count {
    flex: 0 0 auto;
    font-size: 11px;
    color: theme('colors.interface.text-muted');
  }
  .sps-facet-btn--on .sps-facet-count {
    color: theme('colors.brand.700');
  }
</style>
