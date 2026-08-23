import { describe, expect, it } from 'vitest';
import { parseLatexDiagnostics } from '../../src/lib/latex/diagnostics.js';

describe('parseLatexDiagnostics', () => {
  it('extrait une erreur et sa ligne source', () => {
    expect(parseLatexDiagnostics('! Undefined control sequence.\nl.42 \\inconnue\n')).toEqual([
      { severity: 'error', line: 42, message: 'Undefined control sequence.' },
    ]);
  });

  it('extrait les avertissements sans dupliquer un même diagnostic', () => {
    const log = 'LaTeX Warning: Reference `a` on input line 7.\nLaTeX Warning: Reference `a` on input line 7.';
    expect(parseLatexDiagnostics(log)).toEqual([
      { severity: 'warning', line: 7, message: 'Reference `a`' },
    ]);
  });
});
