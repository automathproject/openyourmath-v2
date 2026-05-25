<script>
  import { goto } from '$app/navigation';
  import ChapterNavigation from '$lib/components/ChapterNavigation.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import SearchSnippet from '$lib/components/search/SearchSnippet.svelte';

  export let data;

  const sortOptions = [
    { value: 'title', label: 'Titre' },
    { value: 'level', label: 'Niveau' },
    { value: 'module', label: 'Module' },
    { value: 'difficulty', label: 'Difficulté' },
    { value: 'author', label: 'Auteur' },
    { value: 'updated', label: 'Mise à jour' }
  ];

  $: selection = data.selection || {};
  $: activeFilters = {
    level: selection.level || '',
    module: selection.module || '',
    chapter: selection.chapter || '',
    subchapter: selection.subchapter || ''
  };
  $: pathParts = [selection.level, selection.module, selection.chapter, selection.subchapter].filter(Boolean);
  $: pageTitle = pathParts.length
    ? `${pathParts.join(' • ')} - Parcourir les exercices - OpenYourMath`
    : 'Parcourir les exercices - OpenYourMath';
  $: totalExercises = (data.structure || []).reduce((sum, level) => sum + (level.exerciseCount || 0), 0);
  $: moduleCount = (data.structure || []).reduce((sum, level) => sum + (level.modules?.length || 0), 0);
  $: chapterCount = (data.structure || []).reduce(
    (sum, level) => sum + (level.modules || []).reduce((moduleSum, module) => moduleSum + (module.chapters?.length || 0), 0),
    0
  );

  function buildUrl(nextSelection = selection, sortBy = data.sortBy, sortOrder = data.sortOrder) {
    const params = new URLSearchParams();

    if (nextSelection.level) params.set('level', nextSelection.level);
    if (nextSelection.module) params.set('module', nextSelection.module);
    if (nextSelection.chapter) params.set('chapter', nextSelection.chapter);
    if (nextSelection.subchapter) params.set('subchapter', nextSelection.subchapter);
    if (sortBy && sortBy !== 'title') params.set('sort', sortBy);
    if (sortOrder && sortOrder !== 'asc') params.set('order', sortOrder);

    const query = params.toString();
    return query ? `/browse?${query}` : '/browse';
  }

  function navigateTo(nextSelection) {
    goto(buildUrl(nextSelection), { noScroll: true });
  }

  function handleNavigation(event) {
    navigateTo(event.detail);
  }

  function clearSelection() {
    goto('/browse', { noScroll: true });
  }

  function updateSort(sortBy) {
    const nextOrder = sortBy === data.sortBy && data.sortOrder === 'asc' ? 'desc' : 'asc';
    goto(buildUrl(selection, sortBy, nextOrder), { noScroll: true });
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR');
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<main class="browse-page">
  <header class="browse-header">
    <div>
      <p class="t-overline">Catalogue</p>
      <h1>Parcourir les exercices</h1>
      <p class="browse-subtitle">Explorez la bibliothèque par niveau, module, chapitre et sous-chapitre.</p>
    </div>

    {#if data.selected}
      <button type="button" class="btn btn-secondary" on:click={clearSelection}>
        Vue générale
      </button>
    {/if}
  </header>

  {#if data.error}
    <section class="empty-state">
      <h2 class="empty-state-title text-red-700">Erreur de chargement</h2>
      <p class="empty-state-subtitle">{data.error}</p>
      <a class="btn btn-primary mt-4" href="/browse">Réessayer</a>
    </section>
  {:else if !data.selected}
    <section class="overview-stats" aria-label="Statistiques du catalogue">
      <div>
        <strong>{totalExercises}</strong>
        <span>exercices</span>
      </div>
      <div>
        <strong>{data.structure.length}</strong>
        <span>niveaux</span>
      </div>
      <div>
        <strong>{moduleCount}</strong>
        <span>modules</span>
      </div>
      <div>
        <strong>{chapterCount}</strong>
        <span>chapitres</span>
      </div>
    </section>

    <section class="overview-grid" aria-label="Niveaux disponibles">
      {#each data.structure as level (level.name)}
        <article class="level-card">
          <div class="level-card-head">
            <div>
              <h2>{level.name}</h2>
              <p>{level.exerciseCount} exercice{level.exerciseCount > 1 ? 's' : ''}</p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" on:click={() => navigateTo({ level: level.name })}>
              Explorer
            </button>
          </div>

          {#if level.modules?.length}
            <div class="module-list">
              {#each level.modules.slice(0, 6) as module (module.name)}
                <button
                  type="button"
                  class="module-pill"
                  on:click={() => navigateTo({ level: level.name, module: module.name })}
                >
                  <span>{module.name}</span>
                  <small>{module.exerciseCount}</small>
                </button>
              {/each}
            </div>
            {#if level.modules.length > 6}
              <p class="more-count">+{level.modules.length - 6} module{level.modules.length - 6 > 1 ? 's' : ''}</p>
            {/if}
          {/if}
        </article>
      {/each}
    </section>
  {:else}
    <div class="browse-layout">
      <aside class="browse-sidebar">
        <ChapterNavigation
          selectedLevel={selection.level}
          selectedModule={selection.module}
          selectedChapter={selection.chapter}
          selectedSubchapter={selection.subchapter}
          {activeFilters}
          on:navigate={handleNavigation}
        />
      </aside>

      <section class="browse-results">
        <div class="results-head">
          <div>
            <p class="t-overline">Sélection</p>
            <h2>{pathParts.join(' / ')}</h2>
            <div class="active-path">
              {#if selection.level}<Chip variant="teal-solid">{selection.level}</Chip>{/if}
              {#if selection.module}<Chip variant="teal">{selection.module}</Chip>{/if}
              {#if selection.chapter}<Chip variant="soft">{selection.chapter}</Chip>{/if}
              {#if selection.subchapter}<Chip variant="soft">{selection.subchapter}</Chip>{/if}
            </div>
          </div>

          <div class="result-count">
            <strong>{data.totalCount}</strong>
            <span>exercice{data.totalCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="summary-row">
          {#if Object.keys(data.stats.byDifficulty || {}).length}
            <div class="summary-group">
              <span>Difficulté</span>
              <div>
                {#each Object.entries(data.stats.byDifficulty) as [difficulty, count]}
                  <Chip variant="soft">{difficulty} · {count}</Chip>
                {/each}
              </div>
            </div>
          {/if}

          {#if data.stats.authors?.length}
            <div class="summary-group">
              <span>Auteurs</span>
              <div>
                {#each data.stats.authors.slice(0, 3) as author}
                  <Chip variant="soft">{author.name} · {author.count}</Chip>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <div class="sort-row">
          <div class="sort-buttons" aria-label="Tri des résultats">
            {#each sortOptions as option}
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                class:is-current={data.sortBy === option.value}
                on:click={() => updateSort(option.value)}
              >
                {option.label}
                {#if data.sortBy === option.value}
                  <span aria-hidden="true">{data.sortOrder === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </button>
            {/each}
          </div>
          <p>
            {data.exercises.length} affiché{data.exercises.length > 1 ? 's' : ''}
            {#if data.hasMore}sur les {data.totalCount}{/if}
          </p>
        </div>

        {#if data.exercises.length === 0}
          <section class="empty-state">
            <h3 class="empty-state-title">Aucun exercice trouvé</h3>
            <p class="empty-state-subtitle">Cette entrée de la hiérarchie ne contient pas encore d’exercice indexé.</p>
          </section>
        {:else}
          <div class="exercise-list">
            {#each data.exercises as exercise (exercise.uuid)}
              <article class="exercise-card">
                <div class="exercise-main">
                  <div class="exercise-meta">
                    {#if exercise.level}<Chip variant="teal-solid">{exercise.level}</Chip>{/if}
                    {#if exercise.module}<Chip variant="teal">{exercise.module}</Chip>{/if}
                    {#if exercise.difficulty}<StarsRating n={exercise.difficulty} />{/if}
                    {#if exercise.hasSolution}<Chip variant="success">solution</Chip>{/if}
                  </div>

                  <h3>
                    <a href="/exercise/{exercise.uuid}">
                      <MathRenderer content={exercise.title} inline={true} />
                    </a>
                  </h3>

                  {#if exercise.preview}
                    <div class="exercise-preview">
                      <SearchSnippet content={exercise.preview} lines={2} />
                    </div>
                  {/if}

                  <div class="exercise-foot">
                    {#if exercise.chapter}<span>{exercise.chapter}</span>{/if}
                    {#if exercise.subchapter}<span>{exercise.subchapter}</span>{/if}
                    {#if exercise.author}<span>{exercise.author}</span>{/if}
                    {#if exercise.updated_at}<span>Maj {formatDate(exercise.updated_at)}</span>{/if}
                  </div>
                </div>

                <a class="btn btn-primary btn-sm" href="/exercise/{exercise.uuid}">Voir</a>
              </article>
            {/each}
          </div>

          {#if data.hasMore}
            <p class="result-limit">
              Les {data.maxResults} premiers résultats sont affichés. Affinez la sélection pour réduire la liste.
            </p>
          {/if}
        {/if}
      </section>
    </div>
  {/if}
</main>

<style>
  .browse-page {
    width: min(1180px, calc(100vw - 2rem));
    margin: 0 auto;
    padding: 2rem 0 3rem;
  }

  .browse-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .browse-header h1 {
    margin-top: 0.25rem;
    font-family: theme('fontFamily.heading');
    font-size: clamp(2rem, 4vw, 3.25rem);
    line-height: 1;
    letter-spacing: 0;
  }

  .browse-subtitle {
    margin-top: 0.6rem;
    color: theme('colors.interface.text-secondary');
  }

  .overview-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .overview-stats > div {
    padding: 1rem;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    background: theme('colors.interface.bg-white');
  }

  .overview-stats strong {
    display: block;
    font-size: 1.6rem;
    line-height: 1;
  }

  .overview-stats span {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: theme('colors.interface.text-secondary');
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .level-card,
  .exercise-card {
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    background: theme('colors.interface.bg-white');
  }

  .level-card {
    padding: 1rem;
  }

  .level-card-head,
  .exercise-card,
  .results-head,
  .sort-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .level-card h2,
  .results-head h2,
  .exercise-card h3 {
    font-family: theme('fontFamily.heading');
    letter-spacing: 0;
  }

  .level-card h2 {
    font-size: 1.35rem;
  }

  .level-card p,
  .sort-row p,
  .result-limit {
    color: theme('colors.interface.text-muted');
    font-size: 0.875rem;
  }

  .module-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .module-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    max-width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 999px;
    background: theme('colors.interface.bg-secondary');
    font-size: 0.82rem;
  }

  .module-pill:hover {
    border-color: theme('colors.brand.400');
    color: theme('colors.brand.700');
  }

  .module-pill span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .module-pill small {
    color: theme('colors.interface.text-muted');
  }

  .more-count {
    margin-top: 0.75rem;
  }

  .browse-layout {
    display: grid;
    grid-template-columns: minmax(260px, 330px) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  .browse-sidebar {
    position: sticky;
    top: 1rem;
  }

  .browse-results {
    min-width: 0;
  }

  .results-head {
    padding: 1rem;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 8px;
    background: theme('colors.interface.bg-white');
  }

  .results-head h2 {
    margin-top: 0.2rem;
    font-size: 1.5rem;
  }

  .active-path,
  .summary-group > div,
  .sort-buttons,
  .exercise-meta,
  .exercise-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
  }

  .active-path {
    margin-top: 0.8rem;
  }

  .result-count {
    text-align: right;
    min-width: 5.5rem;
  }

  .result-count strong {
    display: block;
    font-size: 1.6rem;
    line-height: 1;
  }

  .result-count span {
    color: theme('colors.interface.text-secondary');
    font-size: 0.85rem;
  }

  .summary-row {
    display: grid;
    gap: 0.75rem;
    margin: 1rem 0;
  }

  .summary-group {
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 0.75rem;
    align-items: start;
    font-size: 0.875rem;
  }

  .summary-group > span {
    color: theme('colors.interface.text-muted');
  }

  .sort-row {
    align-items: center;
    margin-bottom: 0.9rem;
  }

  .sort-buttons .is-current {
    color: theme('colors.brand.700');
    background: theme('colors.brand.50');
    border-color: theme('colors.brand.200');
  }

  .exercise-list {
    display: grid;
    gap: 0.7rem;
  }

  .exercise-card {
    padding: 1rem;
  }

  .exercise-main {
    min-width: 0;
  }

  .exercise-card h3 {
    margin-top: 0.55rem;
    font-size: 1rem;
  }

  .exercise-card h3 a:hover {
    color: theme('colors.brand.700');
  }

  .exercise-preview {
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .exercise-foot {
    margin-top: 0.7rem;
    color: theme('colors.interface.text-muted');
    font-size: 0.78rem;
  }

  .exercise-foot span:not(:last-child)::after {
    content: '·';
    margin-left: 0.45rem;
  }

  .result-limit {
    margin-top: 1rem;
  }

  @media (max-width: 900px) {
    .browse-layout,
    .overview-grid {
      grid-template-columns: 1fr;
    }

    .browse-sidebar {
      position: static;
    }

    .overview-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .browse-page {
      width: min(100% - 1rem, 1180px);
      padding-top: 1rem;
    }

    .browse-header,
    .results-head,
    .sort-row,
    .exercise-card {
      display: grid;
    }

    .overview-stats {
      grid-template-columns: 1fr 1fr;
    }

    .summary-group {
      grid-template-columns: 1fr;
    }

    .result-count {
      text-align: left;
    }
  }
</style>
