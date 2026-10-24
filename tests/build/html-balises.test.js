// Rééquilibrage des aperçus HTML tronqués (src/lib/utils/htmlBalises.js).
import { describe, expect, it } from 'vitest';
import { fermerBalises } from '../../src/lib/utils/htmlBalises.js';

describe('fermerBalises', () => {
  it('referme un paragraphe tronqué', () => {
    expect(fermerBalises('<p>Soit <span class="math inline">\\(P\\)</span> un polynôme ...'))
      .toBe('<p>Soit <span class="math inline">\\(P\\)</span> un polynôme ...</p>');
  });

  it('referme les balises imbriquées dans l’ordre inverse', () => {
    expect(fermerBalises('<div><p>Texte <strong>gras')).toBe('<div><p>Texte <strong>gras</strong></p></div>');
  });

  it('retire une balise coupée en plein milieu et une fermeture orpheline', () => {
    expect(fermerBalises('</span><p>Début <span cla')).toBe('<p>Début </p>');
  });

  it('laisse intact un fragment équilibré, éléments vides compris', () => {
    const html = '<p>Ligne<br>suite <img src="a.png"> fin.</p><p>Autre</p>';
    expect(fermerBalises(html)).toBe(html);
  });

  it('ferme ce qui reste ouvert à l’intérieur d’un élément fermé', () => {
    expect(fermerBalises('<p><em>italique</p>')).toBe('<p><em>italique</em></p>');
  });

  it('rend une chaîne vide pour un aperçu absent', () => {
    expect(fermerBalises(null)).toBe('');
  });
});
