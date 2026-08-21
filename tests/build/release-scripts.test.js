import { describe, expect, it } from 'vitest';

import { parseUuidArgs } from '../../scripts/build-tikz.js';
import { sourceNeedsTikz } from '../../scripts/prepare-exercise.js';
import { addedExercisePaths } from '../../scripts/prepare-new-exercises.js';
import { isReleaseVersion } from '../../scripts/release-content.js';

describe('prepare-exercise', () => {
  it('detects TikZ while ignoring commented code', () => {
    expect(sourceNeedsTikz('\\begin{tikzpicture}\\end{tikzpicture}')).toBe(true);
    expect(sourceNeedsTikz('% \\begin{tikzpicture}\n\\question{Sans figure.}')).toBe(false);
  });
});

describe('build-tikz', () => {
  it('accepts one or more targeted UUIDs without duplicates', () => {
    expect(parseUuidArgs(['--uuid', 'X7pQ', '--uuid=A2bC', '--uuid', 'X7pQ']))
      .toEqual(['X7pQ', 'A2bC']);
    expect(parseUuidArgs([])).toEqual([]);
  });

  it('rejects incomplete and unknown options', () => {
    expect(() => parseUuidArgs(['--uuid'])).toThrow('Usage');
    expect(() => parseUuidArgs(['--all'])).toThrow('Option inconnue');
  });
});

describe('prepare-new-exercises', () => {
  it('selects only new exercise sources from Git status', () => {
    const status = [
      '?? content/exercises/amscc/X7pQ.tex',
      'A  content/exercises/exo7/9-L3/A2bC.tex',
      ' M content/exercises/amscc/existing.tex',
      '?? content/images/amscc/png/X7pQ-1.png',
      '?? docs/note.md',
      ''
    ].join('\0');

    expect(addedExercisePaths(status)).toEqual([
      'content/exercises/amscc/X7pQ.tex',
      'content/exercises/exo7/9-L3/A2bC.tex'
    ]);
  });
});

describe('release-content', () => {
  it('accepts semantic versions used for Docker tags', () => {
    expect(isReleaseVersion('2.4.3')).toBe(true);
    expect(isReleaseVersion('2.4.3-rc.1')).toBe(true);
    expect(isReleaseVersion('v2.4.3')).toBe(false);
    expect(isReleaseVersion('2.4')).toBe(false);
  });
});
