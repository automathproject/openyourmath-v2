<script>
  export let category = null;
  export let moduleOptions = [];
  export let levelOptions = [];
  export let difficultyOptions = [];
  export let activeMenuFilters = {};
  export let filteredAuthors = [];
  export let authorSearch = '';
  export let difficultyLabel = (option) => option.label ?? option.value;
  export let onModuleSelect = () => {};
  export let onLevelSelect = () => {};
  export let onDifficultySelect = () => {};
  export let onPropertySelect = () => {};
  export let onAuthorSelect = () => {};
  export let onAuthorSearchInput = () => {};
  export let onAuthorSearchSubmit = () => {};
</script>

{#if category === 'content'}
  <div class="filters-menu-section">
    <h5>Module</h5>
    {#if moduleOptions.length === 0}
      <p class="filters-menu-empty">Aucun module disponible</p>
    {:else}
      <div class="filters-menu-options">
        {#each moduleOptions as module (module.value)}
          <button
            type="button"
            class="filters-menu-option {module.active ? 'filters-menu-option--active' : ''}"
            on:click={() => onModuleSelect(module.value)}
          >
            <span>{module.value}</span>
            <span class="filters-menu-option-count">{module.count}</span>
          </button>
        {/each}
      </div>
    {/if}
    <p class="filters-menu-helper">Utilisez la navigation hiérarchique pour choisir un chapitre précis.</p>
  </div>
{:else if category === 'level'}
  <div class="filters-menu-section">
    <h5>Niveau</h5>
    {#if levelOptions.length === 0}
      <p class="filters-menu-empty">Aucun niveau disponible</p>
    {:else}
      <div class="filters-menu-options">
        {#each levelOptions as level (level.value)}
          <button
            type="button"
            class="filters-menu-option {level.active ? 'filters-menu-option--active' : ''}"
            on:click={() => onLevelSelect(level.value)}
          >
            <span>{level.value}</span>
            <span class="filters-menu-option-count">{level.count}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="filters-menu-section">
    <h5>Difficulté</h5>
    <div class="filters-menu-options">
      <button
        type="button"
        class="filters-menu-option {activeMenuFilters.difficulty === '' ? 'filters-menu-option--active' : ''}"
        on:click={() => onDifficultySelect('')}
      >
        <span>Toutes</span>
      </button>
      <button
        type="button"
        class="filters-menu-option {activeMenuFilters.difficulty === 'null' ? 'filters-menu-option--active' : ''}"
        on:click={() => onDifficultySelect('null')}
      >
        <span>Sans difficulté</span>
      </button>
      {#if difficultyOptions.length === 0}
        <p class="filters-menu-empty">Aucune difficulté disponible</p>
      {:else}
        {#each difficultyOptions as diff (diff.value)}
          <button
            type="button"
            class="filters-menu-option {diff.active ? 'filters-menu-option--active' : ''}"
            on:click={() => onDifficultySelect(diff.value)}
          >
            <span>{difficultyLabel(diff)}</span>
            <span class="filters-menu-option-count">{diff.count}</span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
{:else if category === 'properties'}
  <div class="filters-menu-section">
    <h5>Solution</h5>
    <div class="filters-menu-options">
      <button
        type="button"
        class="filters-menu-option {activeMenuFilters.hasSolution === '1' ? 'filters-menu-option--active' : ''}"
        on:click={() => onPropertySelect('hasSolution', '1')}
      >
        <span>✅ Avec solution</span>
      </button>
      <button
        type="button"
        class="filters-menu-option {activeMenuFilters.hasSolution === '0' ? 'filters-menu-option--active' : ''}"
        on:click={() => onPropertySelect('hasSolution', '0')}
      >
        <span>🚫 Sans solution</span>
      </button>
    </div>
  </div>
  <div class="filters-menu-section">
    <h5>Indication</h5>
    <div class="filters-menu-options">
      <button
        type="button"
        class="filters-menu-option {activeMenuFilters.hasIndication === '1' ? 'filters-menu-option--active' : ''}"
        on:click={() => onPropertySelect('hasIndication', '1')}
      >
        <span>💡 Avec indication</span>
      </button>
      <button
        type="button"
        class="filters-menu-option {activeMenuFilters.hasIndication === '0' ? 'filters-menu-option--active' : ''}"
        on:click={() => onPropertySelect('hasIndication', '0')}
      >
        <span>🚫 Sans indication</span>
      </button>
    </div>
  </div>
{:else if category === 'author'}
  <div class="filters-menu-section">
    <h5>Auteur</h5>
    <div class="filters-menu-author">
      <input
        type="text"
        class="filters-menu-author-input"
        placeholder="Nom ou mot-clé"
        value={authorSearch}
        on:input={(event) => onAuthorSearchInput(event.target.value)}
        on:keydown={(event) => event.key === 'Enter' && onAuthorSearchSubmit()}
      />
      <div class="filters-menu-author-actions">
        <button
          type="button"
          class="filters-menu-apply"
          on:click={onAuthorSearchSubmit}
          disabled={!authorSearch.trim()}
        >
          Appliquer
        </button>
      </div>
    </div>
    <div class="filters-menu-options">
      {#if filteredAuthors.length === 0}
        <p class="filters-menu-empty">Aucun auteur trouvé</p>
      {:else}
        {#each filteredAuthors as author (author.value)}
          <button
            type="button"
            class="filters-menu-option {author.active ? 'filters-menu-option--active' : ''}"
            on:click={() => onAuthorSelect(author.value)}
          >
            <span>{author.value}</span>
            <span class="filters-menu-option-count">{author.count}</span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
{/if}
