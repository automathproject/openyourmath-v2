<script>
  import { filters, filterCounts, searchActions } from '$lib/stores/searchStore.js';

  const LEVELS = ['L1', 'L2', 'L3', 'CPGE'];

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

  $: sortedModules = Object.entries($filterCounts?.module ?? {})
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
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
        {#each sortedModules as [name, count]}
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
</aside>

<style>
  .sps {
    padding: 20px 16px 32px;
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
  .sps-hr {
    border: none;
    border-top: 1px solid theme('colors.interface.border-primary');
    margin: 16px 0;
  }

  /* ── Niveau ── */
  .sps-level-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .sps-level-btn {
    padding: 7px 0;
    border: 1.5px solid theme('colors.interface.border-secondary');
    border-radius: 6px;
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
  .sps-level-btn--on {
    background: theme('colors.interface.text-primary');
    border-color: theme('colors.interface.text-primary');
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

  /* ── Contenu ── */
  .sps-check-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sps-check-row {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13px;
    color: theme('colors.interface.text-secondary');
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    transition: color 0.1s;
  }
  .sps-check-row:hover { color: theme('colors.interface.text-primary'); }
  .sps-checkbox {
    width: 16px;
    height: 16px;
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
</style>
