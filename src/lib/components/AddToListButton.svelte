<!-- src/lib/components/AddToListButton.svelte -->
<script>
  import { 
    listActions, 
    listCount,
    exerciseList
  } from '$lib/stores/listStore.js';
  
  export let exercise;
  export let size = 'normal'; // 'small', 'normal', 'large'
  export let variant = 'button'; // 'button', 'icon'
  
  let isAdding = false;
  let justAdded = false;
  
  // Vérifier si l'exercice est déjà dans la liste (réactif au store)
  // Important: on référence `$exerciseList` pour déclencher la réactivité immédiate
  $: isInList = exercise ? $exerciseList.some(ex => ex.uuid === exercise.uuid) : false;
  
  // Fonction pour ajouter/supprimer de la liste
  async function toggleInList() {
    if (!exercise || isAdding) return;
    
    isAdding = true;
    
    try {
      if (isInList) {
        // Supprimer de la liste
        const exerciseIndex = $exerciseList.findIndex(ex => ex.uuid === exercise.uuid);
        if (exerciseIndex !== -1) {
          listActions.removeExercise(exerciseIndex);
        }
      } else {
        // Ajouter à la liste
        await listActions.addExercise({
          uuid: exercise.uuid,
          title: exercise.title,
          chapter: exercise.chapter,
          theme: exercise.theme,
          author: exercise.author,
          difficulty: exercise.difficulty,
          level: exercise.level,
          module: exercise.module
        });
        
        // Animation de feedback
        justAdded = true;
        setTimeout(() => {
          justAdded = false;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to toggle exercise in list:', err);
    } finally {
      isAdding = false;
    }
  }
  
  // Classes CSS dynamiques
  $: buttonClasses = [
    'add-to-list-btn',
    `add-to-list-btn--${size}`,
    `add-to-list-btn--${variant}`,
    isInList ? 'add-to-list-btn--in-list' : '',
    isAdding ? 'add-to-list-btn--loading' : '',
    justAdded ? 'add-to-list-btn--just-added' : ''
  ].filter(Boolean).join(' ');
  
  // Texte du bouton
  $: buttonText = (() => {
    if (isAdding) return variant === 'icon' ? '' : 'Ajout...';
    if (justAdded) return variant === 'icon' ? '' : 'Ajouté !';
    if (isInList) return variant === 'icon' ? '' : 'Retirer de ma liste';
    return variant === 'icon' ? '' : 'Ajouter à ma liste';
  })();
  
  // Titre du bouton (tooltip)
  $: buttonTitle = (() => {
    if (isInList) return 'Retirer de ma liste';
    if ($listCount > 0) return `Ajouter à ma liste (${$listCount} exercice${$listCount > 1 ? 's' : ''})`;
    return 'Ajouter à ma liste';
  })();
</script>

<button
  on:click={toggleInList}
  disabled={isAdding || !exercise}
  class={buttonClasses}
  title={buttonTitle}
  aria-label={buttonTitle}
  aria-pressed={isInList}
>
  {#if variant === 'icon'}
    <svg class="add-to-list-svg" fill={isInList ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4.75A2.75 2.75 0 018.75 2h6.5A2.75 2.75 0 0118 4.75V21l-6-3.5L6 21V4.75z" />
    </svg>
  {:else}
    <svg class="add-to-list-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {#if isInList}
        <!-- Icône marque-page -->
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4.75A2.75 2.75 0 018.75 2h6.5A2.75 2.75 0 0118 4.75V21l-6-3.5L6 21V4.75z" />
      {:else}
        <!-- Icône marque-page -->
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4.75A2.75 2.75 0 018.75 2h6.5A2.75 2.75 0 0118 4.75V21l-6-3.5L6 21V4.75z" />
      {/if}
    </svg>
    <span class="add-to-list-text">{buttonText}</span>
  {/if}
</button>

<style>
  .add-to-list-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    position: relative;
    overflow: hidden;
    @apply border border-interface-border-primary rounded-md bg-interface-bg-primary text-interface-text-secondary;
  }
  
  .add-to-list-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    @apply bg-interface-bg-secondary border-interface-border-secondary;
  }
  
  .add-to-list-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  /* Tailles */
  .add-to-list-btn--small {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
  
  .add-to-list-btn--normal {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  
  .add-to-list-btn--large {
    padding: 0.75rem 1rem;
    font-size: 1rem;
  }
  
  /* Variante icône seulement */
  .add-to-list-btn--icon {
    padding: 0.5rem;
    width: 2rem;
    height: 2rem;
    justify-content: center;
    border-radius: 50%;
  }
  
  .add-to-list-btn--icon.add-to-list-btn--small {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0.25rem;
  }
  
  .add-to-list-btn--icon.add-to-list-btn--large {
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.75rem;
  }
  
  /* États */
  .add-to-list-btn--in-list {
    /* Rouge par défaut quand déjà dans la liste */
    @apply bg-error-200 border-error-500 text-error-800;
  }
  
  .add-to-list-btn--in-list:hover:not(:disabled) {
    /* Rouge un peu plus marqué au survol */
    @apply bg-error-300 border-error-600 text-error-900;
  }
  
  .add-to-list-btn--loading {
    @apply bg-interface-bg-tertiary text-interface-text-muted;
  }
  
  .add-to-list-btn--just-added {
    animation: pulse-success 0.5s ease-in-out;
    @apply bg-green-100 border-green-500 text-green-800;
  }
  
  /* Éléments internes */
  .add-to-list-svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  
  .add-to-list-btn--small .add-to-list-svg {
    width: 0.875rem;
    height: 0.875rem;
  }
  
  .add-to-list-btn--large .add-to-list-svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  
  .add-to-list-icon {
    font-size: 1rem;
    line-height: 1;
  }
  
  .add-to-list-text {
    white-space: nowrap;
  }
  
  /* Animation */
  @keyframes pulse-success {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }
  
  /* Responsive */
  @media (max-width: 640px) {
    .add-to-list-btn--normal {
      padding: 0.375rem 0.625rem;
      font-size: 0.8rem;
    }
    
    .add-to-list-text {
      display: none;
    }
    
    .add-to-list-btn {
      width: 2rem;
      height: 2rem;
      padding: 0.5rem;
      border-radius: 50%;
      justify-content: center;
    }
  }
</style>
