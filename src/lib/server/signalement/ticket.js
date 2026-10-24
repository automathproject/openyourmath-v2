// src/lib/server/signalement/ticket.js
//
// Validation d'un signalement envoyé par le formulaire, puis composition du
// ticket (titre, corps Markdown, étiquettes). Aucune dépendance au réseau ni
// à l'environnement : les fournisseurs (forge, GitHub) ne font que poster ce
// qui est composé ici.

import { LIMITES, TYPES_PAR_ID, partiesExercice } from '$lib/signalement/types.js';

const UUID = /^[A-Za-z0-9]{4}$/;

function texte(valeur, max = LIMITES.champ) {
  if (typeof valeur !== 'string') return '';
  return valeur.replace(/\r\n?/g, '\n').trim().slice(0, max);
}

/**
 * Vérifie un signalement reçu du formulaire, au regard de l'exercice.
 * @param {Record<string, unknown>} corps  corps JSON de la requête
 * @param {{ exercise: object, cpge: Array<{noeuds: Array<{id: string}>}> }} contexte
 * @returns {{ ok: true, signalement: object } | { ok: false, erreur: string }}
 */
export function validerSignalement(corps, { exercise, cpge = [] }) {
  if (!corps || typeof corps !== 'object') return { ok: false, erreur: 'Requête invalide.' };
  // Champ piège : invisible pour une personne, rempli par les robots.
  if (texte(corps.site)) return { ok: false, erreur: 'Requête invalide.' };

  const type = TYPES_PAR_ID[corps.type];
  if (!type) return { ok: false, erreur: 'Choisissez un type de signalement.' };

  const message = texte(corps.message, LIMITES.message.max);
  if (message.length < LIMITES.message.min) {
    return { ok: false, erreur: `Décrivez le problème en quelques mots (${LIMITES.message.min} caractères au moins).` };
  }

  const signalement = { type: type.id, message };

  if (type.champs.includes('partie')) {
    const parties = partiesExercice(exercise.content || []);
    const partie = parties.find(p => p.id === corps.partie);
    if (!partie) return { ok: false, erreur: 'Indiquez la partie de l’exercice concernée.' };
    signalement.partie = partie.libelle;
  }
  if (type.champs.includes('correction')) {
    signalement.ecrit = texte(corps.ecrit);
    signalement.attendu = texte(corps.attendu);
  }
  if (type.champs.includes('classement')) {
    signalement.classement = texte(corps.classement);
    if (!signalement.classement) return { ok: false, erreur: 'Indiquez le classement que vous proposez.' };
  }
  if (type.champs.includes('cpge')) {
    const connus = new Map(cpge.flatMap(p => p.noeuds.map(n => [n.id, { ...n, programme: p.titre || p.programme }])));
    const contestes = Array.isArray(corps.cpgeContestes) ? corps.cpgeContestes : [];
    signalement.cpgeContestes = [...new Set(contestes)].filter(id => connus.has(id)).map(id => connus.get(id));
    signalement.cpgeManquant = texte(corps.cpgeManquant);
    if (!signalement.cpgeContestes.length && !signalement.cpgeManquant) {
      return { ok: false, erreur: 'Cochez un rattachement à retirer ou indiquez le programme qui manque.' };
    }
  }
  if (type.champs.includes('doublon')) {
    const autre = texte(corps.doublon).replace(/^#/, '');
    if (!UUID.test(autre) || autre === exercise.uuid) {
      return { ok: false, erreur: 'Indiquez l’identifiant à 4 caractères de l’autre exercice.' };
    }
    signalement.doublon = autre;
  }
  return { ok: true, signalement };
}

/**
 * Neutralise un texte saisi avant de le citer dans un ticket : pas de
 * mention (@), de renvoi vers un autre ticket (#12), d'image distante ni de
 * HTML. Chaque ligne devient une ligne de citation.
 * @param {string} valeur
 */
export function citer(valeur) {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@/g, '@​')
    .replace(/#(?=\d)/g, '#​')
    .replace(/!\[/g, '!\\[')
    .split('\n')
    .map(ligne => `> ${ligne}`)
    .join('\n');
}

/**
 * Compose le ticket d'un signalement validé.
 * @param {object} p
 * @param {object} p.exercise   exercice (uuid, title, level, module, chapter, subchapter, source_path)
 * @param {object} p.signalement  sortie de validerSignalement
 * @param {{ login: string, nom?: string, profil: string, fournisseur: string }} p.auteur
 * @param {string} p.origine    origine du site, ex. https://openyourmath.org
 * @param {(chemin: string) => string} p.lienSource  URL du fichier dans le dépôt
 * @returns {{ titre: string, corps: string, etiquettes: string[] }}
 */
export function composerTicket({ exercise, signalement, auteur, origine, lienSource }) {
  const type = TYPES_PAR_ID[signalement.type];
  const titreExercice = (exercise.title || '').replace(/\s+/g, ' ').trim();
  const titre = `${exercise.uuid} · ${type.libelle}${titreExercice ? ` — ${titreExercice}` : ''}`.slice(0, 200);

  const chemin = exercise.source_path ? `content/exercises/${exercise.source_path}` : null;
  const classement = [exercise.level, exercise.module, exercise.chapter, exercise.subchapter].filter(Boolean).join(' › ');
  const lignes = [
    `**Exercice** : [${exercise.uuid}](${origine}/exercise/${exercise.uuid})${titreExercice ? ` — ${titreExercice.replace(/[[\]]/g, '')}` : ''}`,
    chemin ? `**Source** : [\`${chemin}\`](${lienSource(chemin)})` : null,
    classement ? `**Classement actuel** : ${classement}` : null,
    `**Type** : ${type.libelle}`,
    signalement.partie ? `**Partie concernée** : ${signalement.partie}` : null
  ].filter(Boolean);

  const sections = [lignes.join('  \n')];
  if (signalement.ecrit) sections.push(`### Ce qui est écrit\n\n${citer(signalement.ecrit)}`);
  if (signalement.attendu) sections.push(`### Ce qu’il faudrait écrire\n\n${citer(signalement.attendu)}`);
  if (signalement.classement) sections.push(`### Classement proposé\n\n${citer(signalement.classement)}`);
  if (signalement.cpgeContestes?.length) {
    const liste = signalement.cpgeContestes
      .map(n => `- \`${n.id}\` — ${n.programme} : ${n.section && n.section !== n.titre ? `${n.section} › ` : ''}${n.titre}`)
      .join('\n');
    sections.push(`### Rattachements CPGE à retirer\n\n${liste}`);
  }
  if (signalement.cpgeManquant) sections.push(`### Programme de CPGE manquant\n\n${citer(signalement.cpgeManquant)}`);
  if (signalement.doublon) {
    sections.push(`### Doublon de\n\n[${signalement.doublon}](${origine}/exercise/${signalement.doublon})`);
  }
  sections.push(`### Message\n\n${citer(signalement.message)}`);

  const compte = auteur.fournisseur === 'forge' ? 'compte de la forge des communs numériques éducatifs' : 'compte GitHub';
  const nom = auteur.nom && auteur.nom !== auteur.login ? ` (${auteur.nom.replace(/[[\]()@]/g, '')})` : '';
  sections.push(`---\nSignalé depuis ${origine} par [${auteur.login}](${auteur.profil})${nom}, ${compte} vérifié.`);

  return {
    titre,
    corps: sections.join('\n\n'),
    etiquettes: ['signalement', type.etiquette]
  };
}
