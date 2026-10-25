// Formules en ligne qui ne peuvent pas se replier : alerte du contrôle des
// sources et réécritures du correcteur déterministe.
//
// Les formules viennent du corpus : ce sont celles qui débordaient de la colonne
// sur un téléphone (375 px) parce que KaTeX ne les coupait nulle part.

import { describe, expect, it } from 'vitest';
import katex from 'katex';

import {
  allowBreakAfterTopLevelCommas,
  analyzeInlineMath,
  findInlineMath,
  fixInlineMathLayout,
  inlineMathFeatures,
  leftRightToBig,
  splitLongText
} from '../../scripts/quality/latex-math-layout.js';
import { validateMathLayout, validateSource } from '../../scripts/quality/check-exercise-sources.js';
import { applyDeterministicFixes } from '../../scripts/quality/fix-exercise-sources-deterministic.js';
import { katexMacros, prepareMathForKatex } from '../../src/lib/katexCompat.js';

const codes = text => analyzeInlineMath(text).map(issue => issue.code);

// Rdsp : une suite de 18 virgules, sans coupure possible.
const COMMA_LIST = String.raw`0,1,0,{1\over2},1,0,{1\over4},{1\over2},{3\over4},1,\cdots,0,{1\over2^k},{2\over2^k},\cdots,{2^k-1\over2^k},1,0,...`;
// UMMH : toute une chaîne d'équivalences enfermée dans \left( … \right).
const LEFT_RIGHT = String.raw`\left(\exists(\lambda_1,...,\lambda_n)\in\Kk^n/\;\varphi =\lambda_1\varphi_1+...+\lambda_n\varphi_n\Leftrightarrow\displaystyle\bigcap_{i=1}^{n}\text{Ker}\varphi_i\right)`;
// DzNC : de la prose dans la formule.
const LONG_TEXT = String.raw`E =SL_2(\Zz) =\{\text{matrices carrées de format}\;2\;\text{à coefficients dans}\;\Zz\;\text{et de déterminant}\;1\}`;
// IaVr : un « tableau » dessiné avec des \hskip.
const HSKIP = String.raw`\hskip 20mm 1\hskip 2mm 2\hskip 2mm 3\hskip 2mm 4\hskip 2mm 5\hskip 2mm 6\hskip 2mm 7 \hskip 20mm 1\hskip 2mm 2\hskip 2mm 3\hskip 2mm 4\hskip 2mm 5\hskip 2mm 6\hskip 2mm 7`;
// KJqT : un tableau de deux lignes dans une formule en ligne.
const INLINE_ARRAY = String.raw`\begin{array}{ll} E_{1}=\{(x,y,z)\in {\Rr}^{3}/ x+y=0\}; & E_{1}'=\{(x,y,z)\in {\Rr}^{3}/xy=0\}.\\ E_{2}=\{(x,y,z,t)\in {\Rr}^{4}/ x+y+z=0\}; & E_{2}'=\{(x,y,z,t)\in {\Rr}^{4}/xyzt=0\}\end{array}`;

const render = tex => katex.renderToString(prepareMathForKatex(tex), {
  throwOnError: true,
  strict: false,
  macros: { ...katexMacros }
});
const breakPoints = tex => {
  const html = render(tex);
  return (html.slice(html.indexOf('katex-html')).match(/class="katex-base"/g) || []).length;
};

describe('findInlineMath', () => {
  it('trouve $…$ et \\(…\\) avec leurs positions', () => {
    const source = String.raw`Soit $x=1$ et \(y=2\).`;
    const found = findInlineMath(source);
    expect(found.map(f => f.text)).toEqual(['x=1', 'y=2']);
    for (const f of found) expect(source.slice(f.start, f.end)).toBe(f.text);
  });

  it('ignore les formules affichées, les commentaires, \\$ et le verbatim', () => {
    const source = [
      String.raw`$$a=b$$ puis \[c=d\] et 5\$ restent hors champ,`,
      String.raw`% $commentée=1$`,
      String.raw`\begin{verbatim}$brut=1$\end{verbatim}`,
      String.raw`mais $vraie=2$.`
    ].join('\n');
    expect(findInlineMath(source).map(f => f.text)).toEqual(['vraie=2']);
  });

  it('signale une formule qui contient un commentaire', () => {
    const [formula] = findInlineMath('$a = % reste\n b$');
    expect(formula.hasComment).toBe(true);
  });
});

describe('analyzeInlineMath', () => {
  it('ne signale ni une formule courte ni une formule qui se coupe déjà', () => {
    expect(codes(String.raw`x^2+y^2=1`)).toEqual([]);
    expect(codes(String.raw`a_1+a_2+a_3+a_4+a_5+a_6+a_7+a_8+a_9+a_{10}+a_{11}+a_{12}+a_{13}+a_{14}=0`)).toEqual([]);
  });

  it('repère chaque famille', () => {
    expect(codes(COMMA_LIST)).toContain('comma-list');
    expect(codes(LEFT_RIGHT)).toContain('left-right');
    expect(codes(LONG_TEXT)).toContain('long-text');
    expect(codes(HSKIP)).toEqual(['hskip-layout']);
    expect(codes(INLINE_ARRAY)).toContain('inline-array');
  });

  it('distingue ce que le correcteur réécrit, ce qu\'il ne fait que sur demande et le reste', () => {
    const fixable = text => Object.fromEntries(analyzeInlineMath(text).map(issue => [issue.code, issue.fixable]));
    expect(fixable(COMMA_LIST)['comma-list']).toBe(true);
    expect(fixable(LONG_TEXT)['long-text']).toBe(true);
    expect(fixable(HSKIP)['hskip-layout']).toBe(false);
    expect(fixable(INLINE_ARRAY)['inline-array']).toBe(false);

    // \left( est la notation voulue : sa réécriture n'a lieu que sur demande.
    const [leftRight] = analyzeInlineMath(LEFT_RIGHT).filter(issue => issue.code === 'left-right');
    expect(leftRight.fixable).toBe(false);
    expect(leftRight.fixableWithOption).toBe(true);
    expect(leftRight.message).toMatch(/Garder \\left\(/);
  });

  it('un \\left…\\right qui contient un tableau est un tableau, pas un groupe à réécrire', () => {
    const matrix = String.raw`A=\left(\begin{array}{ccc} 5^n+2(-1)^n&5^n-(-1)^n&5^n-(-1)^n\\ 5^n-(-1)^n&5^n+2(-1)^n&5^n-(-1)^n\\ 5^n-(-1)^n&5^n-(-1)^n&5^n+2(-1)^n\end{array}\right)`;
    expect(codes(matrix)).not.toContain('left-right');
    expect(codes(matrix)).toContain('inline-array');
    expect(leftRightToBig(matrix)).toBe(matrix);
  });

  it('mesure ses caractéristiques', () => {
    const features = inlineMathFeatures(COMMA_LIST);
    expect(features.topLevelCommas).toBeGreaterThanOrEqual(15);
    expect(features.hasBreakingEnvironment).toBe(false);
  });
});

describe('allowBreakAfterTopLevelCommas', () => {
  it('ajoute \\allowbreak aux virgules de premier niveau seulement', () => {
    const tex = String.raw`f(x,y), \{a,b\}, \left(c,d\right), \frac{u,v}{w}, z`;
    const fixed = allowBreakAfterTopLevelCommas(tex);
    // « \allowbreak » est inséré juste après la virgule ; l'espace d'origine suit.
    expect(fixed).toBe(String.raw`f(x,y),\allowbreak  \{a,b\},\allowbreak  \left(c,d\right),\allowbreak  \frac{u,v}{w},\allowbreak  z`);
  });

  it('est idempotent et ne touche pas \\, ni les virgules d\'un intervalle fermé', () => {
    const tex = String.raw`a\,b, [0,1], c`;
    const once = allowBreakAfterTopLevelCommas(tex);
    expect(once).toContain(String.raw`a\,b,\allowbreak `);
    expect(once).toContain('[0,1]');
    expect(allowBreakAfterTopLevelCommas(once)).toBe(once);
  });

  it('rend la liste coupable en KaTeX', () => {
    const fixed = allowBreakAfterTopLevelCommas(COMMA_LIST);
    expect(() => render(fixed)).not.toThrow();
    expect(breakPoints(COMMA_LIST)).toBe(1);
    expect(breakPoints(fixed)).toBeGreaterThan(10);
  });
});

describe('leftRightToBig', () => {
  it('remplace \\left…\\right par \\bigl…\\bigr', () => {
    const fixed = leftRightToBig(LEFT_RIGHT);
    expect(fixed).not.toMatch(/\\left|\\right/);
    expect(fixed.startsWith(String.raw`\bigl(`)).toBe(true);
    expect(fixed.endsWith(String.raw`\bigr)`)).toBe(true);
  });

  it('prend \\Bigl…\\Bigr quand le contenu est haut', () => {
    const tall = String.raw`\left\{ x\in\Rr \mid \frac{1}{x}+\sqrt{x}=2 \text{ et } x>0 \text{ et } y\in\Zz \text{ et } z\in\Nn \right\}`;
    expect(leftRightToBig(tall)).toMatch(/^\\Bigl\\\{.*\\Bigr\\\}$/);
  });

  it('laisse \\middle et les petits groupes tels quels', () => {
    const middle = String.raw`\left\{ x\in\Rr \middle| x>0 \text{ ou bien } x<-100000000 \right\}`;
    expect(leftRightToBig(middle)).toBe(middle);
    const small = String.raw`\left(a+b\right)^2`;
    expect(leftRightToBig(small)).toBe(small);
  });

  it('est idempotent, groupes imbriqués compris', () => {
    const nested = String.raw`\left[\left(\forall g\in\mathcal{L}(F,E),\;f\circ g\circ f=0\Rightarrow g = 0\right)\Rightarrow f\;\text{bijective}\right]`;
    const once = leftRightToBig(nested);
    expect(leftRightToBig(once)).toBe(once);
  });

  it('rend la formule coupable en KaTeX', () => {
    expect(() => render(leftRightToBig(LEFT_RIGHT))).not.toThrow();
    expect(breakPoints(LEFT_RIGHT)).toBe(1);
    expect(breakPoints(leftRightToBig(LEFT_RIGHT))).toBeGreaterThan(1);
  });
});

describe('splitLongText', () => {
  it('coupe le texte mot à mot et laisse les mots seuls', () => {
    const fixed = splitLongText(String.raw`x \text{ tels que les valeurs soient strictement positives } y \text{si}`);
    expect(fixed).toContain(String.raw`\text{tels }\allowbreak \text{que }`);
    expect(fixed).toContain(String.raw`\text{si}`);
  });

  it('est idempotent et produit du KaTeX valide', () => {
    const fixed = splitLongText(LONG_TEXT);
    expect(splitLongText(fixed)).toBe(fixed);
    expect(() => render(fixed)).not.toThrow();
    expect(breakPoints(fixed)).toBeGreaterThan(breakPoints(LONG_TEXT));
  });
});

describe('fixInlineMathLayout', () => {
  const source = String.raw`\uuid{ZZZ1}
\contenu{
\question{
Soit $${COMMA_LIST}$.

$$${COMMA_LIST}$$

% $${COMMA_LIST}$
Et $x=1$, \(${LEFT_RIGHT}\).
}
}`;

  it('ne réécrit que les formules en ligne signalées', () => {
    const fixed = fixInlineMathLayout(source);
    expect(fixed).not.toBe(source);
    expect(fixed).toContain(String.raw`$$${COMMA_LIST}$$`);
    expect(fixed).toContain(String.raw`% $${COMMA_LIST}$`);
    expect(fixed).toContain('Et $x=1$,');
    expect(fixed).toContain(String.raw`\allowbreak `);
  });

  it('garde \left…\right par défaut', () => {
    const fixed = fixInlineMathLayout(source);
    expect(fixed).toContain(String.raw`\left(\exists`);
    expect(fixed).not.toMatch(/\\bigl|\\Bigl/);
  });

  it('réécrit \left…\right en \bigl…\bigr sur demande', () => {
    const fixed = fixInlineMathLayout(source, { leftRight: true });
    expect(fixed).toContain(String.raw`\bigl(\exists`);
    expect(fixed).not.toContain(String.raw`\left(\exists`);
  });

  it('est idempotent, avec ou sans l\'option', () => {
    for (const options of [{}, { leftRight: true }]) {
      const once = fixInlineMathLayout(source, options);
      expect(fixInlineMathLayout(once, options)).toBe(once);
    }
  });

  it('laisse intacte une formule qui contient un commentaire', () => {
    const commented = String.raw`$${COMMA_LIST} % fin
$`;
    expect(fixInlineMathLayout(commented)).toBe(commented);
  });
});

describe('contrôle des sources et correcteur déterministe', () => {
  const source = String.raw`\uuid{ZZZ2}
\titre{Exercice}
\contenu{
\question{
Étudier $${COMMA_LIST}$ puis \(${LEFT_RIGHT}\).
}
}`;

  it('signale les formules par un avertissement, jamais par une erreur', () => {
    const warnings = validateMathLayout(source, 'sample.tex');
    expect(warnings.map(w => w.code)).toEqual(['inline-math-comma-list', 'inline-math-left-right']);
    expect(warnings.map(w => w.fixable)).toEqual([true, false]);
    expect(warnings.map(w => w.fixableWithOption)).toEqual([false, true]);
    expect(warnings[0]).toMatchObject({ filePath: 'sample.tex', line: 5 });
    expect(validateSource(source, 'sample.tex')).toEqual([]);
  });

  it('applyDeterministicFixes corrige la liste à virgules et laisse \\left…\\right', () => {
    const fixed = applyDeterministicFixes(source);
    expect(fixed).not.toBe(source);
    expect(validateMathLayout(fixed, 'sample.tex').map(w => w.code)).toEqual(['inline-math-left-right']);
    expect(validateSource(fixed, 'sample.tex')).toEqual([]);
  });

  it('avec leftRight, applyDeterministicFixes supprime tous les avertissements sans créer d\'erreur', () => {
    const fixed = applyDeterministicFixes(source, { leftRight: true });
    expect(validateMathLayout(fixed, 'sample.tex')).toEqual([]);
    expect(validateSource(fixed, 'sample.tex')).toEqual([]);
  });

  it('ne signale que ce qu\'il ne sait pas réécrire une fois corrigé', () => {
    const hskip = String.raw`\uuid{ZZZ3}
\contenu{
\question{
Décomposer $${HSKIP}$.
}
}`;
    const fixed = applyDeterministicFixes(hskip);
    expect(fixed).toBe(hskip);
    expect(validateMathLayout(fixed, 'sample.tex').map(w => [w.code, w.fixable])).toEqual([['inline-math-hskip-layout', false]]);
  });
});
