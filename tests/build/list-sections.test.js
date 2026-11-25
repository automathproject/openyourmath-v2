import { describe, it, expect } from 'vitest';
import { cheminExercice, titresNouveaux } from '../../src/lib/listSections.js';

describe('cheminExercice', () => {
  it('préfère le chemin complet, se rabat sur la section', () => {
    expect(cheminExercice({ sectionPath: ['A', 'B'], section: 'B' })).toEqual(['A', 'B']);
    expect(cheminExercice({ section: 'B' })).toEqual(['B']);
    expect(cheminExercice({})).toEqual([]);
  });
});

describe('titresNouveaux', () => {
  const ex = (...sectionPath) => ({ sectionPath });

  it('affiche tout le chemin du premier exercice', () => {
    expect(titresNouveaux(ex('Cours', 'Densités'), null)).toEqual([
      { niveau: 0, titre: 'Cours', feuille: false },
      { niveau: 1, titre: 'Densités', feuille: true }
    ]);
  });

  it('n’affiche que ce qui change', () => {
    expect(titresNouveaux(ex('Cours', 'Lois'), ex('Cours', 'Densités'))).toEqual([
      { niveau: 1, titre: 'Lois', feuille: true }
    ]);
    expect(titresNouveaux(ex('Cours', 'Lois'), ex('Cours', 'Lois'))).toEqual([]);
  });

  it('réaffiche le parent quand on sort d’une sous-section', () => {
    expect(titresNouveaux(ex('Cours'), ex('Cours', 'Lois'))).toEqual([
      { niveau: 0, titre: 'Cours', feuille: true }
    ]);
  });

  it('n’affiche rien hors section', () => {
    expect(titresNouveaux({}, ex('Cours'))).toEqual([]);
  });
});
