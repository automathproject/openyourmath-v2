<!-- src/lib/components/ExercisePreview.svelte — PreviewPanel Hi-Fi -->
<script>
  import { browser } from '$app/environment';
  import ExerciseContent from './ExerciseContent.svelte';
  import MathRenderer from './MathRenderer.svelte';
  import AddToListButton from './AddToListButton.svelte';
  import { previewState, layoutActions } from '$lib/stores/searchStore.js';

  function formatDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }

  function hidePanel() {
    layoutActions.setPreviewPanelVisible(false);
  }

  function goToFullPage() {
    if ($previewState.exercise?.uuid && browser) {
      window.open(`/exercise/${$previewState.exercise.uuid}`, '_blank');
    }
  }

  $: exo = $previewState.exercise;
  $: previewDate = formatDate(exo?.updated_at ?? exo?.created_at);

  function difficultyStars(n, max = 4) {
    return Array.from({ length: max }, (_, i) => i < (n ?? 0));
  }
</script>

<div class="preview-panel">

  {#if $previewState.loading}
    <div class="preview-loading">Chargement…</div>

  {:else if $previewState.error}
    <div class="preview-error">
      <p>Erreur de chargement</p>
      <p class="preview-error-msg">{$previewState.error}</p>
    </div>

  {:else if exo}

    <!-- Header chips + title + meta -->
    <div class="preview-head">
      <div class="preview-chips">
        {#if exo.level}
          <span class="chip-level-solid">{exo.level}</span>
        {/if}
        {#if exo.module}
          <span class="chip-soft">{exo.module}</span>
        {/if}
        {#if exo.difficulty}
          <span class="stars" aria-label="difficulté {exo.difficulty}/4">
            {#each difficultyStars(exo.difficulty) as filled}
              <span class={filled ? 'star-on' : 'star-off'}>★</span>
            {/each}
          </span>
        {/if}
        <span class="head-spacer"></span>
        <button class="close-btn" aria-label="Masquer la prévisualisation" on:click={hidePanel}>✕</button>
      </div>

      <h2 class="preview-title">{exo.title ?? 'Exercice'}</h2>

      <div class="preview-meta">
        {#if exo.author}<span>{exo.author}</span>{/if}
        {#if exo.author && previewDate}<span class="meta-sep">·</span>{/if}
        {#if previewDate}<span>mis à jour {previewDate}</span>{/if}
        {#if exo.license_code}
          <span class="meta-sep">·</span>
          <span>{exo.license_code}</span>
        {/if}
      </div>
    </div>

    <!-- Body: exercise content -->
    <div class="preview-body">
      {#if exo.content && exo.content.length > 0}
        <ExerciseContent
          variant="preview"
          showGlobalToggles={false}
          content={exo.content}
        />
      {:else if exo.preview}
        <div class="preview-text-excerpt">
          <div class="section-label">Énoncé</div>
          <div class="excerpt-text">
            <MathRenderer content={exo.preview} />
          </div>
        </div>
      {:else}
        <div class="preview-no-content">Aperçu non disponible.</div>
      {/if}
    </div>

    <!-- Sticky footer actions -->
    <div class="preview-footer">
      <AddToListButton exercise={exo} size="normal" variant="button" />
      <button class="btn-open" on:click={goToFullPage}>
        Ouvrir l'exercice complet →
      </button>
    </div>

  {:else}
    <!-- Empty state -->
    <div class="preview-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <p>Cliquez sur un exercice pour le prévisualiser</p>
    </div>
  {/if}

</div>

<style>
  .preview-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--oym-bg-elev);
    font-family: var(--oym-font-sans);
  }

  /* ── Header ─────────────────────────────────── */
  .preview-head {
    flex-shrink: 0;
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--oym-hairline);
    background: var(--oym-bg-elev);
  }

  .preview-chips {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .head-spacer { flex: 1; }

  .chip-level-solid {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--oym-teal);
    color: white;
    border: 1px solid var(--oym-teal);
    font-size: 11px;
    font-weight: 600;
  }

  .chip-soft {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--oym-line-2);
    background: transparent;
    color: var(--oym-ink-3);
    font-size: 11px;
    font-weight: 500;
  }

  .stars {
    display: inline-flex;
    gap: 1px;
    line-height: 1;
  }

  .star-on  { color: var(--oym-gold); font-size: 12px; }
  .star-off { color: var(--oym-ink-5); font-size: 12px; }

  .close-btn {
    background: none;
    border: none;
    color: var(--oym-ink-3);
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.1s, background 0.1s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: var(--oym-ink);
    background: var(--oym-bg-tint);
  }

  .preview-title {
    font-family: var(--oym-font-serif);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--oym-ink);
    margin: 0 0 8px;
    letter-spacing: -0.2px;
  }

  .preview-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--oym-ink-3);
  }

  .meta-sep { color: var(--oym-ink-5); }

  /* ── Body ────────────────────────────────────── */
  .preview-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 20px 16px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--oym-ink-3);
    margin-bottom: 8px;
  }

  .preview-text-excerpt {
    margin-bottom: 16px;
  }

  .excerpt-text {
    font-family: var(--oym-font-serif);
    font-size: 14px;
    line-height: 1.55;
    color: var(--oym-ink-2);
    margin: 0;
  }

  .preview-no-content {
    font-size: 13px;
    color: var(--oym-ink-3);
    padding: 12px 0;
  }

  /* ── Loading / Error / Empty ─────────────────── */
  .preview-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--oym-ink-3);
    padding: 40px;
  }

  .preview-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 40px 24px;
    text-align: center;
  }

  .preview-error p {
    font-size: 14px;
    font-weight: 600;
    color: var(--oym-ink);
    margin: 0;
  }

  .preview-error-msg {
    font-size: 12px !important;
    font-weight: 400 !important;
    color: var(--oym-ink-3) !important;
  }

  .preview-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 24px;
    color: var(--oym-ink-4);
    text-align: center;
  }

  .preview-empty p {
    font-size: 13px;
    color: var(--oym-ink-3);
    margin: 0;
  }

  /* ── Footer actions ──────────────────────────── */
  .preview-footer {
    flex-shrink: 0;
    padding: 14px 20px;
    border-top: 1px solid var(--oym-hairline);
    background: var(--oym-bg-elev);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-open {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 9px 16px;
    border-radius: 999px;
    border: 1px solid var(--oym-ink);
    background: var(--oym-bg);
    color: var(--oym-ink);
    font-family: var(--oym-font-sans);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .btn-open:hover {
    background: var(--oym-ink);
    color: var(--oym-bg);
  }

  /* Make AddToListButton fill full width in this context */
  :global(.preview-footer .add-to-list-btn),
  :global(.preview-footer button[class*="add"]) {
    width: 100%;
    justify-content: center;
  }
</style>
