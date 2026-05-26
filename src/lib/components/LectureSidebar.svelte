<!-- src/lib/components/LectureSidebar.svelte -->
<script>
  import MathRenderer from './MathRenderer.svelte';

  export let exercise = {};
  export let similar = [];
  export let showHint = false;
  export let showSolution = false;
  export let showInlineControls = true;

  function formatDisplayDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR');
  }

  function extractYoutubeId(ex) {
    const rawValue = ex?.artifacts?.video ?? ex?.video_id ?? ex?.videoId;
    if (!rawValue) return '';

    const trimmed = String(rawValue).trim();
    if (!trimmed) return '';

    try {
      const asUrl = new URL(trimmed);
      const host = asUrl.hostname.toLowerCase();

      if (host.includes('youtube.com')) {
        return asUrl.searchParams.get('v') || asUrl.pathname.split('/').filter(Boolean).at(-1) || '';
      }

      if (host.includes('youtu.be')) {
        return asUrl.pathname.split('/').filter(Boolean).at(-1) || '';
      }
    } catch (err) {
      // A bare YouTube id is valid for this component.
    }

    return /^[a-zA-Z0-9_-]{6,}$/.test(trimmed) ? trimmed : '';
  }

  $: createdAt = formatDisplayDate(exercise?.created_at ?? exercise?.createdAt);
  $: updatedAt = formatDisplayDate(exercise?.updated_at ?? exercise?.updatedAt);
  $: licenseLabel = exercise?.license_code || exercise?.license || '';
  $: videoId = extractYoutubeId(exercise);
  $: videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
  $: videoEmbedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : '';
  $: visibleSimilar = (similar || []).slice(0, 5);
</script>

<aside class="lecture-sidebar print-hidden" aria-label="Informations de l'exercice">
  {#if exercise?.hasIndication || exercise?.hasSolution}
    <section class="sidebar-section display-section" aria-labelledby="lecture-display-title">
      <h2 id="lecture-display-title" class="t-overline sidebar-heading">Affichage</h2>
      <div class="display-controls" aria-label="Contrôles d'affichage du contenu">
        <label class="display-toggle">
          <span>Boutons</span>
          <input type="checkbox" bind:checked={showInlineControls} />
          <span class="display-switch" aria-hidden="true"></span>
        </label>

        {#if exercise?.hasIndication}
          <button
            type="button"
            class="reveal-button reveal-button--hint"
            class:active={showHint}
            aria-pressed={showHint}
            on:click={() => showHint = !showHint}
          >
            <span>Tout révéler : indices</span>
            {#if showHint}<span class="reveal-check" aria-hidden="true">✓</span>{/if}
          </button>
        {/if}

        {#if exercise?.hasSolution}
          <button
            type="button"
            class="reveal-button reveal-button--solution"
            class:active={showSolution}
            aria-pressed={showSolution}
            on:click={() => showSolution = !showSolution}
          >
            <span>Tout révéler : solutions</span>
            {#if showSolution}<span class="reveal-check" aria-hidden="true">✓</span>{/if}
          </button>
        {/if}
      </div>
    </section>
  {/if}

  <section class="sidebar-section" aria-labelledby="lecture-meta-title">
    <h2 id="lecture-meta-title" class="t-overline sidebar-heading">Métadonnées</h2>
    <dl class="metadata-grid">
      {#if exercise?.author}
        <dt>Auteur</dt>
        <dd>{exercise.author}</dd>
      {/if}

      {#if licenseLabel}
        <dt>Licence</dt>
        <dd>
          {#if exercise?.license_url}
            <a href={exercise.license_url} target="_blank" rel="noopener noreferrer">{licenseLabel}</a>
          {:else}
            {licenseLabel}
          {/if}
        </dd>
      {/if}

      {#if createdAt}
        <dt>Créé</dt>
        <dd>{createdAt}</dd>
      {/if}

      {#if updatedAt}
        <dt>Modifié</dt>
        <dd>{updatedAt}</dd>
      {/if}

      {#if exercise?.uuid}
        <dt>UUID</dt>
        <dd class="metadata-uuid">{exercise.uuid}</dd>
      {/if}
    </dl>
  </section>

  {#if videoUrl}
    <section class="sidebar-section" aria-labelledby="lecture-video-title">
      <h2 id="lecture-video-title" class="t-overline sidebar-heading">Vidéo associée</h2>
      <div class="video-embed">
        <iframe
          src={videoEmbedUrl}
          title="Vidéo associée à l'exercice"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
      <a class="video-direct-link" href={videoUrl} target="_blank" rel="noopener noreferrer">
        Ouvrir sur YouTube
      </a>
    </section>
  {/if}

  {#if visibleSimilar.length > 0}
    <section class="sidebar-section" aria-labelledby="lecture-similar-title">
      <h2 id="lecture-similar-title" class="t-overline sidebar-heading">Exercices similaires</h2>
      <ul class="similar-list">
        {#each visibleSimilar as item}
          <li>
            <a href="/exercise/{item.uuid}" class="similar-link">
              {#if item.level}
                <span class="chip chip-soft similar-chip">{item.level}</span>
              {/if}
              <span class="similar-title">
                <MathRenderer content={item.title} inline={true} />
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</aside>

<style>
  .lecture-sidebar {
    --gold: theme('colors.warning.500');
    --gold-100: theme('colors.warning.100');
    --teal: theme('colors.brand.600');
    --teal-50: theme('colors.brand.50');
    width: 300px;
    position: sticky;
    top: 0;
    align-self: stretch;
    min-height: calc(100vh - theme('spacing.header') - 256px);
    max-height: 100vh;
    overflow-y: auto;
    background: #f7f1e4;
    border-left: 1px solid theme('colors.interface.border-primary');
    padding: 32px 24px 48px;
  }

  .sidebar-section {
    padding: 22px 0;
    border-bottom: 1px solid theme('colors.interface.border-primary');
  }

  .sidebar-section:first-child {
    padding-top: 0;
  }

  .sidebar-section:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .sidebar-heading {
    margin: 0 0 12px;
  }

  .display-section {
    padding-top: 0;
  }

  .display-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .display-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid theme('colors.interface.border-primary');
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.58);
    color: theme('colors.interface.text-secondary');
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    user-select: none;
  }

  .display-toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .display-switch {
    position: relative;
    flex: 0 0 auto;
    width: 34px;
    height: 20px;
    border-radius: 999px;
    background: theme('colors.interface.border-primary');
    transition: background 0.16s ease;
  }

  .display-switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: white;
    box-shadow: 0 1px 3px rgba(13, 60, 77, 0.2);
    transition: transform 0.16s ease;
  }

  .display-toggle input:checked + .display-switch {
    background: var(--teal);
  }

  .display-toggle input:checked + .display-switch::after {
    transform: translateX(14px);
  }

  .display-toggle:focus-within {
    outline: 2px solid theme('colors.brand.300');
    outline-offset: 2px;
  }

  .reveal-button {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: theme('colors.interface.bg-white');
    color: theme('colors.interface.text-secondary');
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
  }

  .reveal-button--hint {
    border-color: theme('colors.warning.200');
    color: theme('colors.warning.700');
  }

  .reveal-button--hint.active {
    background: var(--gold-100);
    border-color: var(--gold);
    color: theme('colors.warning.800');
  }

  .reveal-button--solution {
    border-color: theme('colors.brand.200');
    color: theme('colors.brand.700');
  }

  .reveal-button--solution.active {
    background: var(--teal-50);
    border-color: var(--teal);
    color: theme('colors.brand.800');
  }

  .reveal-check {
    flex: 0 0 auto;
    font-weight: 800;
    line-height: 1;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 12px;
    row-gap: 8px;
    margin: 0;
  }

  .metadata-grid dt {
    color: theme('colors.interface.text-muted');
    font-size: 12px;
    line-height: 1.4;
    font-weight: 500;
  }

  .metadata-grid dd {
    min-width: 0;
    margin: 0;
    color: theme('colors.interface.text-primary');
    font-size: 13px;
    line-height: 1.35;
  }

  .metadata-grid a {
    color: theme('colors.brand.700');
    text-decoration: none;
  }

  .metadata-grid a:hover {
    text-decoration: underline;
  }

  .metadata-uuid {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 11px !important;
    word-break: break-all;
    color: theme('colors.interface.text-muted') !important;
  }

  .video-embed {
    position: relative;
    display: block;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: theme('colors.interface.bg-tertiary');
    box-shadow: inset 0 0 0 1px theme('colors.interface.border-primary');
  }

  .video-embed iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .video-direct-link {
    display: inline-flex;
    margin-top: 8px;
    color: theme('colors.brand.700');
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    text-decoration: none;
  }

  .video-direct-link:hover {
    text-decoration: underline;
  }

  .similar-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .similar-link {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 0;
    color: theme('colors.interface.text-primary');
    text-decoration: none;
  }

  .similar-link:hover .similar-title {
    color: theme('colors.brand.700');
  }

  .similar-chip {
    flex: 0 0 auto;
    padding: 2px 7px;
    font-size: 10px;
    line-height: 1.2;
  }

  .similar-title {
    min-width: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1.25;
    transition: color 0.15s ease;
  }

  @media (max-width: 900px) {
    .lecture-sidebar {
      display: none;
    }
  }
</style>
