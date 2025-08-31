// scripts/analyze-chapters.mjs - Script pour analyser tous les chapitres existants
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.resolve('data/exercises.sqlite');

/**
 * Analyse complète de la structure des chapitres dans la base
 */
async function analyzeChapters() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    
    console.log('📊 Analyse de la structure des chapitres...\n');
    
    // 1. Structure hiérarchique complète
    const hierarchy = db.prepare(`
      SELECT 
        chapter,
        subchapter,
        COUNT(*) as exerciseCount,
        GROUP_CONCAT(DISTINCT theme) as themes,
        GROUP_CONCAT(DISTINCT author) as authors,
        MIN(difficulty) as minDifficulty,
        MAX(difficulty) as maxDifficulty,
        AVG(difficulty) as avgDifficulty
      FROM exercises 
      WHERE chapter IS NOT NULL 
      GROUP BY chapter, subchapter
      ORDER BY chapter, subchapter
    `).all();
    
    // 2. Organiser par chapitre principal
    const chapterMap = new Map();
    
    hierarchy.forEach(row => {
      if (!chapterMap.has(row.chapter)) {
        chapterMap.set(row.chapter, {
          name: row.chapter,
          totalExercises: 0,
          subchapters: [],
          themes: new Set(),
          authors: new Set(),
          difficulties: { min: 5, max: 1, avg: 0 }
        });
      }
      
      const chapter = chapterMap.get(row.chapter);
      chapter.totalExercises += row.exerciseCount;
      
      // Ajouter thèmes et auteurs
      if (row.themes) {
        row.themes.split(',').forEach(theme => chapter.themes.add(theme.trim()));
      }
      if (row.authors) {
        row.authors.split(',').forEach(author => chapter.authors.add(author.trim()));
      }
      
      // Statistiques de difficulté
      if (row.minDifficulty && row.minDifficulty < chapter.difficulties.min) {
        chapter.difficulties.min = row.minDifficulty;
      }
      if (row.maxDifficulty && row.maxDifficulty > chapter.difficulties.max) {
        chapter.difficulties.max = row.maxDifficulty;
      }
      
      // Ajouter le sous-chapitre s'il existe
      if (row.subchapter) {
        chapter.subchapters.push({
          name: row.subchapter,
          exerciseCount: row.exerciseCount,
          themes: row.themes ? row.themes.split(',').map(t => t.trim()) : [],
          avgDifficulty: row.avgDifficulty ? Math.round(row.avgDifficulty * 10) / 10 : null
        });
      }
    });
    
    // 3. Affichage formaté
    console.log('📚 STRUCTURE HIÉRARCHIQUE DES CHAPITRES\n');
    console.log('=' .repeat(60));
    
    Array.from(chapterMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([chapterName, data]) => {
        console.log(`\n📖 ${chapterName.toUpperCase()}`);
        console.log(`   📊 ${data.totalExercises} exercices au total`);
        console.log(`   🎯 Difficulté: ${data.difficulties.min}-${data.difficulties.max}`);
        console.log(`   🏷️  Thèmes: ${Array.from(data.themes).slice(0, 3).join(', ')}${data.themes.size > 3 ? '...' : ''}`);
        console.log(`   👥 Auteurs: ${data.authors.size} différents`);
        
        if (data.subchapters.length > 0) {
          console.log(`   📂 Sous-chapitres (${data.subchapters.length}) :`);
          data.subchapters.forEach(sub => {
            console.log(`      ├─ ${sub.name} (${sub.exerciseCount} ex.)`);
          });
        }
        console.log('   ' + '-'.repeat(50));
      });
    
    // 4. Suggestions de domaines basées sur l'analyse
    console.log('\n\n🧠 SUGGESTIONS DE DOMAINES\n');
    console.log('=' .repeat(60));
    
    const domainSuggestions = generateDomainSuggestions(chapterMap);
    
    Object.entries(domainSuggestions).forEach(([domain, chapters]) => {
      console.log(`\n🎯 ${domain.toUpperCase()}`);
      chapters.forEach(chapter => {
        console.log(`   ├─ ${chapter.name} (${chapter.exerciseCount} ex.)`);
      });
    });
    
    // 5. Générer le fichier de mapping
    await generateMappingFile(chapterMap, domainSuggestions);
    
    // 6. Statistiques globales
    const totalChapters = chapterMap.size;
    const totalSubchapters = Array.from(chapterMap.values()).reduce((sum, ch) => sum + ch.subchapters.length, 0);
    const totalExercises = Array.from(chapterMap.values()).reduce((sum, ch) => sum + ch.totalExercises, 0);
    
    console.log('\n\n📈 STATISTIQUES GLOBALES\n');
    console.log('=' .repeat(60));
    console.log(`📚 ${totalChapters} chapitres principaux`);
    console.log(`📂 ${totalSubchapters} sous-chapitres`);
    console.log(`📝 ${totalExercises} exercices au total`);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  } finally {
    if (db) db.close();
  }
}

/**
 * Génère des suggestions de domaines basées sur les noms de chapitres
 */
function generateDomainSuggestions(chapterMap) {
  const suggestions = {
    "Algèbre": [],
    "Analyse": [],
    "Probabilités": [],
    "Géométrie": [],
    "Analyse numérique": [],
    "Autre": []
  };
  
  // Mots-clés pour classification automatique
  const keywords = {
    "Algèbre": ["matrice", "déterminant", "système", "linéaire", "polynôme", "fraction", "groupe", "anneau"],
    "Analyse": ["dérivabilité", "continuité", "limite", "intégrale", "fonction", "suite", "série"],
    "Probabilités": ["probabilité", "variable aléatoire", "loi", "espérance", "variance"],
    "Géométrie": ["courbe", "surface", "espace", "vectoriel", "métrique", "topologie"],
    "Analyse numérique": ["numérique", "algorithme", "méthode", "itératif", "approximation"]
  };
  
  chapterMap.forEach((data, chapterName) => {
    const chapterLower = chapterName.toLowerCase();
    let classified = false;
    
    // Tenter de classifier par mots-clés
    for (const [domain, domainKeywords] of Object.entries(keywords)) {
      if (domainKeywords.some(keyword => chapterLower.includes(keyword))) {
        suggestions[domain].push({
          name: chapterName,
          exerciseCount: data.totalExercises,
          confidence: "auto"
        });
        classified = true;
        break;
      }
    }
    
    // Si pas classifié, mettre dans "Autre"
    if (!classified) {
      suggestions["Autre"].push({
        name: chapterName,
        exerciseCount: data.totalExercises,
        confidence: "manual"
      });
    }
  });
  
  return suggestions;
}

/**
 * Génère le fichier de mapping à utiliser dans l'application
 */
async function generateMappingFile(chapterMap, domainSuggestions) {
  const mappingContent = `// src/lib/metadata-mappings.js - Généré automatiquement
// ⚠️  Ce fichier est généré par scripts/analyze-chapters.mjs
// ✏️  Modifiez les mappings selon vos besoins puis relancez build-db.mjs

export const chapterMappings = {
${Array.from(chapterMap.keys()).map(chapter => {
  // Deviner le domaine et niveau pour chaque chapitre
  let domain = "Autre";
  let level = "L2"; // Par défaut
  
  // Trouver dans quel domaine suggéré il se trouve
  for (const [domainName, chapters] of Object.entries(domainSuggestions)) {
    if (chapters.some(ch => ch.name === chapter)) {
      domain = domainName;
      break;
    }
  }
  
  // Inférer le niveau basé sur des mots-clés
  const chapterLower = chapter.toLowerCase();
  if (chapterLower.includes('base') || chapterLower.includes('introduction')) {
    level = "L1";
  } else if (chapterLower.includes('avancé') || chapterLower.includes('théorie')) {
    level = "L3";
  }
  
  return `  "${chapter}": { 
    domain: "${domain}", 
    level: "${level}",
    // TODO: Vérifier et ajuster si nécessaire
  }`;
}).join(',\n')}
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
`;

  try {
    await fs.promises.writeFile('src/lib/metadata-mappings.js', mappingContent);
    console.log('\n✅ Fichier de mapping généré : src/lib/metadata-mappings.js');
    console.log('👀 Vérifiez et ajustez les mappings avant de rebuilder la DB');
  } catch (error) {
    console.error('❌ Erreur lors de la génération du fichier:', error);
  }
}

// Lancer l'analyse
analyzeChapters();