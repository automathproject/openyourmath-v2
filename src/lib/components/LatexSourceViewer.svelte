<!-- src/lib/components/LatexSourceViewer.svelte -->
<!--
  Visionneuse de source LaTeX pour une liste d'exercices.
  Affiche le document complet (préambule optimisé, images, blocs de code)
  dans un cadre façon éditeur, avec navigation exercice par exercice.

  Props:
    exercises  {Object[]}  — liste d'exercices (format listStore)
    title      {string}    — titre de la liste (document + nom de fichier)
-->
<script>
  import { browser } from '$app/environment';
  import {
    buildLatexExport,
    fetchArtifactsMap,
    downloadTexFile,
  } from '$lib/latex/export.js';

  /** @type {Object[]} */
  export let exercises = [];

  /** @type {string} */
  export let title = '';

  // Options d'export
  let includeHints = true;
  let includeSolutions = true;
  let solutionsAtEnd = false;

  // Artifacts (images, blocs de code) chargés à la demande
  let artifactsMap = {};
  let artifactsLoading = false;
  let lastUuidsKey = null;

  $: uuidsKey = (exercises || []).map((e) => e.uuid).join(',');
  $: if (browser && uuidsKey !== lastUuidsKey) {
    lastUuidsKey = uuidsKey;
    loadArtifacts();
  }

  async function loadArtifacts() {
    const key = uuidsKey;
    artifactsLoading = true;
    try {
      const map = await fetchArtifactsMap(exercises);
      if (key === uuidsKey) artifactsMap = map;
    } finally {
      if (key === uuidsKey) artifactsLoading = false;
    }
  }

  // Génération du document
  $: exportResult = buildLatexExport(exercises || [], title, {
    includeHints,
    includeSolutions,
    solutionsAtEnd,
    artifactsMap,
    origin: browser ? window.location.origin : '',
  });
  $: source = exportResult.source;
  $: anchors = exportResult.anchors;
  $: hlLines = highlightSource(source);
  $: fileName = `${(title || 'seance').replace(/[^a-z0-9\-_]/gi, '_').toLowerCase()}.tex`;

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
  let bodyEl;
  let currentExo = 0;
  let flashFrom = 0;
  let flashTo = 0;
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
  let copied = false;
  let copyTimer = null;

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  }

  function download() {
    downloadTexFile(source, title || 'seance');
  }
</script>

<div class="latex-viewer">
  {#if !exercises || exercises.length === 0}
    <p class="latex-viewer-empty">Ajoutez des exercices à la liste pour générer la source LaTeX.</p>
  {:else}
    <!-- Options -->
    <div class="latex-viewer-options">
      <label class="lv-option">
        <input type="checkbox" bind:checked={includeHints} />
        <span>Indications</span>
      </label>
      <label class="lv-option">
        <input type="checkbox" bind:checked={includeSolutions} />
        <span>Réponses</span>
      </label>
      <label class="lv-option lv-option--sub" class:lv-option--disabled={!includeSolutions}>
        <input type="checkbox" bind:checked={solutionsAtEnd} disabled={!includeSolutions} />
        <span>Réponses regroupées en fin de document</span>
      </label>
      {#if artifactsLoading}
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
            on:click={() => gotoExercise(currentExo - 1)}
            title="Exercice précédent"
            aria-label="Exercice précédent"
          >‹</button>
          <select
            class="editor-nav-select"
            value={currentExo}
            on:change={handleSelectExo}
            aria-label="Aller à un exercice"
          >
            {#each anchors as a, i}
              <option value={i}>{i + 1}. {a.title}</option>
            {/each}
          </select>
          <button
            class="editor-nav-btn"
            disabled={currentExo >= anchors.length - 1}
            on:click={() => gotoExercise(currentExo + 1)}
            title="Exercice suivant"
            aria-label="Exercice suivant"
          >›</button>
        </div>

        <div class="editor-actions">
          <button class="editor-action-btn" on:click={copySource}>
            {#if copied}✓ Copié{:else}Copier{/if}
          </button>
          <button class="editor-action-btn editor-action-btn--primary" on:click={download}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            .tex
          </button>
        </div>
      </div>

      <div
        class="editor-body"
        bind:this={bodyEl}
        on:scroll={handleScroll}
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
          {exercises.length} exercice{exercises.length > 1 ? 's' : ''}
          <span class="editor-soon" title="Bientôt disponible">Compilation en ligne — bientôt</span>
        </span>
      </div>
    </div>
  {/if}
</div>

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
  .lv-option {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: theme('colors.interface.text-primary');
    cursor: pointer;
  }
  .lv-option input[type='checkbox'] {
    accent-color: theme('colors.brand.600');
    width: 15px;
    height: 15px;
    cursor: pointer;
  }
  .lv-option--sub {
    font-weight: 500;
    color: theme('colors.interface.text-secondary');
  }
  .lv-option--disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .lv-option--disabled input {
    cursor: not-allowed;
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

  @media (max-width: 640px) {
    .editor-filename { display: none; }
    .editor-nav-select { max-width: 120px; }
  }
</style>
