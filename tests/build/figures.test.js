// Figures des exercices : dimensions lues dans les fichiers, attributs ajoutés
// aux balises <img> du site.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readImageSize } from '../../src/lib/imageSize.js';
import { addFigureAttributes, withFigureAttributes } from '../../src/lib/server/exerciseFigures.js';

function png(width, height) {
  const header = Buffer.alloc(24);
  header.writeUInt32BE(0x89504e47, 0);
  header.writeUInt32BE(0x0d0a1a0a, 4);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

// JPEG minimal : SOI, un segment APP0 à sauter, puis SOF0 (hauteur puis largeur).
function jpeg(width, height) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46]);
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0x00, 0x11, 0x08]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

describe('readImageSize', () => {
  it('lit un PNG', () => {
    expect(readImageSize(png(640, 480), 'png')).toEqual({ width: 640, height: 480 });
  });

  it('lit un JPEG derrière un segment APP0', () => {
    expect(readImageSize(jpeg(654, 300), 'jpg')).toEqual({ width: 654, height: 300 });
    expect(readImageSize(jpeg(10, 20), 'JPEG')).toEqual({ width: 10, height: 20 });
  });

  it('convertit les points d\'un SVG TikZ en pixels CSS', () => {
    const svg = Buffer.from("<svg version='1.1' width='245.282pt' height='183.782pt' viewBox='0 0 245.282 183.782'>");
    expect(readImageSize(svg, 'svg')).toEqual({ width: 327.04, height: 245.04 });
  });

  it('se rabat sur le viewBox quand width et height sont relatifs', () => {
    const svg = Buffer.from('<svg width="100%" viewBox="0 0 200 100"></svg>');
    expect(readImageSize(svg, 'svg')).toEqual({ width: 200, height: 100 });
  });

  it('refuse ce qui n\'est pas une image reconnue', () => {
    expect(readImageSize(Buffer.from('rien'), 'png')).toBe(null);
    expect(readImageSize(Buffer.from('<p>pas un svg</p>'), 'svg')).toBe(null);
    expect(readImageSize(Buffer.from([0xff, 0xd8, 0xff]), 'jpg')).toBe(null);
    expect(readImageSize(png(1, 1), 'gif')).toBe(null);
  });
});

describe('addFigureAttributes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oym-figures-'));
  fs.mkdirSync(path.join(root, 'static/artifacts/tikz'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'static/artifacts/tikz/t-tikz_1.svg'),
    "<svg width='96pt' height='48pt' viewBox='0 0 96 48'></svg>",
  );
  fs.writeFileSync(path.join(root, 'static/artifacts/tikz/t-png.png'), png(300, 200));

  const inRoot = (fn) => {
    const previous = process.cwd();
    process.chdir(root);
    try {
      return fn();
    } finally {
      process.chdir(previous);
    }
  };

  it('ajoute dimensions et chargement différé', () => {
    const out = inRoot(() =>
      addFigureAttributes('<p><img src="/artifacts/tikz/t-tikz_1.svg" alt="Diagramme" class="tikz-svg-image"></p>'),
    );
    expect(out).toBe(
      '<p><img src="/artifacts/tikz/t-tikz_1.svg" alt="Diagramme" class="tikz-svg-image" width="128" height="64" loading="lazy" decoding="async"></p>',
    );
  });

  it('garde ce que la balise déclare déjà', () => {
    const out = inRoot(() =>
      addFigureAttributes('<img src="/artifacts/tikz/t-png.png" width="50" loading="eager" />'),
    );
    expect(out).toBe('<img src="/artifacts/tikz/t-png.png" width="50" loading="eager" decoding="async">');
  });

  it('laisse le chargement différé quand le fichier est introuvable', () => {
    const out = inRoot(() => addFigureAttributes('<img src="/artifacts/images/absente/img_1.png">'));
    expect(out).toBe('<img src="/artifacts/images/absente/img_1.png" loading="lazy" decoding="async">');
  });

  it('ne touche ni aux images extérieures ni aux chemins qui remontent', () => {
    const external = '<img src="https://exemple.org/a.png">';
    const traversal = '<img src="/artifacts/../../etc/passwd.png">';
    expect(inRoot(() => addFigureAttributes(external))).toBe(external);
    expect(inRoot(() => addFigureAttributes(traversal))).toBe(
      '<img src="/artifacts/../../etc/passwd.png" loading="lazy" decoding="async">',
    );
  });

  it('passe sur chaque bloc d\'un exercice', () => {
    const out = inRoot(() =>
      withFigureAttributes({
        uuid: 'x',
        content: [{ html: '<img src="/artifacts/tikz/t-png.png">' }, { latex: 'seul' }],
      }),
    );
    expect(out.content[0].html).toContain('width="300" height="200"');
    expect(out.content[1]).toEqual({ latex: 'seul' });
    expect(withFigureAttributes(null)).toBe(null);
  });
});
