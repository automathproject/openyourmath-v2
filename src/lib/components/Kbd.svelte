<!--
  Kbd — affichage d'une touche clavier.

  Usage :
    <Kbd>⌘</Kbd>
    <Kbd>K</Kbd>
    <span>Recherche : <Kbd>⌘</Kbd> + <Kbd>K</Kbd></span>

  Référence DS : #misc dans OpenYourMath Design System.html
-->

<script>
  /** @type {{ children?: import('svelte').Snippet }} */
  let { children } = $props();
</script>

<kbd class="kbd">{@render children?.()}</kbd>
