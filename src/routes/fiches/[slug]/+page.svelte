<!-- src/routes/fiches/[slug]/+page.svelte -->
<!--
  Page canonique d'une fiche : URL courte et stable, structure visible d'un coup
  d'œil. Elle ne rejoue pas l'outil de liste — elle y mène. « Ouvrir dans la
  liste » passe la main à /exercise/list?fiche=…, où consultation, présentation
  et export LaTeX fonctionnent déjà.
-->
<script>
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';

  export let data;

  $: fiche = data.fiche;
  $: listHref = `/exercise/list?fiche=${encodeURIComponent(fiche.slug)}`;
  $: structured = data.groups.some((group) => group.path.length > 0);

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
  }

  /** Une fiche plate n'a qu'un groupe sans titre : inutile de l'annoncer. */
  function groupLabel(group) {
    return group.path.length ? group.path[group.path.length - 1] : '';
  }

  /** Les niveaux au-dessus du dernier, affichés en surtitre discret. */
  function groupAncestors(group) {
    return group.path.slice(0, -1);
  }
</script>

<svelte:head>
  <title>{fiche.title} - Fiche d'exercices - OpenYourMath</title>
  <meta name="description" content={`Fiche d'exercices « ${fiche.title} » : ${fiche.exercise_count} exercices.`} />
</svelte:head>

<div class="fiche-page">
  <nav class="fiche-breadcrumb" aria-label="Fil d'Ariane">
    <a href="/fiches">Fiches</a>
    <span aria-hidden="true">›</span>
    <span>{fiche.slug}</span>
  </nav>

  <header class="fiche-header">
    <div class="fiche-header-main">
      <h1><MathRenderer content={fiche.title} inline={true} /></h1>
      <p class="fiche-meta">
        <strong>{fiche.exercise_count} exercice{fiche.exercise_count !== 1 ? 's' : ''}</strong>
        {#if structured}<span class="dot">·</span><span>{data.groups.length} section{data.groups.length !== 1 ? 's' : ''}</span>{/if}
        {#if fiche.author}<span class="dot">·</span><span>{fiche.author}</span>{/if}
        {#if fiche.organization}<span class="dot">·</span><span>{fiche.organization}</span>{/if}
        {#if formatDate(fiche.created_at)}<span class="dot">·</span><span>{formatDate(fiche.created_at)}</span>{/if}
      </p>
    </div>

    <a class="btn btn-primary" href={listHref}>Ouvrir dans la liste</a>
  </header>

  {#if fiche.intro}
    <div class="fiche-intro"><MathRenderer content={fiche.intro} /></div>
  {/if}

  {#if data.meta.missing > 0}
    <p class="fiche-warning" role="status">
      {data.meta.missing} référence{data.meta.missing !== 1 ? 's' : ''} de la source
      {data.meta.missing !== 1 ? 'ne correspondent' : 'ne correspond'} à aucun exercice publié
      et {data.meta.missing !== 1 ? 'sont omises' : 'est omise'} ci-dessous.
    </p>
  {/if}

  {#each data.groups as group, groupIndex (group.key + groupIndex)}
    <section class="fiche-section">
      {#if groupLabel(group)}
        {#if groupAncestors(group).length}
          <p class="fiche-section-ancestors">
            {#each groupAncestors(group) as ancestor, index}
              {#if index > 0}<span aria-hidden="true"> › </span>{/if}<MathRenderer content={ancestor} inline={true} />
            {/each}
          </p>
        {/if}
        <h2 class="fiche-section-title">
          <MathRenderer content={groupLabel(group)} inline={true} />
          <span class="fiche-section-count">{group.items.length}</span>
        </h2>
      {/if}

      <ol class="fiche-exercises">
        <!-- Sans clé : une fiche peut reprendre un exercice, l'uuid n'est pas unique. -->
        {#each group.items as exercise}
          <li class="fiche-exercise">
            <a class="fiche-exercise-link" href="/exercise/{exercise.uuid}">
              <span class="fiche-exercise-title"><MathRenderer content={exercise.title} inline={true} /></span>
              <span class="fiche-exercise-meta">
                {#if exercise.chapter}<span>{exercise.chapter}</span>{/if}
                {#if exercise.level}<span class="dot">·</span><span>{exercise.level}</span>{/if}
                {#if exercise.difficulty}<StarsRating n={exercise.difficulty} />{/if}
              </span>
            </a>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</div>

<style>
  .fiche-page {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 4rem;
  }

  .fiche-breadcrumb {
    display: flex;
    gap: 0.4rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #64748b);
    margin-bottom: 1rem;
  }

  .fiche-breadcrumb a {
    color: inherit;
  }

  .fiche-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .fiche-header-main {
    flex: 1 1 24rem;
    min-width: 0;
  }

  .fiche-header h1 {
    margin: 0 0 0.5rem;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .fiche-meta {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.875rem;
    color: var(--color-text-muted, #64748b);
  }

  .dot {
    opacity: 0.5;
  }

  .fiche-intro {
    margin: 1.25rem 0 0;
    padding: 0.875rem 1rem;
    border-left: 3px solid var(--color-border, #e2e8f0);
    color: var(--color-text-muted, #475569);
    line-height: 1.65;
  }

  .fiche-warning {
    margin: 1.25rem 0 0;
    padding: 0.7rem 0.9rem;
    border-radius: 0.5rem;
    background: #fffbeb;
    color: #92400e;
    font-size: 0.875rem;
  }

  .fiche-section {
    margin-top: 2rem;
  }

  .fiche-section-ancestors {
    margin: 0 0 0.15rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted, #94a3b8);
  }

  .fiche-section-title {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0 0 0.6rem;
    font-size: 1.05rem;
    font-weight: 600;
  }

  .fiche-section-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted, #64748b);
  }

  .fiche-exercises {
    list-style: none;
    margin: 0;
    padding: 0;
    counter-reset: fiche-exercise;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .fiche-exercise + .fiche-exercise {
    border-top: 1px solid var(--color-border, #e2e8f0);
  }

  .fiche-exercise-link {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.7rem 0.9rem;
    color: inherit;
    text-decoration: none;
  }

  .fiche-exercise-link:hover {
    background: var(--color-surface-hover, #f8fafc);
  }

  .fiche-exercise-title {
    flex: 1 1 18rem;
    min-width: 0;
    font-weight: 500;
  }

  .fiche-exercise-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #64748b);
  }
</style>
