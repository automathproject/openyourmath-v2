// Comportement de la fabrique d'état de l'export LaTeX.
//
// Deux des quatre points d'entrée oubliaient de charger les artifacts, et un
// exercice illustré s'exportait avec des chemins d'image cassés sans aucun
// signal. Ces tests verrouillent les deux propriétés qui l'empêchent :
// les artifacts sont chargés dès qu'un exercice en a besoin, et ils ne sont
// rechargés que si la composition de la liste change.
//
// Vitest exécute ces modules en mode serveur, où le compilateur Svelte réduit
// les effets à des no-op et fige les `$derived` après leur première lecture
// (tester la réactivité elle-même demanderait un environnement DOM). Ces tests
// couvrent donc ce qui ne dépend pas du graphe de réactivité : la garde de
// `syncArtifacts()`, le calcul de `artifactsKey`, le nom de fichier et le
// câblage des options vers le générateur. La propagation réactive reste
// vérifiée à l'usage dans l'application.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

const { LatexExport } = await import('../../src/lib/latex/exportState.svelte.js');

/** Exercice sans ressource externe. */
function plainExercise(uuid = 'aaaa') {
  return {
    uuid,
    title: `Exercice ${uuid}`,
    content: [{ type: 'question', order: 1, latex: 'Calculer $\\int_0^1 x \\dx$.' }],
  };
}

/** Exercice référençant une image : nécessite son fichier d'artifacts. */
function illustratedExercise(uuid = 'bbbb') {
  return {
    uuid,
    title: `Figure ${uuid}`,
    content: [
      {
        type: 'question',
        order: 1,
        latex: 'Voir la figure.\n\\includegraphics{fig/schema.png}',
      },
    ],
  };
}

/** Exercice muni d'une solution, pour tester les options de contenu. */
function solvedExercise() {
  return {
    uuid: 'cccc',
    title: 'Avec solution',
    content: [
      { type: 'question', order: 1, latex: 'Question ?' },
      { type: 'reponse', order: 2, latex: 'La réponse.' },
    ],
  };
}

let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = vi.fn(async (url) => {
    fetchCalls.push(url);
    return {
      ok: true,
      json: async () => ({
        images: [{ originalPath: 'fig/schema.png', url: '/artifacts/images/bbbb/schema.png' }],
      }),
    };
  });
  globalThis.window = { location: { origin: 'https://openyourmath.org' } };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window;
});

describe('LatexExport', () => {
  it('génère la source et le nom de fichier depuis le contexte fourni', () => {
    const ex = new LatexExport(() => ({
      exercises: [plainExercise()],
      title: 'Feuille de TD n°3',
    }));

    expect(ex.source).toContain('\\documentclass');
    expect(ex.source).toContain('Exercice 1');
    expect(ex.fileName).toBe('feuille_de_td_n_3');
    expect(ex.texFileName).toBe('feuille_de_td_n_3.tex');
    expect(ex.isEmpty).toBe(false);
  });

  it('ne demande aucun artifact pour un exercice sans ressource externe', async () => {
    const ex = new LatexExport(() => ({
      exercises: [plainExercise()],
      title: 'Sans image',
    }));
    await ex.syncArtifacts();

    expect(fetchCalls).toEqual([]);
    expect(ex.artifactsLoading).toBe(false);
  });

  it('charge les artifacts et réécrit les chemins d’image', async () => {
    const ex = new LatexExport(() => ({
      exercises: [plainExercise('aaaa'), illustratedExercise()],
      title: 'Avec image',
    }));
    await ex.syncArtifacts();

    // Seul l'exercice illustré est demandé : l'autre n'a pas de ressource.
    expect(fetchCalls).toEqual(['/artifacts/bbbb.json']);
    expect(ex.source).toContain('images/bbbb/schema.png');
    expect(ex.source).not.toContain('{fig/schema.png}');
    expect(ex.images).toEqual([
      { localPath: 'images/bbbb/schema.png', url: '/artifacts/images/bbbb/schema.png' },
    ]);
  });

  it('ne recharge pas les artifacts quand une option change', async () => {
    const ex = new LatexExport(() => ({
      exercises: [illustratedExercise()],
      title: 'Avec image',
    }));
    await ex.syncArtifacts();
    expect(fetchCalls).toHaveLength(1);

    ex.content.includeSolutions = false;
    ex.layout.paperSize = 'a5paper';
    await ex.syncArtifacts();

    expect(fetchCalls).toHaveLength(1);
    // La source, elle, suit bien le changement d'option.
    expect(ex.source).toContain('a5paper');
  });

  it('recharge les artifacts quand la composition de la liste change', async () => {
    let exercises = [illustratedExercise('bbbb')];
    const ex = new LatexExport(() => ({ exercises, title: 'Liste' }));
    await ex.syncArtifacts();
    expect(fetchCalls).toHaveLength(1);

    // Même contenu, nouveau tableau : rien à recharger.
    exercises = [illustratedExercise('bbbb')];
    await ex.syncArtifacts();
    expect(fetchCalls).toHaveLength(1);

    // Un exercice illustré de plus : nouvelle requête.
    exercises = [illustratedExercise('bbbb'), illustratedExercise('cccc')];
    await ex.syncArtifacts();
    expect(fetchCalls).toEqual([
      '/artifacts/bbbb.json',
      '/artifacts/bbbb.json',
      '/artifacts/cccc.json',
    ]);
  });

  it('transmet les réglages de contenu et de mise en page au générateur', () => {
    // Le mode serveur de Vitest fige les `$derived` : on compare deux
    // instances plutôt que de muter l'une d'elles, ce qui vérifie le câblage
    // des options sans dépendre de la réévaluation réactive.
    const withSolutions = new LatexExport(() => ({
      exercises: [solvedExercise()],
      title: 'Test',
    }));

    const withoutSolutions = new LatexExport(() => ({
      exercises: [solvedExercise()],
      title: 'Test',
    }));
    withoutSolutions.content.includeSolutions = false;
    withoutSolutions.layout.paperSize = 'a5paper';

    expect(withSolutions.source).toContain('La réponse.');
    expect(withSolutions.source).toContain('a4paper');
    expect(withoutSolutions.source).not.toContain('La réponse.');
    expect(withoutSolutions.source).toContain('a5paper');
  });

  it('retombe sur le nom de secours quand le titre ne donne rien', () => {
    const ex = new LatexExport(() => ({
      exercises: [plainExercise()],
      title: '  ///  ',
      fallbackName: 'exercice',
    }));
    expect(ex.fileName).toBe('exercice');
  });
});
