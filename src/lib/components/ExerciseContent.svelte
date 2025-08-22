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
  
  // Debug
  $: {
    console.log('🔍 Organized content:', organizedContent);
  }
</script>

<div class="exercise-content">
  <!-- Contenu principal (texte introductif) -->
  {#if organizedContent.mainContent.length > 0}
    <div class="main-content space-y-4 mb-6">
      {#each organizedContent.mainContent as block}
        {@const processed = processContentBlock(block)}
        <div class="content-block {processed.type}">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
    </div>
  {/if}
  
  <!-- Structure question/réponse alternée -->
  {#if organizedContent.hasQuestionResponseStructure}
    <div class="questions-responses space-y-6">
      {#each organizedContent.questionResponsePairs as pair, index}
        <div class="question-response-pair">
          <!-- Question -->
          {#if pair.question}
            {@const processedQ = processContentBlock(pair.question)}
            <div class="question-block mb-4">
              <div class="flex items-start gap-3">
                <div class="question-number">
                  <span class="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                </div>
                <div class="question-content flex-1">
                  <MathRenderer content={processedQ.html} />
                </div>
              </div>
            </div>
          {/if}
          
          <!-- Réponse correspondante -->
          {#if pair.response}
            {@const processedR = processContentBlock(pair.response)}
            <details class="response-block bg-green-50 border border-green-200 rounded-lg" bind:open={showSolution}>
              <summary class="cursor-pointer font-medium p-4 hover:bg-green-100 rounded-lg transition-colors flex items-center gap-2">
                <span class="text-green-700">✅ Réponse {index + 1}</span>
                <span class="text-sm text-green-600">({showSolution ? 'Masquer' : 'Voir'} la solution)</span>
              </summary>
              <div class="px-4 pb-4">
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
        <div class="content-block {processed.type}">
          <MathRenderer content={processed.html} />
        </div>
      {/each}
    </div>
    
    <!-- Solutions groupées -->
    {#if content.filter(b => b.type === 'reponse' || b.type === 'solution').length > 0}
      <details class="mt-8 bg-green-50 border border-green-200 rounded-lg" bind:open={showSolution}>
        <summary class="cursor-pointer font-medium p-4 hover:bg-green-100 rounded-lg transition-colors">
          ✅ Solution complète
        </summary>
        <div class="px-4 pb-4 space-y-3">
          {#each content.filter(b => b.type === 'reponse' || b.type === 'solution') as block}
            {@const processed = processContentBlock(block)}
            <div class="content-block {processed.type}">
              <MathRenderer content={processed.html} />
            </div>
          {/each}
        </div>
      </details>
    {/if}
  {/if}
  
  <!-- Section Indications (toujours séparée) -->
  {#if organizedContent.hints.length > 0}
    <details class="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg" bind:open={showHint}>
      <summary class="cursor-pointer font-medium p-4 hover:bg-yellow-100 rounded-lg transition-colors">
        💡 Indication{organizedContent.hints.length > 1 ? 's' : ''}
      </summary>
      <div class="px-4 pb-4 space-y-3">
        {#each organizedContent.hints as block}
          {@const processed = processContentBlock(block)}
          <div class="content-block {processed.type}">
            <MathRenderer content={processed.html} />
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>

<style>
  .exercise-content {
    line-height: 1.7;
  }
  
  .content-block {
    margin: 1rem 0;
  }
  
  .question-response-pair {
    border-left: 3px solid #e5e7eb;
    padding-left: 1rem;
    margin: 2rem 0;
  }
  
  .question-block {
    background: #f8fafc;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .question-number {
    flex-shrink: 0;
    margin-top: 0.25rem;
  }
  
  .response-block {
    margin-left: 2.75rem; /* Aligné avec le contenu de la question */
  }
  
  /* Styles pour les éléments HTML du contenu */
  .exercise-content :global(p) {
    margin: 1rem 0;
    color: #374151;
  }
  
  .exercise-content :global(h1),
  .exercise-content :global(h2),
  .exercise-content :global(h3) {
    font-weight: 600;
    margin: 1.5rem 0 1rem 0;
    color: #111827;
  }
  
  .exercise-content :global(h1) { font-size: 1.5rem; }
  .exercise-content :global(h2) { font-size: 1.25rem; }
  .exercise-content :global(h3) { font-size: 1.125rem; }
  
  .exercise-content :global(ul),
  .exercise-content :global(ol) {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  .exercise-content :global(li) {
    margin: 0.5rem 0;
  }
  
  .exercise-content :global(strong) {
    font-weight: 600;
    color: #111827;
  }
  
  .exercise-content :global(em) {
    font-style: italic;
    color: #6B7280;
  }
  
  .exercise-content :global(code) {
    background-color: #F3F4F6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
  }
  
  /* Animation pour les details */
  details {
    transition: all 0.2s ease;
  }
  
  details[open] {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
</style>