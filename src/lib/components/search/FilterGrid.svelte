<script>
  import FilterField from '$lib/components/search/FilterField.svelte';

  export let filtersValues = {};
  export let moduleOptions = [];
  export let levelOptions = [];
  export let difficultyOptions = [];
  export let difficultyCounts = {};
  export let authorOptions = [];
  export let showModuleSuggestions = false;
  export let showAuthorSuggestions = false;
  export let onModuleInput = () => {};
  export let onModuleBlur = () => {};
  export let onModuleSuggestionSelect = () => {};
  export let onLevelChange = () => {};
  export let onDifficultyChange = () => {};
  export let onSolutionChange = () => {};
  export let onIndicationChange = () => {};
  export let onVideoChange = () => {};
  export let onAuthorInput = () => {};
  export let onAuthorBlur = () => {};
  export let onAuthorSuggestionSelect = () => {};

  $: moduleSuggestions = moduleOptions
    .filter((option) => option.value.toLowerCase().includes((filtersValues.module || '').toLowerCase()))
    .map((option) => ({ value: option.value, count: option.count }));

  $: authorSuggestions = authorOptions
    .filter((option) => option.value.toLowerCase().includes((filtersValues.author || '').toLowerCase()))
    .map((option) => ({ value: option.value, count: option.count }));

  $: levelSelectOptions = [
    { value: '', label: 'Tous les niveaux' },
    ...levelOptions.map((option) => ({
      value: option.value,
      label: `${option.value} (${option.count})`
    }))
  ];

  $: difficultySelectOptions = [
    { value: '', label: 'Toutes difficultés' },
    { value: 'null', label: `Sans difficulté (${difficultyCounts['null'] || 0})` },
    ...difficultyOptions
      .filter((option) => option.value !== 'null')
      .map((option) => ({ value: option.value, label: `${option.label} (${option.count})` }))
  ];

  const solutionOptions = [
    { value: '', label: 'Tous' },
    { value: '1', label: 'Avec solution' },
    { value: '0', label: 'Sans solution' }
  ];

  const indicationOptions = [
    { value: '', label: 'Tous' },
    { value: '1', label: 'Avec indication' },
    { value: '0', label: 'Sans indication' }
  ];

  const videoOptions = [
    { value: '', label: 'Tous' },
    { value: '1', label: 'Avec vidéo' },
    { value: '0', label: 'Sans vidéo' }
  ];
</script>

<div class="filters-grid filters-grid--desktop hidden md:grid">
  <FilterField
    type="input"
    id="module-filter"
    label="Module"
    value={filtersValues.module || ''}
    placeholder="Ex: Algèbre..."
    showSuggestions={showModuleSuggestions && moduleSuggestions.length > 0}
    suggestions={moduleSuggestions}
    onInput={onModuleInput}
    onBlur={onModuleBlur}
    onSuggestionSelect={(item) => onModuleSuggestionSelect(item.value)}
  />

  <FilterField
    type="select"
    id="level-filter"
    label="Niveau"
    value={filtersValues.level || ''}
    options={levelSelectOptions}
    onChange={onLevelChange}
  />

  <FilterField
    type="select"
    id="difficulty-filter"
    label="Difficulté"
    value={filtersValues.difficulty || ''}
    options={difficultySelectOptions}
    onChange={onDifficultyChange}
  />

  <FilterField
    type="select"
    id="solution-filter"
    label="Solution"
    value={filtersValues.hasSolution || ''}
    options={solutionOptions}
    onChange={onSolutionChange}
  />

  <FilterField
    type="select"
    id="indication-filter"
    label="Indication"
    value={filtersValues.hasIndication || ''}
    options={indicationOptions}
    onChange={onIndicationChange}
  />

  <FilterField
    type="select"
    id="video-filter"
    label="Vidéo"
    value={filtersValues.hasVideo || ''}
    options={videoOptions}
    onChange={onVideoChange}
  />

  <FilterField
    type="input"
    id="author-filter"
    label="Auteur"
    value={filtersValues.author || ''}
    placeholder="Nom de l'auteur..."
    showSuggestions={showAuthorSuggestions && authorSuggestions.length > 0}
    suggestions={authorSuggestions}
    onInput={onAuthorInput}
    onBlur={onAuthorBlur}
    onSuggestionSelect={(item) => onAuthorSuggestionSelect(item.value)}
  />
</div>

<style>
  .filters-grid {
    display:grid;
    gap:1rem;
    grid-template-columns:repeat(1, minmax(0, 1fr));
  }
  @media (min-width:1024px) {
    .filters-grid {
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }
  }
</style>
