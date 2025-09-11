<!-- src/lib/components/ExerciseContent.svelte -->
<script>
  import MathRenderer from './MathRenderer.svelte';
  import ExerciseHeader from './ExerciseHeader.svelte';
  
  export let content = [];
  export let showSolution = false;
  export let showHint = false;
  export let exercise = null; // objet exercice complet si disponible
  export let variant = 'full'; // 'full' | 'preview' | 'simple'
  export let position = null; // { current, total }
  export let showGlobalToggles = false;
  
  // État local pour contrôler l'affichage individuel des solutions et indications
  let solutionStates = {};
  let hintStates = {};
  
  // Variables pour tracker les états globaux précédents
  let previousShowSolution = showSolution;
  let previousShowHint = showHint;
  
  // Réactivité pour détecter les changements d'états globaux
  $: if (showSolution !== previousShowSolution) {
    // Synchroniser seulement lors d'un changement global
    Object.keys(solutionStates).forEach(key => {
      solutionStates[key] = showSolution;
    });
    solutionStates = { ...solutionStates };
    previousShowSolution = showSolution;
  }
  
  $: if (showHint !== previousShowHint) {
    // Synchroniser seulement lors d'un changement global
    Object.keys(hintStates).forEach(key => {
      hintStates[key] = showHint;
    });
    hintStates = { ...hintStates };
    previousShowHint = showHint;
  }
  
  // Fonction pour traiter un bloc de contenu
  function processContentBlock(block) {
    if (!block) return { html: '', type: 'text' };
    
    let html = '';
    let type = block.type || 'text';
    
    if (block.html) {
      html = block.html;
    } else if (block.latex) {
      html = block.latex;
      type = 'latex';
    } else if (block.text) {
      html = `<p>${block.text}</p>`;
    }
    
    return { html, type };
  }
  
  // Nouvelle logique d'organisation : tri global puis regroupement intelligent
  $: organizedContent = (() => {
    // 1. Trier TOUS les blocs par ordre global
    const allBlocksSorted = [...content].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // 2. Créer une structure organisée en respectant l'ordre global
    const organizedBlocks = [];
    let currentGroup = null;
    let questionCounter = 0;
    
    for (let i = 0; i < allBlocksSorted.length; i++) {
      const block = allBlocksSorted[i];
      const blockType = block.type || 'text';
      
      if (blockType === 'question') {
        // Nouvelle question : fermer le groupe précédent et en créer un nouveau
        if (currentGroup) {
          organizedBlocks.push(currentGroup);
        }
        
        currentGroup = {
          type: 'question-group',
          questionIndex: questionCounter++,
          question: block,
          hints: [],
          solutions: [],
          blocks: [block]
        };
      } else if (blockType === 'hint' || blockType === 'indication') {
        if (currentGroup && currentGroup.type === 'question-group') {
          // Ajouter l'indication au groupe de question actuel
          currentGroup.hints.push(block);
          currentGroup.blocks.push(block);
        } else {
          // Indication isolée : créer un bloc standalone
          if (currentGroup) {
            organizedBlocks.push(currentGroup);
          }
          organizedBlocks.push({
            type: 'standalone-hint',
            block: block
          });
          currentGroup = null;
        }
      } else if (blockType === 'reponse' || blockType === 'solution' || blockType === 'answer') {
        if (currentGroup && currentGroup.type === 'question-group') {
          // Ajouter la solution au groupe de question actuel
          currentGroup.solutions.push(block);
          currentGroup.blocks.push(block);
        } else {
          // Solution isolée : créer un bloc standalone
          if (currentGroup) {
            organizedBlocks.push(currentGroup);
          }
          organizedBlocks.push({
            type: 'standalone-solution',
            block: block
          });
          currentGroup = null;
        }
      } else {
        // Bloc de texte ou autre : fermer le groupe précédent et créer un bloc standalone
        if (currentGroup) {
          organizedBlocks.push(currentGroup);
          currentGroup = null;
        }
        
        organizedBlocks.push({
          type: 'standalone-text',
          block: block
        });
      }
    }
    
    // Fermer le dernier groupe s'il existe
    if (currentGroup) {
      organizedBlocks.push(currentGroup);
    }
    
    return {
      blocks: organizedBlocks,
      hasQuestionGroups: organizedBlocks.some(b => b.type === 'question-group')
    };
  })();
  
  // Initialiser les états locaux basés sur les groupes de questions
  $: if (organizedContent.blocks) {
    organizedContent.blocks.forEach((group) => {
      if (group.type === 'question-group') {
        const index = group.questionIndex;
        if (group.solutions.length > 0 && !(index in solutionStates)) {
          solutionStates[index] = showSolution || false;
        }
        if (group.hints.length > 0 && !(index in hintStates)) {
          hintStates[index] = showHint || false;
        }
      }
    });
  }
  
  // Fonctions pour basculer l'affichage individuel
  function toggleSolution(index) {
    solutionStates[index] = !solutionStates[index];
    solutionStates = { ...solutionStates };
  }
  
  function toggleHint(index) {
    hintStates[index] = !hintStates[index];
    hintStates = { ...hintStates };
  }
</script>

<div class="exercise-content">
  {#if exercise}
    <ExerciseHeader 
      {exercise} 
      {variant}
      {position}
      bind:showHint
      bind:showSolution
      showGlobalToggles={showGlobalToggles}
    />
  {/if}
  
  <!-- Affichage séquentiel des blocs organisés -->
  {#each organizedContent.blocks as contentBlock}
    {#if contentBlock.type === 'standalone-text'}
      {#each [contentBlock.block] as block}
        {@const processed = processContentBlock(block)}
        <!-- Bloc de texte standalone -->
        <div class="content-block">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
      
    {:else if contentBlock.type === 'standalone-hint'}
      {#each [contentBlock.block] as block}
        {@const processed = processContentBlock(block)}
        <!-- Indication standalone -->
        <details 
          class="mt-8 collapsible-section collapsible-section--hint" 
          bind:open={showHint}
        >
          <summary class="collapsible-summary collapsible-summary--hint">
            💡 Indication
          </summary>
          <div class="collapsible-content">
            <div class="content-block">
              <MathRenderer content={processed.html} />
            </div>
          </div>
        </details>
      {/each}
      
    {:else if contentBlock.type === 'standalone-solution'}
      {#each [contentBlock.block] as block}
        {@const processed = processContentBlock(block)}
        <!-- Solution standalone -->
        <details 
          class="mt-8 collapsible-section collapsible-section--solution" 
          bind:open={showSolution}
        >
          <summary class="collapsible-summary collapsible-summary--solution">
            ✅ Solution
          </summary>
          <div class="collapsible-content">
            <div class="content-block">
              <MathRenderer content={processed.html} />
            </div>
          </div>
        </details>
      {/each}
      
    {:else if contentBlock.type === 'question-group'}
      <!-- Groupe question/indication/réponse -->
      <div class="question-response-pair">
        {#each [contentBlock.question] as question}
          {@const processedQ = processContentBlock(question)}
          <!-- Question avec icônes d'actions -->
          <div class="question-block">
            <div class="question-header">
              <div class="question-number">
                <span class="question-number-badge">
                  {contentBlock.questionIndex + 1}
                </span>
              </div>
              <div class="question-content">
                <MathRenderer content={processedQ.html} />
              </div>
              <div class="question-actions">
                {#if contentBlock.hints.length > 0}
                  <button 
                    class="question-action-btn question-action-btn--hint"
                    class:question-action-btn--active={hintStates[contentBlock.questionIndex] || showHint}
                    on:click={() => toggleHint(contentBlock.questionIndex)}
                    title={(hintStates[contentBlock.questionIndex] || showHint) ? 'Masquer l\'indication' : 'Voir l\'indication'}
                  >
                    💡
                  </button>
                {/if}
                {#if contentBlock.solutions.length > 0}
                  <button 
                    class="question-action-btn question-action-btn--solution"
                    class:question-action-btn--active={solutionStates[contentBlock.questionIndex] || showSolution}
                    on:click={() => toggleSolution(contentBlock.questionIndex)}
                    title={(solutionStates[contentBlock.questionIndex] || showSolution) ? 'Masquer la solution' : 'Voir la solution'}
                  >
                    ✅
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
        
        <!-- Indications (affichées immédiatement après la question si activées) -->
        {#if contentBlock.hints.length > 0 && (hintStates[contentBlock.questionIndex] || showHint)}
          <div class="inline-hint">
            {#each contentBlock.hints as hint}
              {@const processedH = processContentBlock(hint)}
              <div class="inline-hint-content">
                <MathRenderer content={processedH.html} />
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Solutions (affichées après les indications si activées) -->
        {#if contentBlock.solutions.length > 0 && (solutionStates[contentBlock.questionIndex] || showSolution)}
          <div class="inline-solution">
            {#each contentBlock.solutions as solution}
              {@const processedS = processContentBlock(solution)}
              <div class="inline-solution-content">
                <MathRenderer content={processedS.html} />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>

  
  /* Appliquer l'espacement manuellement seulement où nécessaire */
  .exercise-content > :global(*:not(.question-response-pair) + *:not(.question-response-pair)) {
    @apply mt-6;
  }
  
  .exercise-content > :global(*:not(.question-response-pair) + .question-response-pair) {
    @apply mt-6;
  }
  
  .exercise-content > :global(.question-response-pair + *:not(.question-response-pair)) {
    @apply mt-6;
  }
  
  /* Les questions consécutives n'ont aucun espace */
  .exercise-content > :global(.question-response-pair + .question-response-pair) {
    @apply mt-0;
  }
  
  .content-block {
    @apply text-gray-800 leading-relaxed;
  }
  
  .question-response-pair {
    @apply border-l-4 border-blue-200 pl-4 m-0 p-0;
    /* Force margin et padding à 0, puis réapplique seulement pl-4 pour la bordure */
    padding-left: 1rem !important; /* Garde le padding gauche pour la bordure */
  }
  
  .question-block {
    @apply bg-blue-50 rounded-lg p-2;
    /* Réduction du padding de p-4 à p-2 */
    margin-bottom: 0 !important; /* Annuler le margin-bottom global */
  }
  
  .question-header {
    @apply flex items-start gap-3;
  }
  
  .question-number {
    @apply flex-shrink-0;
  }
  
  .question-number-badge {
    @apply inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white text-sm font-semibold rounded-full;
  }
  
  .question-content {
    @apply flex-1 text-gray-800;
  }
  
  .question-actions {
    @apply flex gap-2 flex-shrink-0;
  }
  
  .question-action-btn {
    @apply w-8 h-8 rounded-full bg-white border-2 border-gray-300 hover:border-gray-400 
           flex items-center justify-center text-lg transition-colors duration-200
           hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1;
  }
  
  .question-action-btn--hint.question-action-btn--active {
    @apply border-yellow-400 bg-yellow-50;
  }
  
  .question-action-btn--solution.question-action-btn--active {
    @apply border-green-400 bg-green-50;
  }
  
  .inline-hint {
    @apply bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg;
  }
  
  .inline-hint-content {
    @apply text-gray-700 space-y-2;
  }
  
  .inline-solution {
    @apply bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg;
  }
  
  .inline-solution-content {
    @apply text-gray-700 space-y-2;
  }
  
  .collapsible-section {
    @apply border border-gray-200 rounded-lg overflow-hidden;
  }
  
  .collapsible-section--hint {
    @apply border-yellow-200;
  }
  
  .collapsible-section--solution {
    @apply border-green-200;
  }
  
  .collapsible-summary {
    @apply px-4 py-3 bg-gray-50 font-medium text-gray-700 cursor-pointer 
           hover:bg-gray-100 transition-colors duration-200
           flex items-center gap-2;
  }
  
  .collapsible-summary--hint {
    @apply bg-yellow-50 hover:bg-yellow-100;
  }
  
  .collapsible-summary--solution {
    @apply bg-green-50 hover:bg-green-100;
  }
  
  .collapsible-content {
    @apply p-4 bg-white;
  }
</style>