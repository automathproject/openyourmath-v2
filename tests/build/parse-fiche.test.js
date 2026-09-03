// tests/build/parse-fiche.test.js
// Lecture des fiches d'exercices exobase (scripts/utils/parse-fiche.js).
//
// Les cas couverts sont ceux que le corpus exo7 contient réellement : listes
// plates, sections simples, plages d'identifiants, hiérarchie profonde, titres
// portant du LaTeX, et titres portant à la fois des exercices et des
// sous-titres.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseFiche } from '../../scripts/utils/parse-fiche.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FICHES = path.join(ROOT, 'content/fiches/exo7');

const refs = fiche => fiche.items.map(item => item.ref);
const paths = fiche => fiche.items.map(item => item.path.join(' > '));

describe('parseFiche — en-tête', () => {
  it('lit identifiant, auteur et date, et normalise la date en ISO', () => {
    const fiche = parseFiche('\\fiche{f00012, bodin, 2007/09/01}\n\\titre{Fonctions continues}\n\\insertion{671}\n\\finfiche');
    expect(fiche.id).toBe('f00012');
    expect(fiche.author).toBe('bodin');
    expect(fiche.date).toBe('2007-09-01');
    expect(fiche.title).toBe('Fonctions continues');
    expect(fiche.warnings).toEqual([]);
  });

  it('signale une fiche tronquée sans rien inventer', () => {
    const fiche = parseFiche('\\titre{Sans en-tête}\n');
    expect(fiche.id).toBeNull();
    expect(fiche.warnings.join(' ')).toMatch(/\\fiche absent/);
    expect(fiche.warnings.join(' ')).toMatch(/aucune référence/);
    expect(fiche.warnings.join(' ')).toMatch(/finfiche absent/);
  });
});

describe('parseFiche — références', () => {
  it('accepte les listes séparées par des virgules', () => {
    const fiche = parseFiche('\\fiche{f1, a, 2020/01/01}\\titre{T}\\insertion{185, 199, 202}\\finfiche');
    expect(refs(fiche)).toEqual(['185', '199', '202']);
  });

  it('développe les plages, bornes comprises', () => {
    const fiche = parseFiche('\\fiche{f1, a, 2020/01/01}\\titre{T}\\insertion{2889-2893}\\finfiche');
    expect(refs(fiche)).toEqual(['2889', '2890', '2891', '2892', '2893']);
  });

  it('mêle plages et références isolées en conservant l’ordre', () => {
    const fiche = parseFiche('\\fiche{f1, a, 2020/01/01}\\titre{T}\\insertion{10, 20-22, 30}\\finfiche');
    expect(refs(fiche)).toEqual(['10', '20', '21', '22', '30']);
  });

  it('numérote les positions de façon continue à travers les sections', () => {
    const fiche = parseFiche(
      '\\fiche{f1, a, 2020/01/01}\\titre{T}\\section{A}\\insertion{1,2}\\section{B}\\insertion{3}\\finfiche');
    expect(fiche.items.map(item => item.position)).toEqual([0, 1, 2]);
  });

  it('ignore une référence illisible en le signalant', () => {
    const fiche = parseFiche('\\fiche{f1, a, 2020/01/01}\\titre{T}\\insertion{12, ??}\\finfiche');
    expect(refs(fiche)).toEqual(['12']);
    expect(fiche.warnings.join(' ')).toMatch(/illisible/);
  });
});

describe('parseFiche — structure', () => {
  it('laisse le chemin vide quand la fiche n’a aucune section', () => {
    const fiche = parseFiche('\\fiche{f1, a, 2020/01/01}\\titre{T}\\insertion{185, 199}\\finfiche');
    expect(paths(fiche)).toEqual(['', '']);
    expect(fiche.maxDepth).toBe(0);
  });

  it('rattache chaque exercice à sa section', () => {
    const fiche = parseFiche(
      '\\fiche{f1, a, 2020/01/01}\\titre{T}\\section{Pratique}\\insertion{1}\\section{Théorie}\\insertion{2}\\finfiche');
    expect(paths(fiche)).toEqual(['Pratique', 'Théorie']);
    expect(fiche.maxDepth).toBe(1);
  });

  it('empile part > section > subsection et dépile au bon niveau', () => {
    const fiche = parseFiche([
      '\\fiche{f1, a, 2020/01/01}\\titre{T}',
      '\\part{Algèbre}\\section{Groupes}\\subsection{Ordre}\\insertion{1}',
      '\\section{Anneaux}\\insertion{2}',
      '\\part{Analyse}\\insertion{3}',
      '\\finfiche'
    ].join('\n'));
    expect(paths(fiche)).toEqual(['Algèbre > Groupes > Ordre', 'Algèbre > Anneaux', 'Analyse']);
    expect(fiche.maxDepth).toBe(3);
  });

  it('représente un titre portant à la fois des exercices et des sous-titres', () => {
    const fiche = parseFiche([
      '\\fiche{f1, a, 2020/01/01}\\titre{T}',
      '\\section{Coniques}\\insertion{4900}',
      '\\subsection{Parabole}\\insertion{4903}',
      '\\finfiche'
    ].join('\n'));
    expect(paths(fiche)).toEqual(['Coniques', 'Coniques > Parabole']);
  });

  it('comble un niveau sauté sans décaler les titres suivants', () => {
    // Une \subsection sans \section au-dessus ne doit pas se faire passer
    // pour une section : le chemin garde sa profondeur réelle.
    const fiche = parseFiche(
      '\\fiche{f1, a, 2020/01/01}\\titre{T}\\part{P}\\subsection{S}\\insertion{1}\\finfiche');
    expect(fiche.items[0].path).toEqual(['P', 'S']);
  });
});

describe('parseFiche — LaTeX dans les titres', () => {
  it('conserve les mathématiques et les accents commandés', () => {
    const fiche = parseFiche([
      '\\fiche{f1, a, 2020/01/01}\\titre{T}',
      '\\section{Propriétés de $\\Nn$}\\insertion{1}',
      "\\section{\\'Equations linéaires}\\insertion{2}",
      '\\finfiche'
    ].join('\n'));
    expect(paths(fiche)).toEqual(['Propriétés de $\\Nn$', "\\'Equations linéaires"]);
  });

  it('équilibre les accolades imbriquées d’un titre', () => {
    const fiche = parseFiche(
      '\\fiche{f1, a, 2020/01/01}\\titre{T}\\section{Torseurs {\\bf (rappels)}}\\insertion{1}\\finfiche');
    expect(fiche.items[0].path).toEqual(['Torseurs {\\bf (rappels)}']);
  });

  it('tolère une accolade fermante en trop, comme dans fic00080', () => {
    const fiche = parseFiche(
      "\\fiche{f1, a, 2020/01/01}\\titre{T}\\part{Fonctions d'une variable}}\\insertion{1}\\finfiche");
    expect(fiche.items[0].path).toEqual(["Fonctions d'une variable"]);
  });
});

describe('parseFiche — texte libre', () => {
  it('retient l’introduction et écarte les macros de mise en page', () => {
    const fiche = parseFiche([
      '\\fiche{f1, a, 2020/01/01}\\titre{T}',
      'Recueillis aux oraux des concours.',
      '\\tableofcontents',
      '\\setcounter{exo}{2888}',
      '\\section{A}\\insertion{1}\\finfiche'
    ].join('\n'));
    expect(fiche.intro).toBe('Recueillis aux oraux des concours.');
    expect(fiche.intro).not.toMatch(/tableofcontents|setcounter|2888/);
  });

  it('rattache une note à la section qui la porte', () => {
    const fiche = parseFiche([
      '\\fiche{f1, a, 2020/01/01}\\titre{T}',
      '\\section{Dualité}',
      '$K$ désigne un corps de caractéristique nulle.',
      '\\insertion{3625}\\finfiche'
    ].join('\n'));
    expect(fiche.notes).toEqual([{ path: ['Dualité'], text: '$K$ désigne un corps de caractéristique nulle.' }]);
  });
});

describe('parseFiche — corpus exo7 importé', () => {
  const files = fs.existsSync(FICHES) ? fs.readdirSync(FICHES).filter(name => name.endsWith('.txt')).sort() : [];

  it('lit chaque fiche sans avertissement', () => {
    expect(files.length).toBeGreaterThan(0);
    const noisy = files
      .map(name => parseFiche(fs.readFileSync(path.join(FICHES, name), 'utf8'), name))
      .filter(fiche => fiche.warnings.length);
    expect(noisy.flatMap(fiche => fiche.warnings)).toEqual([]);
  });

  it('donne à chaque fiche un identifiant accordé à son nom de fichier', () => {
    for (const name of files) {
      const fiche = parseFiche(fs.readFileSync(path.join(FICHES, name), 'utf8'), name);
      expect(fiche.id).toBe(name.replace(/^fic/, 'f').replace(/\.txt$/, ''));
    }
  });

  it('restitue fic00012 tel que la source le décrit', () => {
    const fiche = parseFiche(fs.readFileSync(path.join(FICHES, 'fic00012.txt'), 'utf8'), 'fic00012.txt');
    expect(fiche.title).toBe('Fonctions continues');
    expect(refs(fiche)).toEqual(['671', '670', '677', '639', '645', '642', '646', '686', '680', '653', '776']);
    expect([...new Set(paths(fiche))]).toEqual(['Pratique', 'Théorie', 'Etude de fonctions']);
  });
});
