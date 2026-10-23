<!-- src/lib/components/prepa/PrepaNoeud.svelte
     Une section (ou sous-section) d'un programme de CPGE : son texte officiel,
     ses subdivisions et les exercices qui s'y rattachent, descendants compris. -->
<script>
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import ExerciseRowCard from '$lib/components/ExerciseRowCard.svelte';
  import { celluleCpge, markdownCpge } from '$lib/utils/cpgeTexte.js';

  export let noeud;
  export let page = 1;
  export let parPage = 50;

  const lien = id => `/browse?vue=prepa&noeud=${encodeURIComponent(id)}`;
  $: pages = Math.max(1, Math.ceil(noeud.liste.total / parPage));
  $: texteHtml = markdownCpge(noeud.texte);
  $: contenus = (noeud.contenus || []).filter(c => c.contenu || c.commentaire);
</script>

<article class="prepa-noeud">
  <nav class="prepa-fil" aria-label="Fil d’Ariane">
    <a href="/browse?vue=prepa&programme={noeud.programme.programme}">{noeud.programme.filieres.join(' · ')}</a>
    {#each noeud.ancetres as ancetre (ancetre.id)}
      <span aria-hidden="true">›</span>
      <a href={lien(ancetre.id)}><MathRenderer content={ancetre.titre} inline={true} /></a>
    {/each}
  </nav>

  <header class="prepa-noeud-head">
    <div>
      <p class="t-overline">
        {noeud.programme.titre}{noeud.semestre ? ` · semestre ${noeud.semestre}` : ''}
      </p>
      <h2><MathRenderer content={noeud.titre} inline={true} /></h2>
      {#if noeud.liste.total > 0}
        <a class="prepa-chercher" href="/?cpge={encodeURIComponent(noeud.id)}">Rechercher dans cette partie du programme</a>
      {/if}
    </div>
    <div class="prepa-noeud-count">
      <strong>{noeud.liste.total}</strong>
      <span>exercice{noeud.liste.total > 1 ? 's' : ''}</span>
    </div>
  </header>

  {#if texteHtml || contenus.length}
    <details class="prepa-officiel" open={!noeud.enfants.length}>
      <summary>Texte officiel du programme</summary>
      {#if texteHtml}
        <div class="prepa-texte"><MathRenderer content={texteHtml} /></div>
      {/if}
      {#if contenus.length}
        <div class="prepa-table-wrap">
          <table>
            <thead><tr><th>Contenus</th><th>Capacités et commentaires</th></tr></thead>
            <tbody>
              {#each contenus as ligne}
                <tr>
                  <td><MathRenderer content={celluleCpge(ligne.contenu)} /></td>
                  <td><MathRenderer content={celluleCpge(ligne.commentaire)} /></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </details>
  {/if}

  {#if noeud.enfants.length}
    <ul class="prepa-enfants">
      {#each noeud.enfants as enfant (enfant.id)}
        <li>
          <a href={lien(enfant.id)}>
            <span><MathRenderer content={enfant.titre} inline={true} /></span>
            <small>{enfant.exercices}</small>
          </a>
        </li>
      {/each}
    </ul>
  {/if}

  {#if noeud.liste.total === 0}
    <section class="empty-state">
      <h3 class="empty-state-title">Aucun exercice rattaché</h3>
      <p class="empty-state-subtitle">Aucun exercice de la base n’est encore rattaché à cette partie du programme.</p>
    </section>
  {:else}
    <div class="prepa-exercices">
      {#each noeud.liste.exercices as exercise (exercise.uuid)}
        <ExerciseRowCard {exercise} />
      {/each}
    </div>

    {#if pages > 1}
      <nav class="prepa-pages" aria-label="Pages d’exercices">
        {#if page > 1}<a class="btn btn-secondary btn-sm" href="{lien(noeud.id)}&page={page - 1}">Précédents</a>{/if}
        <span>Page {page} sur {pages}</span>
        {#if page < pages}<a class="btn btn-secondary btn-sm" href="{lien(noeud.id)}&page={page + 1}">Suivants</a>{/if}
      </nav>
    {/if}
  {/if}
</article>

<style>
  .prepa-fil {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
    color: var(--color-interface-text-muted);
    font-size: 0.82rem;
  }

  .prepa-fil a:hover {
    color: var(--color-brand-700);
  }

  .prepa-noeud-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .prepa-noeud-head h2 {
    font-family: var(--font-heading);
    font-size: 1.5rem;
  }

  .prepa-chercher {
    display: inline-block;
    margin-top: 0.35rem;
    color: var(--color-brand-700);
    font-size: 0.85rem;
    text-decoration: underline;
  }

  .prepa-noeud-count {
    min-width: 5.5rem;
    text-align: right;
  }

  .prepa-noeud-count strong {
    display: block;
    font-size: 1.6rem;
  }

  .prepa-noeud-count span {
    color: var(--color-interface-text-muted);
    font-size: 0.8rem;
  }

  .prepa-officiel {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 8px;
    background: var(--color-interface-bg-secondary, var(--color-interface-bg-white));
  }

  .prepa-officiel summary {
    cursor: pointer;
    font-weight: 600;
  }

  .prepa-texte {
    margin-top: 0.75rem;
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .prepa-texte :global(ul) {
    margin: 0.4rem 0 0.4rem 1.2rem;
    list-style: disc;
  }

  .prepa-texte :global(p + p) {
    margin-top: 0.5rem;
  }

  .prepa-table-wrap {
    margin-top: 0.75rem;
    overflow-x: auto;
  }

  .prepa-table-wrap table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .prepa-table-wrap th,
  .prepa-table-wrap td {
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-interface-border-primary);
    text-align: left;
    vertical-align: top;
  }

  .prepa-table-wrap th {
    background: var(--color-interface-bg-tertiary);
    font-weight: 600;
  }

  .prepa-enfants {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.5rem;
    margin: 0 0 1rem;
    padding: 0;
    list-style: none;
  }

  .prepa-enfants a {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 8px;
    color: inherit;
    font-size: 0.88rem;
    text-decoration: none;
  }

  .prepa-enfants a:hover {
    border-color: var(--color-brand-300);
  }

  .prepa-enfants small {
    color: var(--color-interface-text-muted);
  }

  .prepa-exercices {
    display: grid;
    gap: 0.7rem;
  }

  .prepa-pages {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
    color: var(--color-interface-text-muted);
    font-size: 0.85rem;
  }

  @media (max-width: 640px) {
    .prepa-noeud-head {
      display: grid;
    }

    .prepa-noeud-count {
      text-align: left;
    }
  }
</style>
