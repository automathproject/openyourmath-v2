// src/lib/signalement/types.js
//
// Types de signalement proposés par le formulaire guidé de la page
// d'exercice. Chaque type dit quelles précisions demander (`champs`) et
// quelle étiquette poser sur le ticket. Partagé entre le formulaire et le
// serveur, qui valide et compose le ticket.

/**
 * Précisions possibles :
 * - partie   : bloc de l'exercice concerné (énoncé, question n, réponse n…) ;
 * - correction : ce qui est écrit / ce qu'il faudrait écrire ;
 * - classement : classement proposé (niveau, module, chapitre) ;
 * - cpge     : rattachements CPGE contestés et programme manquant ;
 * - doublon  : identifiant de l'autre exercice.
 */
export const TYPES_SIGNALEMENT = [
  {
    id: 'enonce',
    libelle: 'Erreur dans l’énoncé',
    aide: 'Énoncé faux, incomplet ou ambigu, hypothèse manquante.',
    etiquette: 'énoncé',
    champs: ['partie', 'correction']
  },
  {
    id: 'solution',
    libelle: 'Erreur dans la correction',
    aide: 'Calcul faux, résultat erroné, raisonnement incomplet dans une réponse ou une indication.',
    etiquette: 'correction',
    champs: ['partie', 'correction']
  },
  {
    id: 'coquille',
    libelle: 'Coquille ou rédaction',
    aide: 'Faute de frappe ou d’orthographe, notation incohérente, phrase maladroite.',
    etiquette: 'coquille',
    champs: ['partie', 'correction']
  },
  {
    id: 'affichage',
    libelle: 'Problème d’affichage',
    aide: 'Formule mal rendue, image manquante, mise en page cassée.',
    etiquette: 'affichage',
    champs: ['partie']
  },
  {
    id: 'classement',
    libelle: 'Mauvais classement',
    aide: 'Niveau, module ou chapitre qui ne correspond pas à l’exercice.',
    etiquette: 'classement',
    champs: ['classement']
  },
  {
    id: 'cpge',
    libelle: 'Rattachement aux programmes de CPGE',
    aide: 'Programme de prépa indiqué à tort, ou programme qui manque.',
    etiquette: 'cpge',
    champs: ['cpge']
  },
  {
    id: 'doublon',
    libelle: 'Doublon',
    aide: 'Le même exercice existe déjà sous un autre identifiant.',
    etiquette: 'doublon',
    champs: ['doublon']
  },
  {
    id: 'autre',
    libelle: 'Autre chose',
    aide: 'Tout ce qui n’entre pas dans les cas précédents.',
    etiquette: 'autre',
    champs: []
  }
];

export const TYPES_PAR_ID = Object.fromEntries(TYPES_SIGNALEMENT.map(t => [t.id, t]));

const NOMS_BLOCS = { question: 'Question', reponse: 'Réponse', indication: 'Indication' };

/**
 * Parties d'un exercice qu'on peut désigner dans un signalement :
 * l'énoncé introductif, puis chaque question avec sa réponse et ses
 * indications, numérotées comme à l'affichage.
 * @param {Array<{type?: string}>} contenu  blocs de l'exercice
 * @returns {Array<{id: string, libelle: string}>}
 */
export function partiesExercice(contenu = []) {
  const parties = [];
  let question = 0;
  let introduction = false;
  const compteurs = { reponse: 0, indication: 0 };
  for (const bloc of contenu) {
    const type = bloc?.type || 'text';
    if (type === 'text' || type === 'code') {
      if (question === 0 && !introduction) {
        introduction = true;
        parties.push({ id: 'enonce', libelle: 'Énoncé (introduction)' });
      }
    } else if (type === 'question') {
      question += 1;
      compteurs.reponse = 0;
      compteurs.indication = 0;
      parties.push({ id: `question-${question}`, libelle: `${NOMS_BLOCS.question} ${question}` });
    } else if (type === 'reponse' || type === 'indication') {
      compteurs[type] += 1;
      const n = question || 1;
      const suffixe = compteurs[type] > 1 ? ` (${compteurs[type]})` : '';
      const id = `${type}-${n}${compteurs[type] > 1 ? `-${compteurs[type]}` : ''}`;
      parties.push({ id, libelle: `${NOMS_BLOCS[type]} ${n}${suffixe}` });
    }
  }
  parties.push({ id: 'ensemble', libelle: 'Tout l’exercice' });
  return parties;
}

export const LIMITES = {
  message: { min: 10, max: 4000 },
  champ: 1000
};
