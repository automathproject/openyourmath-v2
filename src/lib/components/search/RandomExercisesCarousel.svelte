<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import ResultCard from '$lib/components/search/ResultCard.svelte';

  export let selectedUuid = null;
  export let isPreviewOpen = false;
  export let limit = 12;

  const dispatch = createEventDispatcher();

  let randomExercises = [];
  let randomLoading = false;
  let randomError = '';
  let carouselTrack;
  let autoScrollTimer;

  onMount(() => {
    loadRandomExercises();
  });

  onDestroy(() => {
    stopAutoScroll();
  });

  async function loadRandomExercises() {
    randomLoading = true;
    randomError = '';
    try {
      const response = await fetch(`/api/exercises/random?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Réponse serveur inattendue');
      }
      const data = await response.json();
      randomExercises = data.exercises || [];
      startAutoScroll();
    } catch (err) {
      console.error('Failed to load random exercises:', err);
      randomError = 'Impossible de charger des exercices pour le moment.';
    } finally {
      randomLoading = false;
    }
  }

  function stopAutoScroll() {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = null;
    }
  }

  function startAutoScroll() {
    stopAutoScroll();
    if (!carouselTrack || !randomExercises || randomExercises.length <= 1) return;

    autoScrollTimer = setInterval(() => {
      const track = carouselTrack;
      if (!track) return;

      const firstChild = track.firstElementChild;
      const cardWidth = firstChild?.getBoundingClientRect().width || 300;
      const gap = 16; // matches CSS gap
      const next = track.scrollLeft + cardWidth + gap;
      const maxScroll = track.scrollWidth - track.clientWidth;

      if (next >= maxScroll - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: cardWidth + gap, behavior: 'smooth' });
      }
    }, 4000);
  }

  function handleSelect(exercise) {
    dispatch('select', { exercise });
  }
</script>

<section class="random-carousel">
  <div class="random-carousel__header">
    <div>
      <h2 class="random-carousel__title">Envie de piocher au hasard ?</h2>
      <p class="random-carousel__subtitle">Faites défiler horizontalement ces propositions sélectionnées aléatoirement.</p>
    </div>
    <button class="btn btn-secondary" on:click={loadRandomExercises} disabled={randomLoading}>
      {randomLoading ? 'Chargement…' : 'Nouveau tirage'}
    </button>
  </div>

  {#if randomError}
    <div class="random-carousel__error">{randomError}</div>
  {/if}

  <div
    class="random-carousel__track"
    aria-live="polite"
    bind:this={carouselTrack}
    on:mouseenter={stopAutoScroll}
    on:mouseleave={startAutoScroll}
  >
    {#if randomLoading && randomExercises.length === 0}
      {#each Array(6) as _}
        <div class="random-card-skeleton" aria-hidden="true"></div>
      {/each}
    {:else if randomExercises.length === 0}
      <p class="random-carousel__empty">Aucun exercice aléatoire disponible pour le moment.</p>
    {:else}
      {#each randomExercises as exercise (exercise.uuid)}
        <div class="random-carousel__item">
          <ResultCard
            {exercise}
            isSelected={isPreviewOpen && selectedUuid === exercise.uuid}
            on:select={() => handleSelect(exercise)}
          />
        </div>
      {/each}
    {/if}
  </div>
</section>

<style>
  .random-carousel {
    margin-top: 0.5rem;
    padding: 1.5rem;
    border-radius: 1rem;
    @apply border border-gray-200 bg-white shadow-sm;
    max-width: 1080px;
    margin-left: auto;
    margin-right: auto;
  }
  .random-carousel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .random-carousel__title {
    font-size: 1.25rem;
    font-weight: 700;
    @apply text-gray-900;
  }
  .random-carousel__subtitle {
    margin-top: 0.25rem;
    font-size: 0.95rem;
    @apply text-gray-600;
  }
  .random-carousel__track {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    padding: 0.5rem 0.25rem 0.5rem 0;
    scroll-snap-type: x mandatory;
  }
  .random-carousel__item {
    flex: 0 0 280px;
    max-width: 320px;
    scroll-snap-align: start;
  }
  @media (min-width: 640px) {
    .random-carousel__item {
      flex-basis: 300px;
    }
  }
  .random-carousel__error {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    @apply bg-red-50 border border-red-200 text-red-700;
  }
  .random-carousel__empty {
    padding: 0.5rem 0.25rem;
    @apply text-gray-500;
  }
  .random-card-skeleton {
    flex: 0 0 280px;
    max-width: 320px;
    height: 220px;
    border-radius: 0.75rem;
    scroll-snap-align: start;
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
