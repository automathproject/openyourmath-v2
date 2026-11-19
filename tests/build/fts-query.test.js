import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { singularize, tokenizeSearchQuery, buildFtsQuery, resolveFtsQuery } from '../../src/lib/db/ftsQuery.js';

describe('singularize', () => {
  it('ramène les pluriels réguliers', () => {
    expect(singularize('exponentielles')).toBe('exponentielle');
    expect(singularize('lois')).toBe('loi');
    expect(singularize('normaux')).toBe('norma');
    expect(singularize('jeux')).toBe('jeu');
  });

  it('laisse les mots courts et les -ss intacts', () => {
    expect(singularize('cos')).toBe('cos');
    expect(singularize('gauss')).toBe('gauss');
    expect(singularize('dx')).toBe('dx');
  });
});

describe('tokenizeSearchQuery', () => {
  it('retire les mots vides et sépare les apostrophes', () => {
    expect(tokenizeSearchQuery("Calcul de l'intégrale d'une fonction"))
      .toEqual(['calcul', 'intégrale', 'fonction']);
  });

  it('sépare les mots composés comme l’index', () => {
    expect(tokenizeSearchQuery('Cauchy-Schwarz')).toEqual(['cauchy', 'schwarz']);
  });

  it('garde les mots vides si la requête ne contient rien d’autre', () => {
    expect(tokenizeSearchQuery('de la')).toEqual(['de', 'la']);
  });

  it('dédoublonne après mise au singulier', () => {
    expect(tokenizeSearchQuery('fonction fonctions')).toEqual(['fonction']);
  });

  it('retourne [] sans terme exploitable', () => {
    expect(tokenizeSearchQuery('  ()  ')).toEqual([]);
    expect(tokenizeSearchQuery('')).toEqual([]);
  });
});

describe('buildFtsQuery', () => {
  it('construit ET et OU avec préfixes', () => {
    expect(buildFtsQuery('lois exponentielles')).toBe('loi* exponentielle*');
    expect(buildFtsQuery('lois exponentielles', 'or')).toBe('loi* OR exponentielle*');
  });
});

describe('resolveFtsQuery', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE VIRTUAL TABLE fts_exercises USING fts5(uuid, title, tokenize='unicode61 remove_diacritics 1')`);
  db.prepare('INSERT INTO fts_exercises (uuid, title) VALUES (?, ?)').run('a', 'Densité et fonction de répartition');
  db.prepare('INSERT INTO fts_exercises (uuid, title) VALUES (?, ?)').run('b', 'Lois exponentielles');

  it('garde le ET quand un document contient tous les termes', () => {
    expect(resolveFtsQuery(db, 'fonction de répartition')).toEqual({
      match: 'fonction* répartition*',
      relaxed: false
    });
  });

  it('bascule en OU quand aucun document ne contient tous les termes', () => {
    const r = resolveFtsQuery(db, 'fonction densité queue lourde fonction de répartition');
    expect(r.relaxed).toBe(true);
    const rows = db.prepare('SELECT uuid FROM fts_exercises WHERE fts_exercises MATCH ?').all(r.match);
    expect(rows.map((x) => x.uuid)).toEqual(['a']);
  });

  it('trouve le pluriel depuis le singulier et inversement', () => {
    for (const q of ['loi exponentielle', 'lois exponentielles']) {
      const { match } = resolveFtsQuery(db, q);
      const rows = db.prepare('SELECT uuid FROM fts_exercises WHERE fts_exercises MATCH ?').all(match);
      expect(rows.map((x) => x.uuid)).toEqual(['b']);
    }
  });
});
