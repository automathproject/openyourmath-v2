// Intertitres d'une liste sectionnée (fiche, ou liste où l'on a ajouté une
// fiche) : quels titres afficher devant chaque exercice.

/** Chemin de sections d'une entrée : `sectionPath`, ou à défaut `section`. */
export function cheminExercice(exercice) {
  if (Array.isArray(exercice?.sectionPath) && exercice.sectionPath.length) return exercice.sectionPath;
  return exercice?.section ? [exercice.section] : [];
}

/**
 * Titres à afficher devant un exercice : ceux de son chemin qui diffèrent du
 * chemin de l'exercice précédent, à partir du premier niveau qui change.
 * `feuille` distingue le titre qui porte directement l'exercice de ses parents.
 * @returns {{ niveau: number, titre: string, feuille: boolean }[]}
 */
export function titresNouveaux(exercice, precedent) {
  const chemin = cheminExercice(exercice);
  const avant = precedent ? cheminExercice(precedent) : [];
  let niveau = 0;
  while (niveau < chemin.length && chemin[niveau] === avant[niveau]) niveau++;
  // Même chemin, ou chemin qui remonte à un parent déjà affiché : rien, sauf
  // si l'on sort d'une sous-section pour revenir au parent lui-même.
  if (niveau === chemin.length && !(avant.length > chemin.length && chemin.length > 0)) return [];
  if (niveau === chemin.length) niveau = chemin.length - 1;
  return chemin.slice(niveau).map((titre, i) => ({
    niveau: niveau + i,
    titre,
    feuille: niveau + i === chemin.length - 1
  }));
}
