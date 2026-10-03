// tests/build/cpge-candidats.test.js
// Candidats à l'étiquetage CPGE (scripts/utils/cpge-candidats.js) : la table
// de correspondance ne cite que des nœuds du référentiel, une section se
// déplie en sous-sections, et les sous-sections de même notion se regroupent
// entre filières d'une même famille de programmes.

import { describe, it, expect } from 'vitest';
import path from 'path';

import { collectReferentiel } from '../../scripts/build-referentiel-cpge.js';
import { loadCorrespondances, indexNodes, buildCandidates, formatCandidates } from '../../scripts/utils/cpge-candidats.js';
import { CONTENT_ROOT } from '../../scripts/utils/content-paths.js';

const index = indexNodes(collectReferentiel().nodes);
const table = loadCorrespondances(path.join(CONTENT_ROOT, 'referentials/cpge-correspondances.json'));

describe('table de correspondance', () => {
  it('ne cite que des nœuds du référentiel', () => {
    const unknown = [...table.values()].flat().filter(id => !index.byId.has(id));
    expect(unknown).toEqual([]);
  });

  it('refuse un nœud inconnu', () => {
    expect(() => buildCandidates(['pcsi.inexistant'], index)).toThrow(/nœuds inconnus/);
  });
});

describe('buildCandidates — variantes de titre', () => {
  const polynomes = buildCandidates(table.get('exo7|Polynôme, fraction rationnelle'), index);
  const groupOf = id => polynomes.find(g => g.noeuds.includes(id));

  it('regroupe des sous-sections de sections différemment intitulées', () => {
    // « Polynômes et fractions rationnelles » (MPSI) et « Polynômes » (PCSI)
    expect(groupOf('pcsi.polynomes.b')).toBe(groupOf('mpsi-mp2i.polynomes-fractions-rationnelles.b'));
  });

  it('départage deux sous-sections de même titre par leur section (entiers / polynômes)', () => {
    expect(groupOf('pcsi.polynomes.b').noeuds).toContain('mpsi-mp2i.polynomes-fractions-rationnelles.b');
    expect(groupOf('mpsi-mp2i.arithmetique-entiers.a')?.noeuds ?? []).not.toContain('pcsi.polynomes.b');
  });

  it('rapproche une variante de titre (« Anneau » / « Ensemble des polynômes »)', () => {
    expect(groupOf('pcsi.polynomes.a').noeuds).toEqual([
      'mpsi-mp2i.polynomes-fractions-rationnelles.a', 'pcsi.polynomes.a', 'ptsi.polynomes.a'
    ]);
  });

  it('laisse seule une sous-section propre à une filière', () => {
    expect(groupOf('mpsi-mp2i.polynomes-fractions-rationnelles.g').noeuds).toEqual([
      'mpsi-mp2i.polynomes-fractions-rationnelles.g'
    ]);
  });
});

describe('buildCandidates', () => {
  const groups = buildCandidates(table.get('exo7|Nombres complexes'), index);

  it('déplie une section en ses sous-sections', () => {
    const noeuds = groups.flatMap(g => g.noeuds);
    expect(noeuds).toContain('mpsi-mp2i.nombres-complexes.f');
    expect(noeuds).not.toContain('mpsi-mp2i.nombres-complexes');
  });

  it('regroupe les sous-sections de même titre entre filières, MPSI en tête', () => {
    const racines = groups.find(g => g.titre === 'Racines $n$-ièmes');
    expect(racines.noeuds).toEqual(['mpsi-mp2i.nombres-complexes.f', 'pcsi.nombres-complexes.f', 'ptsi.nombres-complexes.f']);
  });

  it('garde BCPST dans sa propre famille', () => {
    const bcpst = groups.filter(g => g.programmes.includes('bcpst1'));
    expect(bcpst.length).toBeGreaterThan(0);
    expect(bcpst.every(g => g.famille === 'bcpst-1' && g.programmes.length === 1)).toBe(true);
  });

  it('ne met jamais deux sous-sections d’un même programme dans un groupe', () => {
    for (const noeuds of table.values()) {
      for (const g of buildCandidates(noeuds, index)) {
        expect(new Set(g.programmes).size).toBe(g.programmes.length);
      }
    }
  });

  it('numérote les groupes de façon stable', () => {
    const again = buildCandidates(table.get('exo7|Nombres complexes'), index);
    expect(again.map(g => `${g.code}:${g.noeuds[0]}`)).toEqual(groups.map(g => `${g.code}:${g.noeuds[0]}`));
  });

  it('présente les groupes par famille, avec leurs filières et des contenus tronqués', () => {
    const text = formatCandidates(groups, { maxChars: 80 });
    expect(text).toMatch(/^## MPSI\/MP2I, PCSI, PTSI — 1re année\nG1 \[MPSI\/MP2I, PCSI, PTSI\]/);
    expect(text).toMatch(/\n## BCPST — 1re année\n/);
    for (const line of text.split('\n').filter(l => l.startsWith('   '))) expect(line.length).toBeLessThanOrEqual(3 + 82);
  });
});
