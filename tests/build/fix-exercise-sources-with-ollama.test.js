import { describe, expect, it } from 'vitest';

import {
  buildCorrectionPrompt,
  correctSourceWithChat,
  parseModelCorrection,
  parseQualityReport
} from '../../scripts/quality/fix-exercise-sources-with-ollama.js';
import { validateSource } from '../../scripts/quality/check-exercise-sources.js';

function issueCodes(source) {
  return validateSource(source, 'sample.tex').map(issue => issue.code);
}

function fakeChatReturning(correctedLatex) {
  return async () => JSON.stringify({ corrected_latex: correctedLatex });
}

describe('fix-exercise-sources-with-ollama', () => {
  it('parses the quality CSV report, including quoted messages', () => {
    const rows = parseQualityReport([
      'file,line,column,code,message',
      'content/exercises/a.tex,12,3,untyped-content-text,"Texte avec ""guillemets"", virgule, et suite"'
    ].join('\n'));

    expect(rows).toEqual([
      {
        file: 'content/exercises/a.tex',
        line: 12,
        column: 3,
        code: 'untyped-content-text',
        message: 'Texte avec "guillemets", virgule, et suite'
      }
    ]);
  });

  it('states that texte is optional in the prompt', () => {
    const prompt = buildCorrectionPrompt({
      filePath: 'content/exercises/sample.tex',
      issues: [{ line: 1, column: 1, code: 'missing-question', message: 'missing' }],
      source: String.raw`\contenu{\texte{Question ?}}`
    });

    expect(prompt).toContain(String.raw`\texte{...} est facultatif`);
  });

  it('extracts corrected latex from a JSON response wrapped in Markdown', () => {
    const corrected = parseModelCorrection('```json\n{"corrected_latex":"\\\\contenu{\\\\question{Q ?}}"}\n```');

    expect(corrected).toBe(String.raw`\contenu{\question{Q ?}}`);
  });

  it.each([
    {
      name: 'missing question',
      targetCode: 'missing-question',
      source: String.raw`
\uuid{bad01}
\contenu{
\texte{Quelle est la nature de $t\circ h$ ?}
}`,
      corrected: String.raw`
\uuid{bad01}
\contenu{
\question{Quelle est la nature de $t\circ h$ ?}
}`
    },
    {
      name: 'raw text in contenu',
      targetCode: 'untyped-content-text',
      source: String.raw`
\uuid{bad02}
\contenu{
On considère une fonction $f$.
\question{Calculer $f'(x)$.}
}`,
      corrected: String.raw`
\uuid{bad02}
\contenu{
\texte{On considère une fonction $f$.}
\question{Calculer $f'(x)$.}
}`
    },
    {
      name: 'empty indication',
      targetCode: 'empty-indication',
      source: String.raw`
\uuid{bad03}
\contenu{
\question{Une question.}
\indication{}
}`,
      corrected: String.raw`
\uuid{bad03}
\contenu{
\question{Une question.}
}`
    },
    {
      name: 'single item enumerate',
      targetCode: 'single-item-enumerate',
      source: String.raw`
\uuid{bad04}
\contenu{
\begin{enumerate}
  \item \question{Montrer que $A$ est inversible.}
\end{enumerate}
}`,
      corrected: String.raw`
\uuid{bad04}
\contenu{
\question{Montrer que $A$ est inversible.}
}`
    },
    {
      name: 'typed content outside contenu',
      targetCode: 'content-outside-contenu',
      source: String.raw`
\uuid{bad05}
\texte{Contexte hors contenu.}
\contenu{
\question{Une question.}
}`,
      corrected: String.raw`
\uuid{bad05}
\contenu{
\texte{Contexte hors contenu.}
\question{Une question.}
}`
    }
  ])('applies a model correction on sample: $name', async ({ source, corrected, targetCode }) => {
    expect(issueCodes(source)).toContain(targetCode);

    const result = await correctSourceWithChat({
      filePath: 'sample.tex',
      source,
      issues: validateSource(source, 'sample.tex'),
      chatFn: fakeChatReturning(corrected)
    });

    expect(result).toBe(corrected);
    expect(issueCodes(result)).not.toContain(targetCode);
    expect(validateSource(result, 'sample.tex').length).toBeLessThan(validateSource(source, 'sample.tex').length);
  });
});
