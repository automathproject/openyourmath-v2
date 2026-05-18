<!--
  StarsRating — étoiles de difficulté (1 à 5).
  Remplace l'ancien système .difficulty-dot (cercles).

  Usage :
    <StarsRating n={3} />          ★★★☆☆
    <StarsRating n={2} total={4} /> ★★☆☆

  Référence DS : #stars dans OpenYourMath Design System.html
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {number} n         - étoiles pleines
   * @property {number} [total]   - total d'étoiles (par défaut 5)
   * @property {string} [size]    - taille CSS (par défaut 13px)
   * @property {string} [label]   - aria-label override
   */
  /** @type {Props} */
  let { n, total = 5, size = '13px', label } = $props();

  let aria = $derived(label ?? `Difficulté ${n} sur ${total}`);
</script>

<span class="stars" style:font-size={size} aria-label={aria}>
  {#each Array(total) as _, i}
    <span class:star-off={i >= n} aria-hidden="true">★</span>
  {/each}
</span>
