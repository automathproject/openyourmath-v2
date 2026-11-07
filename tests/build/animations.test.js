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
import { applyOymTheme, buildAnimationPage, findWidgetIntro, OYM_PALETTE } from '../../scripts/extract-animation.js';

describe('findAnimations', () => {
  it('lit le nom et la légende', () => {
    expect(findAnimations('Avant \\animation{ebva-directionnelle}{Dérivée en 0} après')).toEqual([
      { name: 'ebva-directionnelle', caption: 'Dérivée en 0', start: 6, end: 51 },
    ]);
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
      '/content/animations/amscc/ebva-directionnelle.html',
      '/content/animations/exo7/autre.html',
    ]);
    expect([...pages]).toEqual([
      ['ebva-directionnelle', '/content/animations/amscc/ebva-directionnelle.html'],
      ['autre', '/content/animations/exo7/autre.html'],
    ]);
    expect(duplicates.size).toBe(0);
  });

  it("n'attribue pas un nom présent dans deux sources", () => {
    const { pages, duplicates } = indexAnimationPages([
      '/content/animations/exo7/x.html',
      '/content/animations/amscc/x.html',
    ]);
    expect(pages.has('x')).toBe(false);
    expect(duplicates.get('x')).toEqual(['/content/animations/amscc/x.html', '/content/animations/exo7/x.html']);
  });

  it('ignore les pages hors de animations/<source>/ et les noms invalides', () => {
    const { pages } = indexAnimationPages([
      '/content/animations/plat.html',
      '/content/animations/amscc/sous/x.html',
      '/content/animations/amscc/x.y.html',
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
    expect(source).toContain('\\newcommand{\\animation}[2]');
    expect(source).toContain('\\url{https://openyourmath.org/animation/#1}');
    expect(source).toContain('\\usepackage{qrcode}');
    expect(source).toContain('\\qrcode[height=2cm]{https://openyourmath.org/animation/#1}');
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
  });
});

describe('page autonome extraite d’un diaporama', () => {
  it('retrouve le texte d’introduction de la figure', () => {
    const slide = '<section><div data-w="demo"><template><p>Intro</p></template></div></section>';
    expect(findWidgetIntro([slide], 'demo')).toBe('<template><p>Intro</p></template>');
    expect(findWidgetIntro(['<div data-w="demo"></div>'], 'demo')).toBe('');
    expect(findWidgetIntro(['<div data-w="autre"></div>'], 'demo')).toBe(null);
  });

  it("charge KaTeX depuis le site, jamais depuis un CDN, et signale sa hauteur", () => {
    const page = buildAnimationPage({
      title: 'Démo <1>', widget: 'demo', intro: '', css: 'body{}', kit: 'const kit=1;',
      widgets: 'W.demo=()=>{};', source: 'deck',
    });
    expect(page).toContain('<title>Démo &lt;1&gt;</title>');
    expect(page).toContain('/animation-vendor/katex/katex.min.js');
    expect(page).not.toMatch(/https?:\/\//);
    expect(page).toContain("parent.postMessage({oym:'animation-size'");
    expect(page).toContain("{left:'\\\\[',right:'\\\\]',display:true}");
  });
});

describe('charte graphique', () => {
  it("remplace la palette et la police des diaporamas par celles du site", () => {
    const themed = applyOymTheme(
      ':root{--teal:#087f81;--orange:#B96C23}body{font-family:"Noto Sans","Segoe UI",Arial,sans-serif}' +
        "const a=`rgba(8,127,129,${x})`,b='#142b3a';",
    );
    expect(themed).toContain('--teal:#3a8f8f');
    expect(themed).toContain('--orange:#b85d3f');
    expect(themed).toContain('font-family:"Source Sans Pro",sans-serif');
    expect(themed).toContain('rgba(58,143,143,${x})');
    expect(themed).toContain("'#0d3c4d'");
    expect(themed).not.toMatch(/087f81|b96c23|142b3a|Noto Sans/i);
  });

  it("n'emprunte au site que des jetons qui existent encore dans app.css", () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app.css'), 'utf8').toLowerCase();
    const tokens = ['#3a8f8f', '#f0fafa', '#b85d3f', '#fbf0eb', '#ead9b8', '#a3322f', '#0d3c4d'];
    for (const token of tokens) {
      expect(Object.values(OYM_PALETTE), token).toContain(token);
      expect(css, token).toContain(token);
    }
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
    return { exercisesRoot: path.join(root, 'ex'), animationsRoot: path.join(root, 'anim') };
  };

  it('accepte une référence valide', async () => {
    const roots = setup({ 'ex/amscc/a.tex': '\\animation{ok}{Légende}', 'anim/amscc/ok.html': '<html></html>' });
    expect(await checkAnimations(roots)).toEqual([]);
  });

  it("signale une page absente, un nom invalide, une légende vide ou avec formule", async () => {
    const roots = setup({
      'ex/a.tex': '\\animation{absente}{L}\n\\animation{../x}{L}\n\\animation{ok}{}\n\\animation{ok}{Une $f$}',
      'anim/amscc/ok.html': '<html></html>',
    });
    const codes = (await checkAnimations(roots)).map((i) => i.code);
    expect(codes).toEqual(['missing-animation', 'invalid-name', 'missing-caption', 'formula-in-caption']);
  });

  it('signale un nom employé par deux sources et une page mal rangée', async () => {
    const roots = setup({
      'ex/a.tex': '\\animation{double}{L}\n\\animation{plat}{L}',
      'anim/amscc/double.html': '<html></html>',
      'anim/exo7/double.html': '<html></html>',
      'anim/plat.html': '<html></html>',
    });
    const issues = await checkAnimations(roots);
    expect(issues.map((i) => [i.code, i.name])).toEqual([
      ['unserved-animation', 'plat'],
      ['duplicate-animation', 'double'],
      ['missing-animation', 'plat'],
    ]);
  });

  it('accepte la page ebva rangée dans sa source', async () => {
    const issues = await checkAnimations({
      exercisesRoot: path.join(process.cwd(), 'content/exercises/amscc'),
      animationsRoot: path.join(process.cwd(), 'content/animations'),
    });
    expect(issues).toEqual([]);
  });

  it('ne se plaint pas quand le dossier des animations n’existe pas', async () => {
    const roots = setup({ 'ex/a.tex': 'Sans animation' });
    expect(await checkAnimations({ ...roots, animationsRoot: '/inexistant' })).toEqual([]);
  });
});
