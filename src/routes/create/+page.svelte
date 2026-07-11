<!--
  /create — éditeur de création d'exercice.
  Double fenêtre : à gauche les champs structurés (description, question,
  indication, solution) avec assistant LaTeX et assistant IA (API Albert) ;
  à droite le rendu tel qu'il apparaîtra sur le site.
  Export .tex au format des sources de content/exercises/.
-->

<script>
  import { tick, onMount } from 'svelte';
  import ExerciseContent from '$lib/components/ExerciseContent.svelte';
  import LatexToolbar from '$lib/components/create/LatexToolbar.svelte';
  import ImportDropzone from '$lib/components/create/ImportDropzone.svelte';
  import { blocksToPreviewContent } from '$lib/latex/texPreview.js';
  import {
    buildExerciseTex,
    parseExerciseTex,
    generateShortUuid,
    splitEnumerateItems,
    BLOCK_TYPES,
  } from '$lib/latex/exerciseTex.js';
  import { downloadTexFile } from '$lib/latex/export.js';
  import { DEFAULT_TASKS, buildTaskPrompt, SYSTEM_PROMPT } from '$lib/ia/assistPrompts.js';

  const DRAFT_KEY = 'oym-create-draft-v1';
  const PROMPTS_KEY = 'oym-create-prompts-v1';
  const LEVELS = ['Seconde', 'Première', 'Terminale', 'L1', 'L2', 'L3', 'M1', 'M2'];

  const BLOCK_LABELS = {
    text: 'Description',
    question: 'Question',
    indication: 'Indication',
    reponse: 'Solution',
    code: 'Code',
  };

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function emptyMeta() {
    return {
      uuid: generateShortUuid(),
      title: '',
      level: '',
      module: '',
      chapter: '',
      subchapter: '',
      theme: '',
      author: '',
      organization: '',
      difficulty: '',
      created_at: today(),
      video_id: '',
    };
  }

  function newBlock(type, latex = '') {
    return { id: crypto.randomUUID(), type, latex };
  }

  // ── État ──────────────────────────────────────────────────────────────────
  let meta = $state(emptyMeta());
  let blocks = $state([newBlock('text'), newBlock('question')]);

  let rightTab = $state('preview'); // 'preview' | 'source'
  let showMeta = $state(true);
  let showImport = $state(false);
  let showHint = $state(true);
  let showSolution = $state(true);

  let aiInstruction = $state('');
  let aiBusyBlockId = $state(null); // id du bloc concerné, ou '__new__'
  let aiMetaBusy = $state(null); // clé du champ de métadonnée en cours de suggestion
  let aiError = $state('');

  // Consignes IA par défaut, personnalisables et mémorisées (localStorage)
  let promptTemplates = $state({ ...DEFAULT_TASKS });
  // Panneau de consigne ouvert par ✨ : { blockId, mode, isImprove, template,
  // targetLatex, currentLatex, remember }
  let promptPanel = $state(null);
  let copied = $state(false);
  let importNotice = $state('');

  // Champ actif pour l'assistant LaTeX
  let activeTextarea = null;
  let activeBlockId = null;

  let restored = false;

  // ── Aperçu (debounce 300 ms) ──────────────────────────────────────────────
  let previewContent = $state([]);
  $effect(() => {
    const snapshot = blocks.map((b) => ({ id: b.id, type: b.type, latex: b.latex }));
    const timer = setTimeout(() => {
      previewContent = blocksToPreviewContent(snapshot);
    }, 300);
    return () => clearTimeout(timer);
  });

  let previewExercise = $derived({
    ...meta,
    difficulty: meta.difficulty ? Number(meta.difficulty) : null,
    artifacts: {},
  });

  let texSource = $derived(
    buildExerciseTex(
      meta,
      blocks.map((b) => ({ type: b.type, latex: b.latex }))
    )
  );

  let questionCount = $derived(blocks.filter((b) => b.type === 'question' && b.latex.trim()).length);

  // ── Brouillon localStorage ────────────────────────────────────────────────
  onMount(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.meta && Array.isArray(draft?.blocks)) {
          meta = { ...emptyMeta(), ...draft.meta };
          blocks = draft.blocks.map((b) => newBlock(b.type || 'text', b.latex || ''));
        }
      }
    } catch {
      // brouillon corrompu : ignoré
    }
    try {
      const rawPrompts = localStorage.getItem(PROMPTS_KEY);
      if (rawPrompts) {
        promptTemplates = { ...DEFAULT_TASKS, ...JSON.parse(rawPrompts) };
      }
    } catch {
      // consignes corrompues : défauts conservés
    }
    restored = true;
  });

  $effect(() => {
    const payload = JSON.stringify({
      meta: { ...meta },
      blocks: blocks.map((b) => ({ type: b.type, latex: b.latex })),
    });
    if (!restored) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, payload);
      } catch {
        // stockage plein : non bloquant
      }
    }, 500);
    return () => clearTimeout(timer);
  });

  // ── Gestion des blocs ─────────────────────────────────────────────────────
  function addBlock(type, afterId = null) {
    const block = newBlock(type);
    if (afterId) {
      const idx = blocks.findIndex((b) => b.id === afterId);
      blocks.splice(idx + 1, 0, block);
    } else {
      blocks.push(block);
    }
    tick().then(() => {
      document.getElementById(`block-ta-${block.id}`)?.focus();
    });
    return block;
  }

  function removeBlock(id) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx !== -1) blocks.splice(idx, 1);
  }

  function moveBlock(id, delta) {
    const idx = blocks.findIndex((b) => b.id === id);
    const target = idx + delta;
    if (idx === -1 || target < 0 || target >= blocks.length) return;
    const [block] = blocks.splice(idx, 1);
    blocks.splice(target, 0, block);
  }

  /** Question précédant le bloc d'index donné (pour indication/solution). */
  function precedingQuestion(index) {
    for (let i = index; i >= 0; i--) {
      if (blocks[i].type === 'question' && blocks[i].latex.trim()) return blocks[i];
    }
    return null;
  }

  /** Index d'insertion après la question `qIndex` et ses indications/solutions. */
  function insertIndexAfterGroup(qIndex) {
    let i = qIndex + 1;
    while (i < blocks.length && (blocks[i].type === 'indication' || blocks[i].type === 'reponse')) i++;
    return i;
  }

  // ── Assistant LaTeX ───────────────────────────────────────────────────────
  function registerFocus(event, blockId) {
    activeTextarea = event.currentTarget;
    activeBlockId = blockId;
  }

  function insertSnippet({ before, after }) {
    const ta = activeTextarea;
    const block = blocks.find((b) => b.id === activeBlockId);
    if (!ta || !block) return;

    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const selected = ta.value.slice(start, end);
    block.latex = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);

    tick().then(() => {
      ta.focus();
      const cursor = selected
        ? start + before.length + selected.length + after.length
        : start + before.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  // ── Assistant IA (API Albert) ─────────────────────────────────────────────
  async function callAssist(mode, { targetLatex = '', instruction = '', taskPrompt = '', field = '' } = {}) {
    const res = await fetch('/api/create/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        meta: { ...meta },
        blocks: blocks.map((b) => ({ type: b.type, latex: b.latex })),
        targetLatex,
        instruction,
        taskPrompt,
        field,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    return data.latex;
  }

  /** Suggère la valeur d'un champ de métadonnée à partir du contenu. */
  async function aiFillMeta(field) {
    if (aiMetaBusy) return;
    if (!blocks.some((b) => b.latex.trim())) {
      aiError = 'Rédigez d’abord le contenu de l’exercice : les suggestions de métadonnées s’appuient dessus.';
      return;
    }
    aiError = '';
    aiMetaBusy = field;
    try {
      const value = await callAssist('metadata', { field });
      meta[field] = value;
    } catch (err) {
      aiError = err.message;
    } finally {
      aiMetaBusy = null;
    }
  }

  /**
   * Répartit une réponse IA de type question en blocs : si le modèle a produit
   * un enumerate malgré la consigne, chaque \item devient une question
   * distincte (la plateforme ne rend pas les enumerate : la numérotation
   * vient des blocs question eux-mêmes).
   */
  function questionBlocksFromAi(latex) {
    const split = splitEnumerateItems(latex);
    if (!split) return { text: null, questions: [latex] };
    return { text: split.prefix || null, questions: split.items };
  }

  /**
   * Ouvre le panneau de consigne du bloc : l'utilisateur voit et peut
   * modifier la consigne exacte envoyée à l'IA avant de générer.
   */
  function openPromptPanel(block) {
    if (aiBusyBlockId) return;
    aiError = '';

    const idx = blocks.findIndex((b) => b.id === block.id);
    const target =
      block.type === 'indication' || block.type === 'reponse'
        ? precedingQuestion(idx)?.latex ?? ''
        : '';
    if ((block.type === 'indication' || block.type === 'reponse') && !target) {
      aiError = 'Rédigez d’abord la question à laquelle ce bloc se rapporte.';
      return;
    }

    if (promptPanel?.blockId === block.id) {
      promptPanel = null; // second clic : referme
      return;
    }

    const isImprove = Boolean(block.latex.trim());
    promptPanel = {
      blockId: block.id,
      mode: block.type,
      isImprove,
      template: promptTemplates[isImprove ? 'improve' : block.type],
      targetLatex: target,
      currentLatex: block.latex,
      remember: false,
    };
  }

  function promptTemplateKey(panel) {
    return panel.isImprove ? 'improve' : panel.mode;
  }

  function savePromptTemplates() {
    try {
      localStorage.setItem(PROMPTS_KEY, JSON.stringify(promptTemplates));
    } catch { /* stockage plein : non bloquant */ }
  }

  /** Rétablit la consigne d'origine (et oublie la version mémorisée). */
  function resetPromptTemplate() {
    if (!promptPanel) return;
    const key = promptTemplateKey(promptPanel);
    promptPanel.template = DEFAULT_TASKS[key];
    promptTemplates[key] = DEFAULT_TASKS[key];
    savePromptTemplates();
  }

  /** Lance la génération avec la consigne affichée dans le panneau. */
  async function generateFromPanel(block) {
    if (!promptPanel || aiBusyBlockId) return;
    const panel = promptPanel;

    if (panel.remember) {
      promptTemplates[promptTemplateKey(panel)] = panel.template;
      savePromptTemplates();
    }

    aiError = '';
    aiBusyBlockId = block.id;
    try {
      const taskPrompt = buildTaskPrompt(panel.mode, {
        template: panel.template,
        targetLatex: panel.targetLatex,
        currentLatex: block.latex,
      });
      const latex = await callAssist(panel.mode, {
        targetLatex: panel.targetLatex,
        taskPrompt,
      });

      if (block.type === 'question') {
        const { text, questions } = questionBlocksFromAi(latex);
        block.latex = questions[0];
        if (text) {
          blocks.splice(blocks.findIndex((b) => b.id === block.id), 0, newBlock('text', text));
        }
        if (questions.length > 1) {
          const insertAt = blocks.findIndex((b) => b.id === block.id) + 1;
          blocks.splice(insertAt, 0, ...questions.slice(1).map((q) => newBlock('question', q)));
        }
      } else {
        block.latex = latex;
      }
      promptPanel = null;
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
    }
  }

  /** Ajoute une indication ou une solution IA pour une question donnée. */
  async function aiAddForQuestion(questionBlock, type) {
    if (aiBusyBlockId) return;
    if (!questionBlock.latex.trim()) {
      aiError = 'Rédigez d’abord la question.';
      return;
    }
    aiError = '';
    aiBusyBlockId = questionBlock.id;
    try {
      const latex = await callAssist(type, { targetLatex: questionBlock.latex });
      const qIndex = blocks.findIndex((b) => b.id === questionBlock.id);
      blocks.splice(insertIndexAfterGroup(qIndex), 0, newBlock(type, latex));
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
    }
  }

  /** Génère une nouvelle question en fin d'exercice. */
  async function aiNewQuestion() {
    if (aiBusyBlockId) return;
    aiError = '';
    aiBusyBlockId = '__new__';
    try {
      const latex = await callAssist('question', { instruction: aiInstruction });
      const { text, questions } = questionBlocksFromAi(latex);
      if (text) blocks.push(newBlock('text', text));
      for (const q of questions) blocks.push(newBlock('question', q));
      aiInstruction = '';
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────
  function handleImported(tex, sourceLabel) {
    const { meta: parsedMeta, blocks: parsedBlocks } = parseExerciseTex(tex);
    if (parsedBlocks.length === 0) {
      importNotice = `⚠️ Aucun bloc reconnu dans « ${sourceLabel} ».`;
      return;
    }
    const hasContent = blocks.some((b) => b.latex.trim()) || meta.title;
    if (hasContent && !confirm('Remplacer l’exercice en cours par le document importé ?')) {
      return;
    }
    meta = {
      ...emptyMeta(),
      ...parsedMeta,
      uuid: parsedMeta.uuid || generateShortUuid(),
      created_at: parsedMeta.created_at || today(),
    };
    blocks = parsedBlocks.map((b) => newBlock(b.type, b.latex));
    importNotice = `✅ « ${sourceLabel} » importé — relisez et corrigez avant export.`;
    showImport = false;
    showMeta = true;
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportTex() {
    downloadTexFile(texSource, meta.uuid || meta.title || 'exercice');
  }

  async function copyTex() {
    try {
      await navigator.clipboard.writeText(texSource);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      aiError = 'Impossible de copier dans le presse-papiers.';
    }
  }

  function resetAll() {
    if (!confirm('Effacer l’exercice en cours et le brouillon enregistré ?')) return;
    meta = emptyMeta();
    blocks = [newBlock('text'), newBlock('question')];
    importNotice = '';
    aiError = '';
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch { /* ignoré */ }
  }

  /** Auto-redimensionnement des textareas. */
  function autoResize(node) {
    const resize = () => {
      node.style.height = 'auto';
      node.style.height = `${Math.min(node.scrollHeight + 2, 480)}px`;
    };
    node.addEventListener('input', resize);
    resize();
    return { destroy: () => node.removeEventListener('input', resize) };
  }
</script>

<svelte:head>
  <title>Créer un exercice - OpenYourMath v2</title>
  <meta name="description" content="Éditeur de création d'exercices de mathématiques : rédaction LaTeX assistée, assistant IA, export .tex" />
</svelte:head>

<div class="create-page">
  <div class="create-subheader">
    <div class="create-subheader-left">
      <h1>Créer un exercice</h1>
      <span class="create-beta" title="Fonctionnalité en période de test : signalez tout problème via la page Contact.">bêta</span>
      <span class="create-counter">{questionCount} question{questionCount > 1 ? 's' : ''}</span>
    </div>
    <div class="create-subheader-actions">
      <button type="button" class="btn-secondary" onclick={() => (showImport = !showImport)}>
        📄 Importer (PDF, image, .tex)
      </button>
      <button type="button" class="btn-secondary" onclick={copyTex}>
        {copied ? '✅ Copié' : '⧉ Copier le .tex'}
      </button>
      <button type="button" class="btn-primary" onclick={exportTex} disabled={!blocks.some((b) => b.latex.trim())}>
        ⬇ Exporter .tex
      </button>
      <button type="button" class="btn-ghost-danger" onclick={resetAll} title="Tout effacer">
        ↺
      </button>
    </div>
  </div>

  <p class="create-beta-notice">
    Cette fonctionnalité est en <strong>période de test</strong> : l'export .tex et les suggestions
    de l'IA méritent une relecture attentive avant publication.
  </p>

  {#if showImport}
    <div class="create-import">
      <ImportDropzone onimported={handleImported} />
    </div>
  {/if}
  {#if importNotice}
    <p class="create-import-notice">{importNotice}</p>
  {/if}

  <div class="create-layout">
    <!-- ── Colonne gauche : édition ─────────────────────────────────────── -->
    <section class="create-editor" aria-label="Édition de l'exercice">
      {#snippet metaAiBtn(field)}
        <button
          type="button"
          class="meta-ai-btn"
          title="Suggérer avec l'IA (d'après le contenu de l'exercice)"
          aria-label="Suggérer ce champ avec l'IA"
          disabled={aiMetaBusy !== null}
          onclick={(e) => { e.preventDefault(); aiFillMeta(field); }}
        >
          {aiMetaBusy === field ? '…' : '✨'}
        </button>
      {/snippet}

      <details class="editor-meta" bind:open={showMeta}>
        <summary>Métadonnées</summary>
        <div class="editor-meta-grid">
          <label class="meta-field meta-field--wide">
            <span>Titre *</span>
            <span class="meta-input-row">
              <input type="text" bind:value={meta.title} placeholder="Titre de l'exercice" />
              {@render metaAiBtn('title')}
            </span>
          </label>
          <label class="meta-field">
            <span>Niveau</span>
            <span class="meta-input-row">
              <input type="text" bind:value={meta.level} list="create-levels" placeholder="L1, L2…" />
              {@render metaAiBtn('level')}
            </span>
            <datalist id="create-levels">
              {#each LEVELS as level}<option value={level}></option>{/each}
            </datalist>
          </label>
          <label class="meta-field">
            <span>Difficulté</span>
            <span class="meta-input-row">
              <select bind:value={meta.difficulty}>
                <option value="">—</option>
                {#each [1, 2, 3, 4, 5] as d}
                  <option value={String(d)}>{'★'.repeat(d)}{'☆'.repeat(5 - d)}</option>
                {/each}
              </select>
              {@render metaAiBtn('difficulty')}
            </span>
          </label>
          <label class="meta-field">
            <span>Module</span>
            <span class="meta-input-row">
              <input type="text" bind:value={meta.module} placeholder="Analyse, Algèbre…" />
              {@render metaAiBtn('module')}
            </span>
          </label>
          <label class="meta-field">
            <span>Chapitre</span>
            <span class="meta-input-row">
              <input type="text" bind:value={meta.chapter} placeholder="Suites numériques…" />
              {@render metaAiBtn('chapter')}
            </span>
          </label>
          <label class="meta-field">
            <span>Sous-chapitre</span>
            <span class="meta-input-row">
              <input type="text" bind:value={meta.subchapter} />
              {@render metaAiBtn('subchapter')}
            </span>
          </label>
          <label class="meta-field">
            <span>Thèmes</span>
            <span class="meta-input-row">
              <input type="text" bind:value={meta.theme} placeholder="mots-clés, séparés, par, virgules" />
              {@render metaAiBtn('theme')}
            </span>
          </label>
          <label class="meta-field">
            <span>Auteur</span>
            <input type="text" bind:value={meta.author} placeholder="Prénom Nom" />
          </label>
          <label class="meta-field">
            <span>Organisation</span>
            <input type="text" bind:value={meta.organization} />
          </label>
          <label class="meta-field">
            <span>UUID</span>
            <span class="meta-uuid">
              <input type="text" bind:value={meta.uuid} maxlength="12" />
              <button type="button" title="Régénérer l'identifiant" onclick={() => (meta.uuid = generateShortUuid())}>⟳</button>
            </span>
          </label>
        </div>
      </details>

      <div class="editor-toolbar-sticky">
        <LatexToolbar oninsert={insertSnippet} />
      </div>

      {#if aiError}
        <p class="editor-ai-error" role="alert">
          {aiError}
          <button type="button" onclick={() => (aiError = '')} aria-label="Fermer">✕</button>
        </p>
      {/if}

      <div class="editor-ai-panel">
        <p class="editor-ai-title">✨ Assistant IA de rédaction <span class="editor-ai-model">Albert · gpt-oss-120b</span></p>
        <div class="editor-ai-row">
          <input
            type="text"
            bind:value={aiInstruction}
            placeholder="Consigne facultative : « une question sur la convergence, niveau L2 »…"
            onkeydown={(e) => e.key === 'Enter' && aiNewQuestion()}
          />
          <button type="button" class="btn-primary" disabled={aiBusyBlockId !== null} onclick={aiNewQuestion}>
            {aiBusyBlockId === '__new__' ? 'Génération…' : 'Générer une question'}
          </button>
        </div>
        <p class="editor-ai-hint">
          Sur chaque bloc : ✨ ouvre la consigne (visible et modifiable) pour rédiger ou améliorer le contenu ;
          sur une question, 💡 ajoute une indication et ✅ une solution.
        </p>
      </div>

      <div class="editor-blocks">
        {#each blocks as block, index (block.id)}
          <div class="editor-block editor-block--{block.type}">
            <div class="editor-block-head">
              <select
                class="editor-block-type"
                bind:value={block.type}
                aria-label="Type du bloc"
              >
                {#each BLOCK_TYPES as bt}
                  <option value={bt.type}>{bt.label}</option>
                {/each}
                {#if block.type === 'code'}<option value="code">Code</option>{/if}
              </select>

              <div class="editor-block-actions">
                <button
                  type="button"
                  class="block-btn block-btn--ai"
                  class:block-btn--ai-open={promptPanel?.blockId === block.id}
                  title={block.latex.trim()
                    ? 'Améliorer ce bloc avec l’IA (voir et modifier la consigne)'
                    : 'Rédiger ce bloc avec l’IA (voir et modifier la consigne)'}
                  disabled={aiBusyBlockId !== null}
                  onclick={() => openPromptPanel(block)}
                >
                  {aiBusyBlockId === block.id ? '…' : '✨'}
                </button>
                {#if block.type === 'question'}
                  <button
                    type="button"
                    class="block-btn"
                    title="Générer une indication (IA)"
                    disabled={aiBusyBlockId !== null}
                    onclick={() => aiAddForQuestion(block, 'indication')}
                  >💡</button>
                  <button
                    type="button"
                    class="block-btn"
                    title="Générer une solution (IA)"
                    disabled={aiBusyBlockId !== null}
                    onclick={() => aiAddForQuestion(block, 'reponse')}
                  >✅</button>
                {/if}
                <button type="button" class="block-btn" title="Monter" disabled={index === 0} onclick={() => moveBlock(block.id, -1)}>↑</button>
                <button type="button" class="block-btn" title="Descendre" disabled={index === blocks.length - 1} onclick={() => moveBlock(block.id, 1)}>↓</button>
                <button type="button" class="block-btn block-btn--danger" title="Supprimer ce bloc" onclick={() => removeBlock(block.id)}>✕</button>
              </div>
            </div>

            {#if promptPanel?.blockId === block.id}
              <div class="prompt-panel">
                <label class="prompt-panel-label" for="prompt-ta-{block.id}">
                  Consigne envoyée à l'IA
                  {#if promptPanel.isImprove}
                    <span class="prompt-panel-tag">amélioration</span>
                  {:else}
                    <span class="prompt-panel-tag">rédaction</span>
                  {/if}
                </label>
                <textarea
                  id="prompt-ta-{block.id}"
                  class="prompt-panel-input"
                  rows="3"
                  bind:value={promptPanel.template}
                ></textarea>

                <details class="prompt-panel-details">
                  <summary>Joint automatiquement à la consigne</summary>
                  <ul>
                    <li>Les métadonnées et tous les blocs de l'exercice (contexte).</li>
                    {#if promptPanel.targetLatex}
                      <li>La question concernée : <code>{promptPanel.targetLatex.slice(0, 120)}{promptPanel.targetLatex.length > 120 ? '…' : ''}</code></li>
                    {/if}
                    {#if promptPanel.isImprove}
                      <li>Le contenu actuel du bloc (à améliorer).</li>
                    {/if}
                  </ul>
                  <p class="prompt-panel-system-title">Instructions générales du modèle (fixes) :</p>
                  <pre class="prompt-panel-system">{SYSTEM_PROMPT}</pre>
                </details>

                <div class="prompt-panel-footer">
                  <label class="prompt-panel-remember">
                    <input type="checkbox" bind:checked={promptPanel.remember} />
                    Mémoriser comme consigne par défaut
                  </label>
                  <div class="prompt-panel-actions">
                    <button type="button" class="btn-link" onclick={resetPromptTemplate}>
                      Consigne d'origine
                    </button>
                    <button type="button" class="btn-secondary" onclick={() => (promptPanel = null)}>
                      Annuler
                    </button>
                    <button
                      type="button"
                      class="btn-primary"
                      disabled={aiBusyBlockId !== null || !promptPanel.template.trim()}
                      onclick={() => generateFromPanel(block)}
                    >
                      {aiBusyBlockId === block.id ? 'Génération…' : '✨ Générer'}
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <textarea
              id="block-ta-{block.id}"
              class="editor-block-input"
              rows="3"
              spellcheck="false"
              placeholder={block.type === 'question'
                ? 'Énoncé de la question (LaTeX, math entre $…$)'
                : block.type === 'indication'
                  ? 'Indication pour la question précédente'
                  : block.type === 'reponse'
                    ? 'Solution détaillée de la question précédente'
                    : 'Mise en situation, définitions, notations…'}
              bind:value={block.latex}
              use:autoResize
              onfocus={(e) => registerFocus(e, block.id)}
            ></textarea>
          </div>
        {/each}
      </div>

      <div class="editor-add-row">
        <span>Ajouter :</span>
        {#each BLOCK_TYPES as bt}
          <button type="button" class="btn-add" onclick={() => addBlock(bt.type)}>+ {bt.label}</button>
        {/each}
      </div>
    </section>

    <!-- ── Colonne droite : rendu ───────────────────────────────────────── -->
    <section class="create-preview" aria-label="Aperçu du rendu">
      <div class="preview-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={rightTab === 'preview'}
          class="preview-tab"
          class:is-active={rightTab === 'preview'}
          onclick={() => (rightTab = 'preview')}
        >Aperçu</button>
        <button
          type="button"
          role="tab"
          aria-selected={rightTab === 'source'}
          class="preview-tab"
          class:is-active={rightTab === 'source'}
          onclick={() => (rightTab = 'source')}
        >Source .tex</button>
      </div>

      <div class="preview-body">
        {#if rightTab === 'preview'}
          {#if previewContent.length === 0}
            <div class="preview-empty">
              <p>L'aperçu s'affichera ici au fur et à mesure de votre rédaction.</p>
              <p class="preview-empty-hint">Les figures TikZ et images ne sont rendues qu'à la construction du site.</p>
            </div>
          {:else}
            <ExerciseContent
              exercise={previewExercise}
              content={previewContent}
              variant="full"
              showHeader={true}
              showGlobalToggles={false}
              bind:showHint
              bind:showSolution
            />
          {/if}
        {:else}
          <div class="preview-source">
            <pre>{texSource}</pre>
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .create-page {
    max-width: 1500px;
    margin: 0 auto;
    padding: 1rem 1.25rem 3rem;
  }

  .create-subheader {
    @apply flex items-center justify-between gap-3 flex-wrap py-2 mb-2;
  }

  .create-subheader-left {
    @apply flex items-baseline gap-3;
  }

  .create-subheader h1 {
    @apply text-xl font-bold text-gray-900 m-0;
  }

  .create-counter {
    @apply text-xs text-gray-500;
  }

  .create-beta {
    @apply px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
           text-amber-700 bg-amber-50 border border-amber-200 self-center cursor-help;
  }

  .create-beta-notice {
    @apply text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 mb-3;
  }

  .create-subheader-actions {
    @apply flex items-center gap-2 flex-wrap;
  }

  .btn-primary {
    @apply px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium
           hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-secondary {
    @apply px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm font-medium
           hover:bg-gray-50 transition-colors;
  }

  .btn-ghost-danger {
    @apply px-2.5 py-1.5 rounded-md text-gray-400 text-sm hover:text-red-600 hover:bg-red-50 transition-colors;
  }

  .create-import {
    @apply mb-3;
  }

  .create-import-notice {
    @apply text-sm text-gray-600 mb-3;
  }

  .create-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  @media (max-width: 1023px) {
    .create-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* ── Colonne édition ─────────────────────────────────────────────────── */

  .create-editor {
    @apply flex flex-col gap-3 min-w-0;
  }

  .editor-meta {
    @apply border border-gray-200 rounded-lg bg-white;
  }

  .editor-meta > summary {
    @apply px-3 py-2 text-sm font-semibold text-gray-700 cursor-pointer select-none;
  }

  .editor-meta-grid {
    @apply grid grid-cols-2 gap-x-3 gap-y-2 px-3 pb-3;
  }

  @media (max-width: 640px) {
    .editor-meta-grid {
      @apply grid-cols-1;
    }
  }

  .meta-field {
    @apply flex flex-col gap-0.5 text-xs font-medium text-gray-500;
  }

  .meta-field--wide {
    @apply col-span-2;
  }

  @media (max-width: 640px) {
    .meta-field--wide {
      @apply col-span-1;
    }
  }

  .meta-field input,
  .meta-field select {
    @apply px-2 py-1.5 rounded-md border border-gray-300 text-sm text-gray-800 font-normal
           focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400;
  }

  .meta-input-row {
    @apply flex gap-1;
  }

  .meta-input-row input,
  .meta-input-row select {
    @apply flex-1 min-w-0;
  }

  .meta-ai-btn {
    @apply px-2 rounded-md border border-brand-200 bg-brand-50 text-sm
           hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
  }

  .meta-uuid {
    @apply flex gap-1;
  }

  .meta-uuid input {
    @apply flex-1 min-w-0 font-mono;
  }

  .meta-uuid button {
    @apply px-2 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50;
  }

  .editor-toolbar-sticky {
    position: sticky;
    top: 0.5rem;
    z-index: 10;
  }

  .editor-ai-error {
    @apply flex items-start justify-between gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2;
  }

  .editor-blocks {
    @apply flex flex-col gap-2.5;
  }

  .editor-block {
    @apply border rounded-lg bg-white overflow-hidden border-gray-200;
    border-left-width: 4px;
  }

  .editor-block--text { border-left-color: theme('colors.gray.300'); }
  .editor-block--question { border-left-color: theme('colors.brand.400'); }
  .editor-block--indication { border-left-color: theme('colors.yellow.400'); }
  .editor-block--reponse { border-left-color: theme('colors.green.400'); }
  .editor-block--code { border-left-color: theme('colors.purple.400'); }

  .editor-block-head {
    @apply flex items-center justify-between gap-2 px-2 pt-2;
  }

  .editor-block-type {
    @apply text-xs font-semibold text-gray-600 border border-gray-200 rounded-md px-1.5 py-1 bg-gray-50;
  }

  .editor-block-actions {
    @apply flex items-center gap-1;
  }

  .block-btn {
    @apply w-7 h-7 grid place-items-center rounded-md text-sm text-gray-500 border border-transparent
           hover:bg-gray-100 transition-colors disabled:opacity-35 disabled:cursor-not-allowed;
  }

  .block-btn--ai {
    @apply border-brand-200 bg-brand-50 hover:bg-brand-100;
  }

  .block-btn--ai-open {
    @apply bg-brand-100 border-brand-400;
  }

  /* Panneau de consigne IA */
  .prompt-panel {
    @apply mx-2 mt-2 px-3 py-2.5 rounded-lg border border-brand-200 bg-brand-50 flex flex-col gap-2;
  }

  .prompt-panel-label {
    @apply flex items-center gap-2 text-xs font-semibold text-brand-800;
  }

  .prompt-panel-tag {
    @apply px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white border border-brand-200 text-brand-600;
  }

  .prompt-panel-input {
    @apply w-full px-2.5 py-2 rounded-md border border-brand-200 bg-white text-sm leading-relaxed text-gray-800
           focus:outline-none focus:ring-2 focus:ring-brand-300 resize-y;
  }

  .prompt-panel-details {
    @apply text-xs text-brand-700;
  }

  .prompt-panel-details summary {
    @apply cursor-pointer select-none font-medium;
  }

  .prompt-panel-details ul {
    @apply list-disc pl-5 mt-1 space-y-0.5;
  }

  .prompt-panel-details code {
    @apply bg-white px-1 rounded border border-brand-100 text-[11px];
  }

  .prompt-panel-system-title {
    @apply mt-2 mb-1 font-medium;
  }

  .prompt-panel-system {
    @apply text-[11px] leading-relaxed bg-white border border-brand-100 rounded-md p-2 whitespace-pre-wrap max-h-44 overflow-y-auto text-gray-600;
  }

  .prompt-panel-footer {
    @apply flex items-center justify-between gap-2 flex-wrap;
  }

  .prompt-panel-remember {
    @apply flex items-center gap-1.5 text-xs text-brand-800 cursor-pointer;
  }

  .prompt-panel-actions {
    @apply flex items-center gap-2;
  }

  .btn-link {
    @apply text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800;
  }

  .block-btn--danger:hover {
    @apply bg-red-50 text-red-600;
  }

  .editor-block-input {
    @apply w-full px-3 py-2 text-sm font-mono leading-relaxed text-gray-800 border-0 resize-none
           focus:outline-none focus:ring-0;
    min-height: 4.5rem;
  }

  .editor-add-row {
    @apply flex items-center gap-2 flex-wrap text-xs text-gray-500;
  }

  .btn-add {
    @apply px-2.5 py-1 rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-600
           hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors;
  }

  .editor-ai-panel {
    @apply border border-brand-200 bg-brand-50 rounded-lg px-3 py-2.5;
  }

  .editor-ai-title {
    @apply text-sm font-semibold text-brand-800 m-0 mb-2;
  }

  .editor-ai-model {
    @apply text-[0.65rem] font-normal text-brand-600 ml-1;
  }

  .editor-ai-row {
    @apply flex gap-2;
  }

  .editor-ai-row input {
    @apply flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-brand-200 text-sm
           focus:outline-none focus:ring-2 focus:ring-brand-300;
  }

  .editor-ai-hint {
    @apply text-xs text-brand-700 m-0 mt-2;
  }

  /* ── Colonne aperçu ──────────────────────────────────────────────────── */

  .create-preview {
    @apply border border-gray-200 rounded-xl bg-white min-w-0;
    position: sticky;
    top: 0.75rem;
    max-height: calc(100vh - 1.5rem);
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 1023px) {
    .create-preview {
      position: static;
      max-height: none;
    }
  }

  .preview-tabs {
    @apply flex gap-1 px-3 pt-2 border-b border-gray-100 flex-shrink-0;
  }

  .preview-tab {
    @apply px-3 py-1.5 text-sm font-medium text-gray-500 border-b-2 border-transparent
           hover:text-gray-700 transition-colors;
  }

  .preview-tab.is-active {
    @apply text-brand-700 border-brand-500;
  }

  .preview-body {
    @apply p-3 overflow-y-auto;
  }

  .preview-empty {
    @apply text-center text-gray-400 text-sm py-16 px-6;
  }

  .preview-empty-hint {
    @apply text-xs mt-2;
  }

  .preview-source pre {
    @apply text-xs font-mono leading-relaxed text-gray-800 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap;
  }

  /* Encarts d'artefacts dans l'aperçu (générés par texPreview.js) */
  .preview-body :global(.tex-preview-artifact) {
    @apply text-xs text-gray-500 bg-gray-100 border border-dashed border-gray-300 rounded-md px-3 py-2 my-2;
  }

  .preview-body :global(.tex-preview-code) {
    @apply text-xs font-mono bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto;
  }
</style>
