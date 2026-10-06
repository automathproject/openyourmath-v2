// tests/build/cpge-preselection.test.js
// Présélection des candidats CPGE par similarité d'embeddings.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { texteGroupe, embeddingsGroupes, plusProches, cosinus, vecteurBlob } from '../../scripts/utils/cpge-preselection.js';

const index = {
  byId: new Map([
    ['a.x', { contenus: [{ contenu: 'Racines $n$-ièmes de l’unité.' }] }],
    ['b.x', { contenus: [{ contenu: 'Racines $n$-ièmes de l’unité.' }, { contenu: 'Notation $\\mathbb{U}_n$.' }] }],
    ['c.y', { contenus: [{ contenu: 'Théorème de Rolle.' }] }]
  ])
};
const groups = [
  { noeuds: ['a.x', 'b.x'], section: 'Nombres complexes', titre: 'Racines' },
  { noeuds: ['c.y'], section: 'Dérivabilité', titre: 'Rolle' }
];
// Encodeur factice : vecteur selon la présence de mots.
const embed = async texte => Float32Array.from([/Racines/.test(texte) ? 1 : 0, /Rolle/.test(texte) ? 1 : 0, 0.1]);

describe('présélection par embeddings', () => {
  it('encode le titre et les contenus distincts du groupe', () => {
    const t = texteGroupe(groups[0], index);
    expect(t.split('\n')[0]).toBe('Nombres complexes › Racines');
    expect(t.match(/Racines \$n\$-ièmes/g)).toHaveLength(1);
    expect(t).toContain('Notation');
  });

  it('classe les groupes du plus proche au moins proche', async () => {
    const vecs = await embeddingsGroupes(groups, index, { embed });
    expect(plusProches([0, 1, 0], groups, vecs, 1)[0].titre).toBe('Rolle');
    expect(plusProches([1, 0, 0], groups, vecs, 2).map(g => g.titre)).toEqual(['Racines', 'Rolle']);
  });

  it('ne réencode pas un texte déjà en cache', async () => {
    const cacheFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cpge-')), 'groupes.json');
    let appels = 0;
    const compte = async t => { appels++; return embed(t); };
    await embeddingsGroupes(groups, index, { embed: compte, cacheFile });
    await embeddingsGroupes(groups, index, { embed: compte, cacheFile });
    expect(appels).toBe(2);
  });

  it('lit un vecteur stocké en base', () => {
    const v = vecteurBlob(Buffer.from(Float32Array.from([0.5, -1]).buffer));
    expect(Array.from(v)).toEqual([0.5, -1]);
    expect(cosinus([1, 0], [2, 0])).toBeCloseTo(1);
  });
});
