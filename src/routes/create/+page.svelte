<!--
  /create — éditeur de création d'exercice.
  Double fenêtre : à gauche les champs structurés (description, question,
  indication, solution) avec assistant LaTeX et assistant IA (API Albert) ;
  à droite le rendu tel qu'il apparaîtra sur le site.
  Export .tex au format des sources de content/exercises/.

  La page porte l'état et la logique métier (blocs, IA, import, export) ;
  chaque section de l'UI est déléguée à un composant dédié sous
  $lib/components/create/ (MetaFields, AiSequencePanel, RevisionPanel,
  ImportPanel, BlockCard, BlockAddRow, PreviewPane).
-->

<script>
  import { tick, onMount } from 'svelte';
  import LatexToolbar from '$lib/components/create/LatexToolbar.svelte';
  import MetaFields from '$lib/components/create/MetaFields.svelte';
  import AiSequencePanel from '$lib/components/create/AiSequencePanel.svelte';
  import RevisionPanel from '$lib/components/create/RevisionPanel.svelte';
  import ImportPanel from '$lib/components/create/ImportPanel.svelte';
  import BlockCard from '$lib/components/create/BlockCard.svelte';
  import BlockAddRow from '$lib/components/create/BlockAddRow.svelte';
  import PreviewPane from '$lib/components/create/PreviewPane.svelte';
  import LatexCompiler from '$lib/components/LatexCompiler.svelte';
  import LatexContentOptions from '$lib/components/LatexContentOptions.svelte';
  import { blocksToPreviewContent } from '$lib/latex/texPreview.js';
  import {
    buildExerciseTex,
    parseExerciseTex,
    generateShortUuid,
    BLOCK_TYPES,
  } from '$lib/latex/exerciseTex.js';
  import { downloadTexFile, generateLatexDocument } from '$lib/latex/export.js';
  import { DEFAULT_TASKS, buildTaskPrompt, buildFixLatexPrompt } from '$lib/ia/assistPrompts.js';
  import { questionBlocksFromAi, limitedSequenceBlocksFromAi } from '$lib/ia/sequence.js';

  const DRAFT_KEY = 'oym-create-draft-v1';
  const IMPORTED_DRAFTS_KEY = 'oym-create-imported-drafts-v1';
  const ACTIVE_IMPORTED_DRAFT_KEY = 'oym-create-active-imported-draft-v1';
  const PROMPTS_KEY = 'oym-create-prompts-v1';
  const LEVELS = ['Seconde', 'Première', 'Terminale', 'L1', 'L2', 'L3', 'M1', 'M2'];

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

  function newBlock(type, latex = '', questionId = null) {
    // indication/réponse portent leur question parente : leur sens ne dépend
    // plus de leur seule position dans la liste.
    return { id: crypto.randomUUID(), type, latex, questionId };
  }

  // ── État ──────────────────────────────────────────────────────────────────
  let meta = $state(emptyMeta());
  let blocks = $state([newBlock('text'), newBlock('question')]);

  let rightTab = $state('preview'); // 'preview' | 'source'
  let finalPreview = $state(null);
  let finalPreviewBusy = $state(false);
  let finalPreviewError = $state('');
  let showMeta = $state(false);
  let showImport = $state(false);
  let showHint = $state(true);
  let showSolution = $state(true);
  let compileMode = $state(false);
  // Configuration du document autonome envoyé au compilateur. Elle est
  // conservée ici pour que tout changement régénère la source affichée.
  let latexContentOptions = $state({
    includeHints: true,
    includeSolutions: true,
    solutionsAtEnd: false,
  });

  let aiInstruction = $state('');
  let aiQuestionCount = $state(3);
  let aiBusyBlockId = $state(null); // id du bloc concerné, ou '__new__'
  let aiBusyKind = $state(null); // mode de l'action IA en cours (pour distinguer les boutons d'un même bloc)
  let aiMetaBusy = $state(null); // clé du champ de métadonnée en cours de suggestion
  let aiError = $state('');
  let revisionInstruction = $state('');
  let revisionBusy = $state(false);
  let revisionProposal = $state(null);

  // Consignes IA par défaut, personnalisables et mémorisées (localStorage)
  let promptTemplates = $state({ ...DEFAULT_TASKS });
  // Panneau de consigne ouvert par ✨ ou TeX : { blockId, mode, isImprove,
  // template, targetLatex, currentLatex, remember }
  let promptPanel = $state(null);
  // Texte d'avant correction LaTeX (bouton TeX), pour pouvoir revenir en arrière :
  // { blockId, previousLatex }
  let fixLatexUndo = $state(null);
  let copied = $state(false);
  let importNotice = $state('');
  let importCandidates = $state([]);
  let importedDrafts = $state([]);
  let activeImportedDraftId = $state(null);

  // Champ actif pour l'assistant LaTeX
  let activeTextarea = null;
  let activeBlockId = null;

  let restored = false;

  /** Blocs dans l'ordre pédagogique attendu par l'export et l'IA. */
  function documentBlocks() {
    const result = [];
    const included = new Set();
    // Les descriptions restent au niveau de l'exercice.
    for (const block of blocks) {
      if (block.type === 'text' || block.type === 'code') {
        result.push(block);
        included.add(block.id);
      }
    }
    for (const question of blocks.filter((b) => b.type === 'question')) {
      result.push(question);
      included.add(question.id);
      for (const child of blocks) {
        if (child.questionId === question.id && (child.type === 'indication' || child.type === 'reponse')) {
          result.push(child);
          included.add(child.id);
        }
      }
    }
    // Conserve les contenus importés dont le parent n'a pas été reconnu.
    return [...result, ...blocks.filter((b) => !included.has(b.id))];
  }

  // ── Aperçu (debounce 300 ms) ──────────────────────────────────────────────
  let previewContent = $state([]);
  $effect(() => {
    const snapshot = documentBlocks().map((b) => ({ id: b.id, type: b.type, latex: b.latex }));
    const timer = setTimeout(() => {
      previewContent = blocksToPreviewContent(snapshot);
    }, 300);
    return () => clearTimeout(timer);
  });

  // Le rendu Pandoc est une vérification ponctuelle : toute modification le
  // rend obsolète et ramène automatiquement à l'aperçu instantané.
  $effect(() => {
    documentBlocks().map((block) => `${block.type}:${block.latex}`);
    finalPreview = null;
    finalPreviewError = '';
  });

  let previewExercise = $derived({
    ...meta,
    difficulty: meta.difficulty ? Number(meta.difficulty) : null,
    artifacts: {},
  });

  let texSource = $derived(
    buildExerciseTex(
      meta,
      documentBlocks().map((b) => ({ type: b.type, latex: b.latex }))
    )
  );

  // Le format OpenYourMath exporté ci-dessus est volontairement un format de
  // contenu, pas un document compilable seul. Cette variante est celle envoyée
  // au compilateur PDF, avec le même contenu et les mêmes macros utiles.
  let latexDocumentSource = $derived(
    generateLatexDocument(
      [{
        uuid: meta.uuid || 'exercice',
        title: meta.title || 'Exercice',
        content: documentBlocks().map((block, index) => ({
          type: block.type,
          latex: block.latex,
          order: index + 1,
        })),
      }],
      meta.title || 'Exercice',
      latexContentOptions,
    )
  );
  let latexDocumentFilename = $derived(`${(meta.uuid || 'exercice').replace(/[^a-z0-9_-]/gi, '_')}.tex`);

  let questionCount = $derived(blocks.filter((b) => b.type === 'question' && b.latex.trim()).length);
  // Liste affichée (ordre pédagogique) : figée une fois par rendu pour que
  // le repère "dernier bloc d'un groupe de question" (docBlocks[i+1]) reste
  // cohérent avec ce qui est effectivement affiché.
  let docBlocks = $derived(documentBlocks());

  /** Vrai si `list[i]` est le dernier bloc du groupe question/indication/solution auquel il appartient. */
  function isLastOfQuestionGroup(list, i) {
    const block = list[i];
    const next = list[i + 1];
    if (block.type === 'question') return !(next && next.questionId === block.id);
    if (block.questionId) return !(next && next.questionId === block.questionId);
    return false;
  }

  /** Libellé "liée à la question N" affiché sur un bloc rattaché, ou null. */
  function parentLabelFor(block) {
    if (!block.questionId) return null;
    const index = blocks.filter((b) => b.type === 'question').findIndex((b) => b.id === block.questionId);
    return `liée à la question ${index + 1}`;
  }

  // ── Brouillon localStorage ────────────────────────────────────────────────
  function cloneBlocks(source) {
    const ids = new Map();
    const cloned = (source || []).map((block) => {
      const copy = newBlock(block.type || 'text', block.latex || '');
      if (block.id) ids.set(block.id, copy.id);
      return copy;
    });
    cloned.forEach((block, index) => {
      const sourceBlock = source[index];
      block.questionId = ids.get(sourceBlock.questionId) || null;
    });
    return cloned;
  }

  function blocksFromParsed(parsedBlocks) {
    let lastQuestionId = null;
    return parsedBlocks.map((block) => {
      const copy = newBlock(
        block.type,
        block.latex,
        (block.type === 'indication' || block.type === 'reponse') ? lastQuestionId : null,
      );
      if (block.type === 'question') lastQuestionId = copy.id;
      return copy;
    });
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.meta && Array.isArray(draft?.blocks)) {
          meta = { ...emptyMeta(), ...draft.meta };
          let lastQuestionId = null;
          blocks = draft.blocks.map((b) => {
            const type = b.type || 'text';
            const block = newBlock(type, b.latex || '', b.questionId || null);
            if (type === 'question') lastQuestionId = block.id;
            // Migration des anciens brouillons, où le rattachement était implicite.
            if ((type === 'indication' || type === 'reponse') && !block.questionId) block.questionId = lastQuestionId;
            return block;
          });
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
    try {
      const rawImported = localStorage.getItem(IMPORTED_DRAFTS_KEY);
      if (rawImported) {
        const parsed = JSON.parse(rawImported);
        if (Array.isArray(parsed)) importedDrafts = parsed;
      }
      activeImportedDraftId = localStorage.getItem(ACTIVE_IMPORTED_DRAFT_KEY) || null;
    } catch {
      // liste de brouillons importés corrompue : ignorée
    }
    restored = true;
  });

  $effect(() => {
    const payload = JSON.stringify({
      meta: { ...meta },
      blocks: blocks.map((b) => ({ type: b.type, latex: b.latex, questionId: b.questionId || null })),
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
  function addBlock(type, afterId = null, questionId = null) {
    const block = newBlock(type, '', questionId);
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
    if (idx === -1) return;
    const [removed] = blocks.splice(idx, 1);
    if (removed.type === 'question') {
      blocks = blocks.filter((b) => b.questionId !== removed.id);
    }
    if (fixLatexUndo?.blockId === id) fixLatexUndo = null;
    if (promptPanel?.blockId === id) promptPanel = null;
  }

  function moveBlock(id, delta) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const siblings = blockSiblings(block);
    const siblingIndex = siblings.findIndex((b) => b.id === id);
    const siblingTarget = siblingIndex + delta;
    if (siblingTarget < 0 || siblingTarget >= siblings.length) return;
    const target = siblings[siblingTarget];
    const idx = blocks.findIndex((b) => b.id === id);
    const targetIndex = blocks.findIndex((b) => b.id === target.id);
    [blocks[idx], blocks[targetIndex]] = [blocks[targetIndex], blocks[idx]];
  }

  function blockSiblings(block) {
    if (block.type === 'question') return blocks.filter((b) => b.type === 'question');
    if (block.questionId) return blocks.filter((b) => b.questionId === block.questionId);
    return blocks.filter((b) => !b.questionId && b.type !== 'question');
  }

  function canMoveBlock(block, delta) {
    const index = blockSiblings(block).findIndex((b) => b.id === block.id);
    const target = index + delta;
    return target >= 0 && target < blockSiblings(block).length;
  }

  /** Question précédant le bloc d'index donné (pour indication/solution). */
  function precedingQuestion(index) {
    const block = blocks[index];
    if (block?.questionId) return blocks.find((b) => b.id === block.questionId) || null;
    for (let i = index; i >= 0; i--) {
      if (blocks[i].type === 'question' && blocks[i].latex.trim()) return blocks[i];
    }
    return null;
  }

  /** Index d'insertion après la question `qIndex` et ses indications/solutions. */
  function insertIndexAfterGroup(qIndex) {
    const question = blocks[qIndex];
    let i = qIndex + 1;
    while (i < blocks.length && blocks[i].questionId === question?.id) i++;
    return i;
  }

  function addChildBlock(questionBlock, type) {
    const qIndex = blocks.findIndex((b) => b.id === questionBlock.id);
    if (qIndex === -1) return;
    const block = newBlock(type, '', questionBlock.id);
    blocks.splice(insertIndexAfterGroup(qIndex), 0, block);
    tick().then(() => document.getElementById(`block-ta-${block.id}`)?.focus());
  }

  /**
   * Change le type d'un bloc via le sélecteur, en gardant `questionId`
   * cohérent avec le nouveau type (sinon la mention "liée à la question X"
   * et le regroupement des blocs peuvent devenir incorrects) :
   * - un bloc question/texte/code n'est jamais "lié" à une autre question ;
   * - une indication/solution qui perd son lien (nouveau type, ou question
   *   parente elle-même requalifiée) se rattache à la question précédente ;
   * - une question requalifiée libère les blocs qui lui étaient rattachés.
   */
  function changeBlockType(block, newType) {
    const previousType = block.type;
    if (previousType === newType) return;

    if (previousType === 'question') {
      for (const child of blocks) {
        if (child.questionId === block.id) child.questionId = null;
      }
    }

    block.type = newType;

    if (newType === 'indication' || newType === 'reponse') {
      const stillValid =
        block.questionId && blocks.some((b) => b.id === block.questionId && b.type === 'question');
      if (!stillValid) {
        const idx = blocks.findIndex((b) => b.id === block.id);
        let question = null;
        for (let i = idx; i >= 0; i--) {
          if (blocks[i].type === 'question' && blocks[i].latex.trim()) {
            question = blocks[i];
            break;
          }
        }
        block.questionId = question ? question.id : null;
      }
    } else {
      block.questionId = null;
    }
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

  async function verifyFinalPreview() {
    if (finalPreviewBusy || !blocks.some((block) => block.latex.trim())) return;
    finalPreviewBusy = true;
    finalPreviewError = '';
    try {
      const res = await fetch('/api/create/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: documentBlocks().map((block) => ({ type: block.type, latex: block.latex })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
      finalPreview = data.content;
      rightTab = 'preview';
    } catch (err) {
      finalPreviewError = err.message;
    } finally {
      finalPreviewBusy = false;
    }
  }

  // ── Assistant IA (API Albert) ─────────────────────────────────────────────
  async function callAssist(mode, { targetLatex = '', instruction = '', taskPrompt = '', field = '', questionCount = null } = {}) {
    const res = await fetch('/api/create/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        meta: { ...meta },
        blocks: documentBlocks().map((b) => ({ type: b.type, latex: b.latex })),
        targetLatex,
        instruction,
        taskPrompt,
        field,
        questionCount,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
    return data.latex;
  }

  async function requestRevision() {
    if (revisionBusy) return;
    if (!revisionInstruction.trim()) {
      aiError = 'Décrivez la modification à répercuter.';
      return;
    }
    if (!blocks.some((block) => block.latex.trim())) {
      aiError = 'Rédigez ou générez d’abord un exercice à réviser.';
      return;
    }
    aiError = '';
    revisionBusy = true;
    try {
      const res = await fetch('/api/create/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'revise',
          meta: { ...meta },
          blocks: documentBlocks().map((block) => ({ type: block.type, latex: block.latex })),
          instruction: revisionInstruction,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
      revisionProposal = { blocks: data.blocks };
    } catch (err) {
      aiError = err.message;
    } finally {
      revisionBusy = false;
    }
  }

  function revisionChanges() {
    if (!revisionProposal) return [];
    const before = documentBlocks();
    return revisionProposal.blocks
      .map((block, index) => ({ before: before[index], after: block, index }))
      .filter(({ before, after }) => !before || before.type !== after.type || before.latex.trim() !== after.latex.trim());
  }

  let revisionChangesList = $derived(revisionChanges());

  function applyRevisionProposal() {
    if (!revisionProposal) return;
    const changeCount = revisionChangesList.length;
    blocks = blocksFromParsed(revisionProposal.blocks);
    importNotice = `✅ Modification répercutée sur l’exercice (${changeCount} bloc${changeCount > 1 ? 's' : ''} modifié${changeCount > 1 ? 's' : ''}).`;
    revisionProposal = null;
    revisionInstruction = '';
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

    if (promptPanel?.blockId === block.id && promptPanel?.mode === block.type) {
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

  /**
   * Corrige directement la syntaxe LaTeX d'un bloc (bouton TeX), sans passer par le
   * panneau de consigne : c'est une correction mécanique, pas une rédaction,
   * inutile de faire valider le prompt à chaque fois. Le texte d'avant
   * correction reste en mémoire (fixLatexUndo) pour pouvoir revenir en
   * arrière.
   */
  async function aiFixLatex(block) {
    if (aiBusyBlockId) return;
    if (!block.latex.trim()) {
      aiError = 'Rédigez d’abord ce bloc avant de corriger son LaTeX.';
      return;
    }
    aiError = '';
    aiBusyBlockId = block.id;
    aiBusyKind = 'fixlatex';
    const previousLatex = block.latex;
    try {
      const taskPrompt = buildFixLatexPrompt({
        template: promptTemplates.fixlatex,
        content: previousLatex,
      });
      const latex = await callAssist('fixlatex', { targetLatex: previousLatex, taskPrompt });
      block.latex = latex;
      fixLatexUndo = { blockId: block.id, previousLatex };
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
      aiBusyKind = null;
    }
  }

  /** Revient au texte d'avant la dernière correction LaTeX de ce bloc. */
  function undoFixLatex(block) {
    if (fixLatexUndo?.blockId !== block.id) return;
    block.latex = fixLatexUndo.previousLatex;
    fixLatexUndo = null;
  }

  /**
   * Ouvre le panneau de consigne pour la correction LaTeX d'un bloc :
   * option pour surcharger le prompt quand le résultat par défaut (TeX) ne
   * convient pas. Repart du texte d'avant la dernière correction s'il y en
   * a une en mémoire, sinon du contenu actuel. Aucun contexte d'exercice
   * n'est joint (voir buildFixLatexPrompt).
   */
  function openFixLatexPanel(block) {
    if (aiBusyBlockId) return;
    aiError = '';

    const target = fixLatexUndo?.blockId === block.id ? fixLatexUndo.previousLatex : block.latex;
    if (!target.trim()) {
      aiError = 'Rédigez d’abord ce bloc avant de corriger son LaTeX.';
      return;
    }

    if (promptPanel?.blockId === block.id && promptPanel?.mode === 'fixlatex') {
      promptPanel = null; // second clic : referme
      return;
    }

    promptPanel = {
      blockId: block.id,
      mode: 'fixlatex',
      isImprove: false,
      template: promptTemplates.fixlatex,
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
    aiBusyKind = panel.mode;
    try {
      const isFixLatex = panel.mode === 'fixlatex';
      const taskPrompt = isFixLatex
        ? buildFixLatexPrompt({ template: panel.template, content: panel.targetLatex })
        : buildTaskPrompt(panel.mode, {
            template: panel.template,
            targetLatex: panel.targetLatex,
            currentLatex: block.latex,
          });
      const latex = await callAssist(panel.mode, {
        targetLatex: panel.targetLatex,
        taskPrompt,
      });

      if (!isFixLatex && block.type === 'question') {
        const { text, questions } = questionBlocksFromAi(latex);
        block.latex = questions[0];
        if (text) {
          blocks.splice(blocks.findIndex((b) => b.id === block.id), 0, newBlock('text', text));
        }
        if (questions.length > 1) {
          const insertAt = blocks.findIndex((b) => b.id === block.id) + 1;
          blocks.splice(insertAt, 0, ...questions.slice(1).map((q) => newBlock('question', q)));
        }
      } else if (isFixLatex) {
        // Repart toujours du texte d'origine (panel.targetLatex), pas du
        // dernier essai : la correction ne s'accumule jamais.
        block.latex = latex;
        fixLatexUndo = { blockId: block.id, previousLatex: panel.targetLatex };
      } else {
        block.latex = latex;
      }
      promptPanel = null;
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
      aiBusyKind = null;
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
    aiBusyKind = type;
    try {
      const latex = await callAssist(type, { targetLatex: questionBlock.latex });
      const qIndex = blocks.findIndex((b) => b.id === questionBlock.id);
      blocks.splice(insertIndexAfterGroup(qIndex), 0, newBlock(type, latex, questionBlock.id));
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
      aiBusyKind = null;
    }
  }

  /** Génère une séquence de questions cohérentes en fin d'exercice. */
  async function aiGenerateSequence() {
    if (aiBusyBlockId) return;
    aiError = '';
    aiBusyBlockId = '__new__';
    aiBusyKind = 'sequence';
    try {
      const count = Math.max(1, Math.min(8, Number(aiQuestionCount) || 3));
      aiQuestionCount = count;
      const singleQuestionRule = count === 1
        ? ' Cette question unique réunit les données et l’objectif à démontrer ou calculer, sans étape intermédiaire ni résultat donné en cours de route.'
        : '';
      const instruction = `${aiInstruction.trim()}\n\nCONTRAINTE DE SORTIE NON NÉGOCIABLE : rédige un exercice complet avec exactement ${count} questions, ni plus ni moins. Chaque question doit contenir ou exploiter des données et notations déjà définies ; n'ajoute ni titre, ni préambule, ni conclusion, ni question supplémentaire. Structure strictement linéaire : chaque question porte UNE consigne, sans sous-question ni sous-partie (a), (b), (c) ni étape numérotée à l'intérieur d'un énoncé.${singleQuestionRule} Sépare chaque question par une ligne contenant uniquement --- .`;
      const latex = await callAssist('sequence', { instruction, questionCount: count });
      const { text, questions } = limitedSequenceBlocksFromAi(latex, count);
      if (text) blocks.push(newBlock('text', text));
      for (const q of questions) blocks.push(newBlock('question', q));
      // La consigne reste affichée après génération : l'auteur la retouche
      // pour relancer une variante plutôt que de la retaper.
    } catch (err) {
      aiError = err.message;
    } finally {
      aiBusyBlockId = null;
      aiBusyKind = null;
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────
  function handleImported(texSources, sourceLabel) {
    const candidates = texSources.map((tex, index) => {
      const { meta: parsedMeta, blocks: parsedBlocks } = parseExerciseTex(tex);
      if (parsedBlocks.length === 0) return null;
      const meta = {
        ...emptyMeta(),
        ...parsedMeta,
        uuid: parsedMeta.uuid || generateShortUuid(),
        created_at: parsedMeta.created_at || today(),
      };
      return {
        id: crypto.randomUUID(),
        selected: true,
        label: parsedMeta.title || `Exercice ${index + 1}`,
        meta,
        blocks: blocksFromParsed(parsedBlocks),
      };
    }).filter(Boolean);
    if (!candidates.length) {
      importNotice = `⚠️ Aucun exercice reconnu dans « ${sourceLabel} ».`;
      return;
    }
    importCandidates = candidates;
    importNotice = candidates.length > 1
      ? `✅ ${candidates.length} exercices détectés dans « ${sourceLabel} » : choisissez les brouillons à conserver.`
      : `✅ Un exercice détecté dans « ${sourceLabel} » : confirmez sa création.`;
  }

  function persistImportedDrafts() {
    try {
      localStorage.setItem(IMPORTED_DRAFTS_KEY, JSON.stringify(importedDrafts));
    } catch {
      aiError = 'Impossible d’enregistrer les brouillons importés localement.';
    }
  }

  function openImportedDraft(draft, askConfirmation = true) {
    const hasContent = blocks.some((b) => b.latex.trim()) || meta.title;
    if (askConfirmation && hasContent && !confirm('Remplacer l’exercice en cours par ce brouillon importé ?')) {
      return;
    }
    meta = { ...emptyMeta(), ...draft.meta };
    blocks = cloneBlocks(draft.blocks);
    activeImportedDraftId = draft.id;
    try {
      localStorage.setItem(ACTIVE_IMPORTED_DRAFT_KEY, draft.id);
    } catch { /* non bloquant */ }
    importNotice = `✅ Brouillon « ${draft.label} » ouvert — relisez et corrigez avant export.`;
    showImport = false;
    showMeta = true;
  }

  function saveSelectedImports() {
    const selected = importCandidates.filter((candidate) => candidate.selected);
    if (!selected.length) {
      importNotice = 'Sélectionnez au moins un exercice à conserver.';
      return;
    }
    const savedAt = new Date().toISOString();
    const drafts = selected.map((candidate) => ({
      ...candidate,
      selected: undefined,
      savedAt,
    }));
    importedDrafts = [...drafts, ...importedDrafts];
    persistImportedDrafts();
    importCandidates = [];
    openImportedDraft(drafts[0]);
    importNotice = `✅ ${drafts.length} brouillon${drafts.length > 1 ? 's' : ''} importé${drafts.length > 1 ? 's' : ''}. Le premier est ouvert.`;
  }

  function deleteImportedDraft(id) {
    importedDrafts = importedDrafts.filter((draft) => draft.id !== id);
    if (activeImportedDraftId === id) {
      activeImportedDraftId = null;
      try {
        localStorage.removeItem(ACTIVE_IMPORTED_DRAFT_KEY);
      } catch { /* non bloquant */ }
    }
    persistImportedDrafts();
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
      localStorage.removeItem(ACTIVE_IMPORTED_DRAFT_KEY);
      activeImportedDraftId = null;
    } catch { /* ignoré */ }
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
      <button type="button" class="editor-btn-secondary" onclick={() => (showImport = !showImport)}>
        📄 Importer (PDF, image, .tex)
      </button>
      <button
        type="button"
        class="editor-btn-primary"
        disabled={!blocks.some((b) => b.latex.trim()) && !compileMode}
        onclick={() => (compileMode = !compileMode)}
      >
        {compileMode ? '← Revenir à l’éditeur' : '▣ Compiler le PDF'}
      </button>
      <button type="button" class="editor-btn-secondary" onclick={copyTex}>
        {copied ? '✅ Copié' : '⧉ Copier le .tex'}
      </button>
      <button type="button" class="editor-btn-primary" onclick={exportTex} disabled={!blocks.some((b) => b.latex.trim())}>
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

  <ImportPanel
    show={showImport}
    notice={importNotice}
    candidates={importCandidates}
    {importedDrafts}
    {activeImportedDraftId}
    onImported={handleImported}
    onCancelCandidates={() => (importCandidates = [])}
    onSaveSelected={saveSelectedImports}
    onOpenDraft={openImportedDraft}
    onDeleteDraft={deleteImportedDraft}
  />

  <div class="create-layout">
    <div class="create-workspace" hidden={compileMode}>
      <!-- ── Colonne gauche : édition ───────────────────────────────────── -->
      <section class="create-editor" aria-label="Édition de l'exercice">
      <MetaFields bind:showMeta {meta} levels={LEVELS} {aiMetaBusy} onSuggest={aiFillMeta} />

      {#if aiError}
        <p class="editor-ai-error" role="alert">
          {aiError}
          <button type="button" onclick={() => (aiError = '')} aria-label="Fermer">✕</button>
        </p>
      {/if}

      <AiSequencePanel
        {meta}
        bind:aiInstruction
        bind:aiQuestionCount
        {aiBusyBlockId}
        onGenerate={aiGenerateSequence}
      />

      <RevisionPanel
        bind:revisionInstruction
        busy={revisionBusy}
        proposal={revisionProposal}
        changes={revisionChangesList}
        onRequest={requestRevision}
        onApply={applyRevisionProposal}
        onCancel={() => (revisionProposal = null)}
      />

      <div class="editor-toolbar-sticky">
        <LatexToolbar oninsert={insertSnippet} />
      </div>

      <div class="editor-blocks">
        {#each docBlocks as block, i (block.id)}
          <BlockCard
            {block}
            parentLabel={parentLabelFor(block)}
            {promptPanel}
            {aiBusyBlockId}
            {aiBusyKind}
            {fixLatexUndo}
            canMoveUp={canMoveBlock(block, -1)}
            canMoveDown={canMoveBlock(block, 1)}
            onChangeType={changeBlockType}
            onOpenPromptPanel={openPromptPanel}
            onFixLatex={aiFixLatex}
            onUndoFixLatex={undoFixLatex}
            onOpenFixLatexPanel={openFixLatexPanel}
            onClosePromptPanel={() => (promptPanel = null)}
            onResetPromptTemplate={resetPromptTemplate}
            onGenerateFromPanel={generateFromPanel}
            onMoveUp={(b) => moveBlock(b.id, -1)}
            onMoveDown={(b) => moveBlock(b.id, 1)}
            onRemove={(b) => removeBlock(b.id)}
            onFocus={registerFocus}
            onInput={(b) => { if (fixLatexUndo?.blockId === b.id) fixLatexUndo = null; }}
          />

          {#if isLastOfQuestionGroup(docBlocks, i)}
            {@const questionBlock = block.type === 'question' ? block : blocks.find((b) => b.id === block.questionId)}
            {#if questionBlock}
              <BlockAddRow
                {questionBlock}
                {aiBusyBlockId}
                {aiBusyKind}
                onGenerateIndication={(qb) => aiAddForQuestion(qb, 'indication')}
                onGenerateSolution={(qb) => aiAddForQuestion(qb, 'reponse')}
                onAddIndication={(qb) => addChildBlock(qb, 'indication')}
                onAddSolution={(qb) => addChildBlock(qb, 'reponse')}
              />
            {/if}
          {/if}
        {/each}
      </div>

      <div class="editor-add-row">
        <span>Édition manuelle :</span>
        {#each BLOCK_TYPES.filter((bt) => bt.type === 'text' || bt.type === 'question') as bt}
          <button type="button" class="btn-add" onclick={() => addBlock(bt.type)}>+ {bt.label}</button>
        {/each}
        <span class="editor-add-hint">Ajoutez les indications et solutions depuis la question concernée.</span>
      </div>
      </section>

      <!-- ── Colonne droite : rendu ─────────────────────────────────────── -->
      <PreviewPane
        bind:rightTab
        {previewExercise}
        {previewContent}
        {finalPreview}
        {finalPreviewBusy}
        {finalPreviewError}
        {texSource}
        hasContent={blocks.some((b) => b.latex.trim())}
        bind:showHint
        bind:showSolution
        onVerify={verifyFinalPreview}
      />
    </div>

    <div
      class="create-compiler-workspace"
      hidden={!compileMode}
      role="dialog"
      aria-modal="true"
      aria-labelledby="latex-compiler-title"
      tabindex="-1"
    >
      <div class="compiler-overlay-header">
        <div>
          <h2 id="latex-compiler-title">Compilation LaTeX</h2>
          <p>Vérifiez le source à gauche et le PDF compilé à droite.</p>
        </div>
        <button type="button" class="editor-btn-secondary" onclick={() => (compileMode = false)}>
          ← Revenir à l’éditeur
        </button>
      </div>
      <div class="compiler-document-options">
        <LatexContentOptions
          bind:includeHints={latexContentOptions.includeHints}
          bind:includeSolutions={latexContentOptions.includeSolutions}
          bind:solutionsAtEnd={latexContentOptions.solutionsAtEnd}
          compact
        />
      </div>
      <LatexCompiler source={latexDocumentSource} filename={latexDocumentFilename} />
    </div>
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

  .editor-btn-primary {
    @apply px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium
           hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .editor-btn-secondary {
    @apply px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-sm font-medium
           hover:bg-gray-50 transition-colors;
  }

  .btn-ghost-danger {
    @apply px-2.5 py-1.5 rounded-md text-gray-400 text-sm hover:text-red-600 hover:bg-red-50 transition-colors;
  }

  .create-layout {
    min-width: 0;
  }

  .create-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  .create-compiler-workspace {
    position: fixed;
    inset: 0;
    z-index: 100;
    overflow-y: auto;
    @apply bg-gray-50 p-4 sm:p-6;
  }

  .compiler-overlay-header {
    @apply flex max-w-[1800px] items-start justify-between gap-4 mx-auto mb-4;
  }

  .compiler-overlay-header h2 {
    @apply text-lg font-bold text-gray-900;
  }

  .compiler-overlay-header p {
    @apply mt-0.5 text-sm text-gray-500;
  }

  .create-compiler-workspace :global(.latex-compiler) {
    max-width: 1800px;
    margin: 0 auto;
  }

  .compiler-document-options {
    @apply max-w-[1800px] mx-auto mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3;
  }

  @media (max-width: 1023px) {
    .create-workspace {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* ── Colonne édition ─────────────────────────────────────────────────── */

  .create-editor {
    @apply flex flex-col gap-3 min-w-0;
  }

  .editor-toolbar-sticky {
    position: sticky;
    top: 0.5rem;
    z-index: 10;
    order: 3;
  }

  .editor-ai-error {
    @apply flex items-start justify-between gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2;
    order: 4;
  }

  .editor-blocks {
    @apply flex flex-col gap-2.5;
    order: 5;
  }

  .editor-add-row {
    @apply flex items-center gap-2 flex-wrap text-xs text-gray-500;
    order: 6;
  }

  .editor-add-hint {
    @apply text-[11px] text-gray-400;
  }

  .btn-add {
    @apply px-2.5 py-1 rounded-full border border-gray-300 bg-white text-xs font-medium text-gray-600
           hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors;
  }
</style>
