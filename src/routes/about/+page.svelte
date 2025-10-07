<!-- src/routes/about/+page.svelte -->
<svelte:head>
  <title>À propos — OpenYourMath v2</title>
  <meta name="description" content="OpenYourMath : plateforme associative et libre pour explorer et pratiquer des exercices de mathématiques, sans collecte de données personnelles." />
</svelte:head>

<div class="container mx-auto px-4 py-10 max-w-3xl">
  <header class="mb-8 animate-slide-in">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">À propos</h1>
    <p class="text-gray-600 dark:text-gray-300 mt-2">
      OpenYourMath v2 • Plateforme pédagogique libre
    </p>
  </header>

  <section
    class="prose prose-neutral dark:prose-invert max-w-none bg-white/60 dark:bg-gray-900/60 rounded-xl shadow-card p-6"
  >
    <h2>Mission</h2>
    <p>
      <strong>OpenYourMath</strong> est une plateforme associative et ouverte qui facilite la
      recherche, la gestion et l'affichage d’exercices de mathématiques. 
    </p>

    <ul>
      <li>Recherche plein-texte et filtres (niveau, module, chapitre, sous-chapitre).</li>
      <li>Prévisualisation des exercices et listes partageables par URL.</li>
      <li>Rendu LaTeX/KaTeX et macros spécifiques aux énoncés.</li>
    </ul>

    <h2>Statut & licences</h2>
    <p>
      OpenYourMath est porté par une association loi 1901.
      Sauf mention contraire, les contenus pédagogiques sont publiés sous
      <a class="text-brand-700 hover:text-brand-800" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
      Le code source est libre (ex. MIT) :
      <a class="text-brand-700 hover:text-brand-800" href="https://github.com/automathproject/openyourmath-v2/" rel="noopener">dépôt Git</a>.
    </p>

    <h2>Vie privée</h2>
    <p>
      <strong>Pas de collecte de données personnelles.</strong>
      Pas de comptes, pas de newsletter, pas de formulaires nominatifs.
      Les éventuelles mesures d’audience sont absentes ou strictement anonymisées.
      Voir <a class="text-brand-700 hover:text-brand-800" href="/confidentialite">Confidentialité</a>
      et <a class="text-brand-700 hover:text-brand-800" href="/mentions-legales">Mentions légales</a>.
    </p>

    <h2>Contribuer</h2>
    <p>
      Contributions bienvenues (corrections, exercices, améliorations).
      Ouvrez une issue ou une PR sur le
      <a class="text-brand-700 hover:text-brand-800" href="https://github.com/automathproject/openyourmath-v2/" rel="noopener">dépôt Git</a>.
    </p>

    <h2>Stack technique (v2)</h2>
    <ul>
      <li><strong>Frontend :</strong> SvelteKit + Tailwind CSS, KaTeX.</li>
      <li><strong>Données :</strong> SQlite, recherche locale.</li>
      <li><strong>Infra :</strong> Docker + Caddy (HTTPS), serveur Linux.</li>
    </ul>

    <h2>Hébergement & accessibilité</h2>
    <p>
      Hébergement en France (OVH). Accessibilité : navigation clavier, sémantique HTML, contrastes.
      Si vous rencontrez une difficulté, signalez-la pour correction.
    </p>

    <h2>Remerciements & sources</h2>
    <p>
      Merci aux auteurs et communautés qui partagent des ressources pédagogiques libres. En particulier la plateforme <a class="text-brand-700 hover:text-brand-800" href="https://exo7.emath.fr/" rel="noopener">Exo7</a> dont est issue une grande partie du contenu.
    </p>

    <h2>Contact</h2>
    <p>
      Écrivez à
      <a class="text-brand-700 hover:text-brand-800" href="mailto:maxime.nguyen@st-cyr.terre-net.defense.gouv.fr">Maxime Nguyen</a>,
      ou via le <a class="text-brand-700 hover:text-brand-800" href="https://github.com/automathproject/openyourmath-v2/issues" rel="noopener">tracker GitHub</a>.
    </p>

    <hr />

    <p class="text-sm text-gray-500 dark:text-gray-400">
      Dernière mise à jour : 26/09/2025 —
      <a class="text-brand-700 hover:text-brand-800" href="/mentions-legales">Mentions légales</a> •
      <a class="text-brand-700 hover:text-brand-800" href="/confidentialite">Confidentialité</a>
    </p>
  </section>
</div>

<style>
  .animate-slide-in {
    animation: slide-in 0.2s ease-out both;
  }
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  /* (Option) si tu préfères utiliser l'animation du config: class "animate-slide-in" existe déjà via extend.animation */
</style>
