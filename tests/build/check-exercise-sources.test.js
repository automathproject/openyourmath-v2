import { describe, expect, it } from 'vitest';

import { validateSource } from '../../scripts/quality/check-exercise-sources.js';

function issueCodes(source) {
  return validateSource(source, 'sample.tex').map(issue => issue.code);
}

describe('check-exercise-sources', () => {
  it('accepts a valid exercise source', () => {
    const source = String.raw`
\uuid{ok01}
\titre{Exercice valide}
\contenu{
\texte{On pose $x=1$.}
\question{Calculer $x+1$.}
\indication{Utiliser la définition.}
\reponse{$x+1=2$.}
}`;

    expect(validateSource(source, 'valid.tex')).toEqual([]);
  });

  it('reports an exercise without question', () => {
    const source = String.raw`
\uuid{bad01}
\contenu{
\texte{Tout le contenu est dans un bloc texte, mais aucune question n'est déclarée.}
}`;

    expect(issueCodes(source)).toContain('missing-question');
  });

  it('reports a single-item enumerate when there is only one question', () => {
    const source = String.raw`
\uuid{bad02}
\contenu{
\begin{enumerate}
  \item \question{Une seule question dans une liste inutile.}
\end{enumerate}
}`;

    expect(issueCodes(source)).toContain('single-item-enumerate');
  });

  it('allows enumerate lists with several questions', () => {
    const source = String.raw`
\uuid{ok02}
\contenu{
\begin{enumerate}
  \item \question{Première question.}
  \item \question{Deuxième question.}
\end{enumerate}
}`;

    expect(issueCodes(source)).not.toContain('single-item-enumerate');
  });

  it('reports empty indications', () => {
    const source = String.raw`
\uuid{bad03}
\contenu{
\question{Une question.}
\indication{
}
}`;

    expect(issueCodes(source)).toContain('empty-indication');
  });

  it('reports raw text directly inside contenu', () => {
    const source = String.raw`
\uuid{bad04}
\contenu{
Ce texte devrait être dans \texte{}.
\question{Une question.}
}`;

    expect(issueCodes(source)).toContain('untyped-content-text');
  });

  it('reports typed content outside contenu', () => {
    const source = String.raw`
\uuid{bad05}
\texte{Ce bloc est hors contenu.}
\contenu{
\question{Une question.}
}`;

    expect(issueCodes(source)).toContain('content-outside-contenu');
  });

  it('ignores accepted metadata and SaveVerbatim blocks outside contenu', () => {
    const source = String.raw`
\uuid{ok03}
\exo7id{1234}
\isIndication{false}
\isCorrection{true}
\begin{SaveVerbatim}{python}
def f(x):
    return x + 1
\end{SaveVerbatim}
\contenu{
\question{Utiliser le code précédent.}
}`;

    expect(validateSource(source, 'metadata-and-code.tex')).toEqual([]);
  });
});
