import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  loadCpgeNodeIds,
  validateCpgeReferences,
  validateImageReferences,
  validateQcmSource,
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

  it('accepts \cpge among the metadata commands', () => {
    const source = String.raw`\uuid{abcd}
\niveau{L1}
\cpge{mpsi-mp2i.nombres-complexes.f, pcsi.nombres-complexes.f}
\contenu{\question{Question.}}`;
    expect(validateSource(source, 'cpge.tex')).toEqual([]);
  });

  it('checks \cpge identifiers against the CPGE referential', async () => {
    const nodeIds = await loadCpgeNodeIds();
    expect(nodeIds.has('pcsi.nombres-complexes.f')).toBe(true);

    const valid = String.raw`\uuid{a}\cpge{pcsi.nombres-complexes.f}\contenu{\question{Q.}}`;
    expect(validateCpgeReferences([{ source: valid, filePath: 'a.tex' }], { nodeIds })).toEqual([]);

    const invalid = String.raw`\uuid{b}
% \cpge{commenté.ignoré}
\cpge{pcsi.nombres-complexes.z, PCSI, pcsi.nombres-complexes.f, pcsi.nombres-complexes.f,}
\contenu{\question{Q.}}`;
    const issues = validateCpgeReferences([{ source: invalid, filePath: 'b.tex' }], { nodeIds });
    expect(issues.map(issue => issue.code)).toEqual([
      'unknown-cpge-node', 'invalid-cpge', 'invalid-cpge', 'invalid-cpge'
    ]);
    expect(issues[0].line).toBe(3);
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
  describe('qcm', () => {
    const header = String.raw`\uuid{qc01}
\titre{Un qcm}
\auteur{Auteur}
\organisation{AMSCC}
\datecreate{2026-11-24}
\niveau{L2}
\module{Probabilité}
\chapitre{Probabilité continue}
\difficulte{2}
`;
    const qcm = (body, extra = '') => `${header}${extra}\\contenu{\n${body}\n}`;
    const qcmCodes = source => validateQcmSource(source, 'content/qcm/amscc/qc01.tex').map(issue => issue.code);
    const question = (answers, before = 'Quelle est la bonne réponse ?', after = '') => String.raw`\begin{question}
${before}
\begin{answers}
${answers}
\end{answers}
\begin{explanations}
Parce que.
\end{explanations}
${after}
\end{question}`;

    it('routes qcm sources to the qcm validator', () => {
      const source = qcm(question(String.raw`\good{$1$}
\bad{$2$}`));
      expect(validateSource(source, 'sample.tex')).toEqual([]);
      expect(validateSource(source, 'content/qcm/amscc/qc01.tex')).toEqual([]);
    });

    it('accepts an ordered series with a shared statement and \qtype', () => {
      const one = question(String.raw`\good{$1$}
\bad{$2$}`, String.raw`\qtype{onlyone}
\qkeeporder
Première question.`);
      const two = question(String.raw`\bad{$1$}
\good{$2$ \feedback{Bien vu.}}.`, 'Seconde question.');
      const source = qcm(String.raw`\texte{Énoncé commun avec $X$.}

${one}

${two}`, '\\serie{ordonnee}\n\\licence{CC BY 4.0}\n');
      expect(qcmCodes(source)).toEqual([]);
    });

    it('reports answer consistency problems', () => {
      expect(qcmCodes(qcm(question(String.raw`\bad{$1$}
\bad{$2$}`)))).toEqual(['qcm-no-correct-answer']);
      expect(qcmCodes(qcm(question(String.raw`\bad{$1$}
\bad{$2$}`, String.raw`\qtype{zerotoall}
Rien de juste ?`)))).toEqual([]);
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}
\good{$2$}`, String.raw`\qtype{onlyone}
Une seule ?`)))).toEqual(['qcm-type-mismatch']);
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}`)))).toEqual(['qcm-too-few-answers']);
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}
\bad{ }`)))).toEqual(['qcm-empty-answer']);
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}
\bad{$2$}`, String.raw`\qtype{multiple}
Type ?`)))).toEqual(['qcm-unknown-type']);
    });

    it('reports text lost by the qcm parser', () => {
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}
Une réponse sans commande
\bad{$2$}`)))).toEqual(['qcm-text-in-answers']);
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}
\bad{$2$}`, undefined, 'Commentaire oublié.')))).toEqual(['qcm-text-after-answers']);
      expect(qcmCodes(qcm(question(String.raw`\good{$1$}
\bad{$2$}`, '\\qclassification{121.02}')))).toEqual(['qcm-empty-stem']);
      expect(qcmCodes(qcm(`Texte libre.\n\n${question(String.raw`\good{$1$}
\bad{$2$}`)}`))).toEqual(['untyped-content-text']);
    });

    it('reports structural and metadata problems with their position', () => {
      const unclosed = qcm(String.raw`\begin{question}
Énoncé.
\begin{answers}
\good{$1$}
\bad{$2$}
\end{answers}`);
      expect(qcmCodes(unclosed)).toEqual(['unbalanced-environment', 'missing-question']);

      const two = qcm(`${question(String.raw`\good{$1$}
\bad{$2$}`)}\n${question(String.raw`\good{$1$}
\bad{$2$}`)}`);
      expect(qcmCodes(two)).toEqual(['qcm-serie']);

      const noDate = qcm(question(String.raw`\good{$1$}
\bad{$2$}`)).replace('\\datecreate{2026-11-24}', '\\datecreate{}');
      expect(qcmCodes(noDate)).toEqual(['missing-metadata']);
      expect(validateQcmSource(noDate, 'content/qcm/amscc/autre.tex').map(issue => issue.code))
        .toEqual(['missing-metadata', 'uuid-filename-mismatch']);

      const issues = validateQcmSource(qcm(question(String.raw`\good{$1$}
\good{$2$}`, String.raw`\qtype{truefalse}
Vrai ?`)), 'content/qcm/amscc/qc01.tex');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ code: 'qcm-type-mismatch', line: 14, column: 1 });
    });

    it('resolves \qimage like the qcm parser', async () => {
      const issues = await validateImageReferences([{
        source: String.raw`\qimage{images/png/absente-1.png}`,
        filePath: 'content/qcm/exo7/lot/nouveau.tex',
        sourceFilePath: path.join(ROOT, 'content/qcm/exo7/lot/nouveau.tex')
      }]);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('\\qimage{images/png/absente-1.png}');
    });
  });
});
