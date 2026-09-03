<!-- src/routes/fiches/+page.svelte -->
<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  export let data;

  $: filters = data.filters;

  function setFilter(key, value) {
    const url = new URL($page.url);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    goto(url, { keepFocus: true });
  }

  let searchDraft = '';
  $: searchDraft = filters.query;

  function submitSearch(event) {
    event.preventDefault();
    setFilter('q', searchDraft.trim());
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
  }

  $: hasFilters = Boolean(filters.organization || filters.author || filters.query);
</script>

<svelte:head>
  <title>Fiches d'exercices ({data.total}) - OpenYourMath</title>
  <meta name="description" content="Fiches d'exercices thématiques : listes prêtes à consulter, présenter et exporter." />
</svelte:head>

<div class="fiches-page">
  <header class="fiches-header">
    <h1>Fiches d'exercices</h1>
    <p class="fiches-subtitle">
      Des listes thématiques prêtes à l'emploi. Chaque fiche s'ouvre dans l'outil de liste :
      consultation, présentation et export LaTeX y fonctionnent à l'identique.
    </p>
  </header>

  <div class="fiches-toolbar">
    <form class="fiches-search" on:submit={submitSearch}>
      <input
        type="search"
        bind:value={searchDraft}
        placeholder="Rechercher une fiche…"
        aria-label="Rechercher une fiche par titre"
      />
      <button type="submit" class="btn btn-primary btn-sm">Rechercher</button>
    </form>

    {#if data.facets.authors.length > 1}
      <label class="fiches-filter">
        <span>Auteur</span>
        <select value={filters.author} on:change={(event) => setFilter('auteur', event.currentTarget.value)}>
          <option value="">Tous ({data.total})</option>
          {#each data.facets.authors as author (author.value)}
            <option value={author.value}>{author.value} ({author.count})</option>
          {/each}
        </select>
      </label>
    {/if}

    {#if hasFilters}
      <button type="button" class="btn btn-ghost btn-sm" on:click={() => goto('/fiches')}>
        Réinitialiser
      </button>
    {/if}

    <span class="fiches-count">{data.fiches.length} fiche{data.fiches.length !== 1 ? 's' : ''}</span>
  </div>

  {#if data.fiches.length === 0}
    <div class="empty-state">
      <p class="empty-state-title">Aucune fiche ne correspond</p>
      <p class="empty-state-subtitle">Élargissez la recherche ou réinitialisez les filtres.</p>
    </div>
  {:else}
    <ul class="fiches-grid">
      {#each data.fiches as fiche (fiche.uuid)}
        <li class="fiche-card">
          <a class="fiche-card-link" href="/fiches/{fiche.slug}">
            <h2 class="fiche-card-title"><MathRenderer content={fiche.title} inline={true} /></h2>
            <p class="fiche-card-meta">
              <span class="fiche-card-count">{fiche.exercise_count} exercice{fiche.exercise_count !== 1 ? 's' : ''}</span>
              {#if fiche.max_depth > 0}<span class="fiche-card-dot">·</span><span>structurée</span>{/if}
              {#if fiche.author}<span class="fiche-card-dot">·</span><span>{fiche.author}</span>{/if}
              {#if formatDate(fiche.created_at)}<span class="fiche-card-dot">·</span><span>{formatDate(fiche.created_at)}</span>{/if}
            </p>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .fiches-page {
    max-width: 72rem;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }

  .fiches-header h1 {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 700;
  }

  .fiches-subtitle {
    margin: 0;
    max-width: 46rem;
    color: var(--color-text-muted, #64748b);
    line-height: 1.6;
  }

  .fiches-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin: 1.75rem 0 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .fiches-search {
    display: flex;
    gap: 0.5rem;
    flex: 1 1 18rem;
  }

  .fiches-search input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    font: inherit;
  }

  .fiches-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
  }

  .fiches-filter select {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    font: inherit;
    max-width: 14rem;
  }

  .fiches-count {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
  }

  .fiches-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: 0.75rem;
  }

  .fiche-card {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.75rem;
    background: var(--color-surface, #fff);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .fiche-card:hover {
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
  }

  .fiche-card-link {
    display: block;
    padding: 1rem;
    color: inherit;
    text-decoration: none;
  }

  .fiche-card-title {
    margin: 0 0 0.4rem;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .fiche-card-meta {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #64748b);
  }

  .fiche-card-count {
    font-weight: 600;
    color: var(--color-text, #0f172a);
  }

  .fiche-card-dot {
    opacity: 0.5;
  }

  .empty-state {
    padding: 3rem 1rem;
    text-align: center;
  }
</style>
