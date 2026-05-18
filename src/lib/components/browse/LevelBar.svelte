<script>
  // levels: { L1: 22, L2: 28, L3: 12, CPGE: 4 }
  // total: overall chapter count (sum of all levels)
  export let levels = {};
  export let total = 0;

  const ORDER = ['L1', 'L2', 'L3', 'CPGE', 'M1', 'M2'];
  const COLORS = {
    L1:   'var(--oym-teal)',
    L2:   'var(--oym-teal-700)',
    L3:   'var(--oym-ink-2)',
    CPGE: 'var(--oym-accent)',
    M1:   'var(--oym-gold)',
    M2:   'var(--oym-ok)',
  };

  $: present = ORDER.filter((l) => levels[l] > 0);
  $: safeTotal = total || Object.values(levels).reduce((s, n) => s + n, 0) || 1;
</script>

<div class="level-bar">
  <div class="bar-track">
    {#each present as l}
      <span
        class="bar-seg"
        title="{l} · {levels[l]} exercices"
        style="width: {(levels[l] / safeTotal) * 100}%; background: {COLORS[l] || 'var(--oym-ink-4)'};"
      />
    {/each}
  </div>
  <div class="bar-legend">
    {#each present as l}
      <span class="legend-item">
        <span class="dot" style="color: {COLORS[l] || 'var(--oym-ink-4)'}">●</span>
        {l}
        <span class="count">{levels[l]}</span>
      </span>
    {/each}
  </div>
</div>

<style>
  .level-bar { display: flex; flex-direction: column; gap: 4px; }

  .bar-track {
    display: flex;
    height: 4px;
    border-radius: 2px;
    overflow: hidden;
    background: var(--oym-bg-tint);
  }

  .bar-seg { flex-shrink: 0; }

  .bar-legend {
    display: flex;
    gap: 8px;
    font-family: var(--oym-font-mono);
    font-size: 10px;
    color: var(--oym-ink-3);
    flex-wrap: wrap;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .dot { font-size: 8px; line-height: 1; }

  .count { color: var(--oym-ink-2); margin-left: 1px; }
</style>
