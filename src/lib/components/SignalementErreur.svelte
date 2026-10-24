<!-- src/lib/components/SignalementErreur.svelte
     Signalement d'une erreur dans un exercice, en trois étapes guidées :
     le type de problème, les précisions qu'il appelle, puis la connexion
     (forge ou GitHub) et l'envoi. Le ticket est public : aucune donnée
     personnelle n'est demandée, l'identité vient du compte de connexion. -->
<script>
  import { onMount, tick } from 'svelte';
  import { LIMITES, TYPES_PAR_ID, TYPES_SIGNALEMENT, partiesExercice } from '$lib/signalement/types.js';

  let { exercise, cpge = [], signalement = { auteur: null, fournisseurs: [] } } = $props();

  const DEPOTS = { forge: 'automath/exobase sur la forge', github: 'automathproject/exobase sur GitHub' };
  const NOMS = { forge: 'la forge', github: 'GitHub' };
  const ETAPES = ['Problème', 'Précisions', 'Envoi'];
  const VIDE = { type: '', partie: '', ecrit: '', attendu: '', classement: '', cpgeContestes: [], cpgeManquant: '', doublon: '', message: '', site: '' };

  let dialogue = $state();
  let etape = $state(0);
  let brouillon = $state({ ...VIDE });
  let erreur = $state('');
  let envoi = $state(false);
  let resultat = $state(null);
  let auteur = $state(signalement.auteur);
  let alerteConnexion = $state('');

  const cleBrouillon = $derived(`oym-signalement:${exercise.uuid}`);
  const type = $derived(TYPES_PAR_ID[brouillon.type]);
  const champs = $derived(type?.champs ?? []);
  const parties = $derived(partiesExercice(exercise.content || []));
  const classementActuel = $derived([exercise.level, exercise.module, exercise.chapter, exercise.subchapter].filter(Boolean).join(' › '));
  const disponible = $derived(signalement.fournisseurs.length > 0);

  function ouvrir() {
    resultat = null;
    erreur = '';
    dialogue?.showModal();
  }

  function fermer() {
    dialogue?.close();
    if (resultat) {
      brouillon = { ...VIDE };
      etape = 0;
      resultat = null;
    }
  }

  function erreurEtape(n) {
    if (n === 0 && !type) return 'Choisissez le type de problème.';
    if (n === 1) {
      if (champs.includes('partie') && !brouillon.partie) return 'Indiquez la partie de l’exercice concernée.';
      if (champs.includes('classement') && !brouillon.classement.trim()) return 'Indiquez le classement que vous proposez.';
      if (champs.includes('cpge') && !brouillon.cpgeContestes.length && !brouillon.cpgeManquant.trim()) {
        return 'Cochez un rattachement à retirer ou indiquez le programme qui manque.';
      }
      if (champs.includes('doublon') && !/^#?[A-Za-z0-9]{4}$/.test(brouillon.doublon.trim())) {
        return 'Indiquez l’identifiant à 4 caractères de l’autre exercice.';
      }
      if (brouillon.message.trim().length < LIMITES.message.min) {
        return `Décrivez le problème en quelques mots (${LIMITES.message.min} caractères au moins).`;
      }
    }
    return '';
  }

  async function suivant() {
    erreur = erreurEtape(etape);
    if (erreur) return;
    etape += 1;
    await tick();
    dialogue?.querySelector('[data-focus]')?.focus();
  }

  function precedent() {
    erreur = '';
    etape = Math.max(0, etape - 1);
  }

  function sauverBrouillon() {
    try { sessionStorage.setItem(cleBrouillon, JSON.stringify(brouillon)); } catch { /* stockage indisponible */ }
  }

  function connexion(fournisseur) {
    sauverBrouillon();
    const retour = `${location.pathname}${location.search}`;
    location.href = `/signalement/connexion/${fournisseur}?retour=${encodeURIComponent(retour)}`;
  }

  async function deconnexion() {
    await fetch('/signalement/deconnexion', { method: 'POST' }).catch(() => {});
    auteur = null;
  }

  async function envoyer() {
    erreur = '';
    envoi = true;
    try {
      const reponse = await fetch('/api/signalement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uuid: exercise.uuid, ...brouillon })
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (reponse.status === 401) auteur = null;
      if (!reponse.ok) {
        erreur = donnees.erreur || 'Le signalement n’a pas pu être envoyé.';
        return;
      }
      resultat = donnees;
      try { sessionStorage.removeItem(cleBrouillon); } catch { /* stockage indisponible */ }
    } catch {
      erreur = 'Le signalement n’a pas pu être envoyé. Vérifiez votre connexion.';
    } finally {
      envoi = false;
    }
  }

  // Retour de la connexion : on rouvre le formulaire à l'étape d'envoi.
  onMount(() => {
    const url = new URL(location.href);
    const statut = url.searchParams.get('signalement');
    if (!statut) return;
    url.searchParams.delete('signalement');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    try {
      const sauve = JSON.parse(sessionStorage.getItem(cleBrouillon) || 'null');
      if (sauve) brouillon = { ...VIDE, ...sauve };
    } catch { /* brouillon illisible */ }
    if (statut !== 'connecte') {
      alerteConnexion = statut === 'connexion-refusee'
        ? 'La connexion a été annulée ou a expiré. Vous pouvez réessayer.'
        : 'La connexion n’a pas abouti. Réessayez dans un instant.';
    }
    etape = TYPES_PAR_ID[brouillon.type] ? 2 : 0;
    ouvrir();
  });
</script>

{#if disponible}
  <p class="signalement">
    <button type="button" class="signalement-lien" onclick={ouvrir}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M3 14V2.5M3 2.5h8.5l-1.75 3 1.75 3H3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      </svg>
      Signaler une erreur
    </button>
  </p>

  <dialog bind:this={dialogue} class="signalement-dialogue" aria-labelledby="signalement-dialogue-titre" onclose={() => (erreur = '')}>
    <form method="dialog" class="signalement-form" onsubmit={e => e.preventDefault()}>
      <header class="signalement-entete">
        <div>
          <p class="t-overline">Exercice <span class="signalement-id">{exercise.uuid}</span></p>
          <h2 id="signalement-dialogue-titre">Signaler une erreur</h2>
        </div>
        <button type="button" class="btn-icon signalement-fermer" aria-label="Fermer" onclick={fermer}>✕</button>
      </header>

      {#if resultat}
        <div class="signalement-corps" role="status">
          <p class="signalement-merci">Merci, votre signalement est enregistré.</p>
          <p>Le ticket n° {resultat.numero} est ouvert dans {resultat.depot}. Vous pouvez y suivre sa correction et y ajouter des précisions.</p>
          <p><a href={resultat.url} target="_blank" rel="noopener noreferrer">Voir le ticket</a></p>
        </div>
        <footer class="signalement-actions">
          <button type="button" class="btn btn-primary" onclick={fermer}>Fermer</button>
        </footer>
      {:else}
        <ol class="signalement-etapes" aria-label="Étapes">
          {#each ETAPES as nom, i}
            <li class:is-current={i === etape} class:is-done={i < etape} aria-current={i === etape ? 'step' : undefined}>{nom}</li>
          {/each}
        </ol>

        <div class="signalement-corps">
          {#if etape === 0}
            <fieldset>
              <legend class="signalement-legende">Quel est le problème ?</legend>
              <div class="signalement-types">
                {#each TYPES_SIGNALEMENT as t, i}
                  <label class="signalement-type" class:is-selected={brouillon.type === t.id}>
                    <input type="radio" name="type" value={t.id} bind:group={brouillon.type} data-focus={i === 0 ? '' : undefined} />
                    <span>
                      <strong>{t.libelle}</strong>
                      <small>{t.aide}</small>
                    </span>
                  </label>
                {/each}
              </div>
            </fieldset>
          {:else if etape === 1}
            <p class="signalement-rappel">{type.libelle}</p>

            {#if champs.includes('partie')}
              <label class="signalement-champ">
                <span>Partie de l’exercice concernée</span>
                <select class="form-input" bind:value={brouillon.partie} data-focus>
                  <option value="" disabled>Choisir…</option>
                  {#each parties as p}<option value={p.id}>{p.libelle}</option>{/each}
                </select>
              </label>
            {/if}

            {#if champs.includes('correction')}
              <div class="signalement-duo">
                <label class="signalement-champ">
                  <span>Ce qui est écrit <small>(facultatif)</small></span>
                  <textarea class="form-input" rows="3" maxlength={LIMITES.champ} bind:value={brouillon.ecrit} placeholder="Recopiez le passage, en LaTeX si besoin : $x^2$"></textarea>
                </label>
                <label class="signalement-champ">
                  <span>Ce qu’il faudrait écrire <small>(facultatif)</small></span>
                  <textarea class="form-input" rows="3" maxlength={LIMITES.champ} bind:value={brouillon.attendu}></textarea>
                </label>
              </div>
            {/if}

            {#if champs.includes('classement')}
              <p class="signalement-info">Classement actuel : <strong>{classementActuel || 'aucun'}</strong></p>
              <label class="signalement-champ">
                <span>Classement proposé</span>
                <input class="form-input" type="text" maxlength={LIMITES.champ} bind:value={brouillon.classement} placeholder="Ex. L2 › Algèbre › Réduction des endomorphismes" data-focus />
              </label>
            {/if}

            {#if champs.includes('cpge')}
              {#if cpge.length}
                <fieldset class="signalement-champ">
                  <legend>Rattachements à retirer</legend>
                  <div class="signalement-cpge">
                    {#each cpge as programme}
                      <p class="signalement-cpge-programme">{programme.titre}</p>
                      {#each programme.noeuds as noeud}
                        <label class="signalement-coche">
                          <input type="checkbox" value={noeud.id} bind:group={brouillon.cpgeContestes} />
                          <span>{#if noeud.section}{noeud.section} › {/if}{noeud.titre}</span>
                        </label>
                      {/each}
                    {/each}
                  </div>
                </fieldset>
              {:else}
                <p class="signalement-info">Cet exercice n’est rattaché à aucun programme de CPGE.</p>
              {/if}
              <label class="signalement-champ">
                <span>Programme ou section qui manque <small>(facultatif)</small></span>
                <input class="form-input" type="text" maxlength={LIMITES.champ} bind:value={brouillon.cpgeManquant} placeholder="Ex. PSI › Réduction des endomorphismes" />
              </label>
            {/if}

            {#if champs.includes('doublon')}
              <label class="signalement-champ">
                <span>Identifiant de l’autre exercice</span>
                <input class="form-input signalement-uuid" type="text" maxlength="5" bind:value={brouillon.doublon} placeholder="Ex. 1IUZ" data-focus />
              </label>
            {/if}

            <label class="signalement-champ">
              <span>Décrivez le problème</span>
              <textarea class="form-input" rows="5" maxlength={LIMITES.message.max} bind:value={brouillon.message} data-focus={champs.length === 0 ? '' : undefined}
                placeholder="Ce qui ne va pas, et si possible comment le corriger. Les formules en LaTeX sont bienvenues."></textarea>
            </label>
            <!-- Piège à robots : invisible et ignoré par les personnes. -->
            <input class="signalement-piege" type="text" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={brouillon.site} />
          {:else}
            {#if alerteConnexion}<p class="signalement-alerte" role="alert">{alerteConnexion}</p>{/if}
            {#if auteur}
              <p>
                Connecté avec {NOMS[auteur.fournisseur]} : <a href={auteur.profil} target="_blank" rel="noopener noreferrer">{auteur.login}</a>
                <button type="button" class="btn-text signalement-deconnexion" onclick={deconnexion}>Changer de compte</button>
              </p>
              <p class="signalement-info">
                Le ticket sera public dans {DEPOTS[auteur.fournisseur]}, signé de votre identifiant. Vous pourrez y suivre la correction.
              </p>
            {:else}
              <p>Pour éviter les abus, connectez-vous avant d’envoyer. Le ticket sera public et signé de votre identifiant ; seul votre profil public est lu.</p>
              <div class="signalement-connexions">
                {#each signalement.fournisseurs as f, i}
                  <button type="button" class={i === 0 ? 'btn btn-primary' : 'btn btn-secondary'} onclick={() => connexion(f.id)} data-focus={i === 0 ? '' : undefined}>
                    Se connecter avec {f.libelle}
                  </button>
                {/each}
              </div>
              {#if signalement.fournisseurs.some(f => f.id === 'forge')}
                <p class="signalement-info">Enseignants et personnels : la forge des communs numériques éducatifs s’ouvre avec votre identifiant académique.</p>
              {/if}
            {/if}
          {/if}

          {#if erreur}<p class="signalement-erreur" role="alert">{erreur}</p>{/if}
        </div>

        <footer class="signalement-actions">
          {#if etape > 0}<button type="button" class="btn btn-ghost" onclick={precedent}>Précédent</button>{/if}
          {#if etape < 2}
            <button type="button" class="btn btn-primary" onclick={suivant}>Suivant</button>
          {:else if auteur}
            <button type="button" class="btn btn-primary" onclick={envoyer} disabled={envoi} data-focus>
              {envoi ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          {/if}
        </footer>
      {/if}
    </form>
  </dialog>
{/if}

<style>
  /* Un simple lien sous l'exercice : présent sans détourner de la lecture. */
  .signalement {
    margin-top: 0.75rem;
    text-align: right;
  }

  .signalement-lien {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.25rem;
    font-size: 0.78rem;
    color: var(--color-interface-text-muted);
    cursor: pointer;
  }

  .signalement-lien:hover,
  .signalement-lien:focus-visible {
    color: var(--color-brand-700);
    text-decoration: underline;
  }

  .signalement-dialogue {
    width: min(640px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    margin: auto;
    padding: 0;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 10px;
    background: var(--color-interface-bg-primary);
    color: var(--color-interface-text-primary);
  }

  .signalement-dialogue::backdrop {
    background: rgb(13 60 77 / 0.35);
  }

  .signalement-form {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 2rem);
  }

  .signalement-entete {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem 1.25rem 0.5rem;
  }

  /* Les identifiants sont sensibles à la casse : pas de capitales forcées. */
  .signalement-id {
    text-transform: none;
    letter-spacing: 0;
  }

  .signalement-entete h2 {
    font-family: var(--font-heading);
    font-size: 1.35rem;
  }

  .signalement-etapes {
    display: flex;
    gap: 0.5rem;
    padding: 0 1.25rem;
    font-size: 0.8rem;
    color: var(--color-interface-text-muted);
    counter-reset: etape;
  }

  .signalement-etapes li {
    counter-increment: etape;
  }

  .signalement-etapes li::before {
    content: counter(etape) '. ';
  }

  .signalement-etapes li + li::before {
    content: '› ' counter(etape) '. ';
  }

  .signalement-etapes li.is-current {
    font-weight: 600;
    color: var(--color-brand-700);
  }

  .signalement-corps {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem 1.25rem;
    overflow-y: auto;
  }

  .signalement-legende {
    margin-bottom: 0.6rem;
    font-weight: 600;
  }

  .signalement-types {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .signalement-type {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 8px;
    background: var(--color-interface-bg-white);
    cursor: pointer;
  }

  .signalement-type.is-selected {
    border-color: var(--color-brand-600);
    background: var(--color-brand-50);
  }

  .signalement-type input {
    margin-top: 0.25rem;
    accent-color: var(--color-brand-600);
  }

  .signalement-type strong {
    display: block;
    font-size: 0.9rem;
  }

  .signalement-type small {
    display: block;
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--color-interface-text-muted);
  }

  .signalement-rappel {
    align-self: flex-start;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--color-brand-100);
    color: var(--color-brand-800);
  }

  .signalement-champ {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .signalement-champ small {
    font-weight: 400;
    color: var(--color-interface-text-muted);
  }

  .signalement-champ textarea,
  .signalement-champ input,
  .signalement-champ select {
    font-weight: 400;
  }

  .signalement-duo {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .signalement-uuid {
    width: 8rem;
    font-family: var(--font-mono, monospace);
  }

  .signalement-cpge {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 6px;
    background: var(--color-interface-bg-white);
  }

  .signalement-cpge-programme {
    margin-top: 0.3rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-brand-700);
  }

  .signalement-coche {
    display: flex;
    gap: 0.5rem;
    font-weight: 400;
    font-size: 0.85rem;
  }

  .signalement-info {
    font-size: 0.85rem;
    color: var(--color-interface-text-secondary);
  }

  .signalement-connexions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .signalement-deconnexion {
    margin-left: 0.5rem;
    font-size: 0.85rem;
  }

  .signalement-erreur,
  .signalement-alerte {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    background: #fdecea;
    color: #8a1c13;
  }

  .signalement-merci {
    font-weight: 600;
  }

  .signalement-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem 1rem;
    border-top: 1px solid var(--color-interface-border-primary);
  }

  .signalement-piege {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  @media (max-width: 640px) {
    .signalement-types,
    .signalement-duo {
      grid-template-columns: 1fr;
    }
  }

  @media print {
    .signalement {
      display: none;
    }
  }
</style>
