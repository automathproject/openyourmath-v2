<!-- src/lib/components/ExerciseContent.svelte -->
<script>
  import MathRenderer from './MathRenderer.svelte';
  
  export let content = [];
  export let showSolution = false;
  export let showHint = false;
  
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
  
  // Organiser le contenu par type et ordre
  $: organizedContent = (() => {
    // Séparer les différents types
    const questions = content.filter(block => 
      block.type === 'question'
    ).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const reponses = content.filter(block => 
      block.type === 'reponse' || block.type === 'solution' || block.type === 'answer'
    ).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const hints = content.filter(block => 
      block.type === 'hint' || block.type === 'indication'
    ).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const mainContent = content.filter(block => 
      !block.type || block.type === 'text' || block.type === 'math'
    ).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Créer des paires question/réponse/indication
    const questionResponsePairs = [];
    
    // Si on a autant de questions que de réponses, les associer
    if (questions.length === reponses.length) {
      for (let i = 0; i < questions.length; i++) {
        questionResponsePairs.push({
          question: questions[i],
          response: reponses[i],
          hint: hints[i] || null
        });
      }
    } else {
      // Sinon, traiter séparément
      questions.forEach((q, i) => questionResponsePairs.push({ 
        question: q, 
        response: reponses[i] || null,
        hint: hints[i] || null
      }));
    }
    
    return {
      mainContent,
      questionResponsePairs,
      hints: hints.filter((_, i) => i >= questions.length), // Indications supplémentaires
      hasQuestionResponseStructure: questions.length > 0
    };
  })();
  
  // Initialiser les états locaux basés sur le nombre de questions
  $: if (organizedContent.questionResponsePairs) {
    organizedContent.questionResponsePairs.forEach((pair, index) => {
      if (pair.response && !(index in solutionStates)) {
        solutionStates[index] = showSolution || false;
      }
      if (pair.hint && !(index in hintStates)) {
        hintStates[index] = showHint || false;
      }
    });
  }
  
  // Fonctions pour basculer l'affichage individuel
  function toggleSolution(index) {
    if (showSolution) {
      // Si le mode global est activé, désactiver le global ne change que l'état local
      solutionStates[index] = !solutionStates[index];
    } else {
      // Sinon, basculer normalement l'état local
      solutionStates[index] = !solutionStates[index];
    }
    solutionStates = { ...solutionStates };
  }
  
  function toggleHint(index) {
    if (showHint) {
      // Si le mode global est activé, désactiver le global ne change que l'état local
      hintStates[index] = !hintStates[index];
    } else {
      // Sinon, basculer normalement l'état local
      hintStates[index] = !hintStates[index];
    }
    hintStates = { ...hintStates };
  }
</script>

<div class="exercise-content">
  <!-- Contenu principal (texte introductif) -->
  {#if organizedContent.mainContent.length > 0}
    <div class="main-content">
      {#each organizedContent.mainContent as block}
        {@const processed = processContentBlock(block)}
        <div class="content-block">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
    </div>
  {/if}
  
  <!-- Structure question/réponse alternée -->
  {#if organizedContent.hasQuestionResponseStructure}
    <div class="questions-responses">
      {#each organizedContent.questionResponsePairs as pair, index}
        <div class="question-response-pair">
          <!-- Question avec icônes d'actions -->
          {#if pair.question}
            {@const processedQ = processContentBlock(pair.question)}
            <div class="question-block">
              <div class="question-header">
                <div class="question-number">
                  <span class="question-number-badge">
                    {index + 1}
                  </span>
                </div>
                <div class="question-content">
                  <MathRenderer content={processedQ.html} />
                </div>
                <div class="question-actions">
                  {#if pair.hint}
                    <button 
                      class="question-action-btn question-action-btn--hint"
                      class:question-action-btn--active={hintStates[index] || showHint}
                      on:click={() => toggleHint(index)}
                      title={(hintStates[index] || showHint) ? 'Masquer l\'indication' : 'Voir l\'indication'}
                    >
                      💡
                    </button>
                  {/if}
                  {#if pair.response}
                    <button 
                      class="question-action-btn question-action-btn--solution"
                      class:question-action-btn--active={solutionStates[index] || showSolution}
                      on:click={() => toggleSolution(index)}
                      title={(solutionStates[index] || showSolution) ? 'Masquer la solution' : 'Voir la solution'}
                    >
                      ✅
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Indication (affichée conditionnellement) -->
          {#if pair.hint && (hintStates[index] || showHint)}
            {@const processedH = processContentBlock(pair.hint)}
            <div class="inline-hint">
              <div class="inline-hint-content">
                <MathRenderer content={processedH.html} />
              </div>
            </div>
          {/if}
          
          <!-- Réponse (affichée conditionnellement) -->
          {#if pair.response && (solutionStates[index] || showSolution)}
            {@const processedR = processContentBlock(pair.response)}
            <div class="inline-solution">
              <div class="inline-solution-content">
                <MathRenderer content={processedR.html} />
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    
  {:else}
    <!-- Fallback : affichage traditionnel si pas de structure Q/R -->
    <div class="traditional-content">
      {#each content.filter(b => b.type === 'question' || !b.type || b.type === 'text') as block}
        {@const processed = processContentBlock(block)}
        <div class="content-block">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
    </div>
    
    <!-- Solutions groupées (seulement si pas de structure Q/R) -->
    {#if content.filter(b => b.type === 'reponse' || b.type === 'solution').length > 0}
      <details 
        class="mt-8 collapsible-section collapsible-section--solution" 
        bind:open={showSolution}
      >
        <summary class="collapsible-summary collapsible-summary--solution">
          ✅ Solution complète
        </summary>
        <div class="collapsible-content">
          {#each content.filter(b => b.type === 'reponse' || b.type === 'solution') as block}
            {@const processed = processContentBlock(block)}
            <div class="content-block">
              <MathRenderer content={processed.html} />
            </div>
          {/each}
        </div>
      </details>
    {/if}
    
    <!-- Indications groupées (seulement si pas de structure Q/R) -->
    {#if content.filter(b => b.type === 'hint' || b.type === 'indication').length > 0}
      <details 
        class="mt-8 collapsible-section collapsible-section--hint" 
        bind:open={showHint}
      >
        <summary class="collapsible-summary collapsible-summary--hint">
          💡 Indication{content.filter(b => b.type === 'hint' || b.type === 'indication').length > 1 ? 's' : ''}
        </summary>
        <div class="collapsible-content">
          {#each content.filter(b => b.type === 'hint' || b.type === 'indication') as block}
            {@const processed = processContentBlock(block)}
            <div class="content-block">
              <MathRenderer content={processed.html} />
            </div>
          {/each}
        </div>
      </details>
    {/if}
  {/if}
  
  <!-- Indications supplémentaires non associées à des questions spécifiques -->
  {#if organizedContent.hints.length > 0}
    <details 
      class="mt-8 collapsible-section collapsible-section--hint" 
      bind:open={showHint}
    >
      <summary class="collapsible-summary collapsible-summary--hint">
        💡 Indication{organizedContent.hints.length > 1 ? 's' : ''} générale{organizedContent.hints.length > 1 ? 's' : ''}
      </summary>
      <div class="collapsible-content">
        {#each organizedContent.hints as block}
          {@const processed = processContentBlock(block)}
          <div class="content-block">
            <MathRenderer content={processed.html} />
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>