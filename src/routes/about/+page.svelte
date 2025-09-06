<!-- src/routes/about/+page.svelte -->
<svelte:head>
  <title>À propos - OpenYourMath v2</title>
  <meta name="description" content="À propos d'OpenYourMath: projet libre pour explorer et pratiquer des exercices de mathématiques." />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  <header class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900">À propos</h1>
    <p class="text-gray-600 mt-2">OpenYourMath V2 • Exercices de mathématiques</p>
  </header>

  <section class="prose prose-gray max-w-none">
    <p>
      OpenYourMath est un projet ouvert qui facilite la recherche, la navigation et la
      pratique d'exercices de mathématiques. Cette version V2 propose une recherche
      textuelle, une navigation par chapitres et une gestion de liste d'exercices à partager.
    </p>

    <p>
      Le code est pensé pour être simple et extensible. Si vous souhaitez contribuer,
      proposer des améliorations ou signaler un problème, n'hésitez pas à ouvrir une issue
      ou à proposer une pull request : <a href="https://github.com/automathproject/openyourmath-v2/">Dépôt Git</a>
    </p>

    <h2>Fonctionnalités principales</h2>
    <ul>
      <li>Recherche d'exercices par mots-clés et filtres.</li>
      <li>Navigation par niveaux, modules, chapitres et sous-chapitres.</li>
      <li>Prévisualisation d'exercices et ajout à une liste personnelle.</li>
      <li>Partage et rechargement d'une liste via URL.</li>
    </ul>

    <h2>Contact</h2>
    <p>
      Pour toute question ou suggestion, vous pouvez contacter l'équipe mainteneuse
      via les canaux habituels du projet à l'adresse mail de <a href="mailto:maxime.nguyen@st-cyr.terre-net.defense.gouv.fr">Maxime Nguyen</a>
    </p>
  </section>
</div>

<style>
  .prose h2 {
    margin-top: 1.5rem;
  }
</style>

