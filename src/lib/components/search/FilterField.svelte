<script>
  export let type = 'input';
  export let id = '';
  export let label = '';
  export let value = '';
  export let placeholder = '';
  export let options = [];
  export let disabled = false;
  export let showSuggestions = false;
  export let suggestions = [];
  export let suggestionLabel = (item) => item.label ?? item.value ?? '';
  export let suggestionSuffix = (item) => (item.count !== undefined ? `(${item.count})` : '');
  export let onInput = () => {};
  export let onBlur = () => {};
  export let onChange = () => {};
  export let onSuggestionSelect = () => {};
</script>

<div class="filters-field">
  {#if label}
    <label for={id}>{label}</label>
  {/if}

  {#if type === 'select'}
    <select
      id={id}
      class="form-input"
      value={value}
      disabled={disabled}
      on:change={(event) => onChange(event.target.value)}
    >
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {:else}
    <input
      id={id}
      type="text"
      class="form-input"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      on:input={(event) => onInput(event.target.value)}
      on:blur={onBlur}
    />
    {#if showSuggestions && suggestions.length > 0}
      <div class="filters-suggestions">
        {#each suggestions as suggestion}
          <button type="button" on:click={() => onSuggestionSelect(suggestion)}>
            {suggestionLabel(suggestion)} {suggestionSuffix(suggestion)}
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .filters-field {
    position:relative;
    display:flex;
    flex-direction:column;
    gap:0.5rem;
  }
  .filters-field label {
    font-size:0.85rem;
    font-weight:600;
    @apply text-interface-text-secondary;
  }
  .form-input {
    width:100%;
    padding:0.6rem 0.75rem;
    border-radius:0.65rem;
    @apply border border-gray-300 bg-interface-bg-primary text-interface-text-primary;
  }
  .filters-suggestions {
    position:absolute;
    top:100%;
    left:0;
    right:0;
    margin-top:0.25rem;
    border-radius:0.5rem;
    box-shadow:0 10px 30px rgba(15,23,42,0.1);
    max-height:12rem;
    overflow:auto;
    z-index:10;
    @apply bg-interface-bg-primary border border-gray-200;
  }
  .filters-suggestions button {
    width:100%;
    text-align:left;
    padding:0.5rem 0.75rem;
    font-size:0.875rem;
    background:transparent;
    border:none;
    @apply text-gray-800;
  }
  .filters-suggestions button:hover { @apply bg-brand-50; }
</style>
