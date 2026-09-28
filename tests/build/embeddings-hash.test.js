// Validité des vecteurs, jugée à leur propre empreinte.
//
// Le résumé d'un exercice voyage par Git (content/metadata/), son vecteur par
// instantané de la base. Des métadonnées à jour pouvaient donc couvrir un
// vecteur calculé sur une version antérieure du contenu ; et après la
// restauration d'un instantané, build:db remettait en attente des exercices
// dont les métadonnées valaient déjà pour le contenu actuel.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadDatabaseModule,
  createDatabase,
  insertExercises,
  backfillEmbeddingHashes,
} from '../../scripts/build-db.js';
import { loadExercisesToIndex } from '../../scripts/index-exercises.js';

const NO_AUTHORS = { list: [], byPseudo: new Map(), byNorm: new Map() };
const SEMANTIC = new Set(['enonce', 'question', 'reponse', 'indication', 'hint', 'answer', 'solution', 'texte', 'text']);
const hashOf = (content) => crypto.createHash('sha256')
  .update(JSON.stringify(content.filter((b) => SEMANTIC.has(b.type)))).digest('hex');

const exercise = (uuid, latex) => ({
  uuid, title: uuid, chapter: 'C', difficulty: 1, source_path: `test/${uuid}.tex`,
  content: [{ id: 'b1', type: 'question', latex, html: `<p>${latex}</p>`, order: 1 }],
});
const metadataFor = (ex) => [ex.uuid, {
  uuid: ex.uuid, source_path: ex.source_path, content_hash: hashOf(ex.content),
  summary: `Résumé de ${ex.uuid}`, concepts: [], methods: [], objects: [], indexed_at: '2026-09-01T00:00:00Z',
}];

let dir;
let db;

beforeAll(() => loadDatabaseModule());

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oym-embeddings-'));
  db = createDatabase(path.join(dir, 'test.sqlite'));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const setVector = (uuid, hash, vector = new Float32Array([1, 2, 3])) => db.prepare(`
  INSERT OR REPLACE INTO exercise_embeddings (uuid, embedding_summary, model_version, dimension, content_hash)
  VALUES (?, ?, 'BAAI/bge-m3', ?, ?)`).run(uuid, Buffer.from(vector.buffer), vector.length, hash);
const indexedAt = (uuid) => db.prepare('SELECT indexed_at FROM exercises WHERE uuid = ?').get(uuid).indexed_at;

describe('build:db — réindexation', () => {
  it("ne remet pas en attente un contenu modifié dont les métadonnées suivent, en une seule passe", () => {
    // Base restaurée : ancienne version, indexée.
    const before = exercise('aaaa', 'Soit $x$.');
    insertExercises(db, [before], NO_AUTHORS, new Map([metadataFor(before)]));
    expect(indexedAt('aaaa')).not.toBeNull();

    // Contenu actuel, dont les métadonnées versionnées ont été mises à jour.
    const after = exercise('aaaa', 'Soit $x \\in \\R$.');
    insertExercises(db, [after], NO_AUTHORS, new Map([metadataFor(after)]));
    expect(indexedAt('aaaa')).not.toBeNull();
  });

  it('remet en attente un contenu modifié que les métadonnées ne couvrent pas', () => {
    const before = exercise('bbbb', 'Soit $x$.');
    insertExercises(db, [before], NO_AUTHORS, new Map([metadataFor(before)]));
    insertExercises(db, [exercise('bbbb', 'Soit $y$.')], NO_AUTHORS, new Map([metadataFor(before)]));
    expect(indexedAt('bbbb')).toBeNull();
  });
});

describe('index:exercises — vecteurs à recalculer', () => {
  it("sélectionne les vecteurs absents, d'empreinte inconnue ou périmée", () => {
    const exs = ['cur1', 'old1', 'nul1', 'abs1'].map((u) => exercise(u, `Exercice ${u}.`));
    insertExercises(db, exs, NO_AUTHORS, new Map(exs.map(metadataFor)));
    const hash = (u) => db.prepare('SELECT content_hash FROM exercises WHERE uuid = ?').get(u).content_hash;
    setVector('cur1', hash('cur1'));
    setVector('old1', 'empreinte-d-une-version-precedente');
    setVector('nul1', null);

    const selected = loadExercisesToIndex(db);
    expect(selected.map((r) => r.uuid).sort()).toEqual(['abs1', 'nul1', 'old1']);
    expect(selected.every((r) => r._needsEmbedding && !r._needsSummary)).toBe(true);
  });
});

describe('backfillEmbeddingHashes', () => {
  it("reprend l'empreinte du cache si le vecteur est le même, sinon celle d'un exercice indexé", () => {
    const exs = ['cach', 'diff', 'none'].map((u) => exercise(u, `Exercice ${u}.`));
    insertExercises(db, exs, NO_AUTHORS, new Map(exs.slice(0, 2).map(metadataFor)));
    const vector = new Float32Array([1, 2, 3]);
    for (const u of ['cach', 'diff', 'none']) setVector(u, null, vector);

    const cacheRoot = path.join(dir, 'cache');
    fs.mkdirSync(cacheRoot);
    const cacheFile = (u, v) => fs.writeFileSync(path.join(cacheRoot, `${u}.json`), JSON.stringify({
      uuid: u, content_hash: 'empreinte-du-cache', embedding_base64: Buffer.from(v.buffer).toString('base64'),
    }));
    cacheFile('cach', vector);
    cacheFile('diff', new Float32Array([9, 9, 9]));

    expect(backfillEmbeddingHashes(db, cacheRoot)).toEqual({ fromCache: 1, fromExercise: 1, unknown: 1 });
    const embHash = (u) => db.prepare('SELECT content_hash FROM exercise_embeddings WHERE uuid = ?').get(u).content_hash;
    expect(embHash('cach')).toBe('empreinte-du-cache');
    expect(embHash('diff')).toBe(db.prepare("SELECT content_hash FROM exercises WHERE uuid = 'diff'").get().content_hash);
    expect(embHash('none')).toBeNull();
  });
});
