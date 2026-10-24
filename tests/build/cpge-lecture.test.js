// Lecture du référentiel CPGE par l'application (src/lib/db/cpge.js), sur une
// base de test : filtres de recherche, arbre d'un programme, nœud, rattachements.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let dir;
let db;
let cpge;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oym-cpge-lecture-'));
  const file = path.join(dir, 'exercises.sqlite');
  db = new Database(file);
  db.exec(fs.readFileSync(path.join(ROOT, 'scripts/schema.sql'), 'utf8'));
  for (const uuid of ['e1', 'e2', 'e3', 'e4']) {
    db.prepare("INSERT INTO exercises (uuid, title, chapter, content_json) VALUES (?, ?, 'c', '[]')").run(uuid, `Exercice ${uuid}`);
  }
  const programme = db.prepare('INSERT INTO cpge_programmes (programme, titre, annee) VALUES (?, ?, ?)');
  programme.run('mpsi-mp2i', 'Programme MPSI, MP2I', 1);
  programme.run('bcpst2', 'Programme BCPST, seconde année', 2);
  const filiere = db.prepare('INSERT INTO cpge_filieres (filiere, programme) VALUES (?, ?)');
  filiere.run('MPSI', 'mpsi-mp2i');
  filiere.run('MP2I', 'mpsi-mp2i');
  filiere.run('BCPST', 'bcpst2');
  const noeud = db.prepare(`INSERT INTO cpge_noeuds (id, programme, type, parent_id, partie, semestre, lettre, titre, texte, ordre)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  noeud.run('mpsi-mp2i.complexes', 'mpsi-mp2i', 'section', null, 'Premier semestre', 1, null, 'Nombres complexes', 'Bandeau.', 0);
  noeud.run('mpsi-mp2i.complexes.a', 'mpsi-mp2i', 'sous-section', 'mpsi-mp2i.complexes', 'Premier semestre', 1, 'a', 'a) Module', null, 1);
  noeud.run('mpsi-mp2i.complexes-a', 'mpsi-mp2i', 'section', 'mpsi-mp2i.complexes', 'Premier semestre', 1, null, 'A - Racines', null, 2);
  noeud.run('mpsi-mp2i.complexes-a.b', 'mpsi-mp2i', 'sous-section', 'mpsi-mp2i.complexes-a', 'Premier semestre', 1, 'b', 'b) Racines $n$-ièmes', null, 3);
  noeud.run('bcpst2.series', 'bcpst2', 'section', null, null, null, null, 'Séries', null, 0);
  const lien = db.prepare("INSERT INTO exercise_cpge (uuid, noeud_id, origine) VALUES (?, ?, 'source')");
  lien.run('e1', 'mpsi-mp2i.complexes.a');
  lien.run('e2', 'mpsi-mp2i.complexes-a.b');
  lien.run('e3', 'bcpst2.series');
  lien.run('e1', 'bcpst2.series');

  process.env.DATABASE_PATH = file;
  cpge = await import('../../src/lib/db/cpge.js');
});

afterAll(() => {
  db?.close();
  delete process.env.DATABASE_PATH;
  fs.rmSync(dir, { recursive: true, force: true });
});

const filtrer = filters => {
  const { clauses, params } = cpge.cpgeFilterClauses(filters, 'e');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT e.uuid FROM exercises e ${where} ORDER BY e.uuid`).all(...params).map(r => r.uuid);
};

describe('cpgeFilterClauses', () => {
  it('filtre une section avec ses parties et sous-sections, en suivant parent_id', () => {
    expect(filtrer({ cpge: 'mpsi-mp2i.complexes' })).toEqual(['e1', 'e2']);
    expect(filtrer({ cpge: 'mpsi-mp2i.complexes-a' })).toEqual(['e2']);
  });

  it('résout une filière en ses programmes', () => {
    expect(filtrer({ filiere: 'MP2I' })).toEqual(['e1', 'e2']);
    expect(filtrer({ filiere: 'bcpst' })).toEqual(['e1', 'e3']);
  });

  it('garde les exercices rattachés à un programme, et rien sans filtre', () => {
    expect(filtrer({ prepa: true })).toEqual(['e1', 'e2', 'e3']);
    expect(filtrer({})).toEqual(['e1', 'e2', 'e3', 'e4']);
  });
});

describe('lecture', () => {
  it('liste les programmes avec leurs filières et leurs exercices', async () => {
    const programmes = await cpge.getCpgeProgrammes();
    expect(programmes.map(p => [p.programme, p.filieres, p.exercices])).toEqual([
      ['mpsi-mp2i', ['MPSI', 'MP2I'], 2],
      ['bcpst2', ['BCPST'], 2]
    ]);
  });

  it('construit l’arbre d’un programme avec des comptes qui incluent les descendants', async () => {
    const arbre = await cpge.getCpgeArbre('mpsi-mp2i');
    expect(arbre.exercices).toBe(2);
    expect(arbre.parties.map(p => p.nom)).toEqual(['Premier semestre']);
    const [section] = arbre.parties[0].sections;
    expect([section.id, section.exercices]).toEqual(['mpsi-mp2i.complexes', 2]);
    expect(section.enfants.map(e => [e.id, e.exercices])).toEqual([
      ['mpsi-mp2i.complexes.a', 1],
      ['mpsi-mp2i.complexes-a', 1]
    ]);
    expect(section.enfants[1].enfants.map(e => e.id)).toEqual(['mpsi-mp2i.complexes-a.b']);
    expect(await cpge.getCpgeArbre('inconnu')).toBeNull();
  });

  it('lit un nœud, ses ancêtres et ses exercices', async () => {
    const noeud = await cpge.getCpgeNoeud('mpsi-mp2i.complexes-a.b');
    expect(noeud.ancetres.map(a => a.id)).toEqual(['mpsi-mp2i.complexes', 'mpsi-mp2i.complexes-a']);
    expect(noeud.programme.filieres).toEqual(['MPSI', 'MP2I']);
    expect(noeud.liste.total).toBe(1);
    expect(noeud.liste.exercices.map(e => e.uuid)).toEqual(['e2']);
    expect(await cpge.getCpgeNoeud('inconnu')).toBeNull();
  });

  it('groupe les rattachements d’un exercice par programme, première année d’abord', async () => {
    const rattachements = await cpge.getExerciseCpge('e1');
    expect(rattachements.map(p => [p.programme, p.filieres])).toEqual([
      ['mpsi-mp2i', ['MPSI', 'MP2I']],
      ['bcpst2', ['BCPST']]
    ]);
    expect(rattachements[0].noeuds).toEqual([
      { id: 'mpsi-mp2i.complexes.a', titre: 'a) Module', section: 'Nombres complexes', sectionId: 'mpsi-mp2i.complexes' }
    ]);
    expect(await cpge.getExerciseCpge('e4')).toEqual([]);
  });
});
