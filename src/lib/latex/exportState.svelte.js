// src/lib/latex/exportState.svelte.js
// État partagé de l'export LaTeX.
//
// `export.js` génère le document ; cette classe porte tout ce que les points
// d'entrée recopiaient auparavant chacun de leur côté : options, chargement des
// artifacts, source dérivée, nom de fichier, téléchargement et copie.
//
// Le chargement des artifacts est la raison d'être principale du regroupement.
// Deux des quatre points d'entrée l'omettaient, et un exercice illustré en
// sortait avec des chemins d'image cassés et sans ses blocs de code, sans
// aucun signal. Passer par cette classe rend l'oubli impossible.

import { browser } from '$app/environment';
import {
  buildLatexExport,
  downloadTexFile,
  exerciseNeedsArtifacts,
  fetchArtifactsMap,
  latexFileName,
} from './export.js';

/**
 * @typedef {Object} LatexExportInput
 * @property {Object[]} exercises  — exercices à exporter (format listStore)
 * @property {string}   [title]    — titre du document
 * @property {string}   [fallbackName] — nom de fichier si le titre est vide
 * @property {string}   [fileName] — impose le nom de fichier, quand il ne doit
 *   pas suivre le titre du document (l'éditeur nomme d'après l'uuid)
 */

export class LatexExport {
  /**
   * Réglages de contenu, liés aux cases de LatexContentOptions.
   * @type {{ includeHints: boolean, includeSolutions: boolean, solutionsAtEnd: boolean }}
   */
  content = $state({
    includeHints: true,
    includeSolutions: true,
    solutionsAtEnd: false,
  });

  /**
   * Réglages de mise en page. `buildPreamble` les gère déjà ; aucune interface
   * ne les expose encore, mais ils transitent d'ici pour que ce soit le seul
   * endroit à modifier quand ce sera le cas.
   * @type {{ documentClass: string, fontSize: string, paperSize: string, margin: string, language: string }}
   */
  layout = $state({
    documentClass: 'article',
    fontSize: '12pt',
    paperSize: 'a4paper',
    margin: '2.5cm',
    language: 'french',
  });

  /** @type {Record<string, Object>} artifacts par uuid */
  artifactsMap = $state({});
  artifactsLoading = $state(false);

  /** Retour visuel des actions de copie. */
  copied = $state(false);

  /** @type {File[]} ressources téléchargées pour la compilation en ligne */
  #assets = $state([]);
  assetsLoading = $state(false);
  #assetsKey = null;

  #input;
  #copyTimer = null;
  /** Empreinte de la liste dont les artifacts sont chargés ou en cours. */
  #syncedKey = null;

  /**
   * À construire pendant l'initialisation d'un composant : l'effet qui suit la
   * composition de la liste s'attache à son cycle de vie.
   *
   * @param {() => LatexExportInput} input — lecture réactive du contexte
   */
  constructor(input) {
    this.#input = input;

    $effect(() => {
      // `artifactsKey` est la seule dépendance suivie : changer une option de
      // contenu ne doit jamais relancer de requête réseau.
      this.artifactsKey;
      if (browser) this.syncArtifacts();
    });
  }

  /**
   * Télécharge les figures joignables à la compilation en ligne.
   *
   * Appelée à l'ouverture du compilateur plutôt qu'au chargement : la plupart
   * des exports ne sont jamais compilés en ligne, et ces fichiers ne servent
   * qu'à ce cas. Comme `syncArtifacts`, la garde est portée par la méthode.
   *
   * @returns {Promise<void>}
   */
  async loadAssets() {
    const wanted = this.#remoteResult.images;
    const key = wanted.map((img) => img.localPath).join(',');
    if (key === this.#assetsKey) return;
    this.#assetsKey = key;

    if (wanted.length === 0) {
      this.#assets = [];
      this.assetsLoading = false;
      return;
    }

    this.assetsLoading = true;
    try {
      const files = await Promise.all(
        wanted.map(async (img) => {
          try {
            const response = await fetch(img.url);
            if (!response.ok) return null;
            const blob = await response.blob();
            return new File([blob], img.localPath, { type: blob.type });
          } catch {
            // Une figure indisponible ne doit pas empêcher la compilation :
            // le document la référencera sans la trouver, ce que le journal
            // LaTeX signalera clairement.
            return null;
          }
        }),
      );
      if (key === this.#assetsKey) this.#assets = files.filter(Boolean);
    } finally {
      if (key === this.#assetsKey) this.assetsLoading = false;
    }
  }

  /** Exercices tels que fournis par le conteneur. */
  get exercises() {
    return this.#input()?.exercises || [];
  }

  get title() {
    return this.#input()?.title || '';
  }

  /** Exercices référençant une image ou un bloc de code externe. */
  #needingArtifacts() {
    return this.exercises.filter((ex) => ex?.uuid && exerciseNeedsArtifacts(ex));
  }

  /**
   * Empreinte de la liste : change quand sa composition change.
   *
   * Volontairement un accesseur et non un `$derived` : `syncArtifacts()` doit
   * toujours comparer la valeur courante, y compris hors d'un contexte
   * réactif. Le calcul se réduit à un filtre sur une petite liste.
   */
  get artifactsKey() {
    return this.#needingArtifacts()
      .map((ex) => ex.uuid)
      .join(',');
  }

  /**
   * Aligne les artifacts chargés sur la composition courante de la liste.
   *
   * La garde contre le rechargement est portée par la méthode, et non par les
   * seules dépendances de l'effet : c'est le comportement qui compte pour le
   * réseau, il doit être vérifiable sans dépendre du graphe de réactivité.
   * Appelée automatiquement par le constructeur ; publique pour les cas où un
   * conteneur veut forcer la synchronisation.
   *
   * @returns {Promise<void>}
   */
  async syncArtifacts() {
    const key = this.artifactsKey;
    if (key === this.#syncedKey) return;
    this.#syncedKey = key;

    if (key === '') {
      this.artifactsMap = {};
      this.artifactsLoading = false;
      return;
    }

    this.artifactsLoading = true;
    try {
      const map = await fetchArtifactsMap(this.#needingArtifacts());
      // Une liste modifiée pendant le chargement invalide le résultat en vol :
      // sans ce contrôle, une réponse lente écraserait celle de la nouvelle.
      if (key === this.#syncedKey) this.artifactsMap = map;
    } finally {
      if (key === this.#syncedKey) this.artifactsLoading = false;
    }
  }

  #buildOptions() {
    return {
      ...this.content,
      ...this.layout,
      artifactsMap: this.artifactsMap,
      origin: browser ? window.location.origin : '',
    };
  }

  /** Document destiné au téléchargement : images en fichiers joints locaux. */
  #result = $derived(buildLatexExport(this.exercises, this.title, this.#buildOptions()));

  /**
   * Document destiné au compilateur en ligne. Il diffère du précédent : les
   * noms de fichiers y sont aplatis (le service range tout dans un répertoire
   * unique) et les formats qu'il ne sait pas recevoir sont remplacés par un
   * encart. La version téléchargée, elle, garde ses \includegraphics intacts
   * pour une compilation locale.
   */
  #remoteResult = $derived(
    buildLatexExport(this.exercises, this.title, {
      ...this.#buildOptions(),
      imageMode: 'remote',
    }),
  );

  /** Source LaTeX complète du document. */
  get source() {
    return this.#result.source;
  }

  /** Ancres de navigation (une par exercice), avec leur ligne dans `source`. */
  get anchors() {
    return this.#result.anchors;
  }

  /** Images à placer à côté du .tex pour que le document compile illustré. */
  get images() {
    return this.#result.images;
  }

  /** Source à envoyer au compilateur en ligne. */
  get compilerSource() {
    return this.#remoteResult.source;
  }

  /**
   * Figures que le compilateur en ligne ne recevra pas, remplacées par un
   * encart dans `compilerSource`. À montrer avant de lancer la compilation :
   * l'utilisateur doit savoir que le PDF sera incomplet, et que télécharger le
   * .tex reste la voie pour l'obtenir illustré.
   */
  get skippedImages() {
    return this.#remoteResult.skippedImages;
  }

  /** Ressources jointes à la compilation (formats acceptés uniquement). */
  get assets() {
    return this.#assets;
  }

  /** Nom de fichier sans extension, aligné sur celui du téléchargement. */
  get fileName() {
    const input = this.#input() || {};
    const fallback = input.fallbackName || 'exercices';
    return latexFileName(input.fileName || this.title, fallback);
  }

  /** Nom de fichier affichable, extension comprise. */
  get texFileName() {
    return `${this.fileName}.tex`;
  }

  get isEmpty() {
    return this.exercises.length === 0;
  }

  /** Déclenche le téléchargement du .tex. */
  download() {
    downloadTexFile(this.source, this.fileName);
  }

  /**
   * Copie la source dans le presse-papiers et bascule `copied` le temps d'un
   * retour visuel.
   * @returns {Promise<boolean>} succès de la copie
   */
  async copy() {
    try {
      await navigator.clipboard.writeText(this.source);
      this.copied = true;
      if (this.#copyTimer) clearTimeout(this.#copyTimer);
      this.#copyTimer = setTimeout(() => {
        this.copied = false;
      }, 2000);
      return true;
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission
      // refusée) : le téléchargement reste la voie de secours.
      return false;
    }
  }
}
