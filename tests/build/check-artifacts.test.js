import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { validateArtifactReferences } from '../../scripts/quality/check-artifacts.js';

const temporaryDirectories = [];

async function fixture({ manifest = true, artifactFile = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oym-artifacts-'));
  temporaryDirectories.push(root);
  const contentRoot = path.join(root, 'content');
  const sourceFilePath = path.join(contentRoot, 'exercises/amscc/sample.tex');
  const imagePath = path.join(contentRoot, 'images/amscc/png/sample.png');
  const artifactsRoot = path.join(root, 'static/artifacts');
  const staticRoot = path.join(root, 'static');
  const publicUrl = '/artifacts/images/test01/img_1.png';

  await fs.mkdir(path.dirname(sourceFilePath), { recursive: true });
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  await fs.writeFile(sourceFilePath, '\\uuid{test01}');
  await fs.writeFile(imagePath, 'png');
  if (manifest) {
    await fs.mkdir(artifactsRoot, { recursive: true });
    await fs.writeFile(path.join(artifactsRoot, 'test01.json'), JSON.stringify({
      images: [{ originalPath: 'png/sample', url: publicUrl }]
    }));
  }
  if (artifactFile) {
    const artifactPath = path.join(staticRoot, publicUrl.slice(1));
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, 'png');
  }

  return {
    contentRoot,
    artifactsRoot,
    staticRoot,
    entries: [{ filePath: 'content/exercises/amscc/sample.tex', sourceFilePath, uuid: 'test01', imagePath: 'png/sample' }]
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })));
});

describe('check-artifacts', () => {
  it('accepts an image declared and copied to static artifacts', async () => {
    const data = await fixture();
    await expect(validateArtifactReferences(data.entries, data)).resolves.toEqual([]);
  });

  it('reports an image omitted from its artifact manifest', async () => {
    const data = await fixture({ manifest: false });
    const issues = await validateArtifactReferences(data.entries, data);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('missing-artifact-manifest');
  });

  it('reports an artifact file missing from static', async () => {
    const data = await fixture({ artifactFile: false });
    const issues = await validateArtifactReferences(data.entries, data);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('missing-artifact-file');
  });
});
