// scripts/utils/cpge-preselection.js
// Présélection des candidats CPGE par similarité d'embeddings : le vecteur du
// résumé de l'exercice (exercise_embeddings, bge-m3) face au texte officiel de
// chaque groupe de sous-sections. Elle accélère l'étiquetage sans le borner :
// le modèle garde accès à tous les programmes.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/** Titre et contenus d'un groupe, tels qu'ils sont encodés. */
export function texteGroupe(group, index) {
  const titre = `${group.section ? `${group.section} › ` : ''}${group.titre}`;
  const lignes = [...new Set(group.noeuds.flatMap(id => (index.byId.get(id)?.contenus ?? [])
    .map(r => String(r.contenu ?? '').replace(/<br>/g, ' ').replace(/\s+/g, ' ').trim())))].filter(Boolean);
  return `${titre}\n${lignes.join('\n')}`.slice(0, 6000);
}

export function cosinus(a, b) {
  let s = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return s / Math.sqrt(na * nb);
}

/**
 * Vecteurs des groupes, indexés par leur premier nœud. Un cache, clé = empreinte
 * du texte encodé, évite de recalculer ce qui n'a pas changé.
 */
export async function embeddingsGroupes(groups, index, { embed, cacheFile }) {
  const cache = cacheFile && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const vecs = new Map();
  let nouveaux = 0;
  for (const group of groups) {
    const texte = texteGroupe(group, index);
    const cle = crypto.createHash('sha1').update(texte).digest('hex');
    if (!cache[cle]) {
      cache[cle] = Array.from(await embed(texte));
      nouveaux++;
    }
    vecs.set(group.noeuds[0], cache[cle]);
  }
  if (cacheFile && nouveaux) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
  }
  return vecs;
}

/** Les k groupes les plus proches d'un exercice, du plus proche au moins proche. */
export function plusProches(vecExercice, groups, vecs, k) {
  return groups
    .map(group => [group, cosinus(vecExercice, vecs.get(group.noeuds[0]))])
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([group]) => group);
}

/** Vecteur stocké en base (BLOB de float32). */
export function vecteurBlob(blob) {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}
