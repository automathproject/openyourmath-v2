<!-- src/lib/components/ExerciseRowCard.svelte
     Carte d'exercice des listes de /browse (vue par niveau et vue Prépa). -->
<script>
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import StarsRating from '$lib/components/StarsRating.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import SearchSnippet from '$lib/components/search/SearchSnippet.svelte';

  export let exercise;

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR');
  }
</script>

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

<style>
  .exercise-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 8px;
    background: var(--color-interface-bg-white);
  }

  .exercise-main {
    min-width: 0;
  }

  .exercise-meta,
  .exercise-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
  }

  .exercise-card h3 {
    margin-top: 0.55rem;
    font-family: var(--font-heading);
    letter-spacing: 0;
    font-size: 1rem;
  }

  .exercise-card h3 a:hover {
    color: var(--color-brand-700);
  }

  .exercise-preview {
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .exercise-foot {
    margin-top: 0.7rem;
    color: var(--color-interface-text-muted);
    font-size: 0.78rem;
  }

  .exercise-foot span:not(:last-child)::after {
    content: '·';
    margin-left: 0.45rem;
  }

  @media (max-width: 640px) {
    .exercise-card {
      display: grid;
    }
  }
</style>
