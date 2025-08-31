// src/lib/metadata-mappings.js - Généré automatiquement
// ⚠️  Ce fichier est généré par scripts/analyze-chapters.mjs
// ✏️  Modifiez les mappings selon vos besoins puis relancez build-db.mjs

export const chapterMappings = {
  "Analyse numérique": { 
    domain: "Analyse numérique", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Application linéaire": { 
    domain: "Algèbre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Autre": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Calcul d'intégrales": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Continuité, limite et étude de fonctions réelles": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Courbes planes": { 
    domain: "Géométrie", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Dénombrement": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Dérivabilité des fonctions réelles": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Déterminant, système linéaire": { 
    domain: "Algèbre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Développement limité": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Equation différentielle": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Fonction convexe": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Fonction de plusieurs variables": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Interpolation polynomiale": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Matrice": { 
    domain: "Algèbre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Méthodes numériques": { 
    domain: "Analyse numérique", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Nombres complexes": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Optimisation": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Polynôme, fraction rationnelle": { 
    domain: "Algèbre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Probabilité continue": { 
    domain: "Probabilités", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Probabilité discrète": { 
    domain: "Probabilités", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Résolution d'équation différentielle": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Résolution de systèmes linéaires : méthode directe": { 
    domain: "Algèbre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Résolution de systèmes linéaires : méthode itérative": { 
    domain: "Algèbre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Statistique": { 
    domain: "Autre", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Suite": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Série de Fourier": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Série entière": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Série numérique": { 
    domain: "Analyse", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  },
  "Topologie": { 
    domain: "Géométrie", 
    level: "L2",
    // TODO: Vérifier et ajuster si nécessaire
  }
};

export const domainHierarchy = {
  "Algèbre": { 
    order: 1, 
    icon: "🔢", 
    color: "blue",
    description: "Structures algébriques, matrices, systèmes linéaires"
  },
  "Analyse": { 
    order: 2, 
    icon: "📈", 
    color: "green",
    description: "Fonctions, limites, dérivées, intégrales"
  },
  "Probabilités": { 
    order: 3, 
    icon: "🎲", 
    color: "purple",
    description: "Variables aléatoires, lois de probabilité"
  },
  "Géométrie": { 
    order: 4, 
    icon: "📐", 
    color: "orange",
    description: "Espaces vectoriels, courbes, surfaces"
  },
  "Analyse numérique": { 
    order: 5, 
    icon: "💻", 
    color: "red",
    description: "Méthodes numériques, algorithmes"
  }
};

export const levelHierarchy = {
  "L1": { order: 1, name: "Licence 1", color: "green", icon: "🟢" },
  "L2": { order: 2, name: "Licence 2", color: "blue", icon: "🔵" },
  "L3": { order: 3, name: "Licence 3", color: "purple", icon: "🟣" },
  "M1": { order: 4, name: "Master 1", color: "orange", icon: "🟠" },
  "M2": { order: 5, name: "Master 2", color: "red", icon: "🔴" }
};
