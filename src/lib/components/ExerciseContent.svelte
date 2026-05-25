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
  export let studentMode = 'normal'; // 'normal' | 'student' | 'student-hints'
  export let showHeader = true;
  $: isPreview = variant === 'preview';
  
  // État local pour contrôler l'affichage individuel des solutions et indications
  let solutionStates = {};
  let hintStates = {};
  // Masquage individuel explicite (permet de cacher même si le global est actif)
  let hiddenHintStates = {};
  let hiddenSolutionStates = {};

  // Variables pour tracker les états globaux précédents
  let previousShowSolution = showSolution;
  let previousShowHint = showHint;

  // Réactivité pour détecter les changements d'états globaux
  $: if (showSolution !== previousShowSolution) {
    hiddenSolutionStates = {};
    Object.keys(solutionStates).forEach(key => {
      solutionStates[key] = showSolution;
    });
    solutionStates = { ...solutionStates };
    previousShowSolution = showSolution;
  }

  $: if (showHint !== previousShowHint) {
    hiddenHintStates = {};
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
          hiddenSolutionStates[index] = false;
        }
        if (group.hints.length > 0 && !(index in hintStates)) {
          hintStates[index] = showHint || false;
          hiddenHintStates[index] = false;
        }
      }
    });
  }
  
  // Fonctions pour basculer l'affichage individuel
  function toggleSolution(index) {
    const visible = (solutionStates[index] || showSolution) && !hiddenSolutionStates[index];
    if (visible) {
      if (showSolution) {
        hiddenSolutionStates[index] = true;
        hiddenSolutionStates = { ...hiddenSolutionStates };
      } else {
        solutionStates[index] = false;
        solutionStates = { ...solutionStates };
      }
    } else {
      hiddenSolutionStates[index] = false;
      solutionStates[index] = true;
      hiddenSolutionStates = { ...hiddenSolutionStates };
      solutionStates = { ...solutionStates };
    }
  }

  function toggleHint(index) {
    const visible = (hintStates[index] || showHint) && !hiddenHintStates[index];
    if (visible) {
      if (showHint) {
        hiddenHintStates[index] = true;
        hiddenHintStates = { ...hiddenHintStates };
      } else {
        hintStates[index] = false;
        hintStates = { ...hintStates };
      }
    } else {
      hiddenHintStates[index] = false;
      hintStates[index] = true;
      hiddenHintStates = { ...hiddenHintStates };
      hintStates = { ...hintStates };
    }
  }
</script>

<div class="exercise-content" class:exercise-content--preview={isPreview}>
  {#if showHeader && exercise && variant !== 'preview'}
    <ExerciseHeader
      {exercise}
      {variant}
      {position}
      bind:showHint
      bind:showSolution
      showGlobalToggles={showGlobalToggles}
      {studentMode}
    />
  {/if}
  
  <!-- Affichage séquentiel des blocs organisés -->
  {#each organizedContent.blocks as contentBlock, blockIndex}
    {#if contentBlock.type === 'standalone-text'}
      {#each [contentBlock.block] as block}
        {@const processed = processContentBlock(block)}
        <!-- Bloc de texte standalone -->
        <div class="content-block" id={!isPreview ? `section-${blockIndex + 1}` : undefined}>
          <MathRenderer content={processed.html} />
        </div>
      {/each}
      
    {:else if contentBlock.type === 'standalone-hint' && studentMode !== 'student'}
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
      
    {:else if contentBlock.type === 'standalone-solution' && studentMode === 'normal'}
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
      <div
        class="question-response-pair"
        class:question-response-pair--preview={isPreview}
        id={!isPreview ? `q${contentBlock.questionIndex + 1}` : undefined}
      >
        {#each [contentBlock.question] as question}
          {@const processedQ = processContentBlock(question)}
          <!-- Question avec icônes d'actions -->
          <div class="question-block" class:question-block--preview={isPreview}>
            <div class="question-header" class:question-header--preview={isPreview}>
              <div class="question-main" class:question-main--preview={isPreview}>
                <div class="question-number" class:question-number--preview={isPreview}>
                  <span class="question-number-badge" class:question-number-badge--preview={isPreview}>
                    {contentBlock.questionIndex + 1}
                  </span>
                </div>
                <div class="question-content" class:question-content--preview={isPreview}>
                  <MathRenderer content={processedQ.html} />
                </div>
              </div>
              <div class="question-actions" class:question-actions--preview={isPreview}>
                {#if contentBlock.hints.length > 0 && studentMode !== 'student'}
                  <button
                    class="question-action-btn question-action-btn--hint"
                    class:question-action-btn--active={(hintStates[contentBlock.questionIndex] || showHint) && !hiddenHintStates[contentBlock.questionIndex]}
                    class:question-action-btn--preview={isPreview}
                    on:click={() => toggleHint(contentBlock.questionIndex)}
                    title={(hintStates[contentBlock.questionIndex] || showHint) && !hiddenHintStates[contentBlock.questionIndex] ? 'Masquer l\'indication' : 'Voir l\'indication'}
                  >
                    {#if isPreview}
                      Ind.
                    {:else}
                      💡
                    {/if}
                  </button>
                {/if}
                {#if contentBlock.solutions.length > 0 && studentMode === 'normal'}
                  <button
                    class="question-action-btn question-action-btn--solution"
                    class:question-action-btn--active={(solutionStates[contentBlock.questionIndex] || showSolution) && !hiddenSolutionStates[contentBlock.questionIndex]}
                    class:question-action-btn--preview={isPreview}
                    on:click={() => toggleSolution(contentBlock.questionIndex)}
                    title={(solutionStates[contentBlock.questionIndex] || showSolution) && !hiddenSolutionStates[contentBlock.questionIndex] ? 'Masquer la solution' : 'Voir la solution'}
                  >
                    {#if isPreview}
                      {(solutionStates[contentBlock.questionIndex] || showSolution) && !hiddenSolutionStates[contentBlock.questionIndex] ? '✔' : 'Sol.'}
                    {:else}
                      ✅
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
        
        <!-- Indications (affichées immédiatement après la question si activées) -->
        {#if contentBlock.hints.length > 0 && studentMode !== 'student' && (hintStates[contentBlock.questionIndex] || showHint) && !hiddenHintStates[contentBlock.questionIndex]}
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
        {#if contentBlock.solutions.length > 0 && studentMode === 'normal' && (solutionStates[contentBlock.questionIndex] || showSolution) && !hiddenSolutionStates[contentBlock.questionIndex]}
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
  
  .exercise-content {
    @apply bg-brand-50 rounded-xl p-2 md:p-4;
  }

  .exercise-content > :global(*:not(.question-response-pair) + .question-response-pair) {
    @apply mt-6;
  }
  
  .exercise-content > :global(.question-response-pair + *:not(.question-response-pair)) {
    @apply mt-6;
  }
  
  /* Questions consécutives : espacement en mode full, aucun en preview */
  .exercise-content:not(.exercise-content--preview) > :global(.question-response-pair + .question-response-pair) {
    margin-top: 1.25rem;
  }

  .exercise-content--preview > :global(.question-response-pair + .question-response-pair) {
    @apply mt-0;
  }
  
  .content-block {
    @apply text-gray-800 leading-relaxed;
  }
  
  .question-response-pair {
    @apply border-l-4 border-brand-200 pl-4 m-0 p-0;
    /* Force margin et padding à 0, puis réapplique seulement pl-4 pour la bordure */
    padding-left: 1rem !important; /* Garde le padding gauche pour la bordure */
  }

  .question-response-pair--preview {
    border-left: 0;
    padding-left: 0 !important;
  }
  
  .question-block {
    @apply bg-brand-50 rounded-lg;
    padding: 0.5rem 0.5rem 0.75rem;
    margin-bottom: 0 !important;
  }

  .question-block--preview {
    background: transparent;
    border-radius: 0;
    padding: 0.15rem 0;
  }
  
  .question-header {
    @apply flex items-start gap-3;
  }

  .question-header--preview {
    gap: 0.4rem;
    align-items: flex-start;
  }

  .question-main {
    @apply flex items-start gap-3 flex-1;
  }

  .question-main--preview {
    position: relative;
    padding-left: 1.85rem;
    min-height: 1.45rem;
    gap: 0;
  }
  
  .question-number {
    @apply flex-shrink-0;
  }

  .question-number--preview {
    position: absolute;
    left: 0;
    top: 0;
    transform: translateX(-0.45rem);
    width: 1.6rem;
    display: flex;
    justify-content: flex-end;
  }
  
  .question-number-badge {
    @apply inline-flex items-center justify-center w-8 h-8 bg-brand-600 text-white text-sm font-semibold rounded-full;
  }

  .question-number-badge--preview {
    width: auto;
    height: auto;
    border-radius: 0;
    background: transparent;
    color: #2f7f86;
    font-family: Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
    font-weight: 800;
    font-size: 1.08rem;
    line-height: 1.3;
    letter-spacing: 0.01em;
  }
  
  .question-content {
    @apply flex-1 text-gray-800;
  }

  .question-content--preview {
    @apply text-gray-900;
    min-width: 0;
  }
  
  .question-actions {
    @apply flex gap-2 flex-shrink-0;
  }

  .question-actions--preview {
    gap: 0.3rem;
    padding-top: 0.06rem;
  }
  
  .question-action-btn {
    @apply w-8 h-8 rounded-full bg-white border-2 border-gray-300 hover:border-gray-400 
           flex items-center justify-center text-lg transition-colors duration-200
           hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1;
  }

  .question-action-btn--preview {
    width: auto;
    height: auto;
    min-height: 1.35rem;
    border-width: 1px;
    border-radius: 9999px;
    padding: 0.05rem 0.45rem;
    font-family: Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 0.68rem;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0.01em;
    @apply text-gray-600 bg-gray-50 border-gray-200;
  }

  .question-action-btn--preview.question-action-btn--hint {
    @apply bg-yellow-50 text-amber-700 border-yellow-200;
  }

  .question-action-btn--preview.question-action-btn--solution {
    @apply bg-green-50 text-green-700 border-green-200;
  }

  .question-action-btn--preview.question-action-btn--solution.question-action-btn--active {
    @apply bg-green-100 text-green-700 border-green-300;
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
