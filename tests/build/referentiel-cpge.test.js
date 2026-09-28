// tests/build/referentiel-cpge.test.js
// Référentiel CPGE : lecture des programmes Markdown
// (scripts/utils/parse-programme-cpge.js), cohérence du corpus réel, lecture
// des rattachements et écriture en base (scripts/build-referentiel-cpge.js).
//
// L'instantané __snapshots__/cpge-identifiants.txt fige la liste des
// identifiants : les rattachements d'exercices en dépendent, toute
// modification doit donc être délibérée (`npx vitest run -u` après relecture).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

import { parseProgramme, parseFrontMatter, semestreFromPartie } from '../../scripts/utils/parse-programme-cpge.js';
import {
  collectReferentiel,
  collectRattachements,
  insertReferentiel
} from '../../scripts/build-referentiel-cpge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const FRONT = `---
programme: test
titre: Programme de test
filieres: [MPSI, MP2I]
annee: 1
nor: [ESRS0000000A]
pages: 1-3
---
`;

const md = body => `${FRONT}\n# Programme de test\n\n${body}`;
const ids = parsed => parsed.nodes.map(node => node.id);

describe('parseFrontMatter', () => {
  it('lit valeurs, listes et entiers, et ignore les commentaires de fin de ligne', () => {
    const meta = parseFrontMatter(['programme: mp-mpi   # = nom du fichier', 'filieres: [MP, MPI]', 'annee: 2', 'pages: 1-29']);
    expect(meta).toEqual({ programme: 'mp-mpi', filieres: ['MP', 'MPI'], annee: 2, pages: '1-29' });
  });
});

describe('semestreFromPartie', () => {
  it('reconnaît les semestres des deux gabarits', () => {
    expect(semestreFromPartie('Premier semestre')).toBe(1);
    expect(semestreFromPartie('Deuxième semestre')).toBe(2);
    expect(semestreFromPartie('3 – Programme du second semestre')).toBe(2);
    expect(semestreFromPartie('Programme')).toBeNull();
  });
});

describe('parseProgramme — nœuds', () => {
  it('ignore le préambule, y compris ses titres et tableaux', () => {
    const parsed = parseProgramme(md(`## Préambule

### Objectifs de formation

| Compétence | Description |
| --- | --- |
| Chercher | … |

## Premier semestre

### Nombres complexes {#test.complexes}
`));
    expect(ids(parsed)).toEqual(['test.complexes']);
    expect(parsed.warnings).toEqual([]);
  });

  it('rattache les sous-sections lettrées à leur section et numérote dans l’ordre du texte', () => {
    const parsed = parseProgramme(md(`## Premier semestre

### Nombres complexes {#test.complexes}

#### a) Nombres complexes {#test.complexes.a}

#### b) Conjugaison et module {#test.complexes.b}
`));
    expect(parsed.nodes.map(({ id, type, parent_id, lettre, ordre, semestre }) => ({ id, type, parent_id, lettre, ordre, semestre })))
      .toEqual([
        { id: 'test.complexes', type: 'section', parent_id: null, lettre: null, ordre: 0, semestre: 1 },
        { id: 'test.complexes.a', type: 'sous-section', parent_id: 'test.complexes', lettre: 'a', ordre: 1, semestre: 1 },
        { id: 'test.complexes.b', type: 'sous-section', parent_id: 'test.complexes', lettre: 'b', ordre: 2, semestre: 1 }
      ]);
  });

  it('rattache une partie « A - » à la section générale, et ses lettres à la partie', () => {
    const parsed = parseProgramme(md(`## Programme

### Suites et séries de fonctions {#test.suites-series}

### A - Suites de fonctions {#test.suites-fonctions}

#### a) Modes de convergence {#test.suites-fonctions.a}

### B - Séries entières {#test.series-entieres}

### Intégration {#test.integration}
`));
    const parent = Object.fromEntries(parsed.nodes.map(node => [node.id, node.parent_id]));
    expect(parent).toEqual({
      'test.suites-series': null,
      'test.suites-fonctions': 'test.suites-series',
      'test.suites-fonctions.a': 'test.suites-fonctions',
      'test.series-entieres': 'test.suites-series',
      'test.integration': null
    });
  });

  it('ne crée pas de nœud pour une rubrique sans identifiant (texte général BCPST)', () => {
    const parsed = parseProgramme(md(`## II – Programme de première année

### 1 – Préambule

Texte général.

## 2 – Programme du premier semestre

### Outils 1 – Logique {#test.logique}
`));
    expect(ids(parsed)).toEqual(['test.logique']);
    expect(parsed.nodes[0].texte).toBeNull();
  });

  it('range bandeau et tableau dans le nœud, sans en-tête ni séparateur', () => {
    const parsed = parseProgramme(md(`## Programme

### Réduction {#test.reduction}

Le but de cette section est **substantiel**.

#### a) Éléments propres {#test.reduction.a}

| Contenus | Capacités & commentaires |
| --- | --- |
| Valeur propre.<br>Vecteur propre. | Équation $u(x)=\\lambda x$. |
| Spectre. | |

★
`));
    const [section, sub] = parsed.nodes;
    expect(section.texte).toBe('Le but de cette section est **substantiel**.');
    expect(section.contenus).toEqual([]);
    expect(sub.contenus).toEqual([
      { contenu: 'Valeur propre.<br>Vecteur propre.', commentaire: 'Équation $u(x)=\\lambda x$.' },
      { contenu: 'Spectre.', commentaire: '' }
    ]);
    expect(sub.texte).toBe('★');
  });

  it('accepte l’en-tête « Commentaires » du gabarit BCPST', () => {
    const parsed = parseProgramme(md(`## 2 – Programme du premier semestre

### Outils 2 – Nombres réels {#test.reels}

| Contenus | Commentaires |
| --- | --- |
| Intervalles. | On se limite à une description. |
`));
    expect(parsed.nodes[0].contenus).toHaveLength(1);
  });

  it('signale une sous-section lettrée sans identifiant et un front matter absent', () => {
    const parsed = parseProgramme('# Sans front matter\n\n## Programme\n\n### S {#x.s}\n\n#### a) Oubli\n', 'x.md');
    expect(parsed.warnings.join(' ')).toMatch(/front matter absent/);
    expect(parsed.warnings.join(' ')).toMatch(/a\) Oubli.*sans identifiant/);
  });
});

describe('référentiel réel (content/referentiels/cpge)', () => {
  const referentiel = collectReferentiel();

  it('se lit sans erreur ni avertissement', () => {
    expect(referentiel.errors).toEqual([]);
    expect(referentiel.warnings).toEqual([]);
  });

  it('couvre les onze filières attendues', () => {
    const filieres = referentiel.programmes.flatMap(programme => programme.filieres).sort();
    expect(filieres).toEqual(['BCPST', 'BCPST', 'MP', 'MP2I', 'MPI', 'MPSI', 'PC', 'PCSI', 'PSI', 'PT', 'PTSI']);
  });

  it('donne à chaque sous-section une lettre cohérente avec son identifiant', () => {
    const incoherent = referentiel.nodes
      .filter(node => node.type === 'sous-section')
      .filter(node => node.id !== `${node.parent_id}.${node.lettre}`);
    expect(incoherent.map(node => node.id)).toEqual([]);
  });

  it('garde des identifiants stables (instantané versionné)', async () => {
    const list = referentiel.nodes.map(node => node.id).join('\n') + '\n';
    await expect(list).toMatchFileSnapshot('__snapshots__/cpge-identifiants.txt');
  });
});

describe('collectRattachements', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oym-cpge-'));
    fs.mkdirSync(path.join(dir, 'exo7'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (uuid, rattachements) =>
    fs.writeFileSync(path.join(dir, 'exo7', `${uuid}.json`), JSON.stringify({ uuid, rattachements }));

  it('lit les rattachements valides et normalise valide/confiance', () => {
    write('abcd', [
      { noeud: 'p.s.a', origine: 'llm', confiance: 0.8 },
      { noeud: 'p.s', origine: 'manuel', valide: true }
    ]);
    const { rattachements, errors } = collectRattachements(new Set(['p.s', 'p.s.a']), dir);
    expect(errors).toEqual([]);
    expect(rattachements).toEqual([
      { uuid: 'abcd', noeud_id: 'p.s.a', origine: 'llm', confiance: 0.8, valide: 0 },
      { uuid: 'abcd', noeud_id: 'p.s', origine: 'manuel', confiance: null, valide: 1 }
    ]);
  });

  it('refuse un nœud disparu du référentiel et une origine inconnue', () => {
    write('abcd', [
      { noeud: 'p.disparu', origine: 'llm' },
      { noeud: 'p.s', origine: 'intuition' }
    ]);
    const { rattachements, errors } = collectRattachements(new Set(['p.s']), dir);
    expect(rattachements).toEqual([]);
    expect(errors.join(' ')).toMatch(/p\.disparu absent du référentiel/);
    expect(errors.join(' ')).toMatch(/origine « intuition » inconnue/);
  });
});

describe('insertReferentiel', () => {
  it('écrit programmes, filières, nœuds et rattachements, en écartant les exercices absents', () => {
    const db = new Database(':memory:');
    db.exec(fs.readFileSync(path.join(ROOT, 'scripts/schema.sql'), 'utf8'));
    db.prepare("INSERT INTO exercises (uuid, title, chapter, content_json) VALUES ('abcd', 't', 'c', '[]')").run();

    const parsed = parseProgramme(md(`## Programme

### Réduction {#test.reduction}

#### a) Éléments propres {#test.reduction.a}

| Contenus | Capacités & commentaires |
| --- | --- |
| Valeur propre. | |

### Suites et séries {#test.suites-series}

### A - Séries entières {#test.series-entieres}

#### a) Rayon {#test.series-entieres.a}
`));
    const referentiel = {
      programmes: [{
        programme: 'test', titre: 'Programme de test', annee: 1, filieres: ['MPSI', 'MP2I'],
        bo: null, nor: '[]', arrete: null, rentree: null, source_url: null, bo_url: null,
        pages: null, source_path: null, source_hash: null
      }],
      nodes: parsed.nodes
    };
    const outcome = insertReferentiel(db, referentiel, [
      { uuid: 'abcd', noeud_id: 'test.reduction.a', origine: 'manuel', confiance: null, valide: 1 },
      { uuid: 'zzzz', noeud_id: 'test.reduction', origine: 'llm', confiance: 0.5, valide: 0 },
      { uuid: 'abcd', noeud_id: 'test.series-entieres.a', origine: 'llm', confiance: 0.9, valide: 0 }
    ]);

    expect(outcome.orphelins).toEqual(['zzzz']);
    expect(db.prepare('SELECT filiere FROM cpge_filieres ORDER BY filiere').all().map(r => r.filiere)).toEqual(['MP2I', 'MPSI']);
    const node = db.prepare("SELECT * FROM cpge_noeuds WHERE id = 'test.reduction.a'").get();
    expect(node.parent_id).toBe('test.reduction');
    expect(JSON.parse(node.contenus)).toEqual([{ contenu: 'Valeur propre.', commentaire: '' }]);

    // Filtre par section : le nœud et ses descendants, en suivant parent_id —
    // une partie « A - » n'a pas l'identifiant de sa section générale en préfixe.
    const inSection = db.prepare(`
      WITH RECURSIVE sous(id) AS (
        SELECT :s UNION ALL SELECT n.id FROM cpge_noeuds n JOIN sous ON n.parent_id = sous.id
      )
      SELECT noeud_id FROM exercise_cpge WHERE noeud_id IN (SELECT id FROM sous)
    `);
    expect(inSection.all({ s: 'test.reduction' })).toEqual([{ noeud_id: 'test.reduction.a' }]);
    expect(inSection.all({ s: 'test.suites-series' })).toEqual([{ noeud_id: 'test.series-entieres.a' }]);

    // Reconstruction intégrale : une seconde écriture remplace la première.
    insertReferentiel(db, referentiel, []);
    expect(db.prepare('SELECT COUNT(*) AS n FROM exercise_cpge').get().n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM cpge_noeuds').get().n).toBe(5);
    db.close();
  });
});
