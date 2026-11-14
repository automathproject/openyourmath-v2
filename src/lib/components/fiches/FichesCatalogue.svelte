<!--
  FichesCatalogue — les fiches comme point de départ d'une liste.

  Deux présentations du même catalogue :
    - `cards`   : état vide de Ma liste ; quelques fiches tirées au hasard, puis
                  les correspondances dès qu'on filtre ;
    - `compact` : panneau « Fiches » d'une liste remplie ; toutes les
                  correspondances, en lignes serrées.

  Chaque fiche est un vrai lien vers /exercise/list?fiche=… (clic du milieu,
  nouvel onglet) ; `onchoose(fiche, event)` permet au parent de l'intercepter,
  par exemple pour demander s'il faut remplacer la liste ou y ajouter la fiche.
-->
<script module>
  /** @type {Promise<{total: number, fiches: any[]}> | null} */
  let cataloguePromise = null;

  function loadCatalogue() {
    cataloguePromise ??= fetch('/api/fiches')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .catch((err) => {
        cataloguePromise = null;
        throw err;
      });
    return cataloguePromise;
  }

  /** Minuscules sans accents : « reduction » trouve « Réduction ». */
  function fold(value) {
    return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
</script>

<script>
  import { onMount } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  /**
   * @typedef {Object} Props
   * @property {'cards'|'compact'} [variant]
   * @property {number} [featured] - fiches montrées sans filtre (variante cards)
   * @property {boolean} [autofocus]
   * @property {(fiche: any, event: MouseEvent) => void} [onchoose]
   */
  /** @type {Props} */
  let { variant = 'cards', featured = 6, autofocus = false, onchoose } = $props();

  let fiches = $state([]);
  let total = $state(0);
  let status = $state('loading');
  let query = $state('');
  let input = $state();

  onMount(() => {
    loadCatalogue()
      .then((data) => {
        total = data.total;
        // Ordre aléatoire tiré une fois : l'état vide montre d'autres fiches à
        // chaque visite, mais ne bouge pas pendant qu'on le regarde.
        fiches = variant === 'cards'
          ? [...data.fiches].map((fiche) => [Math.random(), fiche]).sort((a, b) => a[0] - b[0]).map(([, fiche]) => fiche)
          : data.fiches;
        status = 'ready';
      })
      .catch(() => (status = 'error'));
    if (autofocus) input?.focus();
  });

  let matches = $derived.by(() => {
    const needle = fold(query.trim());
    if (!needle) return fiches;
    return fiches.filter((fiche) => fold(`${fiche.title} ${fiche.author ?? ''}`).includes(needle));
  });

  let shown = $derived(
    variant === 'cards' ? matches.slice(0, query.trim() ? 12 : featured) : matches
  );

  function plural(count, word) {
    return `${count} ${word}${count > 1 ? 's' : ''}`;
  }
</script>

<div class="catalogue catalogue--{variant}">
  <label class="catalogue-filter">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
    <span class="sr-only">Filtrer les fiches</span>
    <input
      bind:this={input}
      bind:value={query}
      type="search"
      placeholder={variant === 'cards' ? 'Filtrer les fiches : suites, réduction, Rouget…' : 'Filtrer les fiches'}
      autocomplete="off"
    />
  </label>

  {#if status === 'loading'}
    <p class="catalogue-note">Chargement des fiches…</p>
  {:else if status === 'error'}
    <p class="catalogue-note">Les fiches n'ont pas pu être chargées. <a href="/fiches">Ouvrir le catalogue</a></p>
  {:else if shown.length === 0}
    <p class="catalogue-note">Aucune fiche ne correspond à « {query.trim()} ».</p>
  {:else}
    <ul class="catalogue-items">
      {#each shown as fiche (fiche.uuid)}
        <li>
          <a
            class="catalogue-item"
            href="/exercise/list?fiche={encodeURIComponent(fiche.slug)}"
            onclick={(event) => onchoose?.(fiche, event)}
          >
            <span class="catalogue-item-title"><MathRenderer content={fiche.title} inline={true} /></span>
            <span class="catalogue-item-meta">
              {#if variant === 'cards'}
                {plural(fiche.exercise_count, 'exercice')}{fiche.author ? ` · ${fiche.author}` : ''}
              {:else}
                {fiche.exercise_count} ex.
              {/if}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  {#if status === 'ready'}
    <p class="catalogue-footer">
      {#if query.trim() && variant === 'cards' && matches.length > shown.length}
        <span>{plural(matches.length, 'fiche')} correspondent.</span>
      {/if}
      <a href="/fiches{query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}">
        {variant === 'cards' ? `Voir les ${total} fiches` : 'Toutes les fiches'} →
      </a>
    </p>
  {/if}
</div>

<style>
  .catalogue {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
  }

  .catalogue-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.75rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 0.5rem;
    background: var(--color-interface-bg-white);
    color: var(--color-interface-text-muted);
  }

  .catalogue-filter:focus-within {
    border-color: var(--color-brand-500);
    box-shadow: 0 0 0 3px var(--color-brand-50);
  }

  .catalogue-filter input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 0.875rem;
    color: var(--color-interface-text-primary);
  }

  .catalogue-items {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .catalogue--cards .catalogue-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.6rem;
  }

  .catalogue--compact .catalogue-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    min-height: 0;
  }

  .catalogue-item {
    display: flex;
    color: var(--color-interface-text-primary);
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
  }

  .catalogue--cards .catalogue-item {
    flex-direction: column;
    gap: 0.25rem;
    height: 100%;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 0.6rem;
    background: var(--color-interface-bg-white);
    text-align: left;
  }

  .catalogue--cards .catalogue-item:hover {
    border-color: var(--color-brand-500);
  }

  .catalogue--compact .catalogue-item {
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.45rem 0.6rem;
    border-radius: 0.4rem;
    font-size: 0.875rem;
  }

  .catalogue--compact .catalogue-item:hover {
    background: var(--color-brand-50);
    color: var(--color-brand-700);
  }

  .catalogue-item:focus-visible {
    outline: 2px solid var(--color-brand-500);
    outline-offset: 2px;
  }

  .catalogue-item-title {
    font-weight: 600;
    line-height: 1.35;
  }

  .catalogue--compact .catalogue-item-title {
    font-weight: 500;
  }

  .catalogue-item-meta {
    font-size: 0.8125rem;
    color: var(--color-interface-text-muted);
    white-space: nowrap;
  }

  .catalogue-note {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-interface-text-secondary);
  }

  .catalogue-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-interface-text-secondary);
  }

  .catalogue-footer a,
  .catalogue-note a {
    margin-left: auto;
    color: var(--color-brand-700);
    font-weight: 500;
    text-decoration: none;
  }

  .catalogue-footer a:hover,
  .catalogue-note a:hover {
    text-decoration: underline;
  }
</style>
