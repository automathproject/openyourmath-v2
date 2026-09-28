// Valide un fichier content/referentiels/cpge/programmes/*.md selon le format
// décrit dans content/referentiels/cpge/README.md.
// Usage : node scripts/quality/check-programmes-cpge.js [fichier.md ...]
// Sans argument, valide tous les fichiers de content/referentiels/cpge/programmes/.
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';

const PROGRAMMES_DIR = 'content/referentiels/cpge/programmes';

let failures = 0;

function checkFile(file) {
  const errors = [];
  const warnings = [];
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const prog = path.basename(file, '.md');

  // Front matter
  if (lines[0] !== '---') errors.push('front matter absent (ligne 1 ≠ ---)');
  const fmEnd = lines.indexOf('---', 1);
  const fm = lines.slice(1, fmEnd).join('\n');
  for (const key of ['programme', 'titre', 'filieres', 'annee', 'bo', 'nor', 'source', 'pages']) {
    if (!new RegExp(`^${key}:`, 'm').test(fm)) errors.push(`front matter : clé ${key} manquante`);
  }
  const m = fm.match(/^programme:\s*(\S+)/m);
  if (m && m[1] !== prog) errors.push(`programme: ${m[1]} ≠ nom de fichier ${prog}`);

  const ids = new Map();
  let h1 = 0;
  let currentSection = null;
  let inProgramme = false;
  let lastHeadingHasTable = true;
  let lastHeading = null;
  const stats = { sections: 0, subsections: 0, rows: 0, maths: 0 };

  const checkMath = (tex, display, ln) => {
    stats.maths++;
    try {
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: true,
        strict: 'ignore'
      });
    } catch (e) {
      errors.push(`L${ln}: KaTeX : ${e.message.split('\n')[0]} — ${tex.slice(0, 80)}`);
    }
  };

  let inDisplay = false;
  let displayBuf = [];
  let displayStart = 0;

  for (let i = fmEnd + 1; i < lines.length; i++) {
    const ln = i + 1;
    const line = lines[i];

    if (inDisplay) {
      if (line.trim() === '$$') {
        checkMath(displayBuf.join('\n'), true, displayStart);
        inDisplay = false;
      } else displayBuf.push(line);
      continue;
    }
    if (line.trim() === '$$') {
      inDisplay = true;
      displayBuf = [];
      displayStart = ln;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      if (level === 1) h1++;
      if (level === 2) inProgramme = !/pr[ée]ambule|objectifs de formation/i.test(text);
      const idm = text.match(/\{#([^}]+)\}\s*$/);
      if (inProgramme && (level === 3 || level === 4)) {
        if (lastHeading && !lastHeadingHasTable && lastHeading.level === 4)
          warnings.push(`L${lastHeading.ln}: sous-section sans tableau : ${lastHeading.text}`);
        const lettre = level === 4 && text.match(/^([a-z])\)/);
        const partie = level === 3 && /^[A-Z] [-–] /.test(text);
        if (!idm) {
          // Les titres intermédiaires (sans tableau propre) peuvent se passer
          // d'identifiant ; les sous-sections lettrées et les parties non.
          if (lettre || partie) errors.push(`L${ln}: titre de niveau ${level} sans identifiant : ${text}`);
          if (level === 3) currentSection = null;
        } else {
          const id = idm[1];
          if (ids.has(id)) errors.push(`L${ln}: identifiant dupliqué ${id} (déjà L${ids.get(id)})`);
          ids.set(id, ln);
          if (level === 3) {
            stats.sections++;
            currentSection = id;
            if (!new RegExp(`^${prog}\\.[a-z0-9]+(-[a-z0-9]+)*$`).test(id))
              errors.push(`L${ln}: identifiant de section invalide ${id}`);
          } else {
            stats.subsections++;
            if (!lettre) warnings.push(`L${ln}: sous-section sans lettre : ${text}`);
            else if (id !== `${currentSection}.${lettre[1]}`)
              errors.push(`L${ln}: identifiant ${id} ≠ attendu ${currentSection}.${lettre[1]}`);
          }
        }
        lastHeading = { level, text, ln, hasId: Boolean(idm) };
        lastHeadingHasTable = false;
      } else if (idm && !inProgramme) {
        warnings.push(`L${ln}: identifiant dans le préambule : ${text}`);
      }
      continue;
    }

    if (line.startsWith('|')) {
      if (!line.trimEnd().endsWith('|')) errors.push(`L${ln}: ligne de tableau non terminée par |`);
      // Les tableaux du préambule (compétences…) sont libres.
      if (!inProgramme) continue;
      if (!lastHeadingHasTable && lastHeading && !lastHeading.hasId)
        errors.push(`L${ln}: tableau sous un titre sans identifiant : ${lastHeading.text}`);
      lastHeadingHasTable = true;
      const cells = line.split('|').length - 2;
      if (cells !== 2) errors.push(`L${ln}: ${cells} cellules au lieu de 2 (| littéral ?) : ${line.slice(0, 100)}`);
      if (/^\|\s*-+\s*\|\s*-+\s*\|$/.test(line) || /^\|\s*Contenus\s*\|/.test(line)) continue;
      stats.rows++;
      if (line.includes('$$')) errors.push(`L${ln}: $$ interdit dans un tableau`);
    }

    // Maths en ligne
    const stripped = line.replace(/\\\$/g, '');
    const parts = stripped.split('$');
    if (parts.length % 2 === 0) errors.push(`L${ln}: nombre impair de $`);
    else for (let k = 1; k < parts.length; k += 2) checkMath(parts[k], false, ln);

    if (/©\s*Minist|enseignementsup-recherche\.gouv\.fr/.test(line)) errors.push(`L${ln}: pied de page résiduel`);
    if (/^\s*\d+\s*\/\s*\d+\s*$/.test(line)) errors.push(`L${ln}: numéro de page résiduel`);
    const cesure = line.replace(/\$[^$]*\$/g, '').match(/[a-zàâçéèêëîïôûùüÿœ]- [a-zàâçéèêëîïôûùüÿœ]/);
    if (cesure) warnings.push(`L${ln}: césure possible « ${cesure[0]} »`);
    if (/C ONTENUS|C APACITÉS/.test(line)) errors.push(`L${ln}: en-tête PDF résiduel`);
  }
  if (inDisplay) errors.push(`L${displayStart}: $$ non fermé`);
  if (h1 !== 1) errors.push(`${h1} titres de niveau 1 (attendu 1)`);

  console.log(`\n== ${file}`);
  console.log(
    `   sections: ${stats.sections}, sous-sections: ${stats.subsections}, lignes de tableau: ${stats.rows}, formules: ${stats.maths}`
  );
  for (const w of warnings) console.log(`   avert. ${w}`);
  for (const e of errors) console.log(`   ERREUR ${e}`);
  console.log(errors.length ? `   ✗ ${errors.length} erreur(s)` : '   ✓ aucune erreur');
  failures += errors.length;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  for (const f of fs.readdirSync(PROGRAMMES_DIR).sort())
    if (f.endsWith('.md')) files.push(path.join(PROGRAMMES_DIR, f));
}
for (const f of files) checkFile(f);
process.exit(failures ? 1 : 0);
