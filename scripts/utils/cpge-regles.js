// scripts/utils/cpge-regles.js
//
// Règles de niveau de l'étiquetage CPGE, appliquées sans appel au modèle
// (consolider-cpge.js) et respectées par la répartition (repartition-cpge.js).

/** Niveaux hors du périmètre des programmes de CPGE. */
export const NIVEAUX_HORS_PROGRAMME = new Set(['M1']);

// Chapitres de L3 dont l'objet même est hors du programme de toutes les
// filières : hors CPGE par règle, sauf avis contraire du relecteur. Les
// chapitres mixtes (compacité, connexité, groupe quotient…) restent jugés
// exercice par exercice.
export const CHAPITRES_L3_HORS_PROGRAMME = new Set([
  'Fonction holomorphe', 'Formule de Cauchy', 'Théorème des résidus', 'Singularité',
  'Sous-variété', "Difféomorphisme, théorème d'inversion locale et des fonctions implicites", 'Forme différentielle',
  'Sous-groupe distingué', 'Action de groupe', 'Théorème de Sylow', 'Extension de corps', "Extension d'anneau",
  'Espace topologique, espace métrique', 'Espace métrique complet, espace de Banach',
  "Théorème de Stone-Weirstrass, théorème d'Ascoli", 'Dualité, topologie faible', 'Espace L^p',
  'Espace de Hilbert, théorème de projection', 'Lemme de Fatou, convergence monotone', 'Tribu, fonction mesurable',
  'Mesure', 'Distributions', 'Tranformée de Laplace et de Fourier',
  'Géométrie projective', 'Géométrie et trigonométrie hyperbolique', 'Géométrie et trigonométrie sphérique'
]);

/** Vrai si l'exercice est hors CPGE par une règle de niveau ou de chapitre. */
export const horsProgrammeParRegle = (niveau, chapitre) =>
  NIVEAUX_HORS_PROGRAMME.has(niveau) || (niveau === 'L3' && CHAPITRES_L3_HORS_PROGRAMME.has(chapitre));
