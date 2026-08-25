<!-- src/lib/components/LatexSourceViewer.svelte -->
<!--
  Visionneuse de source LaTeX : affiche le document complet dans un cadre façon
  éditeur, avec navigation exercice par exercice, copie, téléchargement et
  compilation.

  Composant purement présentationnel : l'état vient de LatexExport.svelte, qui
  est le seul à instancier la fabrique. Rien ici ne doit charger de ressource
  ni reconstruire le document.

  Props:
    latex  {LatexExport}  — instance partagée (source, ancres, actions)
-->
<script>
  import LatexContentOptions from '$lib/components/LatexContentOptions.svelte';
  import LatexCompiler from '$lib/components/LatexCompiler.svelte';

  let {
    /** @type {import('$lib/latex/exportState.svelte.js').LatexExport} */
    latex,
  } = $props();

  let source = $derived(latex.source);
  let anchors = $derived(latex.anchors);
  let hlLines = $derived(highlightSource(source));
  let fileName = $derived(latex.texFileName);

  // ── Coloration syntaxique LaTeX (légère, avec suivi du mode math) ──
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightSource(src) {
    const out = [];
    let math = false;
    const tokenRe = /\\(?:[a-zA-Z@]+\*?|.)|\$\$?|%|[{}]/g;

    for (const raw of src.split('\n')) {
      let html = '';
      let plainStart = 0;
      let m;
      tokenRe.lastIndex = 0;

      const pushPlain = (to) => {
        if (to > plainStart) {
          const text = escapeHtml(raw.slice(plainStart, to));
          html += math ? `<span class="tk-math">${text}</span>` : text;
        }
      };

      while ((m = tokenRe.exec(raw))) {
        pushPlain(m.index);
        const t = m[0];
        if (t === '%') {
          html += `<span class="tk-cmt">${escapeHtml(raw.slice(m.index))}</span>`;
          plainStart = raw.length;
          break;
        } else if (t === '$' || t === '$$') {
          math = !math;
          html += `<span class="tk-mdelim">${t}</span>`;
        } else if (t === '{' || t === '}') {
          html += `<span class="tk-brace">${t}</span>`;
        } else {
          if (t === '\\[') math = true;
          else if (t === '\\]') math = false;
          html += `<span class="tk-cmd">${escapeHtml(t)}</span>`;
        }
        plainStart = tokenRe.lastIndex;
      }
      pushPlain(raw.length);
      out.push(html);
    }
    return out;
  }

  // ── Navigation entre exercices ──
  let bodyEl = $state(null);
  let currentExo = $state(0);
  let flashFrom = $state(0);
  let flashTo = $state(0);
  // Ni le minuteur ni le verrou d'animation ne sont lus par le rendu :
  // les garder hors de $state évite des invalidations inutiles.
  let flashTimer = null;
  let scrollTicking = false;

  function measureLineHeight() {
    const el = bodyEl?.querySelector('.code-line');
    return el ? el.offsetHeight : 21;
  }

  function exerciseRange(i) {
    const from = anchors[i]?.line ?? 1;
    const to = i + 1 < anchors.length ? anchors[i + 1].line - 1 : hlLines.length;
    return { from, to };
  }

  function gotoExercise(i) {
    if (!bodyEl || i < 0 || i >= anchors.length) return;
    currentExo = i;
    const lh = measureLineHeight();
    bodyEl.scrollTo({ top: (anchors[i].line - 1) * lh - 6, behavior: 'smooth' });

    const { from, to } = exerciseRange(i);
    flashFrom = from;
    flashTo = to;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashFrom = 0;
      flashTo = 0;
    }, 1400);
  }

  function handleScroll() {
    if (scrollTicking || !bodyEl || anchors.length === 0) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      if (!bodyEl) return;
      const line = Math.floor(bodyEl.scrollTop / measureLineHeight()) + 4;
      let idx = 0;
      for (let i = 0; i < anchors.length; i++) {
        if (anchors[i].line <= line) idx = i;
        else break;
      }
      currentExo = idx;
    });
  }

  function handleSelectExo(event) {
    gotoExercise(Number(event.target.value));
  }

  // ── Actions ──
  let compileMode = $state(false);

  /**
   * Les figures joignables ne sont téléchargées qu'ici : la plupart des
   * exports partent en .tex sans jamais passer par le compilateur en ligne.
   */
  function openCompiler() {
    compileMode = true;
    latex.loadAssets();
  }
</script>

<div class="latex-viewer">
  {#if latex.isEmpty}
    <p class="latex-viewer-empty">Ajoutez des exercices à la liste pour générer la source LaTeX.</p>
  {:else}
    <!-- Options -->
    <div class="latex-viewer-options">
      <LatexContentOptions
        bind:includeHints={latex.content.includeHints}
        bind:includeSolutions={latex.content.includeSolutions}
        bind:solutionsAtEnd={latex.content.solutionsAtEnd}
        compact
      />
      {#if latex.artifactsLoading}
        <span class="lv-loading">Chargement des ressources…</span>
      {/if}
    </div>

    <!-- Cadre éditeur -->
    <div class="editor-frame">
      <div class="editor-header">
        <span class="editor-dots" aria-hidden="true">
          <i class="dot dot-r"></i><i class="dot dot-y"></i><i class="dot dot-g"></i>
        </span>
        <span class="editor-filename" title={fileName}>{fileName}</span>

        <div class="editor-nav" role="group" aria-label="Navigation entre les exercices">
          <button
            class="editor-nav-btn"
            disabled={currentExo <= 0}
            onclick={() => gotoExercise(currentExo - 1)}
            title="Exercice précédent"
            aria-label="Exercice précédent"
          >‹</button>
          <select
            class="editor-nav-select"
            value={currentExo}
            onchange={handleSelectExo}
            aria-label="Aller à un exercice"
          >
            {#each anchors as a, i}
              <option value={i}>{i + 1}. {a.title}</option>
            {/each}
          </select>
          <button
            class="editor-nav-btn"
            disabled={currentExo >= anchors.length - 1}
            onclick={() => gotoExercise(currentExo + 1)}
            title="Exercice suivant"
            aria-label="Exercice suivant"
          >›</button>
        </div>

        <div class="editor-actions">
          <button class="editor-action-btn editor-action-btn--primary" onclick={openCompiler}>
            Compiler le PDF
          </button>
          <button class="editor-action-btn" onclick={() => latex.copy()}>
            {#if latex.copied}✓ Copié{:else}Copier{/if}
          </button>
          <button class="editor-action-btn editor-action-btn--primary" onclick={() => latex.download()}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            .tex
          </button>
        </div>
      </div>

      <div
        class="editor-body"
        bind:this={bodyEl}
        onscroll={handleScroll}
        tabindex="0"
        role="region"
        aria-label="Source LaTeX de la liste d'exercices"
      >
        <div class="code-lines">
          {#each hlLines as line, i}
            <div
              class="code-line"
              class:flash={i + 1 >= flashFrom && i + 1 <= flashTo}
            ><span class="ln">{i + 1}</span><span class="lc">{@html line}</span></div>
          {/each}
        </div>
      </div>

      <div class="editor-statusbar">
        <span>{hlLines.length} lignes · UTF-8 · LaTeX</span>
        <span class="editor-status-right">
          {latex.exercises.length} exercice{latex.exercises.length > 1 ? 's' : ''}
          <span class="editor-soon">Compilation en ligne</span>
        </span>
      </div>
    </div>
  {/if}
</div>

{#if compileMode}
  <div
    class="latex-compiler-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="list-latex-compiler-title"
    tabindex="-1"
  >
    <div class="latex-compiler-overlay-header">
      <div>
        <h2 id="list-latex-compiler-title">Compilation LaTeX</h2>
        <p>Source de la liste à gauche, PDF compilé à droite.</p>
      </div>
      <button type="button" class="compiler-close" onclick={() => (compileMode = false)}>
        ← Revenir à la source
      </button>
    </div>
    <div class="latex-compiler-document-options">
      <LatexContentOptions
        bind:includeHints={latex.content.includeHints}
        bind:includeSolutions={latex.content.includeSolutions}
        bind:solutionsAtEnd={latex.content.solutionsAtEnd}
        compact
      />
    </div>

    {#if latex.skippedImages.length > 0}
      <p class="compiler-image-warning">
        <strong>{latex.skippedImages.length}</strong>
        figure{latex.skippedImages.length > 1 ? 's' : ''}
        ne peut{latex.skippedImages.length > 1 ? 'vent' : ''} pas être transmise{latex.skippedImages.length > 1 ? 's' : ''}
        au compilateur en ligne ({[...new Set(latex.skippedImages.map((i) => i.extension))].join(', ')}) :
        le PDF les remplacera par un encart. Téléchargez le <code>.tex</code> et compilez-le
        localement pour obtenir le document illustré.
      </p>
    {/if}

    <LatexCompiler
      source={latex.compilerSource}
      assets={latex.assets}
      filename={fileName}
    />
  </div>
{/if}

<style>
  .latex-viewer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .latex-viewer-empty {
    font-size: 13px;
    color: theme('colors.interface.text-muted');
    margin: 0;
  }

  /* Options */
  .latex-viewer-options {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  .lv-loading {
    font-size: 12px;
    color: theme('colors.interface.text-muted');
    font-style: italic;
  }

  /* Cadre éditeur */
  .editor-frame {
    --ed-bg: #1b1f2a;
    --ed-bg-soft: #232837;
    --ed-border: #2e3446;
    --ed-text: #d5dbe8;
    --ed-muted: #6b7590;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 10px;
    overflow: hidden;
    background: var(--ed-bg);
    box-shadow: theme('boxShadow.card');
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--ed-bg-soft);
    border-bottom: 1px solid var(--ed-border);
  }
  .editor-dots {
    display: inline-flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-r { background: #f2555a; }
  .dot-y { background: #f5b840; }
  .dot-g { background: #43c25c; }

  .editor-filename {
    font-family: theme('fontFamily.mono');
    font-size: 12px;
    color: var(--ed-text);
    background: var(--ed-bg);
    border: 1px solid var(--ed-border);
    border-radius: 6px;
    padding: 3px 10px;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
  }

  .editor-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    min-width: 0;
  }
  .editor-nav-btn {
    width: 24px;
    height: 24px;
    border: 1px solid var(--ed-border);
    border-radius: 6px;
    background: var(--ed-bg);
    color: var(--ed-text);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 0 2px;
  }
  .editor-nav-btn:hover:not(:disabled) { border-color: theme('colors.brand.400'); color: white; }
  .editor-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .editor-nav-select {
    max-width: 220px;
    min-width: 0;
    background: var(--ed-bg);
    color: var(--ed-text);
    border: 1px solid var(--ed-border);
    border-radius: 6px;
    font-size: 12px;
    padding: 3px 6px;
    cursor: pointer;
  }
  .editor-nav-select:focus { outline: none; border-color: theme('colors.brand.400'); }

  .editor-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .editor-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--ed-border);
    border-radius: 6px;
    background: var(--ed-bg);
    color: var(--ed-text);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    cursor: pointer;
    white-space: nowrap;
  }
  .editor-action-btn:hover { border-color: theme('colors.brand.400'); color: white; }
  .editor-action-btn--primary {
    background: theme('colors.brand.600');
    border-color: theme('colors.brand.600');
    color: white;
  }
  .editor-action-btn--primary:hover { background: theme('colors.brand.500'); border-color: theme('colors.brand.500'); }

  /* Zone de code */
  .editor-body {
    max-height: 520px;
    overflow: auto;
    font-family: theme('fontFamily.mono');
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--ed-text);
  }
  .editor-body:focus { outline: none; }
  .code-lines {
    width: max-content;
    min-width: 100%;
    padding: 8px 0 14px;
  }
  .code-line {
    display: flex;
    width: max-content;
    min-width: 100%;
    transition: background 0.5s ease;
  }
  .code-line.flash {
    background: rgba(99, 102, 241, 0.16);
    transition: background 0.15s ease;
  }
  .ln {
    position: sticky;
    left: 0;
    flex: 0 0 52px;
    text-align: right;
    padding-right: 14px;
    color: var(--ed-muted);
    background: var(--ed-bg);
    user-select: none;
    z-index: 1;
  }
  .code-line.flash .ln {
    background: #262b3d;
  }
  .lc {
    white-space: pre;
    padding-right: 24px;
  }

  /* Jetons de coloration */
  .lc :global(.tk-cmd)    { color: #82aaff; }
  .lc :global(.tk-cmt)    { color: #64708d; font-style: italic; }
  .lc :global(.tk-math)   { color: #e8bd6d; }
  .lc :global(.tk-mdelim) { color: #c792ea; }
  .lc :global(.tk-brace)  { color: #89ddff; }

  /* Barre de statut */
  .editor-statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 14px;
    background: var(--ed-bg-soft);
    border-top: 1px solid var(--ed-border);
    font-size: 11px;
    color: var(--ed-muted);
  }
  .editor-status-right {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .editor-soon {
    border: 1px solid var(--ed-border);
    border-radius: 999px;
    padding: 1px 8px;
    color: var(--ed-muted);
  }

  .latex-compiler-overlay {
    position: fixed;
    inset: 0;
    z-index: 120;
    overflow-y: auto;
    padding: 1rem;
    background: theme('colors.interface.bg-secondary');
  }
  .latex-compiler-overlay-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    max-width: 1800px;
    margin: 0 auto 1rem;
  }
  .latex-compiler-overlay-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: theme('colors.interface.text-primary');
  }
  .latex-compiler-overlay-header p {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: theme('colors.interface.text-muted');
  }
  .compiler-close {
    flex-shrink: 0;
    padding: 0.45rem 0.75rem;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 0.375rem;
    background: theme('colors.interface.bg-primary');
    color: theme('colors.interface.text-secondary');
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .compiler-close:hover {
    border-color: theme('colors.brand.400');
    color: theme('colors.brand.700');
  }
  .latex-compiler-overlay :global(.latex-compiler) {
    max-width: 1800px;
    margin: 0 auto;
  }
  .latex-compiler-document-options {
    max-width: 1800px;
    margin: 0 auto 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 0.75rem;
    background: theme('colors.interface.bg-primary');
  }

  .compiler-image-warning {
    max-width: 1800px;
    margin: 0 auto 1rem;
    padding: 0.7rem 1rem;
    border: 1px solid theme('colors.amber.300');
    border-radius: 0.75rem;
    background: theme('colors.amber.50');
    color: theme('colors.amber.900');
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .compiler-image-warning code {
    padding: 0 0.2em;
    border-radius: 0.2rem;
    background: theme('colors.amber.100');
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  @media (max-width: 640px) {
    .editor-filename { display: none; }
    .editor-nav-select { max-width: 120px; }
  }
</style>
