import { describe, it, expect } from 'vitest';
import { interpretQuery, filterValueForServer } from '../../src/lib/search/queryIntent.js';

const keys = (r) => Object.fromEntries(r.applied.map((a) => [a.key, a.value]));

describe('interpretQuery', () => {
  it('extrait la filière et le niveau', () => {
    const r = interpretQuery('suites MPSI');
    expect(r.remainingQuery).toBe('suites');
    expect(keys(r)).toEqual({ filiere: 'MPSI' });

    const r2 = interpretQuery('qcm matrices L1');
    expect(r2.remainingQuery).toBe('matrices');
    expect(keys(r2)).toEqual({ qcm: '1', level: 'L1' });
  });

  it('retire le mot de liaison qui précède', () => {
    expect(interpretQuery('exercices de L1').remainingQuery).toBe('exercices');
    expect(interpretQuery('suites en mpsi').remainingQuery).toBe('suites');
  });

  it('reconnaît corrigé, vidéo, indication et les tournures avec / sans', () => {
    const r = interpretQuery('séries entières corrigées');
    expect(r.remainingQuery).toBe('séries entières');
    expect(keys(r)).toEqual({ hasSolution: '1' });

    expect(keys(interpretQuery('intégrales avec vidéo'))).toEqual({ hasVideo: '1' });
    expect(keys(interpretQuery('groupes sans solution'))).toEqual({ hasSolution: '0' });
    expect(keys(interpretQuery('matrices sans qcm'))).toEqual({ qcm: '0' });
  });

  it('laisse « solution » seul comme mot de contenu', () => {
    const r = interpretQuery("solution d'une équation différentielle");
    expect(r.applied).toEqual([]);
    expect(r.remainingQuery).toBe("solution d'une équation différentielle");
  });

  it('ne prend pas L1 / L2 comme niveau après norme, espace…', () => {
    expect(interpretQuery('norme L2').applied).toEqual([]);
    expect(interpretQuery('convergence dans L1').applied).toEqual([]);
    expect(interpretQuery('espace L2 de Hilbert').applied).toEqual([]);
  });

  it('exige les majuscules pour les sigles ambigus', () => {
    expect(interpretQuery('fonction psi').applied).toEqual([]);
    expect(interpretQuery('pc sur les suites').applied).toEqual([]);
    expect(keys(interpretQuery('suites PSI'))).toEqual({ filiere: 'PSI' });
  });

  it('laisse le mot quand le filtre est déjà choisi', () => {
    const r = interpretQuery('suites L1', { level: 'L2' });
    expect(r.applied).toEqual([]);
    expect(r.remainingQuery).toBe('suites L1');
  });

  it('ne prend que la première valeur d’un même filtre', () => {
    const r = interpretQuery('MPSI PCSI suites');
    expect(keys(r)).toEqual({ filiere: 'MPSI' });
    expect(r.remainingQuery).toBe('PCSI suites');
  });

  it('peut vider la requête', () => {
    const r = interpretQuery('QCM MPSI');
    expect(r.remainingQuery).toBe('');
    expect(keys(r)).toEqual({ qcm: '1', filiere: 'MPSI' });
  });

  it('nettoie la ponctuation orpheline', () => {
    expect(interpretQuery('séries entières, corrigé').remainingQuery).toBe('séries entières');
  });
});

describe('filterValueForServer', () => {
  it('convertit les drapeaux en booléens', () => {
    expect(filterValueForServer('qcm', '1')).toBe(true);
    expect(filterValueForServer('hasSolution', '0')).toBe(false);
    expect(filterValueForServer('level', 'L1')).toBe('L1');
  });
});
