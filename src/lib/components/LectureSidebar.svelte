<!-- src/lib/components/LectureSidebar.svelte -->
<script>
  import MathRenderer from './MathRenderer.svelte';

  export let exercise = {};
  export let similar = [];

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
  $: visibleSimilar = (similar || []).slice(0, 5);
</script>

<aside class="lecture-sidebar print-hidden" aria-label="Informations de l'exercice">
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
      <a class="video-thumb" href={videoUrl} target="_blank" rel="noopener noreferrer">
        <span class="video-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span class="video-meta">
          <span class="video-title">Voir la vidéo</span>
          <span class="video-duration">YouTube</span>
        </span>
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

  .video-thumb {
    position: relative;
    display: block;
    height: 120px;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    text-decoration: none;
    background: linear-gradient(135deg, theme('colors.brand.100'), theme('colors.brand.50'));
  }

  .video-play {
    position: absolute;
    inset: 0;
    width: 44px;
    height: 44px;
    margin: auto;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: white;
    color: theme('colors.brand.700');
    box-shadow: 0 8px 24px rgba(13, 60, 77, 0.16), 0 2px 6px rgba(13, 60, 77, 0.08);
  }

  .video-play svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
    transform: translateX(1px);
  }

  .video-meta {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 8px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: theme('colors.brand.800');
    font-size: 12px;
    font-weight: 500;
  }

  .video-title,
  .video-duration {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
