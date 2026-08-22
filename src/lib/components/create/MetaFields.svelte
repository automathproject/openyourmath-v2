<!--
  MetaFields — bloc repliable des métadonnées de l'exercice (titre, niveau,
  module, chapitre..., UUID), chaque champ pouvant être suggéré par l'IA.
  `meta` est l'objet réactif du parent : ses champs sont mutés directement
  (bind:value), aucune synchronisation supplémentaire n'est nécessaire.
-->

<script>
  import { generateShortUuid } from '$lib/latex/exerciseTex.js';

  /**
   * @typedef {Object} Props
   * @property {Object} meta
   * @property {boolean} showMeta
   * @property {string[]} levels
   * @property {string|null} aiMetaBusy — clé du champ en cours de suggestion, ou null
   * @property {(field: string) => void} onSuggest
   */
  /** @type {Props} */
  let { meta, showMeta = $bindable(false), levels, aiMetaBusy, onSuggest } = $props();
</script>

{#snippet metaAiBtn(field)}
  <button
    type="button"
    class="meta-ai-btn"
    title="Suggérer avec l'IA (d'après le contenu de l'exercice)"
    aria-label="Suggérer ce champ avec l'IA"
    disabled={aiMetaBusy !== null}
    onclick={(e) => { e.preventDefault(); onSuggest(field); }}
  >
    {aiMetaBusy === field ? '…' : '✨'}
  </button>
{/snippet}

<details class="editor-meta" bind:open={showMeta}>
  <summary>Métadonnées</summary>
  <div class="editor-meta-grid">
    <label class="meta-field meta-field--wide">
      <span>Titre *</span>
      <span class="meta-input-row">
        <input type="text" bind:value={meta.title} placeholder="Titre de l'exercice" />
        {@render metaAiBtn('title')}
      </span>
    </label>
    <label class="meta-field">
      <span>Niveau</span>
      <span class="meta-input-row">
        <input type="text" bind:value={meta.level} list="create-levels" placeholder="L1, L2…" />
        {@render metaAiBtn('level')}
      </span>
      <datalist id="create-levels">
        {#each levels as level}<option value={level}></option>{/each}
      </datalist>
    </label>
    <label class="meta-field">
      <span>Difficulté</span>
      <span class="meta-input-row">
        <select bind:value={meta.difficulty}>
          <option value="">—</option>
          {#each [1, 2, 3, 4, 5] as d}
            <option value={String(d)}>{'★'.repeat(d)}{'☆'.repeat(5 - d)}</option>
          {/each}
        </select>
        {@render metaAiBtn('difficulty')}
      </span>
    </label>
    <label class="meta-field">
      <span>Module</span>
      <span class="meta-input-row">
        <input type="text" bind:value={meta.module} placeholder="Analyse, Algèbre…" />
        {@render metaAiBtn('module')}
      </span>
    </label>
    <label class="meta-field">
      <span>Chapitre</span>
      <span class="meta-input-row">
        <input type="text" bind:value={meta.chapter} placeholder="Suites numériques…" />
        {@render metaAiBtn('chapter')}
      </span>
    </label>
    <label class="meta-field">
      <span>Sous-chapitre</span>
      <span class="meta-input-row">
        <input type="text" bind:value={meta.subchapter} />
        {@render metaAiBtn('subchapter')}
      </span>
    </label>
    <label class="meta-field">
      <span>Thèmes</span>
      <span class="meta-input-row">
        <input type="text" bind:value={meta.theme} placeholder="mots-clés, séparés, par, virgules" />
        {@render metaAiBtn('theme')}
      </span>
    </label>
    <label class="meta-field">
      <span>Auteur</span>
      <input type="text" bind:value={meta.author} placeholder="Prénom Nom" />
    </label>
    <label class="meta-field">
      <span>Organisation</span>
      <input type="text" bind:value={meta.organization} />
    </label>
    <label class="meta-field">
      <span>UUID</span>
      <span class="meta-uuid">
        <input type="text" bind:value={meta.uuid} maxlength="12" />
        <button type="button" title="Régénérer l'identifiant" onclick={() => (meta.uuid = generateShortUuid())}>⟳</button>
      </span>
    </label>
  </div>
</details>

<style>
  .editor-meta {
    @apply border border-gray-200 rounded-lg bg-white;
    order: 2;
  }

  .editor-meta > summary {
    @apply px-3 py-2 text-sm font-semibold text-gray-700 cursor-pointer select-none;
  }

  .editor-meta-grid {
    @apply grid grid-cols-2 gap-x-3 gap-y-2 px-3 pb-3;
  }

  @media (max-width: 640px) {
    .editor-meta-grid {
      @apply grid-cols-1;
    }
  }

  .meta-field {
    @apply flex flex-col gap-0.5 text-xs font-medium text-gray-500;
  }

  .meta-field--wide {
    @apply col-span-2;
  }

  @media (max-width: 640px) {
    .meta-field--wide {
      @apply col-span-1;
    }
  }

  .meta-field input,
  .meta-field select {
    @apply px-2 py-1.5 rounded-md border border-gray-300 text-sm text-gray-800 font-normal
           focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400;
  }

  .meta-input-row {
    @apply flex gap-1;
  }

  .meta-input-row input,
  .meta-input-row select {
    @apply flex-1 min-w-0;
  }

  .meta-ai-btn {
    @apply px-2 rounded-md border border-brand-200 bg-brand-50 text-sm
           hover:bg-brand-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
  }

  .meta-uuid {
    @apply flex gap-1;
  }

  .meta-uuid input {
    @apply flex-1 min-w-0 font-mono;
  }

  .meta-uuid button {
    @apply px-2 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50;
  }
</style>
