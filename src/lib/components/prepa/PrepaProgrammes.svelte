<!-- src/lib/components/prepa/PrepaProgrammes.svelte
     Vue Prépa de /browse : les programmes de CPGE, première puis seconde année. -->
<script>
  export let programmes = [];

  $: parAnnee = [1, 2]
    .map(annee => ({ annee, programmes: programmes.filter(p => p.annee === annee) }))
    .filter(groupe => groupe.programmes.length);
</script>

{#each parAnnee as groupe (groupe.annee)}
  <section class="prepa-annee" aria-label="{groupe.annee === 1 ? 'Première' : 'Seconde'} année">
    <h2>{groupe.annee === 1 ? 'Première année' : 'Seconde année'}</h2>
    <div class="prepa-grid">
      {#each groupe.programmes as programme (programme.programme)}
        <a class="prepa-card" href="/browse?vue=prepa&programme={programme.programme}">
          <span class="prepa-filieres">{programme.filieres.join(' · ')}</span>
          <span class="prepa-titre">{programme.titre}</span>
          <span class="prepa-count">{programme.exercices} exercice{programme.exercices > 1 ? 's' : ''}</span>
        </a>
      {/each}
    </div>
  </section>
{/each}

<style>
  .prepa-annee + .prepa-annee {
    margin-top: 1.5rem;
  }

  .prepa-annee h2 {
    margin-bottom: 0.75rem;
    font-family: var(--font-heading);
    font-size: 1.15rem;
  }

  .prepa-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .prepa-card {
    display: grid;
    gap: 0.3rem;
    padding: 1rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 8px;
    background: var(--color-interface-bg-white);
    color: inherit;
    text-decoration: none;
    transition: border-color 0.12s, box-shadow 0.12s;
  }

  .prepa-card:hover {
    border-color: var(--color-brand-300);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  }

  .prepa-filieres {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    font-weight: 700;
  }

  .prepa-titre {
    color: var(--color-interface-text-secondary);
    font-size: 0.85rem;
  }

  .prepa-count {
    color: var(--color-interface-text-muted);
    font-size: 0.8rem;
  }
</style>
