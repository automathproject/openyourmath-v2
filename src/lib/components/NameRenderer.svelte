<!-- src/lib/components/NameRenderer.svelte -->
<script>
  export let author = '';
  export let licenseCode = '';
  export let licenseUrl = '';
  export let email = '';
  export let icon = '👤';
  export let variant = 'inline'; // inline | footer | compact
  export let className = '';

  let open = false;

  function toggle(event) {
    event.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }
</script>

{#if author}
  <div class={`name-renderer name-renderer--${variant} ${open ? 'name-renderer--open' : ''} ${className}`.trim()}>
    <button
      type="button"
      class="name-renderer__button"
      on:click={toggle}
      on:keydown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
      aria-label={`Afficher les informations de licence pour ${author}`}
      aria-expanded={open}
    >
      {#if icon}
        <span class="name-renderer__icon">{icon}</span>
      {/if}
      <span class="name-renderer__label">{author}</span>
    </button>

    {#if open}
      <div class="name-renderer__license" role="dialog" aria-live="polite" on:click|stopPropagation>
        {#if licenseCode}
          <span class="name-renderer__badge">🔖 </span>
          {#if licenseUrl}
            <a class="name-renderer__link" href={licenseUrl} target="_blank" rel="noopener">{licenseCode}</a>
          {/if}
        {:else}
          <span class="name-renderer__missing">Licence non renseignée</span>
        {/if}
        {#if email}
          <span class="name-renderer__sep">•</span>
          <a class="name-renderer__link" href={`mailto:${email}`}>Contacter</a>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .name-renderer {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    color: inherit;
  }

  .name-renderer__button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border: none;
    background: transparent;
    color: inherit;
    padding: 0.125rem 0.25rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .name-renderer__button:hover,
  .name-renderer--open .name-renderer__button {
    @apply bg-gray-200 text-gray-700;
  }

  .name-renderer--compact .name-renderer__button {
    padding: 0.0625rem 0.25rem;
    font-size: 0.75rem;
  }

  .name-renderer--footer .name-renderer__button {
    @apply text-gray-500;
  }

  .name-renderer__icon {
    font-size: 0.9em;
    opacity: 0.85;
  }

  .name-renderer__license {
    border-radius: 0.375rem;
    padding: 0.5rem 0.625rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    box-shadow: 0 2px 6px rgb(15 23 42 / 0.1);
    z-index: 5;
    @apply bg-gray-50 border border-gray-200 text-gray-700;
  }

  .name-renderer__badge {
    font-weight: 600;
  }

  .name-renderer__link {
    text-decoration: underline;
    @apply text-blue-600;
  }

  .name-renderer__sep {
    @apply text-gray-300;
  }

  .name-renderer__missing {
    @apply text-gray-500;
  }

  .name-renderer--inline .name-renderer__license,
  .name-renderer--footer .name-renderer__license {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
  }

  .name-renderer--compact {
    font-size: 0.75rem;
  }

  .name-renderer--compact .name-renderer__license {
    position: absolute;
    top: calc(100% + 0.25rem);
    right: 0;
  }

  .name-renderer--compact .name-renderer__button {
    @apply text-gray-600;
  }

  .name-renderer--compact .name-renderer__icon {
    font-size: 0.8em;
  }
</style>
