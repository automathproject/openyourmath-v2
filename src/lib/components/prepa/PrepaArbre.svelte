<!-- src/lib/components/prepa/PrepaArbre.svelte
     Arbre d'un programme de CPGE : parties (semestres), sections, puis
     parties lettrées et sous-sections de la section ouverte. -->
<script>
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  export let arbre;
  /** Nœud affiché, et ses ancêtres, pour ouvrir la bonne branche. */
  export let actif = '';
  export let ouverts = [];

  $: chemin = new Set([...ouverts, actif].filter(Boolean));
  const lien = id => `/browse?vue=prepa&noeud=${encodeURIComponent(id)}`;
</script>

<nav class="prepa-arbre" aria-label="Sections du programme">
  <a class="prepa-arbre-programme" class:is-current={!actif} href="/browse?vue=prepa&programme={arbre.programme}">
    {arbre.filieres.join(' · ')}
    <small>{arbre.exercices}</small>
  </a>

  {#each arbre.parties as partie (partie.nom)}
    {#if arbre.parties.length > 1}<p class="prepa-arbre-partie">{partie.nom}</p>{/if}
    <ul>
      {#each partie.sections as section (section.id)}
        <li>
          <a href={lien(section.id)} class:is-current={section.id === actif} aria-current={section.id === actif ? 'page' : undefined}>
            <span><MathRenderer content={section.titre} inline={true} /></span>
            <small>{section.exercices}</small>
          </a>
          {#if chemin.has(section.id) && section.enfants.length}
            <ul class="prepa-arbre-enfants">
              {#each section.enfants as enfant (enfant.id)}
                <li>
                  <a href={lien(enfant.id)} class:is-current={enfant.id === actif} aria-current={enfant.id === actif ? 'page' : undefined}>
                    <span><MathRenderer content={enfant.titre} inline={true} /></span>
                    <small>{enfant.exercices}</small>
                  </a>
                  {#if chemin.has(enfant.id) && enfant.enfants.length}
                    <ul class="prepa-arbre-enfants">
                      {#each enfant.enfants as petit (petit.id)}
                        <li>
                          <a href={lien(petit.id)} class:is-current={petit.id === actif} aria-current={petit.id === actif ? 'page' : undefined}>
                            <span><MathRenderer content={petit.titre} inline={true} /></span>
                            <small>{petit.exercices}</small>
                          </a>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}
</nav>

<style>
  .prepa-arbre {
    font-size: 0.85rem;
  }

  .prepa-arbre ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .prepa-arbre a {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    color: var(--color-interface-text-secondary);
    text-decoration: none;
  }

  .prepa-arbre a:hover {
    background: var(--color-interface-bg-tertiary);
  }

  .prepa-arbre a.is-current {
    border-left-color: var(--color-brand-600);
    background: var(--color-interface-bg-tertiary);
    color: var(--color-interface-text-primary);
    font-weight: 600;
  }

  .prepa-arbre small {
    flex-shrink: 0;
    color: var(--color-interface-text-muted);
  }

  .prepa-arbre-programme {
    margin-bottom: 0.5rem;
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 700;
  }

  .prepa-arbre-partie {
    margin: 0.9rem 0 0.3rem 0.5rem;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-interface-text-muted);
  }

  .prepa-arbre-enfants {
    margin-left: 0.75rem !important;
  }
</style>
