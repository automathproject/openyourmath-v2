// Brouillons du source LaTeX d'une liste (mode « Éditer »).
//
// Deux propriétés comptent pour l'utilisateur : une retouche n'est jamais
// perdue en silence quand la liste évolue, et un stockage indisponible ou
// corrompu n'empêche pas d'éditer.

import { describe, it, expect } from 'vitest';
import {
  DRAFTS_STORAGE_KEY,
  MAX_DRAFTS,
  draftKey,
  findDraft,
  findExerciseLine,
  readDrafts,
  removeDraft,
  saveDraft,
} from '../../src/lib/latex/listLatexDraft.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const CONTENT = { includeHints: true, includeSolutions: true, solutionsAtEnd: false };

function draft(uuids, savedAt, source = `source ${uuids.join('-')}`) {
  return { uuids, source, base: 'base', content: CONTENT, savedAt };
}

describe('findDraft', () => {
  it('retrouve le brouillon de la composition exacte', () => {
    const drafts = { [draftKey(['a', 'b'])]: draft(['a', 'b'], 1) };
    expect(findDraft(drafts, ['a', 'b'])).toEqual({ draft: drafts['a,b'], exact: true });
  });

  it("tient compte de l'ordre des exercices", () => {
    const drafts = { [draftKey(['a', 'b'])]: draft(['a', 'b'], 1) };
    expect(findDraft(drafts, ['b', 'a'])?.exact).toBe(false);
  });

  it('propose le brouillon le plus récent partageant un exercice', () => {
    const drafts = {
      a: draft(['a'], 1),
      'a,b': draft(['a', 'b'], 5),
      c: draft(['c'], 9),
    };
    const found = findDraft(drafts, ['a', 'b', 'd']);
    expect(found).toEqual({ draft: drafts['a,b'], exact: false });
  });

  it("ne propose rien sans exercice commun ni pour une liste vide", () => {
    const drafts = { c: draft(['c'], 1) };
    expect(findDraft(drafts, ['a'])).toBeNull();
    expect(findDraft(drafts, [])).toBeNull();
  });

  it('ignore les entrées malformées', () => {
    expect(findDraft({ a: { uuids: ['a'] } }, ['a'])).toBeNull();
  });
});

describe('stockage', () => {
  it('enregistre, relit et supprime un brouillon', () => {
    const storage = memoryStorage();
    saveDraft(storage, draft(['a'], 1));
    expect(readDrafts(storage).a.source).toBe('source a');
    removeDraft(storage, ['a']);
    expect(readDrafts(storage)).toEqual({});
  });

  it(`ne garde que les ${MAX_DRAFTS} brouillons les plus récents`, () => {
    const storage = memoryStorage();
    for (let i = 0; i < MAX_DRAFTS + 3; i++) saveDraft(storage, draft([`u${i}`], i));
    const keys = Object.keys(readDrafts(storage));
    expect(keys).toHaveLength(MAX_DRAFTS);
    expect(keys).not.toContain('u0');
    expect(keys).toContain(`u${MAX_DRAFTS + 2}`);
  });

  it('tolère un contenu corrompu ou un stockage qui échoue', () => {
    expect(readDrafts(memoryStorage({ [DRAFTS_STORAGE_KEY]: '{pas du json' }))).toEqual({});
    const failing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(readDrafts(failing)).toEqual({});
    expect(() => saveDraft(failing, draft(['a'], 1))).not.toThrow();
    expect(readDrafts(undefined)).toEqual({});
  });
});

describe('findExerciseLine', () => {
  const source = [
    '\\documentclass{article}',
    '% ----',
    '% Exercice 1 — Intégrales [aaaa]',
    'texte qui cite [bbbb] sans être un marqueur',
    '% Exercice 2 — Suites [bbbb]',
  ].join('\n');

  it("repère le commentaire d'ouverture de l'exercice", () => {
    expect(findExerciseLine(source, 'aaaa')).toBe(3);
    expect(findExerciseLine(source, 'bbbb')).toBe(5);
  });

  it('renvoie null quand le marqueur a disparu', () => {
    expect(findExerciseLine(source, 'cccc')).toBeNull();
    expect(findExerciseLine(source, '')).toBeNull();
  });
});
