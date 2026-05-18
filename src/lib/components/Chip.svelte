<!--
  Chip — base réutilisable pour étiquettes/filtres.
  Variantes : teal (défaut implicite quand pas de variant), teal-solid, accent, soft,
              active, success, warning, error, info.

  Usage :
    <Chip>L1</Chip>
    <Chip variant="teal-solid">L2</Chip>
    <Chip variant="accent" removable onremove={() => …}>Filtre</Chip>

  Référence DS : #chips dans OpenYourMath Design System.html
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {'teal'|'teal-solid'|'accent'|'soft'|'active'|'success'|'warning'|'error'|'info'} [variant]
   * @property {boolean} [removable]
   * @property {() => void} [onremove]
   * @property {import('svelte').Snippet} [children]
   */
  /** @type {Props} */
  let { variant, removable = false, onremove, children } = $props();

  let cls = $derived([
    'chip',
    variant ? `chip-${variant}` : '',
    removable ? 'chip-removable' : '',
  ].filter(Boolean).join(' '));
</script>

<span class={cls}>
  {@render children?.()}
  {#if removable}
    <button
      type="button"
      class="filter-chip-close ml-1"
      aria-label="Retirer"
      onclick={(e) => { e.stopPropagation(); onremove?.(); }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  {/if}
</span>

<style>
  /* Petit override local pour le padding right en mode removable.
     Évite de toucher à app.css pour ce cas spécifique. */
  .chip-removable {
    padding-right: 6px;
  }
  .chip-removable :global(.filter-chip-close) {
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }
  .chip-removable :global(.filter-chip-close:hover) {
    opacity: 1;
  }
</style>
