import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  validateImageReferences,
  validateSource,
  validateUuidUniqueness
} from '../../scripts/quality/check-exercise-sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

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

  it('reports every source sharing the same UUID', () => {
    const source = String.raw`\uuid{same1}\contenu{\question{Question.}}`;
    const issues = validateUuidUniqueness([
      { source, filePath: 'content/exercises/a.tex' },
      { source, filePath: 'content/exercises/b.tex' },
      { source: String.raw`\uuid{other}\contenu{\question{Autre.}}`, filePath: 'content/exercises/c.tex' }
    ]);

    expect(issues).toHaveLength(2);
    expect(issues.map(issue => issue.code)).toEqual(['duplicate-uuid', 'duplicate-uuid']);
    expect(issues[0].message).toContain('same1');
    expect(issues.map(issue => issue.filePath)).toEqual([
      'content/exercises/a.tex',
      'content/exercises/b.tex'
    ]);
  });

  it('ignores UUID commands commented out in a source', () => {
    const issues = validateUuidUniqueness([
      { source: String.raw`% \uuid{same1}
\uuid{first}\contenu{\question{A.}}`, filePath: 'a.tex' },
      { source: String.raw`\uuid{same1}\contenu{\question{B.}}`, filePath: 'b.tex' }
    ]);

    expect(issues).toEqual([]);
  });

  it('accepts an image resolved by the content pipeline', async () => {
    const issues = await validateImageReferences([{
      source: String.raw`\includegraphics{pdf/4R9m-tikz-1}`,
      filePath: 'content/exercises/amscc/4R9m.tex',
      sourceFilePath: path.join(ROOT, 'content/exercises/amscc/4R9m.tex')
    }]);

    expect(issues).toEqual([]);
  });

  it('reports an image that cannot be resolved', async () => {
    const issues = await validateImageReferences([{
      source: String.raw`\includegraphics{png/absente-1.png}`,
      filePath: 'content/exercises/amscc/nouveau.tex',
      sourceFilePath: path.join(ROOT, 'content/exercises/amscc/nouveau.tex')
    }]);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('missing-image');
    expect(issues[0].message).toContain('png/absente-1.png');
  });

  it('ignores image references commented out', async () => {
    const issues = await validateImageReferences([{
      source: String.raw`% \includegraphics{png/absente-1.png}`,
      filePath: 'content/exercises/amscc/nouveau.tex',
      sourceFilePath: path.join(ROOT, 'content/exercises/amscc/nouveau.tex')
    }]);

    expect(issues).toEqual([]);
  });
});
