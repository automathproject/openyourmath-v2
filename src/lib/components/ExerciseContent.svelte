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
  
  // Organiser le contenu par type et ordre - VERSION CORRIGÉE
  $: organizedContent = (() => {
    // Trier tout le contenu par ordre d'abord
    const sortedContent = [...content].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Séparer les différents types APRÈS le tri
    const questions = sortedContent.filter(block => block.type === 'question');
    const reponses = sortedContent.filter(block => 
      block.type === 'reponse' || block.type === 'solution' || block.type === 'answer'
    );
    const hints = sortedContent.filter(block => 
      block.type === 'hint' || block.type === 'indication'
    );
    const mainContent = sortedContent.filter(block => 
      !block.type || block.type === 'text' || block.type === 'math'
    );
    
    // Créer des groupes question/indication/réponse basés sur l'ordre réel
    const questionGroups = [];
    const usedHints = new Set();
    const usedResponses = new Set();
    
    if (questions.length > 0) {
      questions.forEach((question, questionIndex) => {
        const questionOrder = question.order || 0;
        
        // Trouver la prochaine question pour délimiter la zone de recherche
        const nextQuestion = questions[questionIndex + 1];
        const nextQuestionOrder = nextQuestion ? (nextQuestion.order || 0) : Infinity;
        
        // Trouver l'indication la plus proche APRÈS cette question et AVANT la suivante
        let correspondingHint = null;
        const availableHints = hints.filter(h => !usedHints.has(h));
        for (const hint of availableHints) {
          const hintOrder = hint.order || 0;
          if (hintOrder > questionOrder && hintOrder < nextQuestionOrder) {
            correspondingHint = hint;
            usedHints.add(hint);
            break; // Prendre la première (plus proche)
          }
        }
        
        // Trouver la réponse la plus proche APRÈS cette question et AVANT la suivante
        let correspondingResponse = null;
        const availableResponses = reponses.filter(r => !usedResponses.has(r));
        for (const response of availableResponses) {
          const responseOrder = response.order || 0;
          if (responseOrder > questionOrder && responseOrder < nextQuestionOrder) {
            correspondingResponse = response;
            usedResponses.add(response);
            break; // Prendre la première (plus proche)
          }
        }
        
        questionGroups.push({
          question,
          hint: correspondingHint,
          response: correspondingResponse,
          index: questionIndex
        });
      });
    }
    
    return {
      mainContent,
      questionGroups,
      extraHints: hints.filter(h => !usedHints.has(h)),
      extraResponses: reponses.filter(r => !usedResponses.has(r)),
      hasQuestionStructure: questions.length > 0
    };
  })();
  
  // Initialiser les états locaux basés sur le nombre de questions
  $: if (organizedContent.questionGroups) {
    organizedContent.questionGroups.forEach((group) => {
      const index = group.index;
      if (group.response && !(index in solutionStates)) {
        solutionStates[index] = showSolution || false;
      }
      if (group.hint && !(index in hintStates)) {
        hintStates[index] = showHint || false;
      }
    });
  }
  
  // Fonctions pour basculer l'affichage individuel
  function toggleSolution(index) {
    if (showSolution) {
      solutionStates[index] = !solutionStates[index];
    } else {
      solutionStates[index] = !solutionStates[index];
    }
    solutionStates = { ...solutionStates };
  }
  
  function toggleHint(index) {
    if (showHint) {
      hintStates[index] = !hintStates[index];
    } else {
      hintStates[index] = !hintStates[index];
    }
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
  
  <!-- Structure question/indication/réponse dans l'ordre -->
  {#if organizedContent.hasQuestionStructure}
    <div class="questions-responses">
      {#each organizedContent.questionGroups as group}
        <div class="question-response-pair">
          <!-- Question avec icônes d'actions -->
          {#if group.question}
            {@const processedQ = processContentBlock(group.question)}
            <div class="question-block">
              <div class="question-header">
                <div class="question-number">
                  <span class="question-number-badge">
                    {group.index + 1}
                  </span>
                </div>
                <div class="question-content">
                  <MathRenderer content={processedQ.html} />
                </div>
                <div class="question-actions">
                  {#if group.hint}
                    <button 
                      class="question-action-btn question-action-btn--hint"
                      class:question-action-btn--active={hintStates[group.index] || showHint}
                      on:click={() => toggleHint(group.index)}
                      title={(hintStates[group.index] || showHint) ? 'Masquer l\'indication' : 'Voir l\'indication'}
                    >
                      💡
                    </button>
                  {/if}
                  {#if group.response}
                    <button 
                      class="question-action-btn question-action-btn--solution"
                      class:question-action-btn--active={solutionStates[group.index] || showSolution}
                      on:click={() => toggleSolution(group.index)}
                      title={(solutionStates[group.index] || showSolution) ? 'Masquer la solution' : 'Voir la solution'}
                    >
                      ✅
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Indication (affichée immédiatement après la question si activée) -->
          {#if group.hint && (hintStates[group.index] || showHint)}
            {@const processedH = processContentBlock(group.hint)}
            <div class="inline-hint">
              <div class="inline-hint-content">
                <MathRenderer content={processedH.html} />
              </div>
            </div>
          {/if}
          
          <!-- Réponse (affichée après l'indication si activée) -->
          {#if group.response && (solutionStates[group.index] || showSolution)}
            {@const processedR = processContentBlock(group.response)}
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
      {#each content.filter(b => b.type === 'question' || !b.type || b.type === 'text').sort((a, b) => (a.order || 0) - (b.order || 0)) as block}
        {@const processed = processContentBlock(block)}
        <div class="content-block">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
    </div>
    
    <!-- Solutions groupées (seulement si pas de structure Q/R) -->
    {#if organizedContent.extraResponses.length > 0 || content.filter(b => b.type === 'reponse' || b.type === 'solution').length > 0}
      <details 
        class="mt-8 collapsible-section collapsible-section--solution" 
        bind:open={showSolution}
      >
        <summary class="collapsible-summary collapsible-summary--solution">
          ✅ Solution complète
        </summary>
        <div class="collapsible-content">
          {#each content.filter(b => b.type === 'reponse' || b.type === 'solution').sort((a, b) => (a.order || 0) - (b.order || 0)) as block}
            {@const processed = processContentBlock(block)}
            <div class="content-block">
              <MathRenderer content={processed.html} />
            </div>
          {/each}
        </div>
      </details>
    {/if}
    
    <!-- Indications groupées (seulement si pas de structure Q/R) -->
    {#if organizedContent.extraHints.length > 0 || content.filter(b => b.type === 'hint' || b.type === 'indication').length > 0}
      <details 
        class="mt-8 collapsible-section collapsible-section--hint" 
        bind:open={showHint}
      >
        <summary class="collapsible-summary collapsible-summary--hint">
          💡 Indication{content.filter(b => b.type === 'hint' || b.type === 'indication').length > 1 ? 's' : ''}
        </summary>
        <div class="collapsible-content">
          {#each content.filter(b => b.type === 'hint' || b.type === 'indication').sort((a, b) => (a.order || 0) - (b.order || 0)) as block}
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
  {#if organizedContent.extraHints.length > 0}
    <details 
      class="mt-8 collapsible-section collapsible-section--hint" 
      bind:open={showHint}
    >
      <summary class="collapsible-summary collapsible-summary--hint">
        💡 Indication{organizedContent.extraHints.length > 1 ? 's' : ''} générale{organizedContent.extraHints.length > 1 ? 's' : ''}
      </summary>
      <div class="collapsible-content">
        {#each organizedContent.extraHints as block}
          {@const processed = processContentBlock(block)}
          <div class="content-block">
            <MathRenderer content={processed.html} />
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>
