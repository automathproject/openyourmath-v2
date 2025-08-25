<!-- src/lib/components/ExerciseContent.svelte -->
<script>
  import MathRenderer from './MathRenderer.svelte';
  
  export let content = [];
  export let showSolution = false;
  export let showHint = false;
  
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
    
    // Créer des paires question/réponse
    const questionResponsePairs = [];
    
    // Si on a autant de questions que de réponses, les associer
    if (questions.length === reponses.length) {
      for (let i = 0; i < questions.length; i++) {
        questionResponsePairs.push({
          question: questions[i],
          response: reponses[i]
        });
      }
    } else {
      // Sinon, traiter séparément
      questions.forEach(q => questionResponsePairs.push({ question: q, response: null }));
      reponses.forEach(r => questionResponsePairs.push({ question: null, response: r }));
    }
    
    return {
      mainContent,
      questionResponsePairs,
      hints,
      hasQuestionResponseStructure: questions.length > 0 && reponses.length > 0
    };
  })();
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
          <!-- Question -->
          {#if pair.question}
            {@const processedQ = processContentBlock(pair.question)}
            <div class="question-block">
              <div class="flex items-start gap-3">
                <div class="question-number">
                  <span class="question-number-badge">
                    {index + 1}
                  </span>
                </div>
                <div class="question-content">
                  <MathRenderer content={processedQ.html} />
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Réponse correspondante -->
          {#if pair.response}
            {@const processedR = processContentBlock(pair.response)}
            <details 
              class="response-block collapsible-section collapsible-section--solution" 
              bind:open={showSolution}
            >
              <summary class="collapsible-summary collapsible-summary--solution">
                <span class="text-green-700">✅ Réponse {index + 1}</span>
                <span class="text-sm text-green-600">
                  ({showSolution ? 'Masquer' : 'Voir'} la solution)
                </span>
              </summary>
              <div class="collapsible-content">
                <MathRenderer content={processedR.html} />
              </div>
            </details>
          {/if}
        </div>
      {/each}
    </div>
    
  {:else}
    <!-- Fallback : affichage traditionnel si pas de structure Q/R -->
    <div class="traditional-content space-y-4">
      {#each content.filter(b => b.type === 'question' || !b.type || b.type === 'text') as block}
        {@const processed = processContentBlock(block)}
        <div class="content-block">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
    </div>
    
    <!-- Solutions groupées -->
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
  {/if}
  
  <!-- Section Indications (toujours séparée) -->
  {#if organizedContent.hints.length > 0}
    <details 
      class="mt-8 collapsible-section collapsible-section--hint" 
      bind:open={showHint}
    >
      <summary class="collapsible-summary collapsible-summary--hint">
        💡 Indication{organizedContent.hints.length > 1 ? 's' : ''}
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