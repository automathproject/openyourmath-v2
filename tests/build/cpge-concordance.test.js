// tests/build/cpge-concordance.test.js
// Table de concordance (content/referentials/cpge/concordance.json) : groupes
// de sous-sections équivalentes entre programmes d'une famille, avec leurs
// écarts, et leur usage par le calcul des candidats à l'étiquetage.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { collectReferentiel } from '../../scripts/build-referentiel-cpge.js';
import { loadCorrespondances, loadConcordance, indexNodes, buildCandidates, formatCandidates } from '../../scripts/utils/cpge-candidats.js';
import { CONTENT_ROOT } from '../../scripts/utils/content-paths.js';

const FILE = path.join(CONTENT_ROOT, 'referentials/cpge/concordance.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const index = indexNodes(collectReferentiel().nodes);
const concordance = loadConcordance(FILE);
const table = loadCorrespondances(path.join(CONTENT_ROOT, 'referentials/cpge-correspondances.json'));
const NATURES = ['contenu', 'hors programme explicite', 'restriction en commentaire'];
const prog = id => id.split('.')[0];

describe('table de concordance', () => {
  for (const [famille, f] of Object.entries(data.familles)) {
    it(`${famille} : groupes valides`, () => {
      const vus = new Map();
      for (const g of f.groupes) {
        expect(g.notion?.trim(), g.id).toBeTruthy();
        expect(g.noeuds.length, g.id).toBeGreaterThanOrEqual(2);
        const progs = g.noeuds.map(prog);
        expect(new Set(progs).size, `${g.id} : deux sous-sections d'un même programme`).toBe(progs.length);
        for (const n of g.noeuds) {
          expect(index.byId.has(n), `${g.id} : ${n} inconnu`).toBe(true);
          expect(index.children.get(n)?.length ?? 0, `${g.id} : ${n} n'est pas une sous-section`).toBe(0);
          expect(f.programmes).toContain(prog(n));
          expect(vus.has(n), `${n} dans ${vus.get(n)} et ${g.id}`).toBe(false);
          vus.set(n, g.id);
        }
        for (const e of g.ecarts) {
          expect(NATURES).toContain(e.nature);
          expect(e.presente.length && e.absente.length, `${g.id} : écart sans présence ou absence`).toBeTruthy();
          for (const p of [...e.presente, ...e.absente]) expect(progs, `${g.id} : ${p} hors du groupe`).toContain(p);
          expect(e.presente.some(p => e.absente.includes(p))).toBe(false);
        }
      }
    });
  }
});

describe('buildCandidates avec la concordance', () => {
  const reduction = buildCandidates(table.get("exo7|Réduction d'endomorphisme, polynôme annulateur"), index, { concordance });

  it('reprend les groupes de la table pour la 2e année', () => {
    const elements = reduction.find(g => g.noeuds.includes('pc.reduction.a'));
    expect(elements.concordance).toBeTruthy();
    expect(elements.noeuds).toContain('mp-mpi.reduction-endomorphismes.b');
    expect(elements.noeuds).toContain('pt.reduction-endomorphismes.a');
  });

  it('porte les écarts, réduits aux filières présentes', () => {
    const annulateurs = reduction.find(g => g.noeuds.includes('pc.reduction.d'));
    expect(annulateurs.ecarts.some(e => /noyaux/i.test(e.notion) && e.presente.join() === 'mp-mpi')).toBe(true);
    for (const g of reduction) {
      for (const e of g.ecarts) for (const p of [...e.presente, ...e.absente]) expect(g.programmes).toContain(p);
    }
  });

  it('laisse la 1re année au regroupement par titres', () => {
    const complexes = buildCandidates(table.get('exo7|Nombres complexes'), index, { concordance });
    expect(complexes.every(g => g.concordance === null)).toBe(true);
    expect(complexes.find(g => g.titre === 'Racines $n$-ièmes').noeuds).toEqual([
      'mpsi-mp2i.nombres-complexes.f', 'pcsi.nombres-complexes.f', 'ptsi.nombres-complexes.f'
    ]);
  });

  it('affiche les écarts dans la présentation des candidats', () => {
    expect(formatCandidates(reduction)).toMatch(/Écarts entre filières — .*MP\/MPI seulement/);
  });
});
