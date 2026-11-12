<!-- src/lib/components/qcm/LiveSessionButton.svelte
     Ouvre une session de qcm en direct à partir d'un ou plusieurs contenus, puis
     conduit à l'écran d'animation. Les exercices d'une liste mixte sont laissés
     de côté par le serveur. -->
<script>
  import { goto } from '$app/navigation';
  import { post } from '$lib/qcm/liveClient.js';

  /** UUID des contenus, dans l'ordre où les jouer. */
  export let uuids = [];
  export let title = '';
  export let label = 'Session en direct';
  /** Bouton plein, pour une barre d'actions dont c'est une action principale. */
  export let solid = false;

  let busy = false;
  let error = '';

  async function start() {
    error = '';
    busy = true;
    try {
      const created = await post('/api/classe', { uuids, title });
      await goto(`/classe/${created.code}/animer`);
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<span class="live-wrap">
  <button
    type="button"
    class="live-btn"
    class:live-btn--solid={solid}
    disabled={busy || uuids.length === 0}
    title="Jouer les QCM en direct avec une classe : les participants répondent depuis leur téléphone, sans compte"
    on:click={start}
  >
    <svg class="live-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" />
    </svg>
    <span class="live-label">{busy ? 'Ouverture…' : label}</span>
  </button>
  {#if error}
    <span class="live-error" role="alert">{error}</span>
  {/if}
</span>

<style>
  .live-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .live-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .live-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border: 1.5px solid var(--color-brand-600);
    border-radius: 0.5rem;
    background: #fff;
    color: var(--color-brand-700);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .live-btn:hover:not(:disabled) {
    background: var(--color-brand-50);
  }

  .live-btn--solid {
    background: var(--color-brand-600);
    color: #fff;
    padding: 0.5rem 0.9rem;
  }

  .live-btn--solid:hover:not(:disabled) {
    background: var(--color-brand-700);
  }

  .live-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .live-error {
    position: absolute;
    top: calc(100% + 0.35rem);
    right: 0;
    z-index: 30;
    width: max-content;
    max-width: 18rem;
    padding: 0.45rem 0.7rem;
    border-radius: 0.5rem;
    background: #991b1b;
    color: #fff;
    font-size: 0.8rem;
    line-height: 1.35;
    white-space: normal;
  }
</style>
