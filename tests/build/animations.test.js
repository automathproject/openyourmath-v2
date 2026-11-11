// Animations interactives associées aux exercices : \animation{nom}{légende},
// page autonome extraite d'un diaporama, contrôle des références.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ANIMATION_NAME,
  animationUrl,
  findAnimations,
  indexAnimationPages,
  replaceAnimationsWithPlaceholders,
} from '../../src/lib/animations.js';
import { buildLatexExport } from '../../src/lib/latex/export.js';
import { latexToPreviewHtml } from '../../src/lib/latex/texPreview.js';
import { checkAnimations } from '../../scripts/quality/check-animations.js';
import { widgetPage } from '../../src/lib/widgets/page.js';
import { KIT_VERSION, metaProblems, readWidgetSource } from '../../src/lib/widgets/source.js';
import { embedCode } from '../../src/lib/actions/animationFrames.js';

describe('findAnimations', () => {
  it('lit le nom et la légende', () => {
    expect(findAnimations('Avant \\animation{ebva-directionnelle}{Dérivée en 0} après')).toEqual([
      { name: 'ebva-directionnelle', caption: 'Dérivée en 0', image: '', start: 6, end: 51 },
    ]);
  });

  it("lit l'image fixe facultative", () => {
    const [call] = findAnimations('\\animation [\\exercisespath img/pdf/ebva-tikz-1] {ebva-directionnelle}{L}');
    expect(call).toMatchObject({ name: 'ebva-directionnelle', caption: 'L', image: '\\exercisespath img/pdf/ebva-tikz-1' });
  });

  it('accepte des accolades dans la légende et un saut de ligne entre les groupes', () => {
    const [call] = findAnimations('\\animation{x1}\n{Fonction $f_{n}$ et \\textbf{pente}}');
    expect(call.name).toBe('x1');
    expect(call.caption).toBe('Fonction $f_{n}$ et \\textbf{pente}');
  });

  it('ignore les commentaires et les appels incomplets', () => {
    expect(findAnimations('% \\animation{a}{b}\n\\animation{a}\n\\animation{a}{b')).toEqual([]);
  });

  it('trouve plusieurs appels', () => {
    expect(findAnimations('\\animation{a}{A}\n\\animation{b}{B}').map((c) => c.name)).toEqual(['a', 'b']);
  });
});

describe('noms et adresses', () => {
  it('refuse les noms qui pourraient sortir du dossier', () => {
    for (const bad of ['', '../x', 'a/b', 'a b', '.hidden', 'x.html', '-x']) {
      expect(ANIMATION_NAME.test(bad)).toBe(false);
    }
    expect(ANIMATION_NAME.test('ebva-directionnelle')).toBe(true);
  });

  it("construit l'adresse de la page", () => {
    expect(animationUrl(' ebva-directionnelle ')).toBe('/animation/ebva-directionnelle');
  });
});

describe('indexAnimationPages', () => {
  it('retrouve la source de chaque page à partir de son nom', () => {
    const { pages, duplicates } = indexAnimationPages([
      '/content/animations/amscc/ebva-directionnelle.js',
      '/content/animations/exo7/autre.js',
    ]);
    expect([...pages]).toEqual([
      ['ebva-directionnelle', '/content/animations/amscc/ebva-directionnelle.js'],
      ['autre', '/content/animations/exo7/autre.js'],
    ]);
    expect(duplicates.size).toBe(0);
  });

  it("n'attribue pas un nom présent dans deux sources", () => {
    const { pages, duplicates } = indexAnimationPages([
      '/content/animations/exo7/x.js',
      '/content/animations/amscc/x.js',
    ]);
    expect(pages.has('x')).toBe(false);
    expect(duplicates.get('x')).toEqual(['/content/animations/amscc/x.js', '/content/animations/exo7/x.js']);
  });

  it('ignore les pages hors de animations/<source>/ et les noms invalides', () => {
    const { pages } = indexAnimationPages([
      '/content/animations/plat.js',
      '/content/animations/amscc/sous/x.js',
      '/content/animations/amscc/x.y.js',
    ]);
    expect(pages.size).toBe(0);
  });
});

describe('replaceAnimationsWithPlaceholders', () => {
  it('isole chaque appel en paragraphe et fournit un emplacement HTML', () => {
    let n = 0;
    const { content, replacements, names } = replaceAnimationsWithPlaceholders(
      'Texte \\animation{a-1}{Une "figure" <b>}. Suite',
      () => `id${n++}`,
    );
    expect(content).toBe('Texte \n\nANIMATIONPLACEHOLDERid0\n\n. Suite');
    expect(names).toEqual(['a-1']);
    expect(replacements[0].html).toBe(
      '<div class="oym-animation" data-animation="a-1" data-caption="Une &quot;figure&quot; &lt;b&gt;">' +
        '<a href="/animation/a-1">Animation : Une &quot;figure&quot; &lt;b&gt;</a></div>',
    );
  });

  it("fait de l'image fixe la vignette du lecteur", () => {
    const { replacements } = replaceAnimationsWithPlaceholders(
      '\\animation[img/a]{a}{A}\n\\animation[img/inconnue]{b}{B}',
      () => 'z',
      (image) => (image === 'img/a' ? '/artifacts/images/u/img_1.svg' : undefined),
    );
    expect(replacements[0].html).toContain('data-poster="/artifacts/images/u/img_1.svg"');
    expect(replacements[1].html).not.toContain('data-poster');
  });

  it('signale un nom invalide au lieu de produire un lien', () => {
    const { replacements, names } = replaceAnimationsWithPlaceholders('\\animation{../x}{Légende}', () => 'z');
    expect(names).toEqual([]);
    expect(replacements[0].html).toContain('code-error');
    expect(replacements[0].html).not.toContain('href');
  });
});

describe('export LaTeX et aperçu', () => {
  it("définit \\animation dans l'export avec l'adresse publique", () => {
    const { source } = buildLatexExport([{
      uuid: 'ebva', title: 'E',
      content: [{ type: 'reponse', order: 1, latex: '\\animation{ebva-directionnelle}{Dérivée}' }],
    }], 'T', { includeSolutions: true });
    expect(source).toContain('\\usepackage[hidelinks]{hyperref}');
    expect(source).toContain('\\newcommand{\\animation}[3][]');
    expect(source).toContain('\\url{https://openyourmath.org/animation/#2}');
    expect(source).toContain('\\usepackage{qrcode}');
    expect(source).toContain('\\qrcode[height=2cm]{https://openyourmath.org/animation/#2}');
    expect(source).toContain('\\animation{ebva-directionnelle}{Dérivée}');
  });

  it("ne définit rien quand l'exercice n'en a pas", () => {
    const { source } = buildLatexExport([{
      uuid: 'u', title: 'U', content: [{ type: 'question', order: 1, latex: 'Bonjour' }],
    }], 'T');
    expect(source).not.toContain('\\animation');
    expect(source).not.toContain('qrcode');
  });

  it("annonce l'animation dans l'aperçu de /create", () => {
    expect(latexToPreviewHtml('\\animation{ebva-directionnelle}{Dérivée en 0}')).toContain('Animation : Dérivée en 0');
    expect(latexToPreviewHtml('\\animation[img/x]{ebva-directionnelle}{Dérivée en 0}')).toContain('Animation : Dérivée en 0');
  });

  describe('image fixe', () => {
    const exercise = {
      uuid: 'ebva', title: 'E',
      content: [{ type: 'reponse', order: 1, latex: '\\animation[\\exercisespath img/pdf/ebva-tikz-1]{ebva-directionnelle}{Dérivée}' }],
    };
    const artifacts = (image) => ({ ebva: { images: [{ originalPath: '\\exercisespath img/pdf/ebva-tikz-1', ...image }] } });
    const build = (image, imageMode) =>
      buildLatexExport([exercise], 'T', { includeSolutions: true, artifactsMap: artifacts(image), imageMode });

    it('recopie la source TikZ dans le cadre, transportable partout', () => {
      const tikz = '\\begin{tikzpicture}\\draw[thick] (0,0) -- (1,1);\\end{tikzpicture}';
      const { source, images } = build({ url: '/artifacts/images/ebva/img_1.svg', tikz }, 'remote');
      expect(source).toContain('\\newcommand{\\animationcadre}[3]');
      expect(source).toContain('\\animationcadre{\\resizebox{0.6\\linewidth}{!}{%');
      expect(source).toContain('\\draw[thick] (0,0)');
      expect(source).toContain('{ebva-directionnelle}{Dérivée}');
      expect(source).not.toContain('img/pdf');
      expect(images).toEqual([]);
    });

    it("joint le fichier quand il n'y a pas de source TikZ", () => {
      const { source, images } = build({ url: '/artifacts/images/ebva/img_1.png' }, 'files');
      expect(source).toContain('\\animation[images/ebva/img_1.png]{ebva-directionnelle}{Dérivée}');
      expect(images).toEqual([{ localPath: 'images/ebva/img_1.png', url: '/artifacts/images/ebva/img_1.png' }]);
    });

    it("garde l'encadré sans image quand le compilateur distant ne peut pas la recevoir", () => {
      const { source, images, skippedImages } = build({ url: '/artifacts/images/ebva/img_1.png' }, 'remote');
      expect(source).toContain('\\animation{ebva-directionnelle}{Dérivée}');
      expect(images).toEqual([]);
      expect(skippedImages).toEqual([]);
    });
  });
});

describe('page d’une figure', () => {
  const page = widgetPage({
    name: 'demo',
    kitScript: 'globalThis.OYMWidgets = {};',
    kitStyle: '.oym-widget{}',
    widgetScript: "OYMWidgets.define('demo', { intro: '</script><b>' });",
  });

  it('assemble KaTeX du site, le kit, la figure et son conteneur', () => {
    expect(page).toContain('/animation-vendor/katex/katex.min.js');
    expect(page).not.toMatch(/https?:\/\//);
    expect(page).toContain('<div data-widget="demo"></div>');
    expect(page).toContain('.oym-widget{}');
    expect(page.indexOf('globalThis.OYMWidgets')).toBeLessThan(page.indexOf("OYMWidgets.define('demo'"));
    expect(page).toContain('OYMWidgets.page();');
  });

  it('empêche le code de la figure de fermer son <script>', () => {
    expect(page).toContain("intro: '<\\/script><b>'");
    expect(page.match(/<\/script>/g)).toHaveLength(6);
  });

});

describe('lecture statique d’une figure', () => {
  it('lit les noms enregistrés et meta sans exécuter le code', () => {
    const source = `OYMWidgets.define('a', {
      meta: { title: 'T', description: \`D\`, concepts: ['x', "y"], author: 'mnguyen', kit: 1 },
      mount() { throw new Error('jamais exécuté'); },
    });
    OYMWidgets.define( "b" , {});`;
    expect(readWidgetSource(source)).toEqual({
      names: ['a', 'b'],
      meta: { title: 'T', description: 'D', concepts: ['x', 'y'], author: 'mnguyen', kit: 1 },
      errors: [],
    });
    expect(readWidgetSource('// rien')).toEqual({ names: [], meta: null, errors: [] });
  });

  it('refuse un meta calculé et un code illisible', () => {
    expect(readWidgetSource("const t = 'T'; OYMWidgets.define('a', { meta: { title: t, kit: 1 } });").errors)
      .toEqual(['meta.title doit être écrit en dur (texte, nombre ou liste).']);
    expect(readWidgetSource("OYMWidgets.define('a', { meta: { description: `x${1}` } });").errors).toHaveLength(1);
    expect(readWidgetSource("OYMWidgets.define('a', { meta: lire() });").errors).toEqual(['meta doit être un objet écrit en dur.']);
    expect(readWidgetSource('OYMWidgets.define(').errors[0]).toMatch(/^code illisible/);
  });

  it('vérifie les champs de meta', () => {
    const ok = { title: 'T', description: 'D', author: 'a', kit: 1 };
    expect(metaProblems(ok)).toEqual([]);
    expect(metaProblems(null)).toHaveLength(1);
    expect(metaProblems({ title: 'T' })).toEqual(['meta.description manque.', 'meta.author manque.', 'meta.kit manque.']);
    expect(metaProblems({ ...ok, kit: KIT_VERSION + 1 })[0]).toMatch(/^meta\.kit vaut/);
    expect(metaProblems({ ...ok, title: 'La dérivée \\(f\\)' })).toEqual(['meta.title doit être du texte simple, sans formule.']);
    expect(metaProblems({ ...ok, concepts: 'x', licence: 'MIT' })).toEqual(['meta.licence est inconnu.', 'meta.concepts doit être une liste de textes.']);
  });

  it('garde la version du kit et celle du contrôle égales', () => {
    const kit = fs.readFileSync(path.join(process.cwd(), 'src/lib/widgets/kit.js'), 'utf8');
    expect(kit).toContain(`const VERSION = ${KIT_VERSION};`);
  });
});

describe('code d’intégration', () => {
  it('donne une iframe à l’adresse publique, titrée par la légende', () => {
    expect(embedCode('https://openyourmath.org', 'ebva-directionnelle', 'Dérivée en 0')).toBe(
      '<iframe src="https://openyourmath.org/animation/ebva-directionnelle" title="Dérivée en 0" style="width:100%; height:700px; border:0"></iframe>'
    );
  });

  it('échappe la légende dans l’attribut', () => {
    expect(embedCode('https://x', 'a', 'f "x" < g & h')).toContain('title="f &quot;x&quot; &lt; g &amp; h"');
  });
});

describe('kit des figures', () => {
  it("n'emprunte au site que des couleurs qui existent encore dans app.css", () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app.css'), 'utf8').toLowerCase();
    const kit = fs.readFileSync(path.join(process.cwd(), 'src/lib/widgets/kit.css'), 'utf8').toLowerCase();
    for (const token of ['#3a8f8f', '#2b6b6b', '#f0fafa', '#b85d3f', '#964a32', '#fbf0eb', '#ead9b8', '#a3322f', '#0d3c4d']) {
      expect(kit, token).toContain(token);
      expect(css, token).toContain(token);
    }
  });

  it('ne charge rien du réseau', () => {
    // L'espace de noms SVG est une adresse, pas une requête.
    const kit = fs.readFileSync(path.join(process.cwd(), 'src/lib/widgets/kit.js'), 'utf8').replace("'http://www.w3.org/2000/svg'", '');
    expect(kit).not.toMatch(/https?:\/\/|fetch\(|XMLHttpRequest|import\(/);
  });
});

describe('checkAnimations', () => {
  const setup = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oym-anim-'));
    fs.mkdirSync(path.join(root, 'ex'));
    fs.mkdirSync(path.join(root, 'anim'));
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    fs.writeFileSync(path.join(root, 'authors.json'), JSON.stringify([{ pseudo: 'mnguyen' }]));
    return { exercisesRoot: path.join(root, 'ex'), animationsRoot: path.join(root, 'anim'), authorsPath: path.join(root, 'authors.json') };
  };
  const META = "meta: { title: 'T', description: 'D', author: 'mnguyen', kit: 1 }";
  const figure = (name) => `OYMWidgets.define('${name}', { ${META} });`;

  it('accepte une référence valide', async () => {
    const roots = setup({
      'ex/amscc/a.tex': '\\animation{ok}{Légende}\n\\animation[img/pdf/ok]{ok}{Légende}',
      'anim/amscc/ok.js': figure('ok'),
    });
    expect(await checkAnimations(roots)).toEqual([]);
  });

  it("signale une page absente, un nom invalide, une légende vide ou avec formule", async () => {
    const roots = setup({
      'ex/a.tex': '\\animation{absente}{L}\n\\animation{../x}{L}\n\\animation{ok}{}\n\\animation{ok}{Une $f$}',
      'anim/amscc/ok.js': figure('ok'),
    });
    const codes = (await checkAnimations(roots)).map((i) => i.code);
    expect(codes).toEqual(['missing-animation', 'invalid-name', 'missing-caption', 'formula-in-caption']);
  });

  it('signale un nom employé par deux sources et une page mal rangée', async () => {
    const roots = setup({
      'ex/a.tex': '\\animation{double}{L}\n\\animation{plat}{L}',
      'anim/amscc/double.js': figure('double'),
      'anim/exo7/double.js': figure('double'),
      'anim/plat.js': figure('plat'),
    });
    const issues = await checkAnimations(roots);
    expect(issues.map((i) => [i.code, i.name])).toEqual([
      ['unserved-animation', 'plat'],
      ['duplicate-animation', 'double'],
      ['missing-animation', 'plat'],
    ]);
  });

  it('signale une figure enregistrée sous un autre nom que son fichier', async () => {
    const roots = setup({
      'anim/amscc/a.js': figure('b'),
      'anim/amscc/c.js': '// pas de define',
    });
    const issues = await checkAnimations(roots);
    expect(issues.map((i) => [i.code, i.name])).toEqual([
      ['widget-name-mismatch', 'a'],
      ['widget-name-mismatch', 'c'],
      ['widget-meta', 'c'],
    ]);
  });

  it('signale des métadonnées incomplètes et un auteur inconnu', async () => {
    const roots = setup({
      'anim/amscc/a.js': "OYMWidgets.define('a', { meta: { title: 'T', author: 'inconnu', kit: 1 } });",
    });
    const issues = await checkAnimations(roots);
    expect(issues.map((i) => i.code)).toEqual(['widget-meta', 'unknown-author']);
    expect(issues[0].message).toContain('meta.description manque.');
  });

  it('accepte la figure ebva rangée dans sa source', async () => {
    const issues = await checkAnimations({
      exercisesRoot: path.join(process.cwd(), 'content/exercises/amscc'),
      animationsRoot: path.join(process.cwd(), 'content/animations'),
      authorsPath: path.join(process.cwd(), 'content/authors.json'),
    });
    expect(issues).toEqual([]);
  });

  it('ne se plaint pas quand le dossier des animations n’existe pas', async () => {
    const roots = setup({ 'ex/a.tex': 'Sans animation' });
    expect(await checkAnimations({ ...roots, animationsRoot: '/inexistant' })).toEqual([]);
  });
});
