<!--
  SearchPalette — la recherche ouverte par-dessus la page courante.

  « Rechercher » dans l'en-tête et Ctrl K l'ouvrent sans quitter la page : un
  champ, les recherches récentes de ce navigateur et quelques suggestions.
  Entrée mène aux résultats (/?q=…) ; Échap ou un clic à côté referme la
  fenêtre et rend la page telle qu'elle était.

  Usage dans +layout.svelte :
    <SearchPalette bind:open={…} />
-->
<script>
  import { goto } from '$app/navigation';
  import { searchQuery } from '$lib/stores/searchStore.js';
  import { getRecentSearches, addRecentSearch } from '$lib/utils/recentSearches.js';

  /** @type {{ open?: boolean }} */
  let { open = $bindable(false) } = $props();

  const SUGGESTIONS = [
    'intégrale par parties',
    'suites récurrentes',
    'espaces vectoriels',
    'séries entières'
  ];

  let dialog = $state();
  let input = $state();
  let query = $state('');
  let recent = $state([]);
  let active = $state(-1);

  // Les recherches récentes d'abord, puis les suggestions qu'elles ne
  // contiennent pas déjà. Une seule suite pour les flèches.
  let items = $derived([
    ...recent.map((label) => ({ kind: 'recent', label })),
    ...SUGGESTIONS.filter((label) => !recent.includes(label)).map((label) => ({ kind: 'suggestion', label }))
  ]);
  let recentItems = $derived(items.filter((item) => item.kind === 'recent'));
  let suggestionItems = $derived(items.filter((item) => item.kind === 'suggestion'));

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      query = '';
      active = -1;
      recent = getRecentSearches();
      dialog.showModal();
      input?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  async function search(value) {
    const q = value.trim();
    if (!q) return;
    addRecentSearch(q);
    open = false;
    // Le store d'abord : la page de résultats, si elle était déjà passée par
    // une autre requête, garderait sinon l'ancienne.
    searchQuery.set(q);
    await goto(`/?q=${encodeURIComponent(q)}`);
  }

  function onkeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!items.length) return;
      // -1 est le champ lui-même : les flèches y reviennent en bout de course.
      const next = active + (event.key === 'ArrowDown' ? 1 : -1);
      active = next >= items.length ? -1 : next < -1 ? items.length - 1 : next;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      search(active >= 0 ? items[active].label : query);
    }
  }

  // Un clic sur le fond (le <dialog> lui-même, hors de son contenu) referme.
  function onclick(event) {
    if (event.target === dialog) open = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="search-palette"
  aria-label="Rechercher des exercices"
  onclose={() => (open = false)}
  {onclick}
>
  <div class="palette-box">
    <div class="palette-field">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        bind:this={input}
        bind:value={query}
        oninput={() => (active = -1)}
        {onkeydown}
        type="search"
        placeholder="Un exercice, une notion, un théorème…"
        aria-label="Rechercher des exercices"
        aria-controls="palette-options"
        aria-activedescendant={active >= 0 ? `palette-option-${active}` : undefined}
        autocomplete="off"
        enterkeyhint="search"
      />
      <button type="button" class="palette-esc" onclick={() => (open = false)}>Échap</button>
    </div>

    <div id="palette-options" class="palette-options" role="listbox" aria-label="Recherches proposées">
      {#if recentItems.length}
        <p class="palette-group" aria-hidden="true">Recherches récentes</p>
        {#each recentItems as item, i (item.label)}
          <button
            type="button"
            id="palette-option-{i}"
            role="option"
            aria-selected={active === i}
            class="palette-recent"
            class:is-active={active === i}
            onclick={() => search(item.label)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            <span>{item.label}</span>
            {#if active === i}<kbd aria-hidden="true">Entrée</kbd>{/if}
          </button>
        {/each}
      {/if}

      {#if suggestionItems.length}
        <p class="palette-group" aria-hidden="true">Suggestions</p>
        <div class="palette-chips">
          {#each suggestionItems as item, j (item.label)}
            {@const i = recentItems.length + j}
            <button
              type="button"
              id="palette-option-{i}"
              role="option"
              aria-selected={active === i}
              class="palette-chip"
              class:is-active={active === i}
              onclick={() => search(item.label)}
            >{item.label}</button>
          {/each}
        </div>
      {/if}
    </div>

    <footer class="palette-footer">
      <span class="palette-keys">↑↓ choisir · Entrée rechercher</span>
      <a href="/browse?vue=prepa" onclick={() => (open = false)}>Parcourir les programmes →</a>
    </footer>
  </div>
</dialog>

<style>
  .search-palette {
    width: min(34rem, calc(100vw - 2rem));
    max-width: none;
    margin: 12vh auto auto;
    padding: 0;
    border: 0;
    background: transparent;
    overflow: visible;
  }

  .search-palette::backdrop {
    background: rgb(13 60 77 / 0.35);
  }

  .palette-box {
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 12px;
    background: var(--color-interface-bg-white);
    color: var(--color-interface-text-primary);
    box-shadow: 0 16px 40px rgb(0 0 0 / 0.14);
    overflow: hidden;
  }

  .palette-field {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0 0.9rem;
    border-bottom: 1px solid var(--color-interface-border-primary);
    color: var(--color-interface-text-muted);
  }

  .palette-field input {
    flex: 1;
    min-width: 0;
    padding: 0.9rem 0;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 1rem;
    color: var(--color-interface-text-primary);
  }

  /* Le champ est toute la tête de la fenêtre : l'anneau de focus global
     dessinait un second cadre à l'intérieur. */
  .palette-field input:focus {
    box-shadow: none;
  }

  .palette-field input::-webkit-search-cancel-button {
    display: none;
  }

  .palette-esc {
    padding: 1px 6px;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 4px;
    background: transparent;
    font: inherit;
    font-size: 0.6875rem;
    color: var(--color-interface-text-secondary);
    cursor: pointer;
  }

  .palette-options {
    padding: 0.6rem 0.6rem 0.4rem;
  }

  .palette-group {
    margin: 0.4rem 0.4rem 0.3rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-interface-text-muted);
  }

  .palette-group:first-child {
    margin-top: 0;
  }

  .palette-recent {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.45rem 0.5rem;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font: inherit;
    font-size: 0.875rem;
    text-align: left;
    color: var(--color-interface-text-primary);
    cursor: pointer;
  }

  .palette-recent svg {
    flex-shrink: 0;
    color: var(--color-interface-text-muted);
  }

  .palette-recent kbd {
    margin-left: auto;
    font-family: inherit;
    font-size: 0.6875rem;
    color: var(--color-interface-text-muted);
  }

  .palette-recent:hover,
  .palette-recent.is-active {
    background: var(--color-brand-50);
  }

  .palette-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0 0.4rem 0.4rem;
  }

  .palette-chip {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 999px;
    background: transparent;
    font: inherit;
    font-size: 0.8125rem;
    color: var(--color-interface-text-primary);
    cursor: pointer;
  }

  .palette-chip:hover,
  .palette-chip.is-active {
    border-color: var(--color-brand-500);
    background: var(--color-brand-50);
    color: var(--color-brand-700);
  }

  .palette-footer {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0.9rem;
    border-top: 1px solid var(--color-interface-border-primary);
    font-size: 0.75rem;
    color: var(--color-interface-text-muted);
  }

  .palette-footer a {
    margin-left: auto;
    color: var(--color-brand-700);
    font-weight: 500;
    text-decoration: none;
  }

  .palette-footer a:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .search-palette {
      margin-top: 0.75rem;
    }

    .palette-keys {
      display: none;
    }
  }
</style>
