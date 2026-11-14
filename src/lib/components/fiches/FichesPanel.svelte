<!--
  FichesPanel — choisir une fiche depuis une liste déjà remplie.

  Un tiroir à droite garde la liste visible pendant qu'on cherche. Choisir une
  fiche ne remplace jamais la liste en silence : une fenêtre propose d'ajouter
  la fiche à la suite (par défaut, rien n'est perdu) ou de remplacer la liste.

  Le parent fait le travail : `onappend(fiche)` et `onreplace(fiche)` peuvent
  être asynchrones ; le panneau se ferme quand ils ont abouti.
-->
<script>
  import FichesCatalogue from './FichesCatalogue.svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';

  /**
   * @typedef {Object} Props
   * @property {boolean} open
   * @property {number} currentCount - exercices déjà dans la liste
   * @property {(fiche: any) => Promise<void> | void} onappend
   * @property {(fiche: any) => Promise<void> | void} onreplace
   */
  /** @type {Props} */
  let { open = $bindable(false), currentCount, onappend, onreplace } = $props();

  let dialog = $state();
  let pending = $state(null);
  let busy = $state('');
  let error = $state('');

  function plural(count, word) {
    return `${count} ${word}${count > 1 ? 's' : ''}`;
  }

  function choose(fiche, event) {
    // Liste vide : le lien suffit, il n'y a rien à perdre.
    if (currentCount === 0) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    pending = fiche;
    error = '';
    dialog?.showModal();
  }

  async function run(kind) {
    if (!pending || busy) return;
    busy = kind;
    error = '';
    try {
      await (kind === 'append' ? onappend : onreplace)(pending);
      dialog?.close();
      open = false;
    } catch (err) {
      error = err?.message || 'La fiche n\'a pas pu être chargée.';
    } finally {
      busy = '';
    }
  }

  function onkeydown(event) {
    if (open && event.key === 'Escape' && !dialog?.open) {
      event.preventDefault();
      open = false;
    }
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <div class="fiches-panel-backdrop" role="presentation" onclick={() => (open = false)}></div>
  <aside class="fiches-panel" aria-labelledby="fiches-panel-title">
    <header class="fiches-panel-header">
      <h2 id="fiches-panel-title">Fiches</h2>
      <button type="button" class="fiches-panel-close" aria-label="Fermer le panneau des fiches" onclick={() => (open = false)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>
    <p class="fiches-panel-hint">Ajoutez une fiche à votre liste, ou repartez d'une fiche.</p>
    <FichesCatalogue variant="compact" autofocus onchoose={choose} />
  </aside>
{/if}

<dialog bind:this={dialog} class="fiche-choice" aria-labelledby="fiche-choice-title" onclose={() => (pending = null)}>
  {#if pending}
    <h2 id="fiche-choice-title">Ouvrir la fiche « <MathRenderer content={pending.title} inline={true} /> » ?</h2>
    <p class="fiche-choice-lead">
      {plural(pending.exercise_count, 'exercice')} ; votre liste en contient déjà {currentCount}.
    </p>

    <div class="fiche-choice-options">
      <button type="button" class="fiche-choice-option fiche-choice-option--main" disabled={!!busy} onclick={() => run('append')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6" />
        </svg>
        <span>
          <strong>{busy === 'append' ? 'Ajout…' : 'Ajouter à la suite'}</strong>
          <small>{plural(currentCount + pending.exercise_count, 'exercice')}, la fiche forme une section à part</small>
        </span>
      </button>
      <button type="button" class="fiche-choice-option" disabled={!!busy} onclick={() => run('replace')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 7h13l-3-3M20 17H7l3 3" />
        </svg>
        <span>
          <strong>{busy === 'replace' ? 'Ouverture…' : 'Remplacer ma liste'}</strong>
          <small>{currentCount > 1 ? `Les ${currentCount} exercices actuels seront retirés` : 'L\'exercice actuel sera retiré'}</small>
        </span>
      </button>
    </div>

    {#if error}
      <p class="fiche-choice-error" role="alert">{error}</p>
    {/if}

    <footer class="fiche-choice-footer">
      <a href="/fiches/{encodeURIComponent(pending.slug)}">Voir la fiche d'abord</a>
      <button type="button" class="btn btn-ghost btn-sm" onclick={() => dialog.close()}>Annuler</button>
    </footer>
  {/if}
</dialog>

<style>
  .fiches-panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgb(13 60 77 / 0.18);
  }

  .fiches-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 81;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(22rem, 100vw);
    padding: 1rem;
    background: var(--color-interface-bg-primary);
    border-left: 1px solid var(--color-interface-border-primary);
    box-shadow: -8px 0 24px rgb(0 0 0 / 0.08);
  }

  .fiches-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .fiches-panel-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .fiches-panel-close {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-interface-text-secondary);
    cursor: pointer;
  }

  .fiches-panel-close:hover {
    background: var(--color-interface-bg-tertiary);
    color: var(--color-interface-text-primary);
  }

  .fiches-panel-hint {
    margin: -0.4rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-interface-text-secondary);
  }

  .fiches-panel :global(.catalogue) {
    flex: 1;
  }

  .fiche-choice {
    width: min(26rem, calc(100vw - 2rem));
    margin: auto;
    padding: 1.25rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 12px;
    background: var(--color-interface-bg-primary);
    color: var(--color-interface-text-primary);
  }

  .fiche-choice::backdrop {
    background: rgb(13 60 77 / 0.35);
  }

  .fiche-choice h2 {
    margin: 0 0 0.25rem;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .fiche-choice-lead {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-interface-text-secondary);
  }

  .fiche-choice-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .fiche-choice-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--color-interface-border-primary);
    border-radius: 0.6rem;
    background: var(--color-interface-bg-white);
    color: var(--color-interface-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .fiche-choice-option svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--color-interface-text-secondary);
  }

  .fiche-choice-option:hover:not(:disabled) {
    border-color: var(--color-brand-500);
    background: var(--color-brand-50);
  }

  .fiche-choice-option--main {
    border: 1.5px solid var(--color-brand-500);
  }

  .fiche-choice-option--main svg {
    color: var(--color-brand-700);
  }

  .fiche-choice-option:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  .fiche-choice-option strong {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .fiche-choice-option small {
    display: block;
    margin-top: 1px;
    font-size: 0.8125rem;
    color: var(--color-interface-text-secondary);
  }

  .fiche-choice-error {
    margin: 0.75rem 0 0;
    font-size: 0.8125rem;
    color: var(--color-error-600, #b91c1c);
  }

  .fiche-choice-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1rem;
  }

  .fiche-choice-footer a {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-brand-700);
    text-decoration: none;
  }

  .fiche-choice-footer a:hover {
    text-decoration: underline;
  }
</style>
