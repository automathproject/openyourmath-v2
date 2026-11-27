import { describe, expect, it } from 'vitest';
import { buildPresenterSlides } from '../../src/lib/seance/presenterSlides.js';

let order = 0;
const bloc = (type, id) => ({ id, type, html: `<p>${id}</p>`, order: ++order });
const ids = (blocks) => blocks.map((b) => b.id);

describe('buildPresenterSlides', () => {
  it("rappelle l'énoncé de tête sur chaque question", () => {
    const slides = buildPresenterSlides([
      bloc('text', 'intro'),
      bloc('question', 'q1'),
      bloc('reponse', 'r1'),
      bloc('question', 'q2'),
      bloc('reponse', 'r2'),
    ]);
    expect(slides).toHaveLength(2);
    expect(ids(slides[0].contexte)).toEqual(['intro']);
    expect(ids(slides[0].rappel)).toEqual([]);
    expect(ids(slides[1].contexte)).toEqual([]);
    expect(ids(slides[1].rappel)).toEqual(['intro']);
    expect(ids(slides[1].solutions)).toEqual(['r2']);
  });

  it('garde le texte intercalé entre deux questions', () => {
    // Forme de 4Z0U : « Timothée s'attend à avoir 5000 mises… » entre les parties.
    const slides = buildPresenterSlides([
      bloc('text', 'intro'),
      bloc('question', 'q1'),
      bloc('reponse', 'r1'),
      bloc('text', 'partie2'),
      bloc('question', 'q2'),
      bloc('question', 'q3'),
    ]);
    expect(ids(slides[1].contexte)).toEqual(['partie2']);
    expect(ids(slides[1].rappel)).toEqual(['intro']);
    expect(ids(slides[2].contexte)).toEqual([]);
    expect(ids(slides[2].rappel)).toEqual(['intro', 'partie2']);
  });

  it('place un texte final après la dernière question', () => {
    const slides = buildPresenterSlides([
      bloc('question', 'q1'),
      bloc('text', 'remarque'),
    ]);
    expect(slides).toHaveLength(1);
    expect(ids(slides[0].suite)).toEqual(['remarque']);
  });

  it('sans \\question, prend chaque texte suivi de sa solution pour une diapo', () => {
    const slides = buildPresenterSlides([
      bloc('text', 't1'),
      bloc('solution', 's1'),
      bloc('text', 't2'),
      bloc('solution', 's2'),
    ]);
    expect(slides.map((s) => s.question.id)).toEqual(['t1', 't2']);
    expect(ids(slides[1].rappel)).toEqual([]);
    expect(ids(slides[1].solutions)).toEqual(['s2']);
  });

  it("fait une diapo d'un énoncé sans question ni solution", () => {
    const slides = buildPresenterSlides([bloc('figure', 'fig'), bloc('text', 't')]);
    expect(slides).toHaveLength(1);
    expect(slides[0].question.id).toBe('t');
    expect(ids(slides[0].contexte)).toEqual(['fig']);
  });

  it("rattache indications et solutions à leur question", () => {
    const slides = buildPresenterSlides([
      bloc('question', 'q1'),
      bloc('indication', 'i1'),
      bloc('reponse', 'r1'),
      bloc('question', 'q2'),
    ]);
    expect(ids(slides[0].hints)).toEqual(['i1']);
    expect(ids(slides[0].solutions)).toEqual(['r1']);
    expect(slides[1].hints).toEqual([]);
  });
});

describe('buildPresenterSlides — blocs sans diapo ouverte', () => {
  it('garde le code avec la question qui le précède', () => {
    // Forme de aOYg : question, \pythoncode, réponse.
    const slides = buildPresenterSlides([
      bloc('question', 'q1'),
      bloc('code', 'c1'),
      bloc('reponse', 'r1'),
      bloc('question', 'q2'),
    ]);
    expect(ids(slides[0].complements)).toEqual(['c1']);
    expect(ids(slides[0].solutions)).toEqual(['r1']);
    expect(ids(slides[1].contexte)).toEqual([]);
  });

  it("donne la solution posée sur l'énoncé à la diapo qui le projette", () => {
    // Forme de 8mM7 : texte, réponse, puis les questions.
    const slides = buildPresenterSlides([
      bloc('text', 'intro'),
      bloc('reponse', 'r0'),
      bloc('question', 'q1'),
      bloc('reponse', 'r1'),
    ]);
    expect(ids(slides[0].contexte)).toEqual(['intro']);
    expect(ids(slides[0].solutions)).toEqual(['r0', 'r1']);
  });

  it("rattache à la dernière diapo une solution qu'aucune question ne suit", () => {
    // Forme de nSSt : texte, question, texte, réponse.
    const slides = buildPresenterSlides([
      bloc('text', 'intro'),
      bloc('question', 'q1'),
      bloc('text', 'fin'),
      bloc('reponse', 'r'),
    ]);
    expect(slides).toHaveLength(1);
    expect(ids(slides[0].suite)).toEqual(['fin']);
    expect(ids(slides[0].solutions)).toEqual(['r']);
  });
});
