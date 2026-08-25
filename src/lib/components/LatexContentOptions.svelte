<!--
  Réglages de contenu communs aux sorties LaTeX : export, aperçu de source et
  compilation. Les trois props sont bindables pour que le conteneur conserve
  la configuration qui lui est propre.
-->
<script>
  let {
    includeHints = $bindable(true),
    includeSolutions = $bindable(true),
    solutionsAtEnd = $bindable(false),
    compact = false,
  } = $props();

  /**
   * Retirer les solutions rend leur position sans objet : on la réinitialise
   * à la source plutôt que par un effet réactif, pour que l'état ne transite
   * jamais par une combinaison incohérente.
   */
  function toggleSolutions(event) {
    includeSolutions = event.currentTarget.checked;
    if (!includeSolutions) solutionsAtEnd = false;
  }
</script>

<fieldset
  class:latex-content-options--compact={compact}
  class="latex-content-options"
>
  <legend>Contenu du document</legend>

  <label class="content-option">
    <input type="checkbox" bind:checked={includeHints} />
    <span>Inclure les indications</span>
  </label>

  <label class="content-option">
    <input
      type="checkbox"
      checked={includeSolutions}
      onchange={toggleSolutions}
    />
    <span>Inclure les solutions</span>
  </label>

  <div
    class:content-option--disabled={!includeSolutions}
    class="solution-placement"
  >
    <span class="solution-placement-label">Position des solutions</span>
    <label class="content-option">
      <input
        type="radio"
        checked={!solutionsAtEnd}
        disabled={!includeSolutions}
        onchange={() => (solutionsAtEnd = false)}
      />
      <span>Après chaque question</span>
    </label>
    <label class="content-option">
      <input
        type="radio"
        checked={solutionsAtEnd}
        disabled={!includeSolutions}
        onchange={() => (solutionsAtEnd = true)}
      />
      <span>À la fin du document</span>
    </label>
  </div>
</fieldset>

<style>
  .latex-content-options {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    width: 100%;
    margin-bottom: 0.15rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: theme("colors.gray.600");
  }

  .content-option {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: theme("colors.gray.700");
    font-size: 0.8rem;
    cursor: pointer;
  }

  input {
    width: 0.9rem;
    height: 0.9rem;
    accent-color: theme("colors.brand.600");
    cursor: pointer;
  }

  .solution-placement {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-left: 1rem;
    border-left: 1px solid theme("colors.gray.200");
  }

  .solution-placement-label {
    color: theme("colors.gray.500");
    font-size: 0.75rem;
  }

  .content-option--disabled {
    opacity: 0.5;
  }

  .content-option--disabled .content-option,
  .content-option--disabled input {
    cursor: not-allowed;
  }

  .latex-content-options--compact {
    gap: 0.5rem 0.75rem;
  }

  .latex-content-options--compact legend {
    display: none;
  }

  .latex-content-options--compact .content-option,
  .latex-content-options--compact .solution-placement-label {
    font-size: 0.75rem;
  }

  @media (max-width: 640px) {
    .solution-placement {
      width: 100%;
      padding-left: 0;
      border-left: 0;
    }
  }
</style>
