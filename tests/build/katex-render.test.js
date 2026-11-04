// Rendu KaTeX côté serveur : mêmes formules, mêmes balises ignorées qu'auto-render.

import { describe, it, expect } from 'vitest';
import { renderMathInHtml, renderMathInHtmlCached } from '../../src/lib/katexRender.js';
import { withRenderedMath } from '../../src/lib/server/exerciseMath.js';

describe('renderMathInHtml', () => {
  it('compose les formules en ligne et affichées de pandoc', () => {
    const html = renderMathInHtml(
      '<p>Soit <span class="math inline">\\(x\\)</span> :</p><span class="math display">\\[x^2\\]</span>',
    );
    expect(html).toContain('<span class="math inline"><span><span class="katex">');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('\\(');
  });

  it('décode les entités avant de donner la formule à KaTeX', () => {
    const html = renderMathInHtml('<span class="math inline">\\(a &lt; b \\&amp; c\\)</span>');
    expect(html).toContain('<annotation encoding="application/x-tex">a &lt; b \\&amp; c</annotation>');
    expect(html).not.toContain('mathcolor="#cc0000"');
  });

  it('traduit les macros propres aux sources (\\mbox) comme le fait le navigateur', () => {
    expect(renderMathInHtml('<span class="math inline">\\(f \\mbox{ si } x\\)</span>')).not.toContain('mathcolor="#cc0000"');
  });

  it('reconnaît aussi $…$ et $$…$$ hors des balises de pandoc', () => {
    const html = renderMathInHtml('<p>Soit $y$ et $$z$$.</p>');
    expect(html.match(/class="katex"/g)).toHaveLength(2);
    expect(html).toContain('katex-display');
  });

  it('laisse intacts le code et le texte sans formule', () => {
    const code = '<pre><code>$x$ et \\(y\\)</code></pre>';
    expect(renderMathInHtml(code)).toBe(code);
    expect(renderMathInHtml('<p>Bonjour &amp; bienvenue</p>')).toBe('<p>Bonjour &amp; bienvenue</p>');
    expect(renderMathInHtml('')).toBe('');
    expect(renderMathInHtml(undefined)).toBe('');
  });

  it('un $ isolé reste du texte', () => {
    expect(renderMathInHtml('<p>Coûte 5$ pièce</p>')).toBe('<p>Coûte 5$ pièce</p>');
  });

  it("n'étend pas une définition globale (\\gdef) d'un fragment au suivant", () => {
    renderMathInHtml('<span class="math inline">\\(\\gdef\\oymTest{42}\\oymTest\\)</span>');
    expect(renderMathInHtml('<span class="math inline">\\(\\oymTest\\)</span>')).toContain('mathcolor="#cc0000"');
  });

  it('sait ne produire que du MathML', () => {
    const html = renderMathInHtml('<span class="math inline">\\(x\\)</span>', { output: 'mathml' });
    expect(html).toContain('<math');
    expect(html).not.toContain('class="base"');
  });

  it('la version mémorisée rend la même chose', () => {
    const html = '<span class="math inline">\\(x+1\\)</span>';
    expect(renderMathInHtmlCached(html)).toBe(renderMathInHtml(html));
    expect(renderMathInHtmlCached(html)).toBe(renderMathInHtmlCached(html));
  });
});

describe('withRenderedMath', () => {
  it('marque les blocs rendus et laisse le LaTeX seul au navigateur', () => {
    const exercise = withRenderedMath({
      uuid: 'x',
      content: [
        { id: 'b1', type: 'question', html: '<span class="math inline">\\(x\\)</span>', latex: '$x$' },
        { id: 'b2', type: 'text', latex: '$y$' },
      ],
    });
    expect(exercise.content[0].mathRendered).toBe(true);
    expect(exercise.content[0].html).toContain('class="katex"');
    expect(exercise.content[0].latex).toBe('$x$');
    expect(exercise.content[1]).toEqual({ id: 'b2', type: 'text', latex: '$y$' });
  });

  it('accepte un exercice sans contenu', () => {
    expect(withRenderedMath(null)).toBe(null);
    expect(withRenderedMath({ uuid: 'x' })).toEqual({ uuid: 'x' });
  });
});
